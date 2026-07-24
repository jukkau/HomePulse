import type { WidgetLayoutItem } from "../types";
import { applySizePreset } from "./size-presets";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function collides(placed: WidgetLayoutItem[], candidate: WidgetLayoutItem): boolean {
  return placed.some((item) => !(
    candidate.y >= item.y + (item.h || 0) ||
    candidate.y + (candidate.h || 0) <= item.y ||
    candidate.x >= item.x + (item.w || 0) ||
    candidate.x + (candidate.w || 0) <= item.x
  ));
}

function findSlot(
  placed: WidgetLayoutItem[],
  widget: WidgetLayoutItem,
  columns: number,
  preferredX: number,
  preferredY: number,
  compact: boolean,
  denseCompact: boolean
): { x: number; y: number } {
  const maxX = Math.max(0, columns - (widget.w || 0));
  const exact = { x: clamp(preferredX, 0, maxX), y: Math.max(0, preferredY) };
  if (!compact && !collides(placed, { ...widget, ...exact })) {
    return exact;
  }
  const preferred = clamp(preferredX, 0, maxX);
  if (compact) {
    for (let y = 0; y < 240; y += 1) {
      const xOrder = denseCompact
        ? [preferred, ...Array.from({ length: maxX + 1 }, (_, x) => x).filter((x) => x !== preferred)]
        : [preferred];
      for (const x of xOrder) {
        const candidate = { x, y };
        if (!collides(placed, { ...widget, ...candidate })) {
          return candidate;
        }
      }
    }
  }
  for (let y = 0; y < 240; y += 1) {
    const xOrder = [preferred, ...Array.from({ length: maxX + 1 }, (_, x) => x).filter((x) => x !== preferred)];
    for (const x of xOrder) {
      const candidate = { x, y };
      if (!collides(placed, { ...widget, ...candidate })) {
        return candidate;
      }
    }
  }
  return { x: 0, y: placed.reduce((max, item) => Math.max(max, item.y + (item.h || 0)), 0) };
}

export function packLayout(
  items: WidgetLayoutItem[],
  columns: number,
  preferred: Record<string, { x: number; y: number }> = {},
  priorityIds: string[] = [],
  compact = false,
  denseCompact = false,
  preservePriorityPositions = true
): WidgetLayoutItem[] {
  const prioritySet = new Set(priorityIds);
  const ordered = [...items].sort((a, b) => {
    const aPriority = prioritySet.has(a.id) ? 0 : 1;
    const bPriority = prioritySet.has(b.id) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    if ((a.y || 0) !== (b.y || 0)) return (a.y || 0) - (b.y || 0);
    return (a.x || 0) - (b.x || 0);
  });
  const placed: WidgetLayoutItem[] = [];
  for (const raw of ordered) {
    const widget = applySizePreset(deepClone(raw), raw.sizePreset || "PANEL", columns);
    const target = preferred[widget.id] || { x: widget.x, y: widget.y };
    const slot = findSlot(
      placed,
      widget,
      columns,
      target.x,
      target.y,
      compact && (!prioritySet.has(widget.id) || !preservePriorityPositions),
      denseCompact
    );
    widget.x = slot.x;
    widget.y = slot.y;
    placed.push(widget);
  }
  return sortLayoutForReadingOrder(placed);
}

export function sortLayoutForReadingOrder(widgets: WidgetLayoutItem[]): WidgetLayoutItem[] {
  return [...widgets].sort((a, b) => {
    if ((a.y || 0) !== (b.y || 0)) return (a.y || 0) - (b.y || 0);
    if ((a.x || 0) !== (b.x || 0)) return (a.x || 0) - (b.x || 0);
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export function getGridRows(widgets: WidgetLayoutItem[]): number {
  return Math.max(1, widgets.reduce((max, widget) => Math.max(max, widget.y + (widget.h || 0)), 0));
}
