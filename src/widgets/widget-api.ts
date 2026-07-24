// @ts-nocheck
// Migration note: WidgetRenderApi interface for widget definitions.
// This is a type boundary that will be refined when @ts-nocheck is removed.

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function mergeDefaults(base, saved) {
  if (Array.isArray(base)) {
    return Array.isArray(saved) ? deepClone(saved) : deepClone(base);
  }
  if (!base || typeof base !== "object") {
    return saved === undefined ? base : saved;
  }
  const next = {};
  const source = saved && typeof saved === "object" ? saved : {};
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

export function normalizeArray(value, fallback) {
  return Array.isArray(value) ? value.filter(Boolean) : deepClone(fallback);
}

export function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function countDistinctCompletionDays(completions) {
  const days = new Set();
  for (const [key, completed] of Object.entries(completions || {})) {
    if (!completed) continue;
    const separator = key.lastIndexOf("|");
    const dateKey = separator >= 0 ? key.slice(separator + 1) : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) days.add(dateKey);
  }
  return days.size;
}

export function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay() === 0 ? 7 : copy.getDay();
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function parseLineList(raw) {
  return String(raw || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeQuickActions(items) {
  return normalizeArray(items, []).map((item) => `${item.label}|${item.type}|${item.value}`).join("\n");
}

export function parseQuickActions(raw) {
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

export function formatSeconds(total) {
  const safe = Math.max(0, Number(total) || 0);
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function renderEmpty(container, text) {
  container.createDiv({ cls: "yh-empty", text });
}

export function createSvg(parent, tag, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  parent.appendChild(node);
  return node;
}

export function reconcilePomodoroState(state, config) {
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

export function calculateHabitRate(habits, completions, weekStart, habitDays) {
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

export function parseMetricList(raw) {
  const allowed = ["projects", "tasks", "habits", "pomodoro"];
  const items = String(raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const next = items.filter((item) => allowed.includes(item));
  return next.length ? next : allowed;
}
