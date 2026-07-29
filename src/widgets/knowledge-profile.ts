// @ts-nocheck
import { DEFAULT_PROJECT_NAME_PREFIXES } from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import {
  getProjectFileTags,
  matchesProjectFilter,
  readProjectFilterConfig,
  renderProjectFilterSettings
} from "../services/project-filter";

import { setIcon, Setting } from "obsidian";

function countTags(app, files) {
  const tags = new Set();
  for (const file of files) {
    for (const tag of getProjectFileTags(app, file)) {
      tags.add(tag);
    }
  }
  return tags.size;
}

function countProjects(app, files, config) {
  const filter = readProjectFilterConfig(config, { namePrefixes: DEFAULT_PROJECT_NAME_PREFIXES });
  return files.filter((file) => matchesProjectFilter(app, file, filter)).length;
}

export const knowledgeProfileWidget = {
  type: "knowledge-profile",
  displayName: "Knowledge Profile",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W4H2", w: 4, h: 2 },
  defaultConfig: {
    title: "knowledge profile",
    projectNamePrefixes: DEFAULT_PROJECT_NAME_PREFIXES,
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
    renderProjectFilterSettings(container, draft, { namePrefixes: DEFAULT_PROJECT_NAME_PREFIXES });
  }
};
