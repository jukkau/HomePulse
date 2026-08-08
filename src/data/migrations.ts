// Migration note: schema migrations for plugin data.json.
// Current data without schemaVersion is treated as v0.

export const CURRENT_SCHEMA_VERSION = 3;

type MigrationData = Record<string, LooseValue>;

/**
 * Run all migrations needed to bring raw plugin data to CURRENT_SCHEMA_VERSION.
 * Does not fill defaults or validate widget payloads — that is validators/normalize.
 */
export function migrateToLatest(raw: LooseValue): MigrationData {
  const base: MigrationData =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...raw }
      : {};

  let version = Number(base.schemaVersion);
  if (!Number.isFinite(version) || version < 0) {
    version = 0;
  }

  let data = base;

  if (version < 1) {
    data = migrateV0ToV1(data);
    version = 1;
  }

  if (version < 2) {
    data = migrateV1ToV2(data);
    version = 2;
  }

  if (version < 3) {
    data = migrateV2ToV3(data);
    version = 3;
  }

  ensureAccentColorMode(data);
  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  return data;
}

function ensureAccentColorMode(data: MigrationData): void {
  const settings = data.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return;
  if (settings.accentColorMode === "theme" || settings.accentColorMode === "custom") return;
  const accent = String(settings.accentColor || "").trim();
  settings.accentColorMode = /^#[0-9a-f]{6}$/i.test(accent) && accent.toLowerCase() !== "#f5c2e7"
    ? "custom"
    : "theme";
}

/**
 * v0 → v1
 * - Introduce explicit schemaVersion.
 * - Ensure top-level keys exist as plain objects/arrays so later steps are safe.
 * - Preserve user layout, widget ids, config, and state as-is.
 */
function migrateV0ToV1(raw: MigrationData): MigrationData {
  const next: MigrationData = {
    schemaVersion: 1
  };

  // Only copy keys that actually existed so mergeDefaults can still fill
  // first-run / empty payloads from DEFAULT_DATA.
  if (isPlainObject(raw.settings)) {
    next.settings = { ...raw.settings };
  }

  if (isPlainObject(raw.layout)) {
    next.layout = {};
    if (raw.layout.columns !== undefined) {
      next.layout.columns = raw.layout.columns;
    }
    if (Array.isArray(raw.layout.widgets)) {
      next.layout.widgets = raw.layout.widgets.slice();
    }
  }

  if (isPlainObject(raw.widgets)) {
    next.widgets = {};
    for (const id of Object.keys(raw.widgets)) {
      const slot = raw.widgets[id];
      if (!isPlainObject(slot)) {
        next.widgets[id] = { config: {}, state: {} };
        continue;
      }
      next.widgets[id] = {
        config: isPlainObject(slot.config) ? { ...slot.config } : {},
        state: isPlainObject(slot.state) ? { ...slot.state } : {}
      };
    }
  }

  return next;
}

/**
 * v1 → v2
 * - Add the Time Flow fact table.
 * - Preserve any experimental timeLogs array if it already exists.
 */
function migrateV1ToV2(raw: MigrationData): MigrationData {
  return {
    ...raw,
    schemaVersion: 2,
    timeLogs: Array.isArray(raw.timeLogs) ? raw.timeLogs.slice() : []
  };
}

/**
 * v2 → v3
 * - Make Tech Tree project folders inherit the global setup by default.
 * - Remove the old public-build folder baked into Tech Tree widget slots.
 * - Keep explicit custom folders when they are not the old built-in value.
 */
function migrateV2ToV3(raw: MigrationData): MigrationData {
  const next: MigrationData = {
    ...raw,
    schemaVersion: 3
  };
  const legacyProjectRoot = "10_Projects/进行中";
  const layoutWidgets = Array.isArray(next.layout?.widgets) ? next.layout.widgets : [];
  const techTreeIds = new Set<string>(
    layoutWidgets
      .filter((widget: LooseValue) => widget?.type === "tech-tree" && widget.id)
      .map((widget: LooseValue) => String(widget.id))
  );
  const settings = next.settings && typeof next.settings === "object" ? next.settings : {};
  const globalProjectRoot = String(settings.techTreeActiveProjectRoot || "").trim();
  const shouldInheritLegacyFolder = (next.initialized !== true)
    || Boolean(globalProjectRoot && globalProjectRoot !== legacyProjectRoot);

  if (next.widgets && typeof next.widgets === "object") {
    next.widgets = { ...next.widgets };
    for (const id of techTreeIds) {
      const slot = next.widgets[id];
      if (!slot || typeof slot !== "object") continue;
      const config = slot.config && typeof slot.config === "object" ? { ...slot.config } : {};
      const folders = Array.isArray(config.projectFolders)
        ? config.projectFolders.map((value: LooseValue) => String(value || "").trim()).filter(Boolean)
        : [];
      const legacyActiveRoot = String(config.activeProjectRoot || "").trim();
      if (shouldInheritLegacyFolder && folders.length === 1 && folders[0] === legacyProjectRoot) {
        config.projectFolders = [];
      }
      if (shouldInheritLegacyFolder && !folders.length && legacyActiveRoot === legacyProjectRoot) {
        delete config.activeProjectRoot;
        config.projectFolders = [];
      }
      next.widgets[id] = { ...slot, config };
    }
  }

  if (next.initialized !== true && next.settings && typeof next.settings === "object") {
    next.settings = { ...next.settings };
    if (next.settings.techTreeAreaRoot === "20_Areas") next.settings.techTreeAreaRoot = "Areas";
    if (next.settings.techTreeActiveProjectRoot === legacyProjectRoot) next.settings.techTreeActiveProjectRoot = "Projects";
  }

  return next;
}

function isPlainObject(value: LooseValue): boolean {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
