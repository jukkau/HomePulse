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
  schemaVersion: 2,

  /** false when a user first installs the plugin */
  initialized: false,

  settings: {
    openOnStartup: true,
    lockHomepage: true,
    language: "en",
    themePreset: "petal",
    accentColor: "#f5c2e7",
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
      { id: "knowledge-main", type: "knowledge-profile", x: 1, y: 0, sizePreset: "W2H1" },
      { id: "music-player-b5317ac", type: "music-player", x: 3, y: 0, sizePreset: "W2H1" },
      { id: "habits-b0sr8rf", type: "habits", x: 0, y: 1, sizePreset: "W2H2" },
      { id: "pomodoro-64kmxai", type: "pomodoro", x: 2, y: 1, sizePreset: "W1H2" },
      { id: "tasks-lt2bqf1", type: "tasks", x: 3, y: 1, sizePreset: "W1H4" },
      { id: "calendar-1hcbws7", type: "calendar", x: 4, y: 1, sizePreset: "W1H2" },
      { id: "stats-main", type: "stats-overview", x: 0, y: 3, sizePreset: "W3H2" },
      { id: "bookmarks-b1qil66", type: "bookmarks", x: 4, y: 3, sizePreset: "W1H2" },
      { id: "tech-tree-main", type: "tech-tree", x: 0, y: 5, sizePreset: "W2H4" },
      { id: "projects-3fn9vd3", type: "projects", x: 2, y: 5, sizePreset: "W1H2" },
      { id: "recent-notes-xmng40z", type: "recent-notes", x: 3, y: 5, sizePreset: "W1H2" },
      { id: "quick-actions-0h6rh95", type: "quick-actions", x: 4, y: 5, sizePreset: "W1H2" },
      { id: "activity-main", type: "activity-history", x: 2, y: 7, sizePreset: "W3H2" }
    ]
  },

  layoutPresets: [
    {
      id: "public-default",
      name: "Public default",
      isBuiltIn: true,
      layout: {
        columns: 5,
        widgets: [
          { id: "focus-main", type: "focus", x: 0, y: 0, sizePreset: "W1H1" },
          { id: "knowledge-main", type: "knowledge-profile", x: 1, y: 0, sizePreset: "W2H1" },
          { id: "music-player-b5317ac", type: "music-player", x: 3, y: 0, sizePreset: "W2H1" },
          { id: "habits-b0sr8rf", type: "habits", x: 0, y: 1, sizePreset: "W2H2" },
          { id: "pomodoro-64kmxai", type: "pomodoro", x: 2, y: 1, sizePreset: "W1H2" },
          { id: "tasks-lt2bqf1", type: "tasks", x: 3, y: 1, sizePreset: "W1H4" },
          { id: "calendar-1hcbws7", type: "calendar", x: 4, y: 1, sizePreset: "W1H2" },
          { id: "stats-main", type: "stats-overview", x: 0, y: 3, sizePreset: "W3H2" },
          { id: "bookmarks-b1qil66", type: "bookmarks", x: 4, y: 3, sizePreset: "W1H2" },
          { id: "tech-tree-main", type: "tech-tree", x: 0, y: 5, sizePreset: "W2H4" },
          { id: "projects-3fn9vd3", type: "projects", x: 2, y: 5, sizePreset: "W1H2" },
          { id: "recent-notes-xmng40z", type: "recent-notes", x: 3, y: 5, sizePreset: "W1H2" },
          { id: "quick-actions-0h6rh95", type: "quick-actions", x: 4, y: 5, sizePreset: "W1H2" },
          { id: "activity-main", type: "activity-history", x: 2, y: 7, sizePreset: "W3H2" }
        ]
      }
    }
  ],

  defaultLayoutPresetId: "public-default",

  timeLogs: [],

  widgets: {
    "focus-main": {
      config: { title: "today's goal", placeholder: "define your focus..." },
      state: { text: "" }
    },
    "stats-main": {
      config: { title: "execution pulse" },
      state: {}
    },
    "knowledge-main": {
      config: {
        title: "knowledge profile",
        projectNamePrefixes: ["Project_"],
        projectFolders: [],
        projectTags: []
      },
      state: {}
    },
    "music-player-b5317ac": {
      config: {
        title: "music player",
        serviceName: "NetEase Cloud Music",
        loginUrl: "https://music.163.com/",
        playUrl: "https://music.163.com/"
      },
      state: {}
    },
    "habits-b0sr8rf": {
      config: { title: "habits" },
      state: {
        habits: [],
        completions: {}
      }
    },
    "pomodoro-64kmxai": {
      config: {
        title: "pomodoro",
        workMinutes: 25,
        breakMinutes: 5,
        projectFolders: [],
        projectTags: ["type/project"],
        projectNamePrefixes: ["Project_"],
        areaFolders: ["20_Areas"],
        areaTags: [],
        areaNamePrefixes: ["Area_"],
        taskFile: "10_Projects/进行中/QuickCapture.md"
      },
      state: {
        status: "idle",
        remainingSeconds: 1500,
        phaseStartedAt: 0,
        todayCountDate: "",
        todayCount: 0,
        recentTargets: []
      }
    },
    "tasks-lt2bqf1": {
      config: {
        title: "open tasks",
        projectFolders: [],
        projectTags: [],
        projectNamePrefixes: ["Project_"],
        limit: 12
      },
      state: {}
    },
    "calendar-1hcbws7": {
      config: { title: "calendar" },
      state: {}
    },
    "bookmarks-b1qil66": {
      config: {
        title: "bookmarks",
        variant: "grid",
        useFavicons: false,
        items: []
      },
      state: {}
    },
    "projects-3fn9vd3": {
      config: {
        title: "projects",
        projectFolders: [],
        projectTags: [],
        projectNamePrefixes: ["Project_"],
        limit: 10
      },
      state: {}
    },
    "recent-notes-xmng40z": {
      config: { title: "recently updated", limit: 6 },
      state: {}
    },
    "quick-actions-0h6rh95": {
      config: {
        title: "system",
        variant: "grid",
        sectionTitle: "",
        items: [
          { label: "daily", type: "daily-note", value: "" },
          { label: "search", type: "command", value: "global-search:open" }
        ],
        secondaryTitle: "",
        secondaryItems: []
      },
      state: {}
    },
    "tech-tree-main": { config: { title: "tech tree", sourcePath: "", areaRoot: "", projectFolders: ["10_Projects/进行中"], projectTags: ["type/project", "status/ing"], projectNamePrefixes: ["Project_"] },
      state: {}
    },
    "activity-main": {
      config: { title: "activity history", sourcePath: "/", year: "" },
      state: {}
    }
  }
};
