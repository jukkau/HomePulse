// @ts-nocheck
// Offline smoke checks for Step 9 — no Obsidian UI required.
import fs from "fs";
import path from "path";
import { DEFAULT_DATA } from "../src/data/defaults";
import { migrateToLatest, CURRENT_SCHEMA_VERSION } from "../src/data/migrations";
import { normalizeData } from "../src/data/normalize";
import { validateWidgetConfig, validateWidgetState } from "../src/data/validators";
import { applySizePreset, getSizeDimensions, toSizePreset } from "../src/layout/size-presets";
import { packLayout, sortLayoutForReadingOrder } from "../src/layout/pack-layout";
import { buildResponsiveLayout, getResponsiveColumnCount } from "../src/layout/responsive-layout";
import { createWidgetRegistry } from "../src/widgets/registry";
import { calculateObsidianUsageDays } from "../src/services/obsidian-usage";
import { countDistinctCompletionDays, shouldPersistPomodoroState } from "../src/widgets/widget-api";
import { parseBookmarks } from "../src/widgets/bookmarks";
import { t, widgetName, widgetTitle } from "../src/i18n";
import { resolveTechTreeProjectFolders } from "../src/widgets/tech-tree";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(base, saved) {
  if (Array.isArray(base)) {
    return Array.isArray(saved) ? deepClone(saved) : deepClone(base);
  }
  if (!base || typeof base !== "object") {
    return saved === undefined ? base : saved;
  }
  const next = {};
  const source = saved && typeof saved === "object" ? saved : {};
  for (const key of Object.keys(base)) {
    next[key] = mergeDefaults(base[key], source[key]);
  }
  for (const key of Object.keys(source)) {
    if (!(key in next)) next[key] = source[key];
  }
  return next;
}

function normalizeArray(value, fallback) {
  return Array.isArray(value) ? value.filter(Boolean) : deepClone(fallback);
}

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function run() {
  const pluginRoot = path.resolve(__dirname, "..");
  const dataPath = process.env.HOMEPULSE_SMOKE_DATA || path.join(pluginRoot, "data.json");
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  // --- migration only ---
  const migrated = migrateToLatest(raw);
  assert(migrated.schemaVersion === CURRENT_SCHEMA_VERSION, "schemaVersion should be current");
  assert(migrated.settings && typeof migrated.settings === "object", "settings object");
  assert(Array.isArray(migrated.layout.widgets), "layout.widgets array");
  assert(migrated.widgets && typeof migrated.widgets === "object", "widgets map");
  assert(Array.isArray(migrated.timeLogs), "timeLogs array");

  const layoutIdsBefore = (raw.layout?.widgets || []).map((w) => w.id).filter(Boolean).sort();
  const layoutIdsAfter = migrated.layout.widgets.map((w) => w.id).filter(Boolean).sort();
  assert(
    JSON.stringify(layoutIdsBefore) === JSON.stringify(layoutIdsAfter),
    "migration must preserve layout widget ids"
  );

  // Preserve habit completions and pomodoro counters when present
  for (const id of Object.keys(raw.widgets || {})) {
    const before = raw.widgets[id];
    const after = migrated.widgets[id];
    assert(after && after.config && after.state, `slot ${id} must be {config,state}`);
    if (before?.state?.habits) {
      assert(JSON.stringify(after.state.habits) === JSON.stringify(before.state.habits), `${id} habits preserved`);
    }
    if (before?.state?.completions) {
      assert(
        JSON.stringify(after.state.completions) === JSON.stringify(before.state.completions),
        `${id} completions preserved`
      );
    }
    if (before?.state?.todayCount != null) {
      assert(after.state.todayCount === before.state.todayCount, `${id} pomodoro count preserved`);
    }
  }

  // --- full normalize with registry defs ---
  const registry = createWidgetRegistry(null);
  const expectedWidgetCatalog = {
    focus: "Today's goal",
    projects: "Projects",
    tasks: "Tasks",
    calendar: "Calendar",
    pomodoro: "Pomodoro",
    "music-player": "Music Player",
    habits: "Habits",
    bookmarks: "Bookmarks",
    "quick-actions": "System",
    "stats-overview": "Execution Pulse",
    "knowledge-profile": "Knowledge Profile",
    "recent-notes": "Recent Notes",
    "tech-tree": "Tech Tree",
    "time-flow": "Time Flow",
    "activity-history": "Activity History"
  };
  assert(registry.length === Object.keys(expectedWidgetCatalog).length, "Add Widget registry includes every widget");
  for (const [type, displayName] of Object.entries(expectedWidgetCatalog)) {
    const definition = registry.find((item) => item.type === type);
    assert(definition, `Add Widget registry includes ${type}`);
    assert(definition.displayName === displayName, `${type} display name matches the widget catalog`);
  }
  const getDefinition = (type) => registry.find((item) => item.type === type);

  const normalized = normalizeData(raw, {
    mergeDefaults,
    normalizeArray,
    randomId,
    applySizePreset,
    packLayout,
    deepClone,
    getDefinition
  });

  assert(normalized.schemaVersion === CURRENT_SCHEMA_VERSION, "normalized schemaVersion");
  assert(CURRENT_SCHEMA_VERSION === 3, "schema includes Tech Tree inheritance migration");
  assert(normalized.layout.columns >= 1 && normalized.layout.columns <= 5, "layout columns stay in range");
  assert(normalized.layout.columns === (raw.layout?.columns || 5), "saved layout columns preserved");
  assert(normalized.layoutPresets?.find((preset) => preset.id === "public-default")?.layout.columns === 5, "public default columns fixed to 5");
  assert(normalized.layout.widgets.length > 0, "has widgets");
  assert(Array.isArray(normalized.timeLogs), "normalized timeLogs array");
  assert(["en", "zh-CN"].includes(normalized.settings.language), "saved interface language is supported");
  const chineseNormalized = normalizeData({
    ...raw,
    settings: { ...raw.settings, language: "zh-CN" }
  }, {
    mergeDefaults,
    normalizeArray,
    randomId,
    applySizePreset,
    packLayout,
    deepClone,
    getDefinition
  });
  assert(chineseNormalized.settings.language === "zh-CN", "Chinese language preference is preserved");
  assert(t("zh-CN", "manageLayouts") === "管理布局", "Chinese UI dictionary is available");
  assert(t("en", "manageLayouts") === "Manage layouts", "English UI dictionary is available");
  assert(widgetName("zh-CN", "time-flow", "Time Flow") === "时间流", "widget names switch to Chinese");
  assert(widgetTitle("zh-CN", "focus", "today's goal", "Today's goal") === "今日目标", "built-in widget titles switch language");
  assert(widgetTitle("zh-CN", "focus", "Deep work", "Today's goal") === "Deep work", "custom widget titles are preserved");
  assert(resolveTechTreeProjectFolders({ projectFolders: [] }, "Client/Projects").join("|") === "Client/Projects", "Tech Tree inherits the global project folder");
  assert(resolveTechTreeProjectFolders({ projectFolders: ["Archive/Projects"] }, "Client/Projects").join("|") === "Archive/Projects", "Tech Tree keeps an explicit project folder override");
  const migratedTechTree = migrateToLatest({
    schemaVersion: 2,
    initialized: true,
    settings: { techTreeActiveProjectRoot: "Client/Projects" },
    layout: { widgets: [{ id: "tree", type: "tech-tree" }] },
    widgets: { tree: { config: { projectFolders: ["10_Projects/进行中"] }, state: {} } }
  });
  assert(migratedTechTree.widgets.tree.config.projectFolders.length === 0, "legacy Tech Tree folder inherits configured global root");
  assert(!normalized.settings.accentColor || /^#[0-9a-f]{6}$/i.test(normalized.settings.accentColor), "accent color is empty or a hex value");
  assert(["theme", "custom"].includes(normalized.settings.accentColorMode), "accent color mode is supported");
  const themeAccent = normalizeData({ ...raw, settings: { ...raw.settings, accentColor: "#f5c2e7", accentColorMode: undefined } }, {
    mergeDefaults,
    normalizeArray,
    randomId,
    applySizePreset,
    packLayout,
    deepClone,
    getDefinition
  });
  assert(themeAccent.settings.accentColorMode === "theme", "default accent color follows the theme");
  const customAccent = normalizeData({ ...raw, settings: { ...raw.settings, accentColor: "#123456", accentColorMode: undefined } }, {
    mergeDefaults,
    normalizeArray,
    randomId,
    applySizePreset,
    packLayout,
    deepClone,
    getDefinition
  });
  assert(customAccent.settings.accentColorMode === "custom", "non-default accent color stays custom");
  assert(
    normalized.settings.obsidianStartDate === raw.settings.obsidianStartDate,
    "configured start date preserved"
  );
  assert(
    normalized.settings.profileName === raw.settings.profileName,
    "header username preserved"
  );
  assert(normalized.settings.lockHomepage === true, "homepage lock defaults to enabled");
  assert(calculateObsidianUsageDays("2026-07-18", new Date(2026, 6, 18)) === 1, "start day counts as day one");
  assert(calculateObsidianUsageDays("2026-07-17", new Date(2026, 6, 18)) === 2, "usage counts inclusively");
  assert(calculateObsidianUsageDays("2026-07-19", new Date(2026, 6, 18)) === null, "future date rejected");
  assert(countDistinctCompletionDays({
    "read|2026-07-17": true,
    "move|2026-07-17": true,
    "read|2026-07-18": true,
    "write|invalid": true
  }) === 2, "habit check-in days count distinct valid dates");
  assert(Object.keys(normalized.widgets).length === normalized.layout.widgets.length, "widget map matches layout");

  assert(getResponsiveColumnCount(1741) === 5, "large layout has five columns");
  assert(getResponsiveColumnCount(1201) === 5, "wide layout has five columns");
  assert(getResponsiveColumnCount(1000) === 3, "laptop layout has three columns");
  assert(getResponsiveColumnCount(800) === 2, "compact layout has two columns");
  assert(getResponsiveColumnCount(520) === 1, "phone layout has one column");
  for (const columns of [3, 2, 1]) {
    const responsive = buildResponsiveLayout(normalized.layout.widgets, columns);
    for (const widget of responsive) {
      assert(widget.x >= 0 && widget.x + widget.w <= columns, `widget fits ${columns}-column layout`);
    }
    for (let index = 0; index < responsive.length; index += 1) {
      for (let other = index + 1; other < responsive.length; other += 1) {
        const a = responsive[index];
        const b = responsive[other];
        const overlaps = !(a.y >= b.y + b.h || a.y + a.h <= b.y || a.x >= b.x + b.w || a.x + a.w <= b.x);
        assert(!overlaps, `responsive ${columns}-column layout has no overlap`);
      }
    }
  }

  const utilityReflow = buildResponsiveLayout([
    { id: "main", type: "tasks", x: 0, y: 0, sizePreset: "W2H2" },
    { id: "utility", type: "calendar", x: 2, y: 0, sizePreset: "W1H2" },
    { id: "detail", type: "focus", x: 0, y: 2, sizePreset: "W1H1" }
  ], 3);
  const utility = utilityReflow.find((widget) => widget.id === "utility");
  const detail = utilityReflow.find((widget) => widget.id === "detail");
  assert(detail.y === 0 && detail.x === 2, "primary widgets fill the first responsive row");
  assert(utility.y >= 1, "narrow utility widgets move below primary content");

  const withSavedDefault = normalizeData({
    ...raw,
    defaultLayout: {
      columns: 5,
      widgets: [{ id: "saved-focus", type: "focus", x: 4, y: 3, sizePreset: "W1H1" }]
    }
  }, {
    mergeDefaults,
    normalizeArray,
    randomId,
    applySizePreset,
    packLayout,
    deepClone,
    getDefinition
  });
  assert(withSavedDefault.defaultLayout?.widgets.length === 1, "saved default layout preserved");
  assert(withSavedDefault.defaultLayout?.widgets[0].id === "saved-focus", "saved default widget preserved");

  const customColumns = normalizeData({
    ...raw,
    layout: {
      columns: 4,
      widgets: raw.layout.widgets
    },
    layoutPresets: [{
      id: "four-column",
      name: "Four column",
      layout: {
        columns: 4,
        widgets: raw.layout.widgets
      }
    }],
    defaultLayoutPresetId: "four-column"
  }, {
    mergeDefaults,
    normalizeArray,
    randomId,
    applySizePreset,
    packLayout,
    deepClone,
    getDefinition
  });
  assert(customColumns.layout.columns === 4, "custom layout columns preserved");
  assert(customColumns.layoutPresets?.find((preset) => preset.id === "four-column")?.layout.columns === 4, "preset columns preserved");

  for (const widget of normalized.layout.widgets) {
    assert(widget.id && widget.type, "layout item has id/type");
    assert(Number.isFinite(widget.w) && Number.isFinite(widget.h), `${widget.id} has size`);
    assert(normalized.widgets[widget.id], `${widget.id} has stored data`);
    const def = getDefinition(widget.type);
    if (def) {
      assert(normalized.widgets[widget.id].config, `${widget.id} config`);
      assert(normalized.widgets[widget.id].state, `${widget.id} state`);
    }
  }

  // --- free width/height sizing and dense upward packing ---
  assert(toSizePreset(5, 5) === "W5H5", "size preset supports the 5x5 maximum");
  assert(getSizeDimensions("LANE").w === 1 && getSizeDimensions("LANE").h === 2, "legacy sizes remain readable");
  const mixedHeightLayout = packLayout([
    { id: "tall", type: "tasks", x: 0, y: 0, sizePreset: "W1H3" },
    { id: "short-a", type: "focus", x: 1, y: 0, sizePreset: "W1H1" },
    { id: "short-b", type: "focus", x: 1, y: 4, sizePreset: "W1H1" }
  ], 5, {}, [], true);
  const tall = mixedHeightLayout.find((widget) => widget.id === "tall");
  const shortB = mixedHeightLayout.find((widget) => widget.id === "short-b");
  assert(tall?.h === 3, "three-row widget height preserved");
  assert(shortB?.x === 1 && shortB?.y === 1, "one-row widgets stack beside a taller widget");

  const anchoredResize = packLayout([
    { id: "anchor", type: "projects", x: 3, y: 2, sizePreset: "W1H3" },
    { id: "other", type: "focus", x: 0, y: 5, sizePreset: "W1H1" }
  ], 5, { anchor: { x: 3, y: 2 } }, ["anchor"], true);
  const anchor = anchoredResize.find((widget) => widget.id === "anchor");
  assert(anchor?.x === 3 && anchor?.y === 2, "resized widget stays anchored at the chosen position");
  const readingOrder = sortLayoutForReadingOrder([
    { id: "third", type: "focus", x: 0, y: 2, sizePreset: "W1H1" },
    { id: "second", type: "focus", x: 3, y: 0, sizePreset: "W1H1" },
    { id: "first", type: "focus", x: 1, y: 0, sizePreset: "W1H1" }
  ]).map((widget) => widget.id);
  assert(readingOrder.join(",") === "first,second,third", "responsive reading order follows configured geometry");

  // --- validator clamps illegal values ---
  const badPomo = validateWidgetConfig(
    "pomodoro",
    { workMinutes: 9999, breakMinutes: -3, title: "x" },
    { workMinutes: 25, breakMinutes: 5, title: "pomodoro" }
  );
  assert(badPomo.workMinutes === 180, "workMinutes clamped to max 180");
  assert(badPomo.breakMinutes === 1, "breakMinutes clamped to min 1");

  const musicConfig = validateWidgetConfig(
    "music-player",
    { title: "music", serviceName: "NetEase", loginUrl: "", playUrl: "https://music.163.com/#/playlist?id=1" },
    { title: "music player", serviceName: "NetEase Cloud Music", loginUrl: "https://music.163.com/", playUrl: "https://music.163.com/" }
  );
  assert(musicConfig.serviceName === "NetEase", "music service name preserved");
  assert(musicConfig.loginUrl === "https://music.163.com/", "empty music login URL falls back");
  assert(musicConfig.playUrl === "https://music.163.com/#/playlist?id=1", "music play URL preserved");

  const badState = validateWidgetState(
    "pomodoro",
    { status: "explode", remainingSeconds: -10, todayCount: -1 },
    { status: "idle", remainingSeconds: 1500, todayCount: 0, phaseStartedAt: 0, todayCountDate: "" }
  );
  assert(badState.status === "idle", "invalid pomodoro status falls back");
  assert(badState.remainingSeconds === 0, "remainingSeconds clamped >= 0");
  assert(badState.todayCount === 0, "todayCount clamped >= 0");

  const runningPomodoro = {
    status: "running",
    remainingSeconds: 1500,
    phaseStartedAt: 1000,
    todayCountDate: "2026-08-08",
    todayCount: 0
  };
  assert(
    !shouldPersistPomodoroState(runningPomodoro, { ...runningPomodoro, remainingSeconds: 1499 }),
    "pomodoro display ticks do not overwrite the phase-start remaining time"
  );
  assert(
    shouldPersistPomodoroState(runningPomodoro, {
      ...runningPomodoro,
      status: "break",
      remainingSeconds: 300,
      phaseStartedAt: 2500,
      todayCount: 1
    }),
    "pomodoro phase transitions are persisted"
  );

  const parsedBookmarks = parseBookmarks("Grok|https://grok.com\nhttps://chatgpt.com");
  assert(parsedBookmarks.length === 2, "bookmark settings parse label URLs and direct URLs");
  assert(parsedBookmarks[0].label === "Grok", "bookmark parser keeps explicit label");
  assert(parsedBookmarks[1].label === "chatgpt.com", "bookmark parser derives direct URL label");

  const bookmarkConfig = validateWidgetConfig(
    "bookmarks",
    {
      title: "bookmarks",
      variant: "grid",
      useFavicons: true,
      items: [
        { label: "Grok", type: "url", value: "https://grok.com" },
        { label: "chatgpt.com", type: "url", value: "https://chatgpt.com" }
      ]
    },
    { title: "bookmarks", variant: "grid", items: [] }
  );
  assert(bookmarkConfig.items.length === 2, "bookmark settings preserve saved URLs");
  assert(bookmarkConfig.items[0].label === "Grok", "bookmark label preserved");
  assert(bookmarkConfig.items[1].value === "https://chatgpt.com", "direct URL bookmark preserved");
  assert(bookmarkConfig.useFavicons === true, "bookmark favicon preference preserved");

  // empty / garbage raw must not throw
  const emptyNorm = normalizeData(null, {
    mergeDefaults,
    normalizeArray,
    randomId,
    applySizePreset,
    packLayout,
    deepClone,
    getDefinition
  });
  assert(emptyNorm.schemaVersion === CURRENT_SCHEMA_VERSION, "null input yields current schema");
  assert(
    emptyNorm.layout.widgets.length === DEFAULT_DATA.layout.widgets.length,
    `null uses default layout (got ${emptyNorm.layout.widgets.length}, expected ${DEFAULT_DATA.layout.widgets.length})`
  );

  const emptyObjNorm = normalizeData({}, {
    mergeDefaults,
    normalizeArray,
    randomId,
    applySizePreset,
    packLayout,
    deepClone,
    getDefinition
  });
  assert(
    emptyObjNorm.layout.widgets.length === DEFAULT_DATA.layout.widgets.length,
    "empty object uses default layout"
  );

  const corruptNorm = normalizeData(
    { layout: { widgets: [{ id: "bad", type: "", x: "nope" }, { type: "focus", x: 0, y: 0 }] }, widgets: "nope" },
    {
      mergeDefaults,
      normalizeArray,
      randomId,
      applySizePreset,
      packLayout,
      deepClone,
      getDefinition
    }
  );
  assert(
    corruptNorm.layout.widgets.every((w) => w.type),
    "invalid layout items dropped"
  );
  assert(
    corruptNorm.layout.widgets.some((w) => w.type === "focus"),
    "valid focus widget kept from corrupt payload"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        schemaVersion: normalized.schemaVersion,
        layoutCount: normalized.layout.widgets.length,
        widgetIds: normalized.layout.widgets.map((w) => w.id),
        types: [...new Set(normalized.layout.widgets.map((w) => w.type))].sort(),
        preservedHabitIds: Object.keys(raw.widgets || {}).filter((id) => raw.widgets[id]?.state?.habits),
        settings: normalized.settings
      },
      null,
      2
    )
  );
}

run();
