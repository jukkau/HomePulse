// @ts-nocheck
import { DEFAULT_PROJECT_FOLDERS, DEFAULT_PROJECT_NAME_PREFIXES } from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";
import { getInheritedProjectFolders, readProjectFilterConfig, renderProjectFilterSettings, withInheritedProjectFolders } from "../services/project-filter";
import { renderEmpty } from "./widget-api";

const { Setting } = require("obsidian");

function formatUpdatedAt(timestamp, now, language) {
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - Number(timestamp || 0)) / 86400000));
  if (elapsedDays === 0) return t(language, "today");
  if (elapsedDays === 1) return t(language, "yesterday");
  if (elapsedDays < 14) return t(language, "daysAgoShort", { count: elapsedDays });
  return new Date(timestamp).toLocaleDateString(language === "zh-CN" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
}

export const projectsWidget = {
  type: "projects",
  displayName: "Projects",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H3", w: 1, h: 3 },
  defaultConfig: {
    title: "projects",
    projectFolders: DEFAULT_PROJECT_FOLDERS,
    projectTags: [],
    projectNamePrefixes: DEFAULT_PROJECT_NAME_PREFIXES,
    limit: 10
  },
  defaultState: {},
  async render(container, api) {
    const filter = readProjectFilterConfig(withInheritedProjectFolders(api.widgetData.config, api.settings), {
      folders: DEFAULT_PROJECT_FOLDERS,
      namePrefixes: DEFAULT_PROJECT_NAME_PREFIXES
    });
    const items = api.snapshot.getProjects(filter, Number(api.widgetData.config.limit) || 10);
    if (!items.length) {
      renderEmpty(container, t(api.language, "noProjectNotes"));
      return;
    }
    const list = container.createDiv({ cls: "yh-list yh-project-list" });
    for (const [index, item] of items.entries()) {
      const row = list.createEl("button", {
        cls: "yh-list-row yh-project-row"
      });
      row.createDiv({ cls: "yh-project-index", text: String(index + 1).padStart(2, "0") });
      const left = row.createDiv({ cls: "yh-list-left" });
      left.createDiv({ cls: "yh-list-title", text: item.name });
      const meta = left.createDiv({ cls: "yh-list-meta" });
      if (item.progress) {
        meta.createSpan({ cls: "yh-project-status", text: item.progress });
      }
      meta.createSpan({ text: formatUpdatedAt(item.mtime, api.snapshot.now, api.language) });
      row.createDiv({ cls: "yh-row-arrow", text: "↗", attr: { "aria-hidden": "true" } });
      row.addEventListener("click", async () => {
        await api.openPath(item.path);
      });
    }
  },
  renderSettings(container, draft, ctx) {
    new Setting(container).setName(t(ctx.language, "title")).addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    renderProjectFilterSettings(container, draft, {
      folders: getInheritedProjectFolders(ctx.settings, DEFAULT_PROJECT_FOLDERS),
      namePrefixes: DEFAULT_PROJECT_NAME_PREFIXES
    }, ctx.language);
    new Setting(container).setName(t(ctx.language, "limit")).addText((text) => {
      text.setValue(String(draft.limit || 10));
      text.onChange((value) => {
        draft.limit = Number(value) || 10;
      });
    });
  }
};
