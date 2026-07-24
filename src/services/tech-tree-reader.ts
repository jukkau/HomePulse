import { DEFAULT_TECH_TREE_SOURCE } from "../constants";

const {
  TFile,
  normalizePath
} = require("obsidian");

const AREA_ROOT = "20_Areas";
const ACTIVE_PROJECT_ROOT = "10_Projects/进行中";

const VALUE_GROUPS = [
  { id: "care-self", title: "照顾自己" },
  { id: "run-life", title: "经营生活" },
  { id: "understand-world", title: "理解世界" },
  { id: "relate-others", title: "与人相处" },
  { id: "express-create", title: "表达与创造" },
  { id: "make-things-happen", title: "推动事情" }
];

const VALUE_GROUP_BY_TITLE = new Map(VALUE_GROUPS.map((group) => [group.title, group]));

function withinFolder(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedFolder = normalizePath(folder).replace(/\/+$/, "");
  return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function getFrontmatter(app: any, file: any): any {
  const cache = app.metadataCache.getFileCache(file) || {};
  return cache.frontmatter || {};
}

function getValueGroup(frontmatter: any): any | null {
  for (const rawTag of asArray(frontmatter.tags)) {
    const tag = String(rawTag || "").trim().replace(/^#/, "");
    if (!tag.startsWith("value/")) continue;
    const valueTitle = tag.slice("value/".length).split("/")[0];
    const group = VALUE_GROUP_BY_TITLE.get(valueTitle);
    if (group) return group;
  }
  return null;
}

function hasProjectTags(frontmatter: any): boolean {
  const tags = new Set(
    asArray(frontmatter.tags)
      .map((rawTag) => String(rawTag || "").trim().replace(/^#/, "").toLowerCase())
  );
  return tags.has("type/project") && tags.has("status/ing");
}

function extractLinkpath(value: any): string {
  const text = String(value || "").trim();
  const wikiLink = /^\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]$/.exec(text);
  return normalizePath((wikiLink ? wikiLink[1] : text).replace(/\.md$/i, ""));
}

function displayProjectName(file: any, frontmatter: any): string {
  if (frontmatter.title) return String(frontmatter.title);
  return String(file.basename || "")
    .replace(/^Project_(?:\d+|long)_/i, "")
    .replace(/_/g, " ");
}

function nodeId(prefix: string, path: string): string {
  return `${prefix}:${normalizePath(path).toLowerCase()}`;
}

function findAreaFile(app: any, sourceFile: any, linkpath: string, areaByKey: Map<string, any>): any | null {
  const direct = app.metadataCache.getFirstLinkpathDest(linkpath, sourceFile.path);
  if (direct && areaByKey.has(normalizePath(direct.path).toLowerCase())) return direct;

  const key = normalizePath(linkpath).toLowerCase();
  return areaByKey.get(key)
    || areaByKey.get(`${key}.md`)
    || areaByKey.get(key.split("/").pop() || "")
    || null;
}

export async function readTechTreeData(app: any, sourcePath: string) {
  const path = normalizePath(sourcePath || DEFAULT_TECH_TREE_SOURCE);
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    return { error: `Tech tree source is missing: ${path}` };
  }

  const markdownFiles = app.vault.getMarkdownFiles();
  const areaFiles = markdownFiles.filter((candidate: any) => {
    if (!withinFolder(candidate.path, AREA_ROOT)) return false;
    const frontmatter = getFrontmatter(app, candidate);
    return String(frontmatter.type || "").toLowerCase() === "area";
  });

  const areaByKey = new Map<string, any>();
  for (const areaFile of areaFiles) {
    areaByKey.set(normalizePath(areaFile.path).toLowerCase(), areaFile);
    areaByKey.set(normalizePath(areaFile.path).replace(/\.md$/i, "").toLowerCase(), areaFile);
    areaByKey.set(String(areaFile.basename || "").toLowerCase(), areaFile);
  }

  const nodes: any[] = [];
  const areaNodeByPath = new Map<string, any>();
  const warnings: string[] = [];

  for (const areaFile of areaFiles) {
    const frontmatter = getFrontmatter(app, areaFile);
    const group = getValueGroup(frontmatter);
    if (!group) {
      warnings.push(`${areaFile.basename} is missing a supported value/* tag.`);
      continue;
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

  const activeProjectFiles = markdownFiles.filter((candidate: any) => {
    const parentPath = candidate.parent && normalizePath(candidate.parent.path);
    if (!/^Project_/i.test(String(candidate.basename || ""))) return false;

    // Keep the legacy active-project folder, and also allow active project
    // roots that stay in their own project directory.
    return parentPath === normalizePath(ACTIVE_PROJECT_ROOT)
      || hasProjectTags(getFrontmatter(app, candidate));
  });

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
    const groupA = VALUE_GROUPS.findIndex((group) => group.id === a.group);
    const groupB = VALUE_GROUPS.findIndex((group) => group.id === b.group);
    return groupA - groupB
      || Number(a.level || 0) - Number(b.level || 0)
      || String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
  });

  return { file, groups: VALUE_GROUPS, nodes, warnings };
}
