// Shared value helpers used by both the plugin core and widget definitions.
// Single source of truth: do not re-declare these in main.ts or widget-api.ts.

export function deepClone(value: LooseValue): LooseValue {
  return JSON.parse(JSON.stringify(value));
}

export function mergeDefaults(base: LooseValue, saved: LooseValue): LooseValue {
  if (Array.isArray(base)) {
    return Array.isArray(saved) ? deepClone(saved) : deepClone(base);
  }
  if (!base || typeof base !== "object") {
    return saved === undefined ? base : saved;
  }
  const next: Record<string, LooseValue> = {};
  const source: Record<string, LooseValue> = saved && typeof saved === "object" ? saved : {};
  for (const key of Object.keys(base)) {
    next[key] = mergeDefaults(base[key], source[key]);
  }
  for (const key of Object.keys(source)) {
    if (!(key in next)) {
      next[key] = source[key];
    }
  }
  return next;
}

export function normalizeArray(value: LooseValue, fallback: LooseValue): LooseValue {
  return Array.isArray(value) ? value.filter(Boolean) : deepClone(fallback);
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
