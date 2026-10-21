// @ts-nocheck
import { DEFAULT_PROJECT_NAME_PREFIXES, DEFAULT_TASK_FOLDERS } from "../constants";
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";
import { getInheritedProjectFolders, readProjectFilterConfig, renderProjectFilterSettings, withInheritedProjectFolders } from "../services/project-filter";
import { renderEmpty } from "./widget-api";
import { parseTasks } from "../services/task-index";

const { Notice, Setting } = require("obsidian");

export function markTaskComplete(content, task) {
  const text = String(content || "");
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(newline);
  const source = String(task.source || "").replace(/\r$/, "");
  const candidates = parseTasks(text).filter((item) => !item.checked && item.source === source);
  // Repeated tasks can use their indexed position only against the exact original document.
  const unchanged = task.originalContent === text;
  if (!unchanged && (candidates.length !== 1 || task.occurrences > 1)) return null;
  const target = unchanged ? candidates.find((item) => item.line === Number(task.line)) : candidates[0];
  if (!target) return null;
  lines[target.line - 1] = lines[target.line - 1].replace(/^(\s*[-*+]\s+\[) (\])/, "$1x$2");
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
      renderEmpty(container, t(api.language, "noOpenTasks"), { label: t(api.language, "configureSources"), run: () => api.openSettings() });
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
      const fileEl = content.createEl("button", { cls: "yh-task-file", text: task.name, attr: { type: "button", title: task.path } });
      fileEl.setAttr("role", "button");
      fileEl.setAttr("aria-label", t(api.language, "jumpToSource"));
      fileEl.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
          const file = api.app.vault.getAbstractFileByPath(task.path);
          if (!file || !file.path) throw new Error("Task file not found.");
          const leaf = api.app.workspace.getLeaf("tab");
          await leaf.openFile(file);
          const view = leaf.view;
          if (view && view.editor) {
            const line = Number(task.line) - 1;
            const editor = view.editor;
            if (line >= 0 && line < editor.lineCount()) {
              window.setTimeout(() => {
                editor.setCursor({ line, ch: 0 });
                editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
              }, 100);
            }
          }
        } catch (error) {
          new Notice(error.message || String(error));
        }
      });
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
            if (updated === null) throw new Error(t(api.language, "taskChanged"));
            return updated;
          });
          saved = true;
          api.refreshData(task.path);
          row.addClass("is-completing");
          window.setTimeout(() => row.remove(), 180);
        } catch (error) {
          if (!saved) api.restoreVaultRefresh(task.path);
          row.removeClass("is-completing");
          check.disabled = false;
          api.refreshData(task.path);
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
