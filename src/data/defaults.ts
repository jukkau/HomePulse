/**
 * Public default configuration for a first-time installation.
 *
 * IMPORTANT RULES FOR PUBLIC RELEASE
 * ─────────────────────────────────
 * 1. Do NOT include any personal paths, names, habits, or focus text.
 * 2. All folder references use generic placeholders (e.g. "Projects/").
 * 3. Widget state must start empty — no pre-filled habits, no focus text.
 * 4. Users configure their own data through the SetupWizard or Settings tab.
 *
 * Personal data (data.json) is gitignored and never committed.
 */

export const DEFAULT_DATA = {
  schemaVersion: 1,

  /** false when a user first installs the plugin */
  initialized: false,

  settings: {
    openOnStartup: true,
    lockHomepage: true,
    themePreset: "petal",
    profileName: "My Homepage",
    profileSignature: "",
    obsidianStartDate: "",
    techTreeSource: "",
    techTreeAreaRoot: "20_Areas",
    techTreeActiveProjectRoot: "Projects"
  },

  layout: {
    columns: 5,
    widgets: [
      { id: "focus-main", type: "focus", x: 0, y: 0, sizePreset: "W1H1" },
      { id: "stats-main", type: "stats-overview", x: 1, y: 0, sizePreset: "W4H1" },
      { id: "tasks-main", type: "tasks", x: 0, y: 1, sizePreset: "W1H3" },
      { id: "calendar-main", type: "calendar", x: 1, y: 1, sizePreset: "W2H2" },
      { id: "pomodoro-main", type: "pomodoro", x: 3, y: 1, sizePreset: "W1H2" },
      { id: "projects-main", type: "projects", x: 4, y: 1, sizePreset: "W1H3" },
      { id: "habits-main", type: "habits", x: 1, y: 3, sizePreset: "W2H2" },
      { id: "quick-actions-main", type: "quick-actions", x: 0, y: 3, sizePreset: "W1H2" },
      { id: "tech-tree-main", type: "tech-tree", x: 3, y: 3, sizePreset: "W3H2" },
      { id: "activity-main", type: "activity-history", x: 2, y: 5, sizePreset: "W4H2" }
    ]
  },

  widgets: {
    "focus-main": {
      config: { title: "today's goal", placeholder: "define your focus..." },
      state: { text: "" }
    },
    "stats-main": {
      config: { title: "execution overview" },
      state: {}
    },
    "projects-main": {
      config: {
        title: "projects",
        folders: [],
        limit: 10
      },
      state: {}
    },
    "tasks-main": {
      config: {
        title: "open tasks",
        folders: [],
        limit: 12
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
        habits: [],
        completions: {}
      }
    },
    "quick-actions-main": {
      config: {
        title: "system",
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
    "tech-tree-main": { config: { title: "tech tree", sourcePath: "", areaRoot: "", activeProjectRoot: "" },
      state: {}
    },
    "activity-main": {
      config: { title: "activity history", sourcePath: "/" },
      state: {}
    }
  }
};
