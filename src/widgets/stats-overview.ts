// @ts-nocheck
import {
  DEFAULT_STATS_PROJECT_FOLDERS,
  DEFAULT_TASK_FOLDERS
} from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import {
  localDateKey,
  normalizeArray,
  parseMetricList,
  reconcilePomodoroState
} from "./widget-api";

const { Setting } = require("obsidian");

export function getExecutionMetrics(api) {
  const habitsState = api.plugin.findFirstWidgetState("habits");
  const pomodoroState = api.plugin.findFirstWidgetState("pomodoro");
  const habits = normalizeArray(habitsState.habits, []);
  const todayKey = localDateKey(api.snapshot.now);
  const completedToday = habits.filter((habit) => (habitsState.completions || {})[`${habit}|${todayKey}`]).length;
  const todayRate = habits.length ? Math.round((completedToday / habits.length) * 100) : 0;
  return {
    projects: { label: "Projects", value: api.snapshot.getProjects(DEFAULT_STATS_PROJECT_FOLDERS, 0).length },
    tasks: { label: "Open tasks", value: api.snapshot.getOpenTasks(DEFAULT_TASK_FOLDERS, 0).length },
    habits: { label: "Habits today", value: `${todayRate}%` },
    pomodoro: { label: "Pomodoros", value: String(reconcilePomodoroState(pomodoroState, api.plugin.getFirstWidgetConfig("pomodoro")).todayCount || 0) }
  };
}

export const statsOverviewWidget = {
  type: "stats-overview",
  displayName: "Stats Overview",
  shell: "strip",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W4H1", w: 4, h: 1 },
  defaultConfig: { title: "execution overview", metrics: ["projects", "tasks", "habits", "pomodoro"] },
  defaultState: {},
  async render(container, api) {
    const metrics = getExecutionMetrics(api);
    const order = normalizeArray(api.widgetData.config.metrics, ["projects", "tasks", "habits", "pomodoro"]);
    const grid = container.createDiv({ cls: "yh-stat-grid" });
    for (const key of order) {
      if (!metrics[key]) continue;
      const card = grid.createDiv({ cls: "yh-stat-card" });
      card.createDiv({ cls: "yh-stat-value", text: String(metrics[key].value) });
      card.createDiv({ cls: "yh-stat-label", text: metrics[key].label });
    }
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Metrics").setDesc("Comma-separated: projects,tasks,habits,pomodoro").addText((text) => {
      text.setValue((draft.metrics || []).join(","));
      text.onChange((value) => {
        draft.metrics = parseMetricList(value);
      });
    });
  }
};
