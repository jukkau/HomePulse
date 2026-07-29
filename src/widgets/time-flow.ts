// @ts-nocheck
import { Setting, setIcon } from "obsidian";

import { renderEmpty } from "./widget-api";

const ALLOWED_SIZE_PRESETS = ["W2H2", "W3H2", "W4H2", "W5H2", "W2H3", "W3H3", "W4H3", "W5H3"];

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" }
];

function formatDuration(minutes) {
  const safe = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDateTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return `${date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} ${date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })}`;
}

function targetTitle(log) {
  if (log.targetType === "project") return log.projectTitle || log.projectId || log.targetId;
  if (log.targetType === "area") return log.areaTitle || log.areaId || log.targetId;
  if (log.targetType === "task") return log.taskId || log.targetId;
  return log.targetId;
}

function rangeBounds(range, now) {
  const date = now instanceof Date ? now : new Date();
  const end = date.getTime();
  if (range === "today") {
    return { start: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(), end };
  }
  if (range === "week") {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = start.getDay() === 0 ? 7 : start.getDay();
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end };
  }
  return { start: new Date(date.getFullYear(), date.getMonth(), 1).getTime(), end };
}

function renderBuckets(parent, title, buckets) {
  const section = parent.createDiv({ cls: "yh-time-flow-section" });
  section.createDiv({ cls: "yh-time-flow-section-title", text: title });
  const list = section.createDiv({ cls: "yh-time-flow-buckets" });
  const top = buckets.slice(0, 3);
  if (!top.length) {
    list.createDiv({ cls: "yh-time-flow-empty-line", text: "No data" });
    return;
  }

  for (const bucket of top) {
    const row = list.createDiv({ cls: "yh-time-flow-bucket" });
    row.createDiv({ cls: "yh-time-flow-bucket-title", text: bucket.title || bucket.id || "Untitled" });
    row.createDiv({ cls: "yh-time-flow-bucket-value", text: formatDuration(bucket.duration) });
  }
}

function renderRangeTabs(parent, activeRange, onSelect) {
  const tabs = parent.createDiv({ cls: "yh-time-flow-tabs" });
  for (const range of RANGES) {
    const button = tabs.createEl("button", {
      cls: range.key === activeRange ? "yh-time-flow-tab is-active" : "yh-time-flow-tab",
      text: range.label
    });
    button.addEventListener("click", () => onSelect(range.key));
  }
}

export const timeFlowWidget = {
  type: "time-flow",
  displayName: "Time Flow",
  shell: "panel",
  allowedSizes: ALLOWED_SIZE_PRESETS,
  defaultSize: { preset: "W3H2", w: 3, h: 2 },
  defaultConfig: { title: "time flow", recentLimit: 6 },
  defaultState: {},
  async render(container, api) {
    const uiState = api.getUiState();
    const activeRange = RANGES.some((item) => item.key === uiState.range) ? uiState.range : "today";
    const recentLimit = Math.max(3, Math.min(10, Number(api.widgetData.config.recentLimit) || 6));
    const summary = api.getTimeSummary(activeRange);
    const bounds = rangeBounds(activeRange, api.snapshot.now);
    const logs = api.getTimeLogs({ startDate: bounds.start, endDate: bounds.end })
      .slice()
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, recentLimit);

    const root = container.createDiv({ cls: "yh-time-flow" });
    const top = root.createDiv({ cls: "yh-time-flow-top" });
    const metric = top.createDiv({ cls: "yh-time-flow-metric" });
    metric.createDiv({ cls: "yh-time-flow-total", text: formatDuration(summary.totalDuration) });
    metric.createDiv({ cls: "yh-time-flow-meta", text: `${summary.count} logs` });
    renderRangeTabs(top, activeRange, (range) => {
      api.setUiState({ range });
      api.requestRender();
    });

    const bucketGrid = root.createDiv({ cls: "yh-time-flow-grid" });
    renderBuckets(bucketGrid, "Projects", summary.byProject);
    renderBuckets(bucketGrid, "Areas", summary.byArea);

    const recent = root.createDiv({ cls: "yh-time-flow-recent" });
    recent.createDiv({ cls: "yh-time-flow-section-title", text: "Recent" });
    if (!logs.length) {
      renderEmpty(recent, "No time logs yet.");
      return;
    }

    const list = recent.createDiv({ cls: "yh-list yh-time-flow-list" });
    for (const log of logs) {
      const row = list.createDiv({ cls: "yh-list-row yh-time-flow-row" });
      const left = row.createDiv({ cls: "yh-list-left" });
      left.createDiv({ cls: "yh-list-title", text: targetTitle(log) || "Untitled" });
      left.createDiv({ cls: "yh-list-meta", text: `${formatDateTime(log.startTime)} / ${formatDuration(log.duration)} / ${log.source}` });
      const remove = row.createEl("button", { cls: "yh-time-flow-delete", attr: { "aria-label": "Delete time log" } });
      setIcon(remove, "trash-2");
      remove.addEventListener("click", async (event) => {
        event.stopPropagation();
        await api.deleteTimeLog(log.id);
        api.requestRender();
      });
    }
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Recent logs").setDesc("How many recent rows to show (3-10).").addText((text) => {
      text.setValue(String(draft.recentLimit || 6));
      text.onChange((value) => {
        draft.recentLimit = Math.max(3, Math.min(10, Number(value) || 6));
      });
    });
  }
};
