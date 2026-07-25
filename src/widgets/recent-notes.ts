// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { renderEmpty } from "./widget-api";

import { Setting } from "obsidian";

function formatUpdatedAt(timestamp, now) {
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - Number(timestamp || 0)) / 86400000));
  if (elapsedDays === 0) return "today";
  if (elapsedDays === 1) return "yesterday";
  if (elapsedDays < 14) return `${elapsedDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayName(file) {
  return String(file.basename || "")
    .replace(/^Project_(?:\d+|long)_/i, "")
    .replace(/^Area_/, "")
    .replace(/_/g, " ");
}

// Extracted from Knowledge Profile: recently-updated notes are an activity feed,
// a distinct concern from the long-term knowledge picture (§7 composable units).
export const recentNotesWidget = {
  type: "recent-notes",
  displayName: "Recent Notes",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H2", w: 1, h: 2 },
  defaultConfig: { title: "recently updated", limit: 6 },
  defaultState: {},
  async render(container, api) {
    const files = api.snapshot.files || [];
    const limit = Math.max(1, Math.min(20, Number(api.widgetData.config.limit) || 6));
    const recent = files
      .slice()
      .sort((a, b) => Number(b.stat?.mtime || 0) - Number(a.stat?.mtime || 0))
      .slice(0, limit);

    if (!recent.length) {
      renderEmpty(container, "No notes yet.");
      return;
    }

    const list = container.createDiv({ cls: "yh-list yh-recent-notes-list" });
    for (const [index, file] of recent.entries()) {
      const row = list.createEl("button", { cls: "yh-list-row yh-recent-notes-row" });
      row.createDiv({ cls: "yh-project-index", text: String(index + 1).padStart(2, "0") });
      const left = row.createDiv({ cls: "yh-list-left" });
      left.createDiv({ cls: "yh-list-title", text: displayName(file) });
      left.createDiv({ cls: "yh-list-meta", text: formatUpdatedAt(file.stat?.mtime, api.snapshot.now) });
      row.createDiv({ cls: "yh-row-arrow", text: "↗", attr: { "aria-hidden": "true" } });
      row.addEventListener("click", async () => {
        await api.openPath(file.path);
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
    new Setting(container).setName("Note count").setDesc("How many recent notes to show (1–20).").addText((text) => {
      text.setValue(String(draft.limit || 6));
      text.onChange((value) => {
        draft.limit = Math.max(1, Math.min(20, Number(value) || 6));
      });
    });
  }
};
