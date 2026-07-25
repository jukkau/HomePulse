// @ts-nocheck
import {
  DEFAULT_STATS_PROJECT_FOLDERS,
  DEFAULT_TASK_FOLDERS
} from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import {
  localDateKey,
  normalizeArray,
  reconcilePomodoroState
} from "./widget-api";

const { Setting, setIcon } = require("obsidian");

export function getExecutionMetrics(api) {
  const habitsState = api.plugin.findFirstWidgetState("habits");
  const pomodoroState = api.plugin.findFirstWidgetState("pomodoro");
  const habits = normalizeArray(habitsState.habits, []);
  const todayKey = localDateKey(api.snapshot.now);
  const completedToday = habits.filter((habit) => (habitsState.completions || {})[`${habit}|${todayKey}`]).length;
  const todayRate = habits.length ? Math.round((completedToday / habits.length) * 100) : 0;
  return {
    projects: { key: "projects", label: "Projects", value: api.snapshot.getProjects(DEFAULT_STATS_PROJECT_FOLDERS, 0).length },
    tasks: { key: "tasks", label: "Open tasks", value: api.snapshot.getOpenTasks(DEFAULT_TASK_FOLDERS, 0).length },
    habits: { key: "habits", label: "Habits today", value: `${todayRate}%` },
    pomodoro: { key: "pomodoro", label: "Pomodoros", value: String(reconcilePomodoroState(pomodoroState, api.plugin.getFirstWidgetConfig("pomodoro")).todayCount || 0) }
  };
}

export const statsOverviewWidget = {
  type: "stats-overview",
  displayName: "Execution Overview",
  shell: "strip",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W4H1", w: 4, h: 1 },
  defaultConfig: { title: "execution overview" },
  defaultState: {},
  async render(container, api) {
    const metrics = getExecutionMetrics(api);
    const groups = [
      {
        key: "vault",
        icon: "database",
        title: "Vault",
        items: [
          { key: "days", label: "Obsidian days", value: api.snapshot.obsidianDays ?? "—" },
          { key: "notes", label: "Notes", value: api.snapshot.files.length }
        ]
      },
      {
        key: "work",
        icon: "list-checks",
        title: "Work",
        items: [
          { key: "open", label: "Open", value: api.snapshot.openTaskCount },
          { key: "done", label: "Done", value: api.snapshot.doneTaskCount },
          metrics.projects
        ]
      },
      {
        key: "routine",
        icon: "repeat-2",
        title: "Routine",
        items: [
          metrics.pomodoro,
          metrics.habits
        ]
      }
    ];

    const groupGrid = container.createDiv({ cls: "yh-overview-groups" });
    for (const group of groups) {
      const section = groupGrid.createDiv({ cls: `yh-overview-group is-${group.key}` });
      const title = section.createDiv({ cls: "yh-overview-group-title" });
      const icon = title.createSpan({ cls: "yh-overview-group-icon" });
      setIcon(icon, group.icon);
      title.createSpan({ text: group.title });
      const metricGrid = section.createDiv({ cls: "yh-overview-metrics" });
      for (const metric of group.items) {
        const item = metricGrid.createDiv({ cls: `yh-overview-metric is-${metric.key}` });
        item.createDiv({ cls: "yh-overview-value", text: String(metric.value) });
        item.createDiv({ cls: "yh-overview-label", text: metric.label });
      }
    }
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
