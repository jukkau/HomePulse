/* eslint-disable @typescript-eslint/no-explicit-any */

import { DEFAULT_DATA } from "./defaults";
import { migrateToLatest, CURRENT_SCHEMA_VERSION } from "./migrations";
import {
  validateLayoutWidget,
  validateSettings,
  validateTimeLogs,
  validateWidgetStoredData
} from "./validators";
import type { DefinitionResolver, HomepageLayoutPreset, PluginData, WidgetLayoutItem } from "../types";

type NormalizeDeps = {
  mergeDefaults: (base: any, saved: any) => any;
  normalizeArray: (value: any, fallback: any) => any[];
  randomId: (prefix: string) => string;
  applySizePreset: (widget: any, preset: string, columns: number) => WidgetLayoutItem;
  packLayout: (items: WidgetLayoutItem[], columns: number) => WidgetLayoutItem[];
  deepClone: <T>(value: T) => T;
  getDefinition: DefinitionResolver;
};

/**
 * Canonical load path:
 *   raw data.json → migrateToLatest → validate + fill defaults → PluginData
 */
export function normalizeData(saved: unknown, deps: NormalizeDeps): PluginData {
  const migrated = migrateToLatest(saved);
  return validateAndFillDefaults(migrated, deps);
}

function validateAndFillDefaults(migrated: any, deps: NormalizeDeps): PluginData {
  const data = deps.mergeDefaults(DEFAULT_DATA, migrated || {});

  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  data.settings = validateSettings(data.settings, DEFAULT_DATA.settings);

  data.layout = normalizeLayout(data.layout, DEFAULT_DATA.layout, deps);

  if (data.defaultLayout && typeof data.defaultLayout === "object") {
    data.defaultLayout = normalizeLayout(data.defaultLayout, DEFAULT_DATA.layout, deps);
  } else {
    delete data.defaultLayout;
  }
  data.layoutPresets = normalizeLayoutPresets(data, deps);
  if (!data.layoutPresets.some((preset: HomepageLayoutPreset) => preset.id === data.defaultLayoutPresetId)) {
    data.defaultLayoutPresetId = data.layoutPresets[0]?.id || "public-default";
  }

  const widgetMap = data.widgets && typeof data.widgets === "object" ? data.widgets : {};
  const nextMap: Record<string, any> = {};

  for (const widget of data.layout.widgets) {
    const definition = deps.getDefinition(widget.type);
    if (!definition) {
      // Keep unknown-type slots if present, but isolate them.
      if (widgetMap[widget.id]) {
        nextMap[widget.id] = validateWidgetStoredData(widget.type, widgetMap[widget.id], null);
      }
      continue;
    }
    const stored = widgetMap[widget.id] || {
      config: deps.deepClone(definition.defaultConfig),
      state: deps.deepClone(definition.defaultState)
    };
    nextMap[widget.id] = validateWidgetStoredData(widget.type, stored, definition);
  }

  data.widgets = nextMap;
  data.timeLogs = validateTimeLogs(data.timeLogs);
  return data;
}

function normalizeLayout(rawLayout: any, fallbackLayout: any, deps: NormalizeDeps): any {
  const layout = rawLayout && typeof rawLayout === "object" ? rawLayout : fallbackLayout;
  const columns = clampLayoutColumns(layout.columns, fallbackLayout.columns || 5);
  const rawWidgets = deps.normalizeArray(layout.widgets, fallbackLayout.widgets);
  const widgets = rawWidgets
    .map((widget) => {
      const cleaned = validateLayoutWidget(widget);
      if (!cleaned) return null;
      const next = {
        id: cleaned.id || deps.randomId(cleaned.type || "widget"),
        type: cleaned.type,
        x: cleaned.x,
        y: cleaned.y,
        sizePreset: cleaned.sizePreset
      };
      return deps.applySizePreset(next, next.sizePreset, columns);
    })
    .filter((w): w is WidgetLayoutItem => Boolean(w));

  return {
    columns,
    widgets: deps.packLayout(widgets, columns)
  };
}

function clampLayoutColumns(value: any, fallback = 5): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function normalizeLayoutPresets(data: any, deps: NormalizeDeps): HomepageLayoutPreset[] {
  const builtIn = (DEFAULT_DATA.layoutPresets || []).map((preset: any) => ({
    id: preset.id,
    name: preset.name,
    isBuiltIn: true,
    updatedAt: Number(preset.updatedAt) || 0,
    layout: normalizeLayout(preset.layout, DEFAULT_DATA.layout, deps)
  }));
  const seen = new Set<string>(builtIn.map((preset) => preset.id));
  const presets: HomepageLayoutPreset[] = [...builtIn];
  const rawPresets = Array.isArray(data.layoutPresets) ? data.layoutPresets : [];

  for (const raw of rawPresets) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || "").trim() || deps.randomId("layout");
    if (!id || seen.has(id)) continue;
    const name = String(raw.name || "").trim() || "Untitled layout";
    presets.push({
      id,
      name,
      updatedAt: Number(raw.updatedAt) || Date.now(),
      layout: normalizeLayout(raw.layout, DEFAULT_DATA.layout, deps)
    });
    seen.add(id);
  }

  if (data.defaultLayout && !seen.has("saved-default")) {
    presets.push({
      id: "saved-default",
      name: "Saved default",
      updatedAt: Date.now(),
      layout: normalizeLayout(data.defaultLayout, DEFAULT_DATA.layout, deps)
    });
  }

  return presets;
}
