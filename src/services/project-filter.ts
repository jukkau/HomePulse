import { normalizePath, Setting } from "obsidian";
import { parseLineList } from "../core/utils";

export type ProjectFilterConfig = {
  projectFolders?: string[];
  projectTags?: string[];
  projectNamePrefixes?: string[];
  folders?: string[];
  tags?: string[];
  namePrefixes?: string[];
};

export type ProjectFilterDefaults = {
  folders?: string[];
  tags?: string[];
  namePrefixes?: string[];
};

function normalizeToken(value: LooseValue): string {
  return String(value || "").replace(/^#/, "").trim();
}

export function normalizeProjectFilterList(value: LooseValue, fallback: LooseValue = []): string[] {
  const source = Array.isArray(value) ? value : value == null || value === "" ? fallback : parseLineList(value);
  return (Array.isArray(source) ? source : [source])
    .map(normalizeToken)
    .filter(Boolean);
}

export function readProjectFilterConfig(config: ProjectFilterConfig, defaults: ProjectFilterDefaults = {}): Required<ProjectFilterDefaults> {
  return {
    folders: normalizeProjectFilterList(config.projectFolders ?? config.folders, defaults.folders || []),
    tags: normalizeProjectFilterList(config.projectTags ?? config.tags, defaults.tags || []),
    namePrefixes: normalizeProjectFilterList(config.projectNamePrefixes ?? config.namePrefixes, defaults.namePrefixes || [])
  };
}

export function withinAnyProjectFolder(file: LooseValue, folders: string[]): boolean {
  if (!folders.length) return true;
  const path = normalizePath(file.path);
  return folders.some((folder) => {
    const root = normalizePath(folder).replace(/\/+$/, "");
    return path === root || path.startsWith(`${root}/`);
  });
}

export function matchesAnyProjectNamePrefix(file: LooseValue, prefixes: string[]): boolean {
  if (!prefixes.length) return true;
  const basename = String(file.basename || "");
  return prefixes.some((prefix) => basename.startsWith(prefix));
}

export function getProjectFileTags(app: LooseValue, file: LooseValue): Set<string> {
  const cache = app.metadataCache.getFileCache(file) || {};
  const tags = new Set<string>();
  for (const entry of cache.tags || []) {
    const tag = normalizeToken(entry.tag);
    if (tag) tags.add(tag);
  }
  const frontmatterTags = cache.frontmatter?.tags;
  const list = Array.isArray(frontmatterTags) ? frontmatterTags : frontmatterTags ? [frontmatterTags] : [];
  for (const rawTag of list) {
    const tag = normalizeToken(rawTag);
    if (tag) tags.add(tag);
  }
  return tags;
}

export function matchesAllProjectTags(app: LooseValue, file: LooseValue, tags: string[]): boolean {
  if (!tags.length) return true;
  const present = getProjectFileTags(app, file);
  return tags.every((tag) => present.has(tag));
}

export function matchesProjectFilter(app: LooseValue, file: LooseValue, filter: Required<ProjectFilterDefaults>): boolean {
  return withinAnyProjectFolder(file, filter.folders)
    && matchesAnyProjectNamePrefix(file, filter.namePrefixes)
    && matchesAllProjectTags(app, file, filter.tags);
}

export function renderProjectFilterSettings(container: LooseValue, draft: LooseValue, defaults: ProjectFilterDefaults = {}): void {
  const filter = readProjectFilterConfig(draft, defaults);
  new Setting(container).setName("Project folders").setDesc("One vault-relative folder per line. Empty means any folder.").addTextArea((text) => {
    text.setValue(filter.folders.join("\n"));
    text.onChange((value) => {
      draft.projectFolders = parseLineList(value);
    });
  });
  new Setting(container).setName("Project tags").setDesc("All listed tags must be present. One tag per line, with or without #. Empty disables the tag condition.").addTextArea((text) => {
    text.setValue(filter.tags.join("\n"));
    text.onChange((value) => {
      draft.projectTags = parseLineList(value);
    });
  });
  new Setting(container).setName("Project filename prefixes").setDesc("One prefix per line. Empty disables the filename condition.").addTextArea((text) => {
    text.setValue(filter.namePrefixes.join("\n"));
    text.onChange((value) => {
      draft.projectNamePrefixes = parseLineList(value);
    });
  });
}
