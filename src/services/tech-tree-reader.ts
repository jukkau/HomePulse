import { DEFAULT_PROJECT_NAME_PREFIXES } from "../constants";
import { matchesProjectFilter, readProjectFilterConfig, toVaultRelativePath } from "./project-filter";

const { normalizePath } = require("obsidian");

const DEFAULT_AREA_ROOT = "Areas";
const DEFAULT_ACTIVE_PROJECT_ROOT = "Projects";

function withinFolder(app: LooseValue, path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(toVaultRelativePath(app, folder)).replace(/\/+$/, "");
  return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}

function asArray(value: LooseValue): LooseValue[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function getFrontmatter(app: LooseValue, file: LooseValue): LooseValue {
  const cache = app.metadataCache.getFileCache(file) || {};
  return cache.frontmatter || {};
}

function getValueGroup(frontmatter: LooseValue): LooseValue | null {
  for (const rawTag of asArray(frontmatter.tags)) {
    const tag = String(rawTag || "").trim().replace(/^#/, "");
    if (!tag.startsWith("value/")) continue;
    const valueTitle = tag.slice("value/".length).split("/")[0];
    if (valueTitle) {
      return { id: valueTitle, title: valueTitle };
    }
  }
  return null;
}

function extractLinkpath(value: LooseValue): string {
  const text = String(value || "").trim();
  const wikiLink = /^\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]$/.exec(text);
  return normalizePath((wikiLink ? wikiLink[1] : text).replace(/\.md$/i, ""));
}

function displayProjectName(file: LooseValue, frontmatter: LooseValue): string {
  if (frontmatter.title) return String(frontmatter.title);
  return String(file.basename || "")
    .replace(/^Project_(?:\d+|long)_/i, "")
    .replace(/_/g, " ");
}

function nodeId(prefix: string, path: string): string {
  return `${prefix}:${normalizePath(path).toLowerCase()}`;
}

function findAreaFile(app: LooseValue, sourceFile: LooseValue, linkpath: string, areaByKey: Map<string, LooseValue>): LooseValue | null {
  const direct = app.metadataCache.getFirstLinkpathDest(linkpath, sourceFile.path);
  if (direct && areaByKey.has(normalizePath(direct.path).toLowerCase())) return direct;

  const key = normalizePath(linkpath).toLowerCase();
  return areaByKey.get(key)
    || areaByKey.get(`${key}.md`)
    || areaByKey.get(key.split("/").pop() || "")
    || null;
}

export async function readTechTreeData(app: LooseValue, options: LooseValue = {}) {
  const areaRoot = normalizePath(toVaultRelativePath(app, options.areaRoot || DEFAULT_AREA_ROOT) || DEFAULT_AREA_ROOT);
  const legacyActiveProjectRoot = normalizePath(toVaultRelativePath(app, options.activeProjectRoot || DEFAULT_ACTIVE_PROJECT_ROOT) || DEFAULT_ACTIVE_PROJECT_ROOT);
  const projectFilter = readProjectFilterConfig({
    projectFolders: options.projectFolders ?? [legacyActiveProjectRoot],
    projectTags: options.projectTags ?? [],
    projectNamePrefixes: options.projectNamePrefixes ?? DEFAULT_PROJECT_NAME_PREFIXES
  });
  const markdownFiles = app.vault.getMarkdownFiles();
  const areaFiles = markdownFiles.filter((candidate: LooseValue) => {
    if (!withinFolder(app, candidate.path, areaRoot)) return false;
    return Boolean(getValueGroup(getFrontmatter(app, candidate)));
  });

  const areaByKey = new Map<string, LooseValue>();
  for (const areaFile of areaFiles) {
    areaByKey.set(normalizePath(areaFile.path).toLowerCase(), areaFile);
    areaByKey.set(normalizePath(areaFile.path).replace(/\.md$/i, "").toLowerCase(), areaFile);
    areaByKey.set(String(areaFile.basename || "").toLowerCase(), areaFile);
  }

  const nodes: LooseValue[] = [];
  const areaNodeByPath = new Map<string, LooseValue>();
  const warnings: string[] = [];
  const discoveredGroups: LooseValue[] = [];
  const groupSet = new Set<string>();

  for (const areaFile of areaFiles) {
    const frontmatter = getFrontmatter(app, areaFile);
    const group = getValueGroup(frontmatter);
    if (!group) {
      warnings.push(`${areaFile.basename} is missing a value/* tag.`);
      continue;
    }
    if (!groupSet.has(group.id)) {
      groupSet.add(group.id);
      discoveredGroups.push(group);
    }

    const node = {
      id: nodeId("area", areaFile.path),
      title: String(areaFile.basename || "").replace(/^Area_/, ""),
      group: group.id,
      status: String(frontmatter.status || "active"),
      level: 2,
      kind: "area",
      link: areaFile.path,
      dependsOn: []
    };
    nodes.push(node);
    areaNodeByPath.set(normalizePath(areaFile.path).toLowerCase(), node);
  }

  const activeProjectFiles = markdownFiles.filter((candidate: LooseValue) => matchesProjectFilter(app, candidate, projectFilter));

  for (const projectFile of activeProjectFiles) {
    const frontmatter = getFrontmatter(app, projectFile);
    const areaLinks = asArray(frontmatter.area).map(extractLinkpath).filter(Boolean);
    if (!areaLinks.length) {
      warnings.push(`${projectFile.basename} is missing area metadata.`);
      continue;
    }

    for (const areaLink of areaLinks) {
      const areaFile = findAreaFile(app, projectFile, areaLink, areaByKey);
      const areaNode = areaFile
        ? areaNodeByPath.get(normalizePath(areaFile.path).toLowerCase())
        : null;
      if (!areaNode) {
        warnings.push(`${projectFile.basename} references an unavailable Area: ${areaLink}.`);
        continue;
      }

      nodes.push({
        id: nodeId("project", `${projectFile.path}::${areaFile.path}`),
        title: displayProjectName(projectFile, frontmatter),
        group: areaNode.group,
        status: "active",
        level: 3,
        kind: "project",
        link: projectFile.path,
        dependsOn: [areaNode.id]
      });
    }
  }

  nodes.sort((a, b) => {
    const groupA = discoveredGroups.findIndex((group) => group.id === a.group);
    const groupB = discoveredGroups.findIndex((group) => group.id === b.group);
    return groupA - groupB
      || Number(a.level || 0) - Number(b.level || 0)
      || String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
  });

  return { groups: discoveredGroups, nodes, warnings };
}
