// @ts-nocheck
// Migration note: registry is the single registration entry for all widgets.

import { activityHistoryWidget } from "./activity-history";
import { bookmarksWidget } from "./bookmarks";
import { calendarWidget } from "./calendar";
import { focusWidget } from "./focus";
import { habitsWidget } from "./habits";
import { knowledgeProfileWidget } from "./knowledge-profile";
import { musicPlayerWidget } from "./music-player";
import { pomodoroWidget } from "./pomodoro";
import { projectsWidget } from "./projects";
import { quickActionsWidget } from "./quick-actions";
import { recentNotesWidget } from "./recent-notes";
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
    musicPlayerWidget,
    habitsWidget,
    bookmarksWidget,
    quickActionsWidget,
    statsOverviewWidget,
    knowledgeProfileWidget,
    recentNotesWidget,
    techTreeWidget,
    activityHistoryWidget
  ];
}
