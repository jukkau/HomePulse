import { DEFAULT_TECH_TREE_SOURCE } from "../constants";
import { readTechTreeData } from "./tech-tree-reader";
import { calculateObsidianUsageDays } from "./obsidian-usage";
import { normalizeArray } from "../core/utils";
import { localDateKey, reconcilePomodoroState } from "../widgets/widget-api";
import { normalizePath } from "obsidian";
import { matchesProjectFilter, type ProjectFilterDefaults } from "./project-filter";
import { getTimeRange } from "./time/TimeAggregation";

function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay() === 0 ? 7 : copy.getDay();
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function withinFolder(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folder).replace(/\/+$/, "");
  return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}

function isDateBasename(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(name);
}

function stripTaskText(text: string): string {
  return String(text || "")
    .replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_: string, path: string, alias: string) => alias || path)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export class SnapshotBuilder {
  app: any;
  plugin: any;
  files: any[];
  projectFiles: any[];
  projectIndex: any[];
  taskIndex: any[];
  dailyNotes: Map<string, any[]>;
  techTree: any;
  now: Date;
  openTaskCount: number;
  doneTaskCount: number;
  obsidianDays: number | null;
  // Cross-widget aggregates. Reading other widgets' state happens here, in one
  // place, so individual widgets depend only on the snapshot — never on each other.
  focusText: string;
  habitTodayRate: number;
  habitCompletedToday: number;
  habitTotal: number;
  habitStreakDays: number;
  habitDailyLast7: number[];
  pomodoroToday: number;
  pomodoroMinutesToday: number;
  notesThisWeek: number;
  notesDailyLast7: number[];
  updatedAreasThisWeek: number;
  techTreeSettings: { source: string; areaRoot: string; activeProjectRoot: string };

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.files = [];
    this.projectFiles = [];
    this.projectIndex = [];
    this.taskIndex = [];
    this.dailyNotes = new Map();
    this.techTree = null;
    this.now = new Date();
    this.openTaskCount = 0;
    this.doneTaskCount = 0;
    this.obsidianDays = null;
    this.focusText = "";
    this.habitTodayRate = 0;
    this.habitCompletedToday = 0;
    this.habitTotal = 0;
    this.habitStreakDays = 0;
    this.habitDailyLast7 = [];
    this.pomodoroToday = 0;
    this.pomodoroMinutesToday = 0;
    this.notesThisWeek = 0;
    this.notesDailyLast7 = [];
    this.updatedAreasThisWeek = 0;
    this.techTreeSettings = { source: "", areaRoot: "", activeProjectRoot: "" };
  }

  async load(): Promise<this> {
    this.files = this.app.vault.getMarkdownFiles();
    this.projectFiles = this.files;
    this.computeVaultUsage();
    this.indexDailyNotes();
    await this.indexProjectsAndTasks();
    await this.loadTechTree();
    this.computeWidgetAggregates();
    this.computeKnowledgeTrends();
    return this;
  }

  computeWidgetAggregates(): void {
    const settings = this.plugin.data.settings;
    this.techTreeSettings = {
      source: settings.techTreeSource || DEFAULT_TECH_TREE_SOURCE,
      areaRoot: settings.techTreeAreaRoot,
      activeProjectRoot: settings.techTreeActiveProjectRoot
    };

    const focusState = this.plugin.findFirstWidgetState("focus");
    this.focusText = String(focusState.text || "").trim();

    const habitsState = this.plugin.findFirstWidgetState("habits");
    const habits = normalizeArray(habitsState.habits, []);
    const todayKey = localDateKey(this.now);
    const completions = habitsState.completions || {};
    const completedToday = habits.filter(
      (habit: string) => completions[`${habit}|${todayKey}`]
    ).length;
    this.habitCompletedToday = completedToday;
    this.habitTotal = habits.length;
    this.habitTodayRate = habits.length ? Math.round((completedToday / habits.length) * 100) : 0;

    // Completion count per day for the last 7 days (oldest first).
    const habitBuckets = new Array(7).fill(0);
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate() - offset);
      const key = localDateKey(day);
      let done = 0;
      for (const habit of habits) {
        if (completions[`${habit}|${key}`]) done += 1;
      }
      habitBuckets[6 - offset] = done;
    }
    this.habitDailyLast7 = habitBuckets;
    this.habitStreakDays = this.countHabitStreakDays(habits, completions);

    const todayRange = getTimeRange("today", this.now);
    const pomodoroLogs = this.plugin.getTimeLogService().query({
      source: "pomodoro",
      startDate: todayRange.start,
      endDate: todayRange.end
    });
    const todaySummary = this.plugin.getTimeAggregation().summarize("today", this.now);
    this.pomodoroToday = pomodoroLogs.length;
    this.pomodoroMinutesToday = todaySummary.totalDuration;

    if (!this.pomodoroMinutesToday) {
      const pomodoroConfig = this.plugin.getFirstWidgetConfig("pomodoro");
      const pomodoroState = reconcilePomodoroState(this.plugin.findFirstWidgetState("pomodoro"), pomodoroConfig);
      this.pomodoroToday = Number(pomodoroState.todayCount) || 0;
      this.pomodoroMinutesToday = (Number(pomodoroConfig.workMinutes) || 25) * this.pomodoroToday;
    }
  }

  countHabitStreakDays(habits: string[], completions: Record<string, boolean>): number {
    if (!habits.length) return 0;
    let streak = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const day = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate() - offset);
      const key = localDateKey(day);
      const fullyDone = habits.every((habit) => completions[`${habit}|${key}`]);
      if (!fullyDone) break;
      streak += 1;
    }
    return streak;
  }

  computeKnowledgeTrends(): void {
    const weekStart = startOfWeek(this.now).getTime();
    this.notesThisWeek = this.files.filter((file) => Number(file.stat?.ctime || 0) >= weekStart).length;

    const buckets = new Array(7).fill(0);
    const dayStart = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate()).getTime();
    for (const file of this.files) {
      const created = Number(file.stat?.ctime || 0);
      const daysAgo = Math.floor((dayStart - new Date(created).setHours(0, 0, 0, 0)) / 86400000);
      if (daysAgo >= 0 && daysAgo < 7) buckets[6 - daysAgo] += 1;
    }
    this.notesDailyLast7 = buckets;

    this.updatedAreasThisWeek = (this.techTree?.nodes || [])
      .filter((node: any) => node.kind === "area" && node.link)
      .map((node: any) => this.app.vault.getAbstractFileByPath(node.link))
      .filter((file: any) => file && Number(file.stat?.mtime || 0) >= weekStart).length;
  }

  computeVaultUsage(): void {
    this.obsidianDays = calculateObsidianUsageDays(
      this.plugin.data.settings.obsidianStartDate || "",
      this.now
    );
  }

  indexDailyNotes(): void {
    for (const file of this.files) {
      if (!isDateBasename(file.basename)) continue;
      const list = this.dailyNotes.get(file.basename) || [];
      list.push(file);
      this.dailyNotes.set(file.basename, list);
    }
  }

  async indexProjectsAndTasks(): Promise<void> {
    const reads = await Promise.all(
      this.projectFiles.map(async (file) => {
        const cache = this.app.metadataCache.getFileCache(file) || {};
        let content = "";
        try {
          content = await this.app.vault.cachedRead(file);
        } catch (error) {
          content = "";
        }
        return { file, cache, content };
      })
    );

    for (const entry of reads) {
      const progress = entry.cache.frontmatter && entry.cache.frontmatter.progress ? String(entry.cache.frontmatter.progress) : "";
      this.projectIndex.push({
        path: entry.file.path,
        file: entry.file,
        name: entry.file.basename,
        progress,
        mtime: entry.file.stat.mtime
      });

      const taskRegex = /^\s*[-*]\s+\[( |x)\]\s+(.+)$/gm;
      let match = taskRegex.exec(entry.content);
      while (match) {
        if (match[1] === " ") {
          this.openTaskCount += 1;
          this.taskIndex.push({
            path: entry.file.path,
            file: entry.file,
            name: entry.file.basename,
            text: stripTaskText(match[2])
          });
        } else {
          this.doneTaskCount += 1;
        }
        match = taskRegex.exec(entry.content);
      }
    }
  }

  async loadTechTree(): Promise<void> {
    this.techTree = await readTechTreeData(
      this.app,
      this.plugin.data.settings.techTreeSource || DEFAULT_TECH_TREE_SOURCE,
      {
        areaRoot: this.plugin.data.settings.techTreeAreaRoot,
        activeProjectRoot: this.plugin.data.settings.techTreeActiveProjectRoot
      }
    );
  }

  getProjects(filter: Required<ProjectFilterDefaults>, limit: number): any[] {
    const list = this.projectIndex
      .filter((item) => matchesProjectFilter(this.app, item.file, filter))
      .sort((a, b) => b.mtime - a.mtime);
    return limit > 0 ? list.slice(0, limit) : list;
  }

  getOpenTasks(filter: Required<ProjectFilterDefaults>, limit: number): any[] {
    const list = this.taskIndex.filter((item) => matchesProjectFilter(this.app, item.file, filter));
    return limit > 0 ? list.slice(0, limit) : list;
  }

  getDailyNotesForDate(key: string): any[] {
    return this.dailyNotes.get(key) || [];
  }
}
