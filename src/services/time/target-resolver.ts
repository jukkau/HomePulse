import { normalizePath } from "obsidian";
import { QUICK_CAPTURE_PATH, QUICK_CAPTURE_TASK_ID, type TimeLogTarget } from "./types";
import { DEFAULT_PROJECT_NAME_PREFIXES } from "../../constants";
import {
  matchesProjectFilter,
  readProjectFilterConfig,
  toVaultRelativePath,
  type ProjectFilterConfig,
  type ProjectFilterDefaults
} from "../project-filter";

type AreaFilterConfig = {
  areaFolders?: string[];
  areaTags?: string[];
  areaNamePrefixes?: string[];
};

function stripKnownPrefix(name: string): string {
  return String(name || "")
    .replace(/^Project_(?:\d+|long)_/i, "")
    .replace(/^Area_/, "")
    .replace(/_/g, " ")
    .trim();
}

function readTitle(file: LooseValue, frontmatter: LooseValue = {}): string {
  const title = String(frontmatter.title || "").trim();
  return title || stripKnownPrefix(file?.basename || "");
}

export function projectTargetFromFile(app: LooseValue, file: LooseValue): TimeLogTarget | null {
  if (!file) return null;
  const cache = app.metadataCache.getFileCache(file) || {};
  const frontmatter = cache.frontmatter || {};
  const title = readTitle(file, frontmatter);
  if (!title) return null;
  const area = inheritedAreaFromProject(app, file, frontmatter);
  return {
    type: "project",
    id: title,
    title,
    ...(area ? { areaId: area.id, areaTitle: area.title } : {})
  };
}

export function areaTargetFromFile(app: LooseValue, file: LooseValue): TimeLogTarget | null {
  if (!file) return null;
  const cache = app.metadataCache.getFileCache(file) || {};
  const title = readTitle(file, cache.frontmatter || {});
  if (!title) return null;
  return { type: "area", id: title, title };
}

export function quickCaptureTaskTarget(app?: LooseValue, taskFile = QUICK_CAPTURE_PATH): TimeLogTarget {
  const file = app ? getTaskFile(app, taskFile) : null;
  if (file) {
    const cache = app.metadataCache.getFileCache(file) || {};
    const title = readTitle(file, cache.frontmatter || {});
    return {
      type: "task",
      id: title || QUICK_CAPTURE_TASK_ID,
      title: title || QUICK_CAPTURE_TASK_ID
    };
  }
  return {
    type: "task",
    id: QUICK_CAPTURE_TASK_ID,
    title: QUICK_CAPTURE_TASK_ID
  };
}

export function quickTarget(title: string): TimeLogTarget | null {
  const clean = String(title || "").trim();
  if (!clean) return null;
  return { type: "quick", id: clean, title: clean };
}

export function getQuickCaptureFile(app: LooseValue, taskFile = QUICK_CAPTURE_PATH): LooseValue | null {
  return getTaskFile(app, taskFile);
}

export function listProjectTargets(app: LooseValue, config: ProjectFilterConfig = {}, limit = 24): TimeLogTarget[] {
  const filter = readProjectFilterConfig(config, {
    folders: [],
    tags: ["type/project"],
    namePrefixes: DEFAULT_PROJECT_NAME_PREFIXES
  });
  const targets = app.vault.getMarkdownFiles()
    .filter((file: LooseValue) => isProjectFile(app, file))
    .filter((file: LooseValue) => matchesProjectFilter(app, file, filter))
    .map((file: LooseValue) => projectTargetFromFile(app, file))
    .filter(Boolean);
  return uniqueTargets(targets).slice(0, limit);
}

export function listAreaTargets(app: LooseValue, config: AreaFilterConfig = {}, limit = 24): TimeLogTarget[] {
  const filter = readAreaFilterConfig(config);
  const targets = app.vault.getMarkdownFiles()
    .filter((file: LooseValue) => isAreaFile(app, file))
    .filter((file: LooseValue) => matchesProjectFilter(app, file, filter))
    .map((file: LooseValue) => areaTargetFromFile(app, file))
    .filter(Boolean);
  return uniqueTargets(targets).slice(0, limit);
}

function isProjectFile(app: LooseValue, file: LooseValue): boolean {
  const cache = app.metadataCache.getFileCache(file) || {};
  const frontmatter = cache.frontmatter || {};
  if (String(frontmatter.type || "").toLowerCase() === "project") return true;
  if (hasTag(cache, "type/project")) return true;
  const basename = String(file.basename || "");
  return DEFAULT_PROJECT_NAME_PREFIXES.some((prefix) => basename.startsWith(prefix));
}

function readAreaFilterConfig(config: AreaFilterConfig): Required<ProjectFilterDefaults> {
  return readProjectFilterConfig({
    projectFolders: config.areaFolders,
    projectTags: config.areaTags,
    projectNamePrefixes: config.areaNamePrefixes
  }, {
    folders: ["Areas"],
    tags: [],
    namePrefixes: ["Area_"]
  });
}

function getTaskFile(app: LooseValue, taskFile = QUICK_CAPTURE_PATH): LooseValue | null {
  const path = toVaultRelativePath(app, taskFile || QUICK_CAPTURE_PATH) || QUICK_CAPTURE_PATH;
  return app.vault.getAbstractFileByPath(normalizePath(path)) || null;
}

function inheritedAreaFromProject(app: LooseValue, projectFile: LooseValue, frontmatter: LooseValue): TimeLogTarget | null {
  const areaValues = asArray(frontmatter.area);
  for (const rawArea of areaValues) {
    const linkpath = extractLinkpath(rawArea);
    if (!linkpath) continue;
    const areaFile = app.metadataCache.getFirstLinkpathDest(linkpath, projectFile.path)
      || findAreaFileByBasename(app, linkpath);
    if (areaFile) {
      const target = areaTargetFromFile(app, areaFile);
      if (target) return target;
    }
    const fallbackTitle = stripKnownPrefix(linkpath.split("/").pop() || linkpath);
    if (fallbackTitle) return { type: "area", id: fallbackTitle, title: fallbackTitle };
  }
  return null;
}

function asArray(value: LooseValue): LooseValue[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function extractLinkpath(value: LooseValue): string {
  const text = String(value || "").trim();
  const wikiLink = /^\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]$/.exec(text);
  return normalizePath((wikiLink ? wikiLink[1] : text).replace(/\.md$/i, ""));
}

function findAreaFileByBasename(app: LooseValue, linkpath: string): LooseValue | null {
  const basename = normalizePath(linkpath).split("/").pop()?.toLowerCase();
  if (!basename) return null;
  return app.vault.getMarkdownFiles().find((file: LooseValue) => {
    return String(file.basename || "").toLowerCase() === basename && isAreaFile(app, file);
  }) || null;
}

function isAreaFile(app: LooseValue, file: LooseValue): boolean {
  const cache = app.metadataCache.getFileCache(file) || {};
  const frontmatter = cache.frontmatter || {};
  if (String(frontmatter.type || "").toLowerCase() === "area") return true;
  if (hasTag(cache, "type/area")) return true;
  if (hasTagPrefix(cache, "value/")) return true;
  return String(file.basename || "").startsWith("Area_");
}

function hasTag(cache: LooseValue, target: string): boolean {
  return collectTags(cache).has(target.replace(/^#/, ""));
}

function hasTagPrefix(cache: LooseValue, prefix: string): boolean {
  for (const tag of collectTags(cache)) {
    if (tag.startsWith(prefix)) return true;
  }
  return false;
}

function collectTags(cache: LooseValue): Set<string> {
  const tags = new Set<string>();
  for (const entry of cache.tags || []) {
    const tag = String(entry.tag || "").replace(/^#/, "").trim();
    if (tag) tags.add(tag);
  }
  const frontmatterTags = cache.frontmatter?.tags;
  const list = Array.isArray(frontmatterTags) ? frontmatterTags : frontmatterTags ? [frontmatterTags] : [];
  for (const raw of list) {
    const tag = String(raw || "").replace(/^#/, "").trim();
    if (tag) tags.add(tag);
  }
  return tags;
}

function uniqueTargets(targets: LooseValue[]): TimeLogTarget[] {
  const seen = new Set<string>();
  const next: TimeLogTarget[] = [];
  for (const target of targets) {
    if (!target || seen.has(`${target.type}:${target.id}`)) continue;
    seen.add(`${target.type}:${target.id}`);
    next.push(target);
  }
  return next.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
}
