// @ts-nocheck
import { DEFAULT_TASK_FOLDERS } from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { normalizeArray, parseLineList, renderEmpty } from "./widget-api";

const { Setting } = require("obsidian");

export const tasksWidget = {
  type: "tasks",
  displayName: "Tasks",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H3", w: 1, h: 3 },
  defaultConfig: { title: "open tasks", folders: DEFAULT_TASK_FOLDERS, limit: 12 },
  defaultState: {},
  async render(container, api) {
    const folders = normalizeArray(api.widgetData.config.folders, DEFAULT_TASK_FOLDERS);
    const tasks = api.snapshot.getOpenTasks(folders, Number(api.widgetData.config.limit) || 12);
    if (!tasks.length) {
      renderEmpty(container, "No open tasks found.");
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
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Folders").setDesc("One folder per line.").addTextArea((text) => {
      text.setValue(normalizeArray(draft.folders, DEFAULT_TASK_FOLDERS).join("\n"));
      text.onChange((value) => {
        draft.folders = parseLineList(value);
      });
    });
    new Setting(container).setName("Limit").addText((text) => {
      text.setValue(String(draft.limit || 12));
      text.onChange((value) => {
        draft.limit = Number(value) || 12;
      });
    });
  }
};
