// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t, widgetTitle } from "../i18n";
import { parseMusicTracks, scanMusicFolder } from "../services/music-playback";
import { MUSIC_SERVICE_ICONS } from "../assets/music-service-icons";
import { renderEmpty } from "./widget-api";
const { Setting, setIcon, Platform } = require("obsidian");

function time(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function chooseSystemFolder() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      const absolutePath = String(file?.path || "");
      const relativePath = String(file?.webkitRelativePath || "");
      if (!absolutePath || !relativePath) return resolve("");
      resolve(absolutePath.slice(0, Math.max(0, absolutePath.length - relativePath.length)).replace(/[\\/]$/, ""));
    }, { once: true });
    input.click();
  });
}

export const musicPlayerWidget = {
  type: "music-player", displayName: "Music Player", shell: "panel", allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W2H2", w: 2, h: 2 },
  defaultConfig: { title: "music player", tracks: "", musicFolder: "", playMode: "sequential", loopPlaylist: true,
    serviceName: "NetEase Cloud Music", loginUrl: "https://music.163.com/", playUrl: "https://music.163.com/" },
  defaultState: {},
  normalizeConfig(config, state) {
    delete config.volume;
    delete config._volumeChanged;
    delete state.volume;
    return { config, state };
  },
  async render(container, api) {
    const config = api.widgetData.config;
    const tracks = parseMusicTracks(config.tracks || "");
    const session = api.getMusicSession();
    session.configure(tracks, config.loopPlaylist !== false, config.playMode === "shuffle" ? "shuffle" : "sequential");
    const root = container.createDiv({ cls: "yh-music-player" });
    const heading = root.createDiv({ cls: "yh-music-player-heading" });
    heading.createDiv({ cls: "yh-card-title", text: widgetTitle(api.language, "music-player", config.title, "Music Player") });
    const links = heading.createDiv({ cls: "yh-music-links" });
    for (const [service, key, url] of [["netease", "musicOpenNetEase", "https://music.163.com/"], ["qq", "musicOpenQQ", "https://y.qq.com/"]]) {
      const link = links.createEl("button", { cls: "yh-music-control", attr: { "aria-label": t(api.language, key) } });
      link.createEl("img", { cls: "yh-music-service-icon", attr: { src: MUSIC_SERVICE_ICONS[service], alt: "", width: "20", height: "20", draggable: "false" } });
      link.addEventListener("click", () => window.open(url, "_blank", "noopener,noreferrer"));
    }
    if (!tracks.length) {
      renderEmpty(root, t(api.language, "musicNoTracks"), { label: t(api.language, "musicConfigure"), run: () => api.openSettings() });
      return;
    }
    const hero = root.createDiv({ cls: "yh-music-hero" });
    const artwork = hero.createDiv({ cls: "yh-music-artwork", attr: { "aria-hidden": "true" } });
    artwork.createDiv({ cls: "yh-music-vinyl" });
    const sleeve = artwork.createDiv({ cls: "yh-music-sleeve" });
    setIcon(sleeve.createSpan(), "music-2");
    const main = hero.createDiv({ cls: "yh-music-main" });
    const titleRow = main.createDiv({ cls: "yh-music-title-row" });
    const track = titleRow.createDiv({ cls: "yh-music-current-track", text: session.tracks[session.index]?.title || "", attr: { "aria-live": "polite" } });
    const settings = titleRow.createEl("button", { cls: "yh-music-control", attr: { "aria-label": t(api.language, "musicConfigure") } });
    setIcon(settings, "settings"); settings.addEventListener("click", () => api.openSettings());
    const waveform = main.createDiv({ cls: "yh-music-waveform", attr: { "aria-hidden": "true" } });
    for (const height of [8, 15, 10, 20, 13, 17, 9, 22, 12, 18, 8, 15, 21, 11, 17, 9, 14, 19]) {
      waveform.createSpan({ attr: { style: `--wave-height:${height}px` } });
    }
    const controls = root.createDiv({ cls: "yh-music-transport" });
    const button = (icon, label, action) => {
      const el = controls.createEl("button", { cls: "yh-music-control", attr: { type: "button", "aria-label": t(api.language, label) } });
      setIcon(el, icon); el.addEventListener("click", action); return el;
    };
    const previous = button("skip-back", "musicPrevious", () => void session.previous());
    const play = button("play", "musicPlay", () => void session.toggle());
    play.addClass("yh-music-play-primary");
    const next = button("skip-forward", "musicNext", () => void session.next());
    const mode = button("list-music", "musicSequential", () => void api.saveConfig({ ...api.getConfig(), playMode: session.playMode === "shuffle" ? "sequential" : "shuffle" }));
    const bottom = root.createDiv({ cls: "yh-music-player-bottom" });
    const elapsed = bottom.createSpan({ cls: "yh-music-elapsed" });
    const position = bottom.createEl("input", { type: "range", attr: { min: "0", max: "0", step: "1", "aria-label": t(api.language, "musicPosition") } });
    position.addEventListener("input", () => session.seek(Number(position.value)));
    const durationText = bottom.createSpan({ cls: "yh-music-elapsed" });
    const playlist = root.createEl("details", { cls: "yh-music-playlist" });
    playlist.createEl("summary", { text: `${t(api.language, "musicPlaylist")} · ${tracks.length}` });
    const rows = [];
    tracks.forEach((item, index) => {
      const row = playlist.createDiv({ cls: "yh-music-playlist-row" });
      const pick = row.createEl("button", { cls: "yh-music-playlist-track", text: item.title, attr: { title: item.source } });
      pick.addEventListener("click", () => void session.select(index, true));
      const remove = row.createEl("button", { cls: "yh-music-control", attr: { "aria-label": `${t(api.language, "musicRemoveTrack")} · ${item.title}` } });
      setIcon(remove, "x");
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        const remaining = tracks.filter((_, trackIndex) => trackIndex !== index);
        const resume = !session.audio.paused && index === session.index;
        try {
          await api.saveConfig({ ...api.getConfig(), tracks: remaining.map((entry) => `${entry.title} | ${entry.source}`).join("\n") });
          if (resume && remaining.length) await session.select(Math.min(index, remaining.length - 1), true);
        } catch { remove.disabled = false; }
      });
      rows.push(pick);
    });
    const error = root.createDiv({ cls: "yh-music-error", attr: { role: "status" } });
    const unsubscribe = session.subscribe(() => {
      track.setText(session.tracks[session.index]?.title || "");
      rows.forEach((row, index) => row.setAttribute("aria-current", index === session.index ? "true" : "false"));
      setIcon(play, session.audio.paused ? "play" : "pause");
      play.setAttribute("aria-label", t(api.language, session.audio.paused ? "musicPlay" : "musicPause"));
      const shuffled = session.playMode === "shuffle";
      setIcon(mode, shuffled ? "shuffle" : "list-music");
      mode.setAttribute("aria-label", `${t(api.language, "musicMode")}: ${t(api.language, shuffled ? "musicShuffle" : "musicSequential")}`);
      mode.setAttribute("aria-pressed", String(shuffled));
      play.disabled = session.loading;
      // File reads and play() can stay pending; users must still be able to skip.
      previous.disabled = next.disabled = session.tracks.length < 2;
      const duration = Number.isFinite(session.audio.duration) ? session.audio.duration : 0;
      position.max = String(duration); position.value = String(session.audio.currentTime || 0); position.disabled = !duration;
      elapsed.setText(time(session.audio.currentTime));
      durationText.setText(time(duration));
      const keys = { share: "musicShareUnsupported", desktop: "musicDesktopOnly", format: "musicFormatError", missing: "musicMissing", playback: "musicPlaybackError" };
      error.setText(session.error ? t(api.language, keys[session.error] || "musicPlaybackError") : "");
      error.hidden = !session.error;
    });
    api.component.register(unsubscribe);
  },
  renderSettings(container, draft, ctx) {
    new Setting(container).setName(t(ctx.language, "title")).addText((text) => {
      text.setValue(draft.title || ""); text.onChange((value) => { draft.title = value; });
    });
    const folderSetting = new Setting(container).setName(t(ctx.language, "musicFolder"));
    let folderInput;
    folderSetting.addText((text) => {
      folderInput = text;
      text.setValue(draft.musicFolder || "");
      text.setPlaceholder(String.raw`D:\Music`);
      text.inputEl.setAttribute("aria-label", t(ctx.language, "musicFolder"));
      text.onChange((value) => {
        const path = value.trim();
        if (path !== draft.musicFolder) draft.tracks = "";
        draft.musicFolder = path;
      });
    }).addButton((button) => {
      button.setButtonText(t(ctx.language, "musicBrowseFolder"));
      button.setDisabled(!Platform?.isDesktop);
      button.onClick(async () => {
        const folder = await chooseSystemFolder();
        if (!folder) return;
        if (folder !== draft.musicFolder) draft.tracks = "";
        draft.musicFolder = folder;
        folderInput?.setValue(folder);
        folderSetting.setDesc(t(ctx.language, "musicFolderSelected"));
      });
    }).addButton((button) => {
      button.setButtonText(t(ctx.language, "musicScanFolder"));
      button.setDisabled(!Platform?.isDesktop);
      button.onClick(async () => {
        button.setDisabled(true);
        const folder = draft.musicFolder || "";
        try {
          const tracks = await scanMusicFolder(folder);
          if (folder !== draft.musicFolder) return;
          draft.tracks = tracks.map((entry) => `${entry.title.replace(/[|\r\n]/g, " ")} | ${entry.source}`).join("\n");
          folderSetting.setDesc(t(ctx.language, tracks.length ? "musicScanDone" : "musicScanEmpty", { count: tracks.length }));
        } catch {
          folderSetting.setDesc(t(ctx.language, "musicScanFailed"));
        } finally { button.setDisabled(!Platform?.isDesktop); }
      });
    });
    new Setting(container).setName(t(ctx.language, "musicMode")).addDropdown((dropdown) => {
      dropdown.addOption("sequential", t(ctx.language, "musicSequential")).addOption("shuffle", t(ctx.language, "musicShuffle"));
      dropdown.setValue(draft.playMode || "sequential"); dropdown.onChange((value) => { draft.playMode = value; });
    });
    new Setting(container).setName(t(ctx.language, "musicLoop")).addToggle((toggle) => {
      toggle.setValue(draft.loopPlaylist !== false); toggle.onChange((value) => { draft.loopPlaylist = value; });
    });
  }
};
