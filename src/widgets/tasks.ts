// @ts-nocheck
import { DEFAULT_PROJECT_NAME_PREFIXES, DEFAULT_TASK_FOLDERS } from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";
import { getInheritedProjectFolders, readProjectFilterConfig, renderProjectFilterSettings, withInheritedProjectFolders } from "../services/project-filter";
import { renderEmpty } from "./widget-api";

const { Setting } = require("obsidian");

export const tasksWidget = {
  type: "tasks",
  displayName: "Tasks",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H3", w: 1, h: 3 },
  defaultConfig: {
    title: "open tasks",
    projectFolders: DEFAULT_TASK_FOLDERS,
    projectTags: [],
    projectNamePrefixes: DEFAULT_PROJECT_NAME_PREFIXES,
    limit: 12
  },
  defaultState: {},
  async render(container, api) {
    const filter = readProjectFilterConfig(withInheritedProjectFolders(api.widgetData.config, api.settings), {
      folders: DEFAULT_TASK_FOLDERS,
      namePrefixes: DEFAULT_PROJECT_NAME_PREFIXES
    });
    const tasks = api.snapshot.getOpenTasks(filter, Number(api.widgetData.config.limit) || 12);
    if (!tasks.length) {
      renderEmpty(container, t(api.language, "noOpenTasks"));
      return;
    }
    const list = container.createDiv({ cls: "yh-task-list" });
    for (const task of tasks) {
      const row = list.createEl("button", {
        cls: "yh-task-row"
      });
      row.createDiv({ cls: "yh-task-check", attr: { "aria-hidden": "true" } });
      const content = row.createDiv({ cls: "yh-task-content" });
      content.createDiv({ cls: "yh-task-text", text: task.text });
      content.createDiv({ cls: "yh-task-file", text: task.name });
      row.createDiv({ cls: "yh-row-arrow", text: "↗", attr: { "aria-hidden": "true" } });
      row.addEventListener("click", async () => {
        await api.openPath(task.path);
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
      folders: getInheritedProjectFolders(ctx.settings, DEFAULT_TASK_FOLDERS),
      namePrefixes: DEFAULT_PROJECT_NAME_PREFIXES
    }, ctx.language);
    new Setting(container).setName(t(ctx.language, "limit")).addText((text) => {
      text.setValue(String(draft.limit || 12));
      text.onChange((value) => {
        draft.limit = Number(value) || 12;
      });
    });
  }
};
