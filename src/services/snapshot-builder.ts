import { DEFAULT_TECH_TREE_SOURCE, PROJECT_ROOT } from "../constants";
import { readTechTreeData } from "./tech-tree-reader";
import { calculateObsidianUsageDays } from "./obsidian-usage";

const {
  normalizePath
} = require("obsidian");

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
  }

  async load(): Promise<this> {
    this.files = this.app.vault.getMarkdownFiles();
    this.projectFiles = this.files.filter((file) => withinFolder(file.path, PROJECT_ROOT));
    this.computeVaultUsage();
    this.indexDailyNotes();
    await this.indexProjectsAndTasks();
    await this.loadTechTree();
    return this;
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
      this.plugin.data.settings.techTreeSource || DEFAULT_TECH_TREE_SOURCE
    );
  }

  getProjects(folders: string[], limit: number): any[] {
    const list = this.projectIndex
      .filter((item) => folders.some((folder) => withinFolder(item.path, folder)))
      .sort((a, b) => b.mtime - a.mtime);
    return limit > 0 ? list.slice(0, limit) : list;
  }

  getOpenTasks(folders: string[], limit: number): any[] {
    const list = this.taskIndex.filter((item) => folders.some((folder) => withinFolder(item.path, folder)));
    return limit > 0 ? list.slice(0, limit) : list;
  }

  getDailyNotesForDate(key: string): any[] {
    return this.dailyNotes.get(key) || [];
  }
}
