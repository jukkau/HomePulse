/* eslint-disable @typescript-eslint/no-explicit-any */

import { DEFAULT_DATA } from "./defaults";
import { migrateToLatest, CURRENT_SCHEMA_VERSION } from "./migrations";
import {
  validateLayoutWidget,
  validateSettings,
  validateWidgetStoredData
} from "./validators";
import type { DefinitionResolver, PluginData, WidgetLayoutItem } from "../types";

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
  return data;
}

function normalizeLayout(rawLayout: any, fallbackLayout: any, deps: NormalizeDeps): any {
  const layout = rawLayout && typeof rawLayout === "object" ? rawLayout : fallbackLayout;
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
      return deps.applySizePreset(next, next.sizePreset, 5);
    })
    .filter((w): w is WidgetLayoutItem => Boolean(w));

  return {
    columns: 5,
    widgets: deps.packLayout(widgets, 5)
  };
}
