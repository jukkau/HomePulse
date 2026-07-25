// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { parseLineList } from "./widget-api";

import { normalizePath, Setting, setIcon } from "obsidian";

const DEFAULT_PROJECT_PREFIX = "Project_";

function normalizeToken(value) {
  return String(value || "").replace(/^#/, "").trim();
}

function normalizeFilterList(value) {
  if (Array.isArray(value)) return value.map(normalizeToken).filter(Boolean);
  return parseLineList(value).map(normalizeToken).filter(Boolean);
}

function withinAnyFolder(file, folders) {
  if (!folders.length) return true;
  const path = normalizePath(file.path);
  return folders.some((folder) => {
    const root = normalizePath(folder).replace(/\/+$/, "");
    return path === root || path.startsWith(`${root}/`);
  });
}

function matchesAnyPrefix(file, prefixes) {
  if (!prefixes.length) return true;
  const basename = String(file.basename || "");
  return prefixes.some((prefix) => basename.startsWith(prefix));
}

function fileTags(app, file) {
  const cache = app.metadataCache.getFileCache(file) || {};
  const tags = new Set();
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

function matchesAnyTag(app, file, tags) {
  if (!tags.length) return true;
  const present = fileTags(app, file);
  return tags.some((tag) => present.has(tag));
}

function countTags(app, files) {
  const tags = new Set();
  for (const file of files) {
    for (const tag of fileTags(app, file)) {
      tags.add(tag);
    }
  }
  return tags.size;
}

function countProjects(app, files, config) {
  const prefixes = normalizeFilterList(config.projectNamePrefixes || config.projectNamePrefix || DEFAULT_PROJECT_PREFIX);
  const folders = normalizeFilterList(config.projectFolders || []);
  const tags = normalizeFilterList(config.projectTags || []);
  return files.filter((file) =>
    matchesAnyPrefix(file, prefixes)
    && withinAnyFolder(file, folders)
    && matchesAnyTag(app, file, tags)
  ).length;
}

export const knowledgeProfileWidget = {
  type: "knowledge-profile",
  displayName: "Knowledge Profile",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W4H2", w: 4, h: 2 },
  defaultConfig: {
    title: "knowledge profile",
    projectNamePrefixes: [DEFAULT_PROJECT_PREFIX],
    projectFolders: [],
    projectTags: []
  },
  defaultState: {},
  async render(container, api) {
    const files = api.snapshot.files || [];
    const projectCount = countProjects(api.app, files, api.widgetData.config);
    const areas = (api.snapshot.techTree?.nodes || []).filter((node) => node.kind === "area");
    const tagCount = countTags(api.app, files);

    // Totals only — the weekly growth trend lives in Execution Pulse, so this
    // widget is the "profile" (reference counts), not a second trend view.
    const stats = container.createDiv({ cls: "yh-knowledge-profile" });
    const items = [
      { label: "Notes", value: files.length, icon: "file-text" },
      { label: "Areas", value: areas.length, icon: "layers" },
      { label: "Projects", value: projectCount, icon: "rocket" },
      { label: "Tags", value: tagCount, icon: "hash" }
    ];
    for (const item of items) {
      const stat = stats.createDiv({ cls: "yh-knowledge-stat" });
      const icon = stat.createDiv({ cls: "yh-knowledge-stat-icon" });
      setIcon(icon, item.icon);
      const body = stat.createDiv({ cls: "yh-knowledge-stat-body" });
      body.createDiv({ cls: "yh-knowledge-stat-value", text: String(item.value) });
      body.createDiv({ cls: "yh-knowledge-stat-label", text: item.label });
    }
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Project filename prefixes").setDesc("One per line. Empty disables the prefix condition.").addTextArea((text) => {
      text.setValue(normalizeFilterList(draft.projectNamePrefixes || draft.projectNamePrefix || DEFAULT_PROJECT_PREFIX).join("\n"));
      text.onChange((value) => {
        draft.projectNamePrefixes = parseLineList(value);
      });
    });
    new Setting(container).setName("Project folders").setDesc("One vault-relative folder per line. Empty means any folder.").addTextArea((text) => {
      text.setValue(normalizeFilterList(draft.projectFolders || []).join("\n"));
      text.onChange((value) => {
        draft.projectFolders = parseLineList(value);
      });
    });
    new Setting(container).setName("Project tags").setDesc("One tag per line, with or without #. Empty means any tag.").addTextArea((text) => {
      text.setValue(normalizeFilterList(draft.projectTags || []).join("\n"));
      text.onChange((value) => {
        draft.projectTags = parseLineList(value);
      });
    });
  }
};
