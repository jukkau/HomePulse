// Migration note: schema migrations for plugin data.json.
// Current data without schemaVersion is treated as v0.

/* eslint-disable @typescript-eslint/no-explicit-any */

export const CURRENT_SCHEMA_VERSION = 1;

type MigrationData = Record<string, any>;

/**
 * Run all migrations needed to bring raw plugin data to CURRENT_SCHEMA_VERSION.
 * Does not fill defaults or validate widget payloads — that is validators/normalize.
 */
export function migrateToLatest(raw: any): MigrationData {
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

  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  return data;
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

function isPlainObject(value: any): boolean {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
