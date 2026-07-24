import type { WidgetLayoutItem } from "../types";

export type WidgetDimensions = { label: string; w: number; h: number };

export const SIZE_PRESETS: Record<string, WidgetDimensions> = Object.fromEntries(
  Array.from({ length: 5 }, (_, rowIndex) => rowIndex + 1).flatMap((h) =>
    Array.from({ length: 5 }, (_, columnIndex) => columnIndex + 1).map((w) => [
      `W${w}H${h}`,
      { label: `${w} col × ${h} row`, w, h }
    ])
  )
);

const LEGACY_SIZE_PRESETS: Record<string, WidgetDimensions> = {
  CHIP: { label: "1 col × 1 row", w: 1, h: 1 },
  LANE: { label: "1 col × 2 rows", w: 1, h: 2 },
  PANEL: { label: "2 cols × 2 rows", w: 2, h: 2 },
  STRIP: { label: "4 cols × 1 row", w: 4, h: 1 },
  WIDE: { label: "3 cols × 2 rows", w: 3, h: 2 },
  BOTTOM: { label: "4 cols × 2 rows", w: 4, h: 2 },
  FULL: { label: "5 cols × 2 rows", w: 5, h: 2 }
};

export const ALL_SIZE_PRESETS = Object.keys(SIZE_PRESETS);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function toSizePreset(w: number, h: number): string {
  return `W${clamp(Math.round(Number(w) || 1), 1, 5)}H${clamp(Math.round(Number(h) || 1), 1, 5)}`;
}

export function getSizeDimensions(preset: string): WidgetDimensions {
  return SIZE_PRESETS[preset] || LEGACY_SIZE_PRESETS[preset] || SIZE_PRESETS.W2H2;
}

export function isKnownSizePreset(preset: string): boolean {
  return Boolean(SIZE_PRESETS[preset] || LEGACY_SIZE_PRESETS[preset]);
}

export function applySizePreset<T extends WidgetLayoutItem>(widget: T, preset: string, columns: number): T {
  const size = getSizeDimensions(preset);
  widget.sizePreset = toSizePreset(size.w, size.h);
  widget.w = Math.min(size.w, columns);
  widget.h = size.h;
  widget.x = clamp(widget.x || 0, 0, Math.max(0, columns - widget.w));
  widget.y = Math.max(0, widget.y || 0);
  return widget;
}
