// @ts-nocheck
import { DEFAULT_TECH_TREE_SOURCE } from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { readTechTreeData } from "../services/tech-tree-reader";
import { renderEmpty } from "./widget-api";

const { Setting, normalizePath } = require("obsidian");

const TREE_KINDS = new Set(["area", "moc", "project"]);

function renderNode(container, node, childrenByParent, api, ancestry = new Set()) {
  const subtree = container.createDiv({ cls: `yh-tech-subtree yh-tech-subtree-${node.kind}` });
  const card = subtree.createEl("button", {
    cls: `yh-tech-node is-${node.status || "idle"} is-${node.kind || "node"}`
  });
  card.setAttribute("type", "button");
  card.setAttribute("aria-label", `${node.title || node.id} · ${node.kind || "node"} · ${node.status || "idle"}`);
  card.createDiv({ cls: "yh-tech-node-title", text: node.title || node.id });
  if (node.link) {
    card.addEventListener("click", async () => {
      await api.openLink(node.link);
    });
  }

  if (ancestry.has(node.id)) return;
  const children = childrenByParent.get(node.id) || [];
  if (!children.length) return;

  const nextAncestry = new Set(ancestry);
  nextAncestry.add(node.id);
  const branch = subtree.createDiv({ cls: "yh-tech-children" });
  for (const child of children) {
    renderNode(branch, child, childrenByParent, api, nextAncestry);
  }
}

export const techTreeWidget = {
  type: "tech-tree",
  displayName: "Tech Tree",
  shell: "canvas",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W4H1", w: 4, h: 1 },
  defaultConfig: { title: "tech tree", sourcePath: "" },
  defaultState: {},
  async render(container, api) {
    let data = api.snapshot.techTree;
    const override = api.widgetData.config.sourcePath && normalizePath(api.widgetData.config.sourcePath);
    if (override && override !== normalizePath(api.plugin.data.settings.techTreeSource || DEFAULT_TECH_TREE_SOURCE)) {
      data = await readTechTreeData(api.app, override);
    }
    if (!data || data.error) {
      renderEmpty(container, data && data.error ? data.error : "No tech tree data available.");
      return;
    }

    const meta = container.createDiv({ cls: "yh-tech-meta", text: data.file.basename });
    meta.addEventListener("click", async () => {
      await api.openPath(data.file.path);
    });

    const nodes = data.nodes.filter((node) => TREE_KINDS.has(String(node.kind || "").toLowerCase()));
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const childrenByParent = new Map();
    for (const node of nodes) {
      const parents = (Array.isArray(node.dependsOn) ? node.dependsOn : []).filter((id) => nodeMap.has(id));
      for (const parentId of parents) {
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
        childrenByParent.get(parentId).push(node);
      }
    }
    for (const children of childrenByParent.values()) {
      children.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id), "zh-CN"));
    }

    const board = container.createDiv({ cls: "yh-tech-board" });
    const tree = board.createDiv({ cls: "yh-tech-tree" });
    for (const group of data.groups) {
      const lane = tree.createDiv({ cls: "yh-tech-lane" });
      lane.createDiv({ cls: "yh-tech-group", text: group.title || group.id });

      const groupNodes = nodes.filter((node) => node.group === group.id);
      const roots = groupNodes
        .filter((node) => {
          const deps = Array.isArray(node.dependsOn) ? node.dependsOn : [];
          return !deps.some((id) => nodeMap.has(id) && nodeMap.get(id).group === group.id);
        })
        .sort((a, b) => {
          const areaOrder = (a.kind === "area" ? 0 : 1) - (b.kind === "area" ? 0 : 1);
          return areaOrder || String(a.title || a.id).localeCompare(String(b.title || b.id), "zh-CN");
        });

      if (roots.length) {
        const branch = lane.createDiv({ cls: "yh-tech-children" });
        for (const node of roots) renderNode(branch, node, childrenByParent, api);
      }
    }
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Source override").setDesc("Optional. Leave blank to use the global tech tree source.").addText((text) => {
      text.setValue(draft.sourcePath || "");
      text.onChange((value) => {
        draft.sourcePath = value.trim();
      });
    });
  }
};
