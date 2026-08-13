// @ts-nocheck
import { DEFAULT_PROJECT_NAME_PREFIXES, DEFAULT_TASK_FOLDERS } from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";
import { getInheritedProjectFolders, readProjectFilterConfig, renderProjectFilterSettings, withInheritedProjectFolders } from "../services/project-filter";
import { renderEmpty } from "./widget-api";

const { Notice, Setting } = require("obsidian");

export function markTaskComplete(content, task) {
  const text = String(content || "");
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(newline);
  const lineIndex = Number(task.line) - 1;
  const source = String(task.source || "").replace(/\r$/, "");
  if (lineIndex >= 0 && lineIndex < lines.length && lines[lineIndex] === source) {
    lines[lineIndex] = lines[lineIndex].replace(/(\[) (\])/, "$1x$2");
    return lines.join(newline);
  }

  const fallbackIndex = lines.findIndex((line) => line === source);
  if (fallbackIndex < 0) return null;
  lines[fallbackIndex] = lines[fallbackIndex].replace(/(\[) (\])/, "$1x$2");
  return lines.join(newline);
}

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
      const row = list.createDiv({ cls: "yh-task-row" });
      const check = row.createEl("button", {
        cls: "yh-task-check",
        attr: { "aria-label": t(api.language, "done") }
      });
      const content = row.createDiv({ cls: "yh-task-content" });
      content.createDiv({ cls: "yh-task-text", text: task.text });
      content.createDiv({ cls: "yh-task-file", text: task.name });
      check.addEventListener("click", async () => {
        if (check.disabled) return;
        check.disabled = true;
        let saved = false;
        try {
          const file = api.app.vault.getAbstractFileByPath(task.path);
          if (!file || !file.path) throw new Error("Task file not found.");
          api.suppressVaultRefresh(task.path);
          await api.app.vault.process(file, (content) => {
            const updated = markTaskComplete(content, task);
            if (updated === null) throw new Error("Task changed before it could be completed.");
            return updated;
          });
          saved = true;
          row.addClass("is-completing");
          window.setTimeout(() => row.remove(), 180);
        } catch (error) {
          if (!saved) api.restoreVaultRefresh(task.path);
          row.removeClass("is-completing");
          check.disabled = false;
          new Notice(error.message || String(error));
        }
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
