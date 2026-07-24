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
import { countDistinctCompletionDays } from "../src/widgets/widget-api";

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
  const dataPath = path.join(pluginRoot, "data.json");
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  // --- migration only ---
  const migrated = migrateToLatest(raw);
  assert(migrated.schemaVersion === CURRENT_SCHEMA_VERSION, "schemaVersion should be 1");
  assert(migrated.settings && typeof migrated.settings === "object", "settings object");
  assert(Array.isArray(migrated.layout.widgets), "layout.widgets array");
  assert(migrated.widgets && typeof migrated.widgets === "object", "widgets map");

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

  assert(normalized.schemaVersion === 1, "normalized schemaVersion");
  assert(normalized.layout.columns === 5, "columns fixed to 5");
  assert(normalized.layout.widgets.length > 0, "has widgets");
  assert(
    normalized.settings.obsidianStartDate === raw.settings.obsidianStartDate,
    "configured start date preserved"
  );
  assert(normalized.settings.profileName === "Yuki", "header username preserved");
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

  assert(getResponsiveColumnCount(1201) === 5, "large layout has five columns");
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

  const badState = validateWidgetState(
    "pomodoro",
    { status: "explode", remainingSeconds: -10, todayCount: -1 },
    { status: "idle", remainingSeconds: 1500, todayCount: 0, phaseStartedAt: 0, todayCountDate: "" }
  );
  assert(badState.status === "idle", "invalid pomodoro status falls back");
  assert(badState.remainingSeconds === 0, "remainingSeconds clamped >= 0");
  assert(badState.todayCount === 0, "todayCount clamped >= 0");

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
  assert(emptyNorm.schemaVersion === 1, "null input yields schema 1");
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
