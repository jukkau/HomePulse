// Shared value helpers used by both the plugin core and widget definitions.
// Single source of truth: do not re-declare these in main.ts or widget-api.ts.

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function mergeDefaults<T>(base: T, saved: unknown): T {
  if (Array.isArray(base)) {
    return (Array.isArray(saved) ? deepClone(saved as unknown[]) : deepClone(base as unknown[])) as T;
  }
  if (!base || typeof base !== "object") {
    return (saved === undefined ? base : saved) as T;
  }
  const next: Record<string, LooseValue> = {};
  const baseObj = base as Record<string, unknown>;
  const sourceObj = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  for (const key of Object.keys(baseObj)) {
    next[key] = mergeDefaults(baseObj[key], sourceObj[key]) as unknown;
  }
  for (const key of Object.keys(sourceObj)) {
    if (!(key in next)) {
      next[key] = sourceObj[key] as unknown;
    }
  }
  return next as T;
}

export function normalizeArray<T>(value: LooseValue, fallback: T[]): T[] {
  if (!Array.isArray(value)) return deepClone(fallback);
  const kept = value.filter(Boolean);
  return kept as T[];
}

export function parseLineList(raw: LooseValue): string[] {
  return String(raw || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
