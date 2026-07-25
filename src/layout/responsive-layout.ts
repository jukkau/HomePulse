import type { WidgetLayoutItem } from "../types";
import { packLayout } from "./pack-layout";
import { applySizePreset } from "./size-presets";

const SECONDARY_WIDGET_TYPES = new Set(["calendar", "pomodoro", "music-player", "bookmarks", "quick-actions"]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function getResponsiveColumnCount(width: number): number {
  if (width <= 520) return 1;
  if (width <= 900) return 2;
  if (width <= 1200) return 3;
  return 5;
}

export function buildResponsiveLayout(items: WidgetLayoutItem[], columns: number): WidgetLayoutItem[] {
  if (columns >= 5) return items;
  const resized = items.map((item) => applySizePreset(clone(item), item.sizePreset, columns));
  const primaryIds = resized
    .filter((item) => !SECONDARY_WIDGET_TYPES.has(item.type))
    .map((item) => item.id);
  return packLayout(resized, columns, {}, primaryIds, true, true, false);
}
