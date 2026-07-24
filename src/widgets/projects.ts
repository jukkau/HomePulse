// @ts-nocheck
import { DEFAULT_PROJECT_FOLDERS } from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { normalizeArray, parseLineList, renderEmpty } from "./widget-api";

const { Setting } = require("obsidian");

function formatUpdatedAt(timestamp, now) {
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - Number(timestamp || 0)) / 86400000));
  if (elapsedDays === 0) return "today";
  if (elapsedDays === 1) return "yesterday";
  if (elapsedDays < 14) return `${elapsedDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const projectsWidget = {
  type: "projects",
  displayName: "Projects",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H3", w: 1, h: 3 },
  defaultConfig: { title: "projects", folders: DEFAULT_PROJECT_FOLDERS, limit: 10 },
  defaultState: {},
  async render(container, api) {
    const folders = normalizeArray(api.widgetData.config.folders, DEFAULT_PROJECT_FOLDERS);
    const items = api.snapshot.getProjects(folders, Number(api.widgetData.config.limit) || 10);
    if (!items.length) {
      renderEmpty(container, "No project notes found in the configured folders.");
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
      meta.createSpan({ text: formatUpdatedAt(item.mtime, api.snapshot.now) });
      row.createDiv({ cls: "yh-row-arrow", text: "↗", attr: { "aria-hidden": "true" } });
      row.addEventListener("click", async () => {
        await api.openPath(item.path);
      });
    }
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Folders").setDesc("One folder per line.").addTextArea((text) => {
      text.setValue(normalizeArray(draft.folders, DEFAULT_PROJECT_FOLDERS).join("\n"));
      text.onChange((value) => {
        draft.folders = parseLineList(value);
      });
    });
    new Setting(container).setName("Limit").addText((text) => {
      text.setValue(String(draft.limit || 10));
      text.onChange((value) => {
        draft.limit = Number(value) || 10;
      });
    });
  }
};
