import { DEFAULT_TECH_TREE_SOURCE } from "../constants";

export const DEFAULT_DATA = {
  schemaVersion: 1,
  settings: {
    openOnStartup: true,
    lockHomepage: true,
    themePreset: "petal",
    profileName: "Your name",
    profileSignature: "A personal Obsidian homepage",
    obsidianStartDate: "",
    techTreeSource: DEFAULT_TECH_TREE_SOURCE,
    techTreeAreaRoot: "20_Areas",
    techTreeActiveProjectRoot: "10_Projects/进行中"
  },
  layout: {
    columns: 5,
    widgets: [
      { id: "focus-main", type: "focus", x: 0, y: 0, sizePreset: "W1H1" },
      { id: "activity-main", type: "activity-history", x: 1, y: 0, sizePreset: "W4H2" },
      { id: "projects-main", type: "projects", x: 0, y: 1, sizePreset: "W1H3" },
      { id: "habits-main", type: "habits", x: 1, y: 2, sizePreset: "W2H2" },
      { id: "pomodoro-main", type: "pomodoro", x: 3, y: 2, sizePreset: "W1H2" },
      { id: "calendar-main", type: "calendar", x: 4, y: 2, sizePreset: "W1H2" },
      { id: "tasks-main", type: "tasks", x: 0, y: 4, sizePreset: "W1H3" },
      { id: "tech-tree-main", type: "tech-tree", x: 1, y: 4, sizePreset: "W3H2" },
      { id: "ai-main", type: "quick-actions", x: 4, y: 4, sizePreset: "W1H2" }
    ]
  },
  widgets: {
    "focus-main": {
      config: { title: "today's goal", placeholder: "define your focus..." },
      state: { text: "do the work. trust the process." }
    },
    "projects-main": {
      config: {
        title: "projects",
        folders: ["10_Projects/\u8fdb\u884c\u4e2d"],
        limit: 6
      },
      state: {}
    },
    "tasks-main": {
      config: {
        title: "open tasks",
        folders: ["10_Projects/\u8fdb\u884c\u4e2d"],
        limit: 6
      },
      state: {}
    },
    "calendar-main": {
      config: { title: "calendar" },
      state: {}
    },
    "pomodoro-main": {
      config: {
        title: "pomodoro",
        workMinutes: 25,
        breakMinutes: 5
      },
      state: {
        status: "idle",
        remainingSeconds: 1500,
        phaseStartedAt: 0,
        todayCountDate: "",
        todayCount: 0
      }
    },
    "habits-main": {
      config: { title: "habits" },
      state: {
        habits: ["read", "move", "write"],
        completions: {}
      }
    },
    "ai-main": {
      config: {
        title: "quick actions",
        variant: "grid",
        sectionTitle: "",
        items: [
          { label: "daily", type: "daily-note", value: "" },
          { label: "search", type: "command", value: "global-search:open" },
          { label: "commands", type: "command", value: "command-palette:open" }
        ],
        secondaryTitle: "",
        secondaryItems: []
      },
      state: {}
    },
    "tech-tree-main": {
      config: { title: "tech tree", sourcePath: "" },
      state: {}
    },
    "activity-main": {
      config: { title: "activity history", sourcePath: "/" },
      state: {}
    }
  }
};
