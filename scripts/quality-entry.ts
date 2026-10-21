// @ts-nocheck
import assert from "node:assert/strict";
import { MusicSession, parseMusicTracks, isExternalPath, isMusicSharePage, resolveMusicSource, scanMusicFolder } from "../src/services/music-playback";
import { SnapshotBuilder } from "../src/services/snapshot-builder";
import { parseTasks, TaskContentIndex } from "../src/services/task-index";
import { markTaskComplete } from "../src/widgets/tasks";
import { advancePomodoro } from "../src/services/pomodoro-clock";
import { reconcilePomodoroState, localDateKey } from "../src/widgets/widget-api";
import { musicPlayerWidget } from "../src/widgets/music-player";
import { pomodoroWidget } from "../src/widgets/pomodoro";
import { TimeAggregation } from "../src/services/time/TimeAggregation";
import { PersistenceQueue } from "../src/services/persistence";
import { createWidgetRegistry } from "../src/widgets/registry";
import { TimeLogListModal } from "../src/services/time/TimeLogListModal";
const HomePulse = require("../src/main");
const { Element } = globalThis.__quality;

let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function descendants(root) { return [root, ...root.children.flatMap(descendants)]; }

async function run() {
  for (const newline of ["\n", "\r\n"]) {
    const content = ["Heading", "", "- [ ] actual", "```md", "- [ ] example", "```", "  - [X] done", "~~~", "- [ ] example2", "~~~"].join(newline);
    const tasks = parseTasks(content);
    check(tasks.length === 2 && tasks[0].line === 3 && tasks[1].checked, "task line position / code-fence exclusions");
    check(markTaskComplete(content, tasks[0]) === content.replace("[ ] actual", "[x] actual"), "task write preserves all other text and line endings");
  }
  check(markTaskComplete("- [ ] same\nchanged\n- [ ] same", { line: 2, source: "- [ ] same" }) === null, "ambiguous tasks never modify another occurrence");
  check(markTaskComplete("```\n- [ ] old\n```", { line: 2, source: "- [ ] old" }) === null, "stale task moved into code fence cannot be completed");
  check(markTaskComplete("inserted\n- [ ] moved", { line: 1, source: "- [ ] moved" }) === "inserted\n- [x] moved", "unique task follows inserted lines");

  const duplicateContent = "- [ ] repeat\n- [ ] repeat";
  const duplicates = parseTasks(duplicateContent);
  check(markTaskComplete(duplicateContent, duplicates[1]) === "- [ ] repeat\n- [x] repeat", "unchanged duplicate tasks complete the exact selected occurrence");
  check(markTaskComplete("changed\n- [ ] repeat", duplicates[1]) === null, "stale duplicate never falls back to the remaining occurrence");
  const index = new TaskContentIndex();
  const file = { path: "note.md", stat: { mtime: 1, size: 1 } };
  let reads = 0;
  const read = async () => { reads++; return "- [ ] task"; };
  await Promise.all([index.read(file, read), index.read(file, read)]);
  await index.read(file, read);
  check(reads === 1, "concurrent snapshots share unchanged content reads");
  index.invalidate(file.path); await index.read(file, read);
  check(reads === 2, "explicit invalidation rereads only the changed file");
  await assert.rejects(index.read({ ...file, path: "error.md" }, async () => { throw Error("read failure"); }));
  check((await index.read({ ...file, path: "error.md" }, read)).length === 1, "failed reads can be retried");
  let active = 0, maximum = 0;
  await Promise.all(Array.from({ length: 30 }, (_, n) => index.read({ ...file, path: `${n}.md` }, async () => {
    maximum = Math.max(maximum, ++active); await new Promise((resolve) => setTimeout(resolve, 1)); active--; return "";
  })));
  check(maximum <= 8, "initial indexing bounds concurrent reads");

  const now = new Date(2026, 9, 21, 1).getTime();
  const target = { type: "quick", id: "focus", title: "Focus" };
  const state = { status: "running", remainingSeconds: 60, phaseStartedAt: now - 70000,
    todayCountDate: localDateKey(new Date(now)), todayCount: 0, activeTarget: target, sessionId: "one" };
  const config = { workMinutes: 1, breakMinutes: 1 };
  const transition = advancePomodoro(state, config, now);
  check(transition.state.status === "break" && transition.state.remainingSeconds === 60 && transition.state.phaseStartedAt === now - 10000, "break starts at actual deadline");
  check(transition.log.endTime === now - 10000 && transition.log.duration === 1, "late processing logs actual completion time");
  check(advancePomodoro(state, config, now).log.id === transition.log.id, "completion log has stable id across retries");
  const slept = advancePomodoro(state, config, now + 120000);
  check(slept.state.status === "idle" && slept.state.remainingSeconds === 60 && slept.completed.length === 2, "sleep across both phases returns to ready without negative timer");
  const yesterday = { ...state, phaseStartedAt: new Date(2026, 9, 20, 23, 58).getTime(), remainingSeconds: 60 };
  check(advancePomodoro(yesterday, config, now).state.todayCount === 0, "yesterday completion is not counted as today");
  const paused = { ...state, status: "paused", pausedPhase: "break", remainingSeconds: 40, phaseStartedAt: 0 };
  check(advancePomodoro(paused, config, now).state.status === "paused", "background clock leaves paused phase intact");

  // Exercise real widget handlers, including reloaded paused state.
  let current = paused;
  const root = new Element();
  const api = { language: "en", widgetData: { config }, settings: {}, getState: () => current, getConfig: () => config,
    getTimeSummary: () => ({ totalDuration: 0 }), rememberInterval() {}, saveState: async (patch) => { current = { ...current, ...patch }; } };
  await pomodoroWidget.render(root, api);
  const start = descendants(root).find((el) => el.icon === "play");
  await start.click();
  check(current.status === "break" && current.remainingSeconds === 40, "resume handler preserves break");
  await start.click();
  check(current.status === "paused" && current.pausedPhase === "break", "pause handler preserves break");
  check(descendants(root).filter((el) => el.tag === "button").every((el) => el.attributes["aria-label"]), "all timer icon controls have accessible names");

  const log = { id: "cross", source: "manual", targetType: "quick", targetId: "x", createdAt: now,
    startTime: new Date(2026, 9, 20, 23, 30).getTime(), endTime: new Date(2026, 9, 21, 0, 30).getTime(), duration: 60 };
  const summary = new TimeAggregation([log]).summarize("today", new Date(now));
  check(summary.totalDuration === 30 && summary.byQuick[0].duration === 30, "today total and buckets clip at midnight");
  const boundary = { ...log, endTime: new Date(2026, 9, 21).getTime() };
  check(new TimeAggregation([boundary]).summarize("today", new Date(now)).count === 0, "zero intersection excluded");
  const monday = new Date(2026, 9, 19, 1);
  const weekLog = { ...log, startTime: new Date(2026, 9, 18, 23, 30).getTime(), endTime: new Date(2026, 9, 19, 0, 30).getTime() };
  check(new TimeAggregation([weekLog]).summarize("week", monday).totalDuration === 30, "week boundary clipped");
  const monthLog = { ...log, startTime: new Date(2026, 8, 30, 23, 30).getTime(), endTime: new Date(2026, 9, 1, 0, 30).getTime() };
  check(new TimeAggregation([monthLog]).summarize("month", new Date(2026, 9, 1, 1)).totalDuration === 30, "month boundary clipped");

  let fail = true;
  const writes = [];
  const queue = new PersistenceQueue({ count: 0 }, async (data) => { if (fail) { fail = false; throw Error("disk full"); } writes.push(data.count); });
  await assert.rejects(queue.save({ count: 1 }));
  check(queue.committed.count === 0, "failed save does not replace recovery point");
  const mutable = { count: 2 }; const first = queue.save(mutable); mutable.count = 99;
  await Promise.all([first, queue.save({ count: 3 })]);
  check(writes.join() === "2,3" && queue.committed.count === 3, "writes serialize immutable snapshots and recover after failure");

  const plugin = new HomePulse();
  plugin.registry = createWidgetRegistry(plugin);
  const base = plugin.normalizeData({ initialized: true, layout: { columns: 2, widgets: [{ id: "timer", type: "pomodoro", x: 0, y: 0, sizePreset: "W1H2" }] }, widgets: { timer: { config, state: { ...state, phaseStartedAt: Date.now() - 70000, todayCountDate: localDateKey(new Date()) } } }, timeLogs: [] });
  plugin.data = structuredClone(base); plugin.unloaded = false; plugin.clockBusy = false; plugin.scheduleRefresh = () => {};
  plugin.refreshOpenViews = () => {};
  plugin.persistence = new PersistenceQueue(base, async () => {});
  await plugin.tickPomodoro(); await plugin.tickPomodoro();
  check(plugin.data.timeLogs.length === 1 && plugin.data.widgets.timer.state.status === "break", "plugin clock runs without a homepage view, with no duplicate log");
  // Saving failure restores original state, then the same completion succeeds once.
  plugin.data = structuredClone(base); let rejected = true;
  plugin.persistence = new PersistenceQueue(base, async () => { if (rejected) { rejected = false; throw Error("disk full"); } });
  await plugin.tickPomodoro();
  check(plugin.data.widgets.timer.state.status === "running" && plugin.data.timeLogs.length === 0, "failed timer save rolls back both state and log");
  await plugin.tickPomodoro();
  check(plugin.data.widgets.timer.state.status === "break" && plugin.data.timeLogs.length === 1, "failed timer save retries without losing completion");

  // Components are removed outright and can be added again, without a deletion history.
  plugin.data = plugin.normalizeData({ ...base, layout: { columns: 2, widgets: [{ id: "task", type: "tasks", x: 0, y: 0, sizePreset: "W1H2" }] },
    widgets: { task: { config: {}, state: {} } } });
  plugin.persistence = new PersistenceQueue(plugin.data, async () => {});
  await plugin.removeWidget("task");
  check(!plugin.data.widgets.task && !plugin.data.layout.widgets.some((item) => item.id === "task"), "component removal clears the slot");
  check(!("removedWidgets" in plugin.data), "component removal does not keep deletion history");
  await plugin.addWidget("tasks");
  check(plugin.data.layout.widgets.some((item) => item.type === "tasks"), "removed component can be added afresh");

  plugin.data.timeLogs = [log];
  const cancelledDelete = plugin.deleteTimeLog(log.id);
  globalThis.__quality.modals.at(-1).close();
  check(!await cancelledDelete && plugin.data.timeLogs.length === 1, "cancelled deletion preserves time record");
  const confirmedDelete = plugin.deleteTimeLog(log.id);
  await descendants(globalThis.__quality.modals.at(-1).contentEl).find((el) => el.cls === "mod-warning").click();
  check(await confirmedDelete && plugin.data.timeLogs.length === 0, "confirmed deletion removes the time record");

  let noteContent = "Heading\n\n- [ ] actual\n```\n- [ ] example\n```";
  const taskFile = { path: "Projects/Project_one.md", basename: "Project_one", stat: { mtime: 1, size: noteContent.length, ctime: Date.now() } };
  const taskApp = { vault: { getMarkdownFiles: () => [taskFile], cachedRead: async () => noteContent, getAbstractFileByPath: () => null },
    metadataCache: { getFileCache: () => ({ frontmatter: {} }) } };
  plugin.app = taskApp; plugin.taskContentIndex = new TaskContentIndex();
  const beforeTask = await new SnapshotBuilder(taskApp, plugin).load();
  check(beforeTask.openTaskCount === 1 && beforeTask.taskIndex[0].line === 3, "real snapshot excludes code example and preserves task source line");
  noteContent = markTaskComplete(noteContent, beforeTask.taskIndex[0]);
  plugin.taskContentIndex.invalidate(taskFile.path);
  const afterTask = await new SnapshotBuilder(taskApp, plugin).load();
  check(afterTask.openTaskCount === 0 && afterTask.doneTaskCount === 1, "task completion updates dependent snapshot counts");
  plugin.taskContentIndex.invalidate(taskFile.path);
  taskApp.vault.cachedRead = async () => { throw Error("read denied"); };
  await assert.rejects(new SnapshotBuilder(taskApp, plugin).load());
  checks++;

  const records = Array.from({ length: 45 }, (_, n) => ({ ...log, id: String(n), startTime: log.startTime - n * 86400000, endTime: log.endTime - n * 86400000 }));
  const modal = new TimeLogListModal({}, () => records, async () => false, "en");
  modal.onOpen();
  check(descendants(modal.contentEl).filter((el) => el.cls === "yh-time-log-row").length === 20, "history first page");
  const next = descendants(modal.contentEl).find((el) => el.tag === "button" && el.textContent === "Next"); await next.click();
  check(modal.page === 1, "history can access entries beyond first twenty");
  modal.page = 2; modal.render();
  check(descendants(modal.contentEl).filter((el) => el.cls === "yh-time-log-row").length === 5, "history last page");
  modal.fromDate = "2026-10-21"; modal.toDate = "2026-10-21"; modal.page = 0; modal.render();
  check(descendants(modal.contentEl).filter((el) => el.cls === "yh-time-log-row").length === 1, "history date filter includes overlapping midnight record");
  // Music logic uses an audio transport double; no actual user music is opened.
  const musicTracks = parseMusicTracks("Rain | D:\\Music\\rain.mp3\nPiano | Music/piano.mp3\nhttps://example.com/song.mp3");
  check(musicTracks.length === 3 && musicTracks[0].source === "D:\\Music\\rain.mp3", "playlist preserves external Windows paths");
  check(isExternalPath("D:\\Music\\rain.mp3") && isExternalPath("/Users/test/song.mp3") && isExternalPath("\\\\server\\music\\song.mp3"), "Windows, macOS and network paths recognized");
  check(isMusicSharePage("https://music.163.com/#/song?id=1") && isMusicSharePage("https://y.qq.com/n/ryqq/playlist/1"), "music sharing pages are distinguished from playable audio URLs");
  await assert.rejects(resolveMusicSource({}, "https://y.qq.com/n/ryqq/song/1"), /share/); checks++;
  const sourceApp = { vault: { getAbstractFileByPath: (path) => path === "Music/a.mp3" ? { path } : null, getResourcePath: (file) => `app://audio/${file.path}` } };
  check((await resolveMusicSource(sourceApp, "Music/a.mp3")).url === "app://audio/Music/a.mp3", "vault resource path resolved through host API");
  await assert.rejects(resolveMusicSource(sourceApp, "Music/missing.mp3"), /missing/); checks++;
  await assert.rejects(resolveMusicSource(sourceApp, "../private.mp3"), /format/); checks++;
  await assert.rejects(resolveMusicSource(sourceApp, "javascript:alert(1)"), /format/); checks++;
  class AudioDouble {
    paused = true; duration = 120; currentTime = 0; volume = 0.7; src = ""; handlers = new Map();
    addEventListener(event, fn) { const set = this.handlers.get(event) || new Set(); set.add(fn); this.handlers.set(event, set); }
    removeEventListener(event, fn) { this.handlers.get(event)?.delete(fn); }
    emit(event) { for (const fn of this.handlers.get(event) || []) fn(); }
    pause() { this.paused = true; this.emit("pause"); }
    async play() { this.paused = false; this.emit("play"); }
    load() { this.currentTime = 0; }
    removeAttribute(name) { if (name === "src") this.src = ""; }
  }
  const fs = require("node:fs"); const os = require("node:os"); const path = require("node:path");
  const musicTestDir = fs.mkdtempSync(path.join(os.tmpdir(), "homepulse-audio-test-"));
  const musicTestFile = path.join(musicTestDir, "tone.wav");
  try {
    const wav = Buffer.alloc(44 + 1600);
    wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVE", 8); wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write("data", 36); wav.writeUInt32LE(1600, 40); fs.writeFileSync(musicTestFile, wav);
    const resource = await resolveMusicSource({}, musicTestFile);
    const resolved = Buffer.from(await (await fetch(resource.url)).arrayBuffer());
    check(resolved.equals(wav), "external file outside vault resolves into the original audio bytes");
    resource.release();
    const scanned = await scanMusicFolder(musicTestDir);
    check(scanned.length === 1 && scanned[0].source === musicTestFile, "computer folder generates an audio playlist");
    await assert.rejects(resolveMusicSource({}, path.join(musicTestDir, "missing.wav")), /missing/); checks++;
  } finally { if (fs.existsSync(musicTestFile)) fs.unlinkSync(musicTestFile); fs.rmdirSync(musicTestDir); }
  const audio = new AudioDouble(); let released = 0;
  const music = new MusicSession(audio, async (source) => { if (source === "missing") throw Error("missing"); return { url: source, release: () => released++ }; });
  music.configure(musicTracks, 0.5);
  check(audio.volume === 0.5 && audio.paused, "music does not autoplay when configured");
  await music.toggle(); check(!audio.paused && audio.src === musicTracks[0].source, "music plays selected external source via resolver");
  audio.currentTime = 40; music.configure(musicTracks, 0.5);
  check(!audio.paused && audio.currentTime === 40, "same configuration preserves playback across view refresh");
  await music.select(1); check(!audio.paused && music.index === 1 && released === 1, "next track preserves playing state and releases previous resource");
  await music.toggle(); check(audio.paused, "play control pauses audio");
  music.seek(999); check(audio.currentTime === 120, "seek is clamped to duration");
  music.configure([{ title: "Missing", source: "missing" }]); await music.toggle();
  check(music.error === "missing" && audio.paused, "missing file gives a recoverable error");
  music.configure(musicTracks); await music.select(2, true); audio.emit("ended");
  await new Promise((resolve) => setTimeout(resolve, 0));
  check(music.index === 0 && !audio.paused, "playlist loops after last track");
  music.configure([]); check(audio.paused && !audio.src, "clearing playlist stops old audio");
  music.dispose(); check([...audio.handlers.values()].every((handlers) => handlers.size === 0), "plugin cleanup releases audio listeners");
  // Selecting a later track invalidates an earlier slow file read.
  let releaseSlow;
  const slow = new Promise((resolve) => { releaseSlow = resolve; });
  const raceAudio = new AudioDouble(); let staleReleased = false;
  const race = new MusicSession(raceAudio, (source) => source === "slow" ? slow : Promise.resolve({ url: source }));
  race.configure([{ title: "Slow", source: "slow" }, { title: "Fast", source: "fast" }]);
  const selectingSlow = race.select(0, true); await race.select(1, true);
  releaseSlow({ url: "slow", release: () => { staleReleased = true; } }); await selectingSlow;
  check(raceAudio.src === "fast" && race.index === 1 && staleReleased, "rapid switching discards and releases stale file results");
  race.dispose();

  const shuffleAudio = new AudioDouble();
  const shuffled = new MusicSession(shuffleAudio, async (source) => ({ url: source }));
  const sixTracks = Array.from({ length: 6 }, (_, index) => ({ title: String(index), source: String(index) }));
  shuffled.configure(sixTracks, 0.7, true, "shuffle");
  const visits = [shuffled.index];
  for (let i = 0; i < 5; i++) { await shuffled.next(true); visits.push(shuffled.index); }
  check(new Set(visits).size === 6, "shuffle visits every track before repeating");
  const lastShuffle = shuffled.index; await shuffled.next(true);
  check(shuffled.index !== lastShuffle, "shuffle avoids immediate repeats across cycles");
  const sourceBefore = shuffleAudio.src;
  shuffled.configure(sixTracks, 0.7, false, "sequential");
  check(shuffleAudio.src === sourceBefore && !shuffleAudio.paused, "mode switch preserves current playback");
  await shuffled.select(0, true); await shuffled.next(); check(shuffled.index === 1, "sequential next follows playlist order");
  await shuffled.previous(); check(shuffled.index === 0, "previous follows playback order");
  await shuffled.select(5, true); shuffleAudio.paused = true; shuffleAudio.emit("ended");
  await new Promise((resolve) => setTimeout(resolve, 0));
  check(shuffled.index === 5 && shuffleAudio.paused, "non-repeating sequential playlist stops after last song");
  shuffled.dispose();
  const musicRoot = new Element(); const widgetAudio = new AudioDouble();
  const widgetSession = new MusicSession(widgetAudio, async (source) => ({ url: source }));
  let widgetConfig = { tracks: "First | C:/Music/one.mp3\nSecond | C:/Music/two.mp3", playMode: "sequential" };
  const openedSites = []; window.open = (url) => openedSites.push(url);
  await musicPlayerWidget.render(musicRoot, { language: "en", widgetData: { config: widgetConfig }, getMusicSession: () => widgetSession,
    getState: () => ({}), getConfig: () => widgetConfig, component: { register() {} }, openSettings() {},
    saveConfig: async (next) => { widgetConfig = next; widgetSession.configure(parseMusicTracks(next.tracks), 0.7, next.loopPlaylist !== false, next.playMode || "sequential"); }, saveState: async () => {} });
  const iconButtons = descendants(musicRoot).filter((el) => el.tag === "button");
  await iconButtons.find((el) => el.attributes["aria-label"] === "Open NetEase Cloud Music in browser").click();
  await iconButtons.find((el) => el.attributes["aria-label"] === "Open QQ Music in browser").click();
  check(openedSites.join() === "https://music.163.com/,https://y.qq.com/", "separate browser icons open the two music services");
  const modeControl = iconButtons.find((el) => el.attributes["aria-label"]?.startsWith("Playback order:"));
  await modeControl.click();
  check(widgetConfig.playMode === "shuffle" && widgetSession.playMode === "shuffle", "single mode icon switches to shuffle");
  await modeControl.click();
  check(widgetConfig.playMode === "sequential" && widgetSession.playMode === "sequential", "single mode icon switches back to sequential");
  await widgetSession.select(0, true);
  await iconButtons.find((el) => el.attributes["aria-label"]?.startsWith("Remove from playlist")).click();
  check(parseMusicTracks(widgetConfig.tracks).length === 1 && widgetSession.audio.src === "C:/Music/two.mp3" && !widgetSession.audio.paused, "deleting current track only removes its entry and continues with remaining track");
  widgetSession.dispose();

  // Drive the real view render path with tiny host controls, without launching Obsidian.
  const app = {
    vault: { on: () => ({}), getMarkdownFiles: () => [], getAbstractFileByPath: () => null },
    metadataCache: { on: () => ({}), getFileCache: () => ({}) },
    workspace: { onLayoutReady() {} }
  };
  const host = new HomePulse(); host.app = app;
  host.loadData = async () => ({ initialized: true, settings: { openOnStartup: false }, layout: { columns: 2, widgets: [{ id: "task", type: "tasks", x: 0, y: 0, sizePreset: "W1H2" }] }, widgets: { task: { config: {}, state: {} } } });
  host.saveData = async () => {};
  host.addStatusBarItem = () => new Element();
  host.registerDomEvent = () => {}; host.registerEvent = () => {};
  host.addRibbonIcon = () => new Element(); host.addCommand = () => ({}); host.addSettingTab = () => {};
  let viewFactory;
  host.registerView = (_type, factory) => { viewFactory = factory; };
  await host.onload();
  // Let startup date normalization finish before replacing background scheduling.
  await host.tickPomodoro();
  let dataVersion = 1;
  const snapshot = () => ({ now: new Date(), obsidianDays: null, taskIndex: [{ path: "task.md", line: dataVersion, source: `- [ ] ${dataVersion}` }], fileSignature: String(dataVersion), getOpenTasks: () => [] });
  host.loadSnapshot = async () => snapshot();
  host.scheduleRefresh = () => {};
  const definition = host.getDefinition("tasks");
  let renderCount = 0;
  const originalRender = definition.render;
  definition.render = async (body) => { renderCount++; body.createEl("input", { value: String(dataVersion) }); };
  const view = viewFactory({ app });
  await view.onOpen();
  const frame = view.contentEl.querySelector(".yh-frame");
  check(renderCount === 1 && frame, "real view initially renders widgets");
  await view.renderView({ incremental: true });
  check(renderCount === 1 && frame === view.contentEl.querySelector(".yh-frame"), "unchanged snapshot preserves widget DOM and page frame");
  const input = view.contentEl.querySelector("input"); input.focus(); dataVersion++;
  await view.renderView({ incremental: true });
  check(renderCount === 1 && input === view.contentEl.querySelector("input"), "active input survives data refresh");
  document.activeElement = null;
  await view.renderView({ incremental: true });
  check(renderCount === 2 && frame === view.contentEl.querySelector(".yh-frame"), "changed dependency rerenders only component body");
  host.loadSnapshot = async () => { throw Error("read denied"); };
  await view.renderView({ incremental: true });
  check(frame === view.contentEl.querySelector(".yh-frame") && view.contentEl.querySelector(".yh-load-error"), "read failure preserves page and offers retry");
  await view.onClose(); host.onunload(); definition.render = originalRender;
  console.log(JSON.stringify({ ok: true, regressionChecks: checks, scope: "offline logic and mocked Obsidian controls; no vault writes" }, null, 2));
}

export const done = run();
