// Widget-facing helpers. Generic value utilities live in ../core/utils and are
// re-exported here so widgets keep a single import surface.

import { deepClone, mergeDefaults, normalizeArray, parseLineList } from "../core/utils";

export { deepClone, mergeDefaults, normalizeArray, parseLineList };

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function countDistinctCompletionDays(completions: LooseValue): number {
  const days = new Set();
  for (const [key, completed] of Object.entries(completions || {})) {
    if (!completed) continue;
    const separator = key.lastIndexOf("|");
    const dateKey = separator >= 0 ? key.slice(separator + 1) : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) days.add(dateKey);
  }
  return days.size;
}

export function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay() === 0 ? 7 : copy.getDay();
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function serializeQuickActions(items: LooseValue): string {
  return normalizeArray(items, []).map((item: LooseValue) => `${item.label}|${item.type}|${item.value}`).join("\n");
}

export function parseQuickActions(raw: LooseValue): LooseValue[] {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, type, ...rest] = line.split("|").map((part) => part.trim());
      return {
        label: label || "action",
        type: type || "command",
        value: rest.join("|")
      };
    });
}

export function formatSeconds(total: LooseValue): string {
  const safe = Math.max(0, Number(total) || 0);
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function renderEmpty(container: LooseValue, text: string): void {
  container.createDiv({ cls: "yh-empty", text });
}

export function createSvg(parent: LooseValue, tag: string, attributes: Record<string, string> = {}): SVGElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  parent.appendChild(node);
  return node;
}

export function reconcilePomodoroState(state: LooseValue, config: LooseValue): LooseValue {
  const workSeconds = (Number(config.workMinutes) || 25) * 60;
  const breakSeconds = (Number(config.breakMinutes) || 5) * 60;
  const next = mergeDefaults({
    status: "idle",
    remainingSeconds: workSeconds,
    phaseStartedAt: 0,
    todayCountDate: "",
    todayCount: 0
  }, state || {});

  const today = localDateKey(new Date());
  if (next.todayCountDate !== today) {
    next.todayCountDate = today;
    next.todayCount = 0;
  }

  if (next.status === "running" || next.status === "break") {
    const elapsed = next.phaseStartedAt ? Math.floor((Date.now() - next.phaseStartedAt) / 1000) : 0;
    const remaining = next.remainingSeconds - elapsed;
    if (remaining > 0) {
      return { ...next, remainingSeconds: remaining };
    }
    if (next.status === "running") {
      return {
        ...next,
        status: "break",
        remainingSeconds: breakSeconds + remaining,
        phaseStartedAt: Date.now(),
        todayCount: next.todayCount + 1
      };
    }
    return {
      ...next,
      status: "idle",
      remainingSeconds: workSeconds + remaining,
      phaseStartedAt: 0
    };
  }

  if (!next.remainingSeconds || next.remainingSeconds <= 0) {
    next.remainingSeconds = workSeconds;
  }
  return next;
}

export function calculateHabitRate(habits: LooseValue, completions: LooseValue, weekStart: Date, habitDays: number): number {
  const list = normalizeArray(habits, []);
  const total = list.length * habitDays;
  if (!total) return 0;
  let done = 0;
  for (const habit of list) {
    for (let i = 0; i < habitDays; i += 1) {
      if (completions[`${habit}|${localDateKey(addDays(weekStart, i))}`]) {
        done += 1;
      }
    }
  }
  return Math.round((done / total) * 100);
}

export function parseMetricList(raw: LooseValue): string[] {
  const allowed = ["projects", "tasks", "habits", "pomodoro"];
  const items = String(raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const next = items.filter((item) => allowed.includes(item));
  return next.length ? next : allowed;
}
