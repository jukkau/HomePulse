// @ts-nocheck
// Migration note: registry is the single registration entry for all widgets.

import { activityHistoryWidget } from "./activity-history";
import { calendarWidget } from "./calendar";
import { focusWidget } from "./focus";
import { habitsWidget } from "./habits";
import { pomodoroWidget } from "./pomodoro";
import { projectsWidget } from "./projects";
import { quickActionsWidget } from "./quick-actions";
import { statsOverviewWidget } from "./stats-overview";
import { tasksWidget } from "./tasks";
import { techTreeWidget } from "./tech-tree";

export function createWidgetRegistry(plugin) {
  void plugin;
  return [
    focusWidget,
    projectsWidget,
    tasksWidget,
    calendarWidget,
    pomodoroWidget,
    habitsWidget,
    quickActionsWidget,
    statsOverviewWidget,
    techTreeWidget,
    activityHistoryWidget
  ];
}
