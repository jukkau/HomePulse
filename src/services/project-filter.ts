import { normalizePath, Setting } from "obsidian";
import { parseLineList } from "../core/utils";
import { t } from "../i18n";

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

export type ProjectFilterSettingOptions = {
  folderDesc?: string;
};

const DEFAULT_PROJECT_ROOT = "Projects";
const DEFAULT_AREA_ROOT = "Areas";

function normalizeToken(value: LooseValue): string {
  return String(value || "").replace(/^#/, "").trim();
}

export function normalizeProjectFilterList(value: LooseValue, fallback: LooseValue = []): string[] {
  const source = Array.isArray(value) ? value : value == null || value === "" ? fallback : parseLineList(value);
  return (Array.isArray(source) ? source : [source])
    .map(normalizeToken)
    .filter(Boolean);
}

function normalizeFolderPath(value: LooseValue): string {
  return normalizePath(String(value || "").trim()).replace(/\/+$/, "");
}

function getVaultBasePath(app: LooseValue): string {
  const adapter = app?.vault?.adapter;
  if (!adapter || typeof adapter.getBasePath !== "function") return "";
  return normalizeFolderPath(adapter.getBasePath());
}

export function toVaultRelativePath(app: LooseValue, value: LooseValue): string {
  const input = normalizeFolderPath(value);
  if (!input) return "";
  const basePath = getVaultBasePath(app);
  if (!basePath) return input;

  const inputKey = input.toLowerCase();
  const baseKey = basePath.toLowerCase();
  if (inputKey === baseKey) return "";
  if (inputKey.startsWith(`${baseKey}/`)) {
    return input.slice(basePath.length + 1);
  }
  return input;
}

export function normalizeProjectFoldersForVault(app: LooseValue, folders: LooseValue): string[] {
  return normalizeProjectFilterList(folders, [])
    .map((folder) => toVaultRelativePath(app, folder))
    .filter(Boolean);
}

export function getInheritedProjectFolders(settings: LooseValue, fallback: LooseValue = [DEFAULT_PROJECT_ROOT]): string[] {
  return normalizeProjectFilterList(settings?.techTreeActiveProjectRoot, fallback);
}

export function getInheritedAreaFolders(settings: LooseValue, fallback: LooseValue = [DEFAULT_AREA_ROOT]): string[] {
  return normalizeProjectFilterList(settings?.techTreeAreaRoot, fallback);
}

export function withInheritedProjectFolders(config: LooseValue, settings: LooseValue, fallback: LooseValue = [DEFAULT_PROJECT_ROOT]): LooseValue {
  const configured = normalizeProjectFilterList(config?.projectFolders ?? config?.folders, []);
  return {
    ...(config || {}),
    projectFolders: configured.length ? configured : getInheritedProjectFolders(settings, fallback)
  };
}

export function withInheritedAreaFolders(config: LooseValue, settings: LooseValue, fallback: LooseValue = [DEFAULT_AREA_ROOT]): LooseValue {
  const configured = normalizeProjectFilterList(config?.areaFolders, []);
  return {
    ...(config || {}),
    areaFolders: configured.length ? configured : getInheritedAreaFolders(settings, fallback)
  };
}

export function readProjectFilterConfig(config: ProjectFilterConfig, defaults: ProjectFilterDefaults = {}): Required<ProjectFilterDefaults> {
  return {
    folders: normalizeProjectFilterList(config.projectFolders ?? config.folders, defaults.folders || []),
    tags: normalizeProjectFilterList(config.projectTags ?? config.tags, defaults.tags || []),
    namePrefixes: normalizeProjectFilterList(config.projectNamePrefixes ?? config.namePrefixes, defaults.namePrefixes || [])
  };
}

export function withinAnyProjectFolder(file: LooseValue, folders: string[], app?: LooseValue): boolean {
  const resolvedFolders = normalizeProjectFoldersForVault(app, folders);
  if (!resolvedFolders.length) return true;
  const path = normalizePath(file.path);
  return resolvedFolders.some((folder) => {
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
  return withinAnyProjectFolder(file, filter.folders, app)
    && matchesAnyProjectNamePrefix(file, filter.namePrefixes)
    && matchesAllProjectTags(app, file, filter.tags);
}

export function renderProjectFilterSettings(
  container: LooseValue,
  draft: LooseValue,
  defaults: ProjectFilterDefaults = {},
  language: LooseValue = "en",
  options: ProjectFilterSettingOptions = {}
): void {
  const filter = readProjectFilterConfig(draft, defaults);
  const configuredFolders = normalizeProjectFilterList(draft.projectFolders ?? draft.folders, []);
  const displayFolders = configuredFolders.length
    ? configuredFolders
    : normalizeProjectFilterList(defaults.folders || [], []);
  new Setting(container).setName(t(language, "projectFolders")).setDesc(options.folderDesc || t(language, "projectFoldersDesc")).addTextArea((text) => {
    text.setValue(displayFolders.join("\n"));
    text.onChange((value) => {
      draft.projectFolders = parseLineList(value);
    });
  });
  new Setting(container).setName(t(language, "projectTags")).setDesc(t(language, "projectTagsDesc")).addTextArea((text) => {
    text.setValue(filter.tags.join("\n"));
    text.onChange((value) => {
      draft.projectTags = parseLineList(value);
    });
  });
  new Setting(container).setName(t(language, "projectPrefixes")).setDesc(t(language, "projectPrefixesDesc")).addTextArea((text) => {
    text.setValue(filter.namePrefixes.join("\n"));
    text.onChange((value) => {
      draft.projectNamePrefixes = parseLineList(value);
    });
  });
}
