// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { createSvg } from "./widget-api";

import { Setting, setIcon } from "obsidian";

// A tiny inline bar sparkline. Values are normalized against the series max so
// an empty week renders flat rather than throwing.
function renderSparkline(parent, values) {
  const max = Math.max(1, ...values);
  const svg = createSvg(parent, "svg", {
    class: "yh-pulse-sparkline",
    viewBox: "0 0 70 24",
    preserveAspectRatio: "none",
    role: "img"
  });
  const barWidth = 70 / values.length;
  values.forEach((value, index) => {
    const height = Math.max(2, Math.round((value / max) * 22));
    createSvg(svg, "rect", {
      x: (index * barWidth + 1).toFixed(1),
      y: (24 - height).toFixed(1),
      width: (barWidth - 2).toFixed(1),
      height: String(height),
      rx: "1",
      class: index === values.length - 1 ? "yh-pulse-spark-bar is-current" : "yh-pulse-spark-bar"
    });
  });
}

function renderTaskMatrix(parent, pct) {
  const totalCells = 18;
  const doneCells = Math.round((Math.max(0, Math.min(100, pct)) / 100) * totalCells);
  const matrix = parent.createDiv({ cls: "yh-pulse-task-matrix", attr: { "aria-hidden": "true" } });
  for (let index = 0; index < totalCells; index += 1) {
    matrix.createDiv({ cls: index < doneCells ? "yh-pulse-task-cell is-done" : "yh-pulse-task-cell" });
  }
}

function renderPomodoroRails(parent, count) {
  const done = Math.max(0, Number(count) || 0);
  const rails = parent.createDiv({ cls: "yh-pulse-focus-rails", attr: { "aria-hidden": "true" } });
  for (let row = 0; row < 3; row += 1) {
    const rail = rails.createDiv({ cls: "yh-pulse-focus-rail" });
    for (let slot = 0; slot < 6; slot += 1) {
      const index = row * 6 + slot;
      const cls = index < done ? "yh-pulse-focus-node is-done" : index === done ? "yh-pulse-focus-node is-next" : "yh-pulse-focus-node";
      rail.createDiv({ cls });
    }
  }
}

function renderHabitTree(parent, streakDays, todayRate) {
  const safeStreak = Math.max(0, Math.min(365, Number(streakDays) || 0));
  const leafCount = Math.max(3, Math.min(18, Math.ceil(Math.sqrt(safeStreak) * 0.95)));
  const tone = todayRate >= 100 ? "is-bright" : todayRate > 0 ? "is-mid" : "is-dim";
  const tree = parent.createDiv({ cls: `yh-pulse-habit-tree ${tone}`, attr: { "aria-hidden": "true" } });
  const crown = tree.createDiv({ cls: "yh-pulse-habit-crown" });
  for (let index = 0; index < leafCount; index += 1) {
    crown.createSpan({ cls: `yh-pulse-habit-leaf leaf-${index % 18}` });
  }
  tree.createDiv({ cls: "yh-pulse-habit-trunk" });
  tree.createDiv({ cls: "yh-pulse-habit-root" });
}

export const statsOverviewWidget = {
  type: "stats-overview",
  displayName: "Execution Pulse",
  shell: "strip",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W4H2", w: 4, h: 2 },
  defaultConfig: { title: "execution pulse" },
  defaultState: {},
  // Weekly-scale rhythm only. Raw project/task/focus content lives in their own
  // widgets; Execution Pulse shows the trend, never a second copy of the list.
  async render(container, api) {
    const snapshot = api.snapshot;
    const grid = container.createDiv({ cls: "yh-pulse-trends" });

    // Each card: header (icon + label), a big focal value, then a visualization
    // that grows to fill the remaining height — so tall cards read as intentional
    // rather than mostly-empty.
    const card = (key, icon, title, value, unit) => {
      const el = grid.createDiv({ cls: `yh-pulse-metric is-${key}` });
      const head = el.createDiv({ cls: "yh-pulse-metric-head" });
      const iconEl = head.createSpan({ cls: "yh-pulse-icon" });
      setIcon(iconEl, icon);
      head.createSpan({ text: title });
      const valueRow = el.createDiv({ cls: "yh-pulse-metric-value" });
      valueRow.createSpan({ cls: "yh-pulse-metric-num", text: value });
      if (unit) valueRow.createSpan({ cls: "yh-pulse-metric-unit", text: unit });
      return el.createDiv({ cls: "yh-pulse-metric-viz" });
    };

    // Habits: fixed tree; streak grows leaves while today's completion controls brightness.
    const habitsViz = card("habits", "sprout", "Habits", `${snapshot.habitTodayRate}%`, "today");
    renderHabitTree(habitsViz, snapshot.habitStreakDays, snapshot.habitTodayRate);
    const habitSub = snapshot.habitStreakDays
      ? `已打卡 ${snapshot.habitStreakDays} 天`
      : `已完成 ${snapshot.habitCompletedToday}/${snapshot.habitTotal} 个习惯`;
    habitsViz.createDiv({ cls: "yh-pulse-metric-sub", text: habitSub });

    // Focus: today's time investment (numbers, not the focus statement itself).
    const focusViz = card("focus", "flame", "Focus", `${snapshot.pomodoroMinutesToday}`, "min today");
    renderPomodoroRails(focusViz, snapshot.pomodoroToday);
    focusViz.createDiv({ cls: "yh-pulse-metric-sub", text: `${snapshot.pomodoroToday} pomodoros logged` });

    // Knowledge: 7-day note-creation trend.
    const knowledgeViz = card("knowledge", "book-open", "Knowledge", `+${snapshot.notesThisWeek}`, "this week");
    renderSparkline(knowledgeViz.createDiv({ cls: "yh-pulse-spark-wrap" }), snapshot.notesDailyLast7);
    knowledgeViz.createDiv({ cls: "yh-pulse-metric-sub", text: "7-day note rhythm" });

    // Tasks: all indexed project-task checkboxes, so it closes the row as the
    // broadest scope.
    const total = snapshot.openTaskCount + snapshot.doneTaskCount;
    const donePct = total ? Math.round((snapshot.doneTaskCount / total) * 100) : 0;
    const tasksViz = card("tasks", "check-check", "Tasks", `${donePct}%`, "done");
    renderTaskMatrix(tasksViz, donePct);
    tasksViz.createDiv({ cls: "yh-pulse-metric-sub", text: `${snapshot.openTaskCount} open · ${snapshot.doneTaskCount} done` });
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
  }
};
