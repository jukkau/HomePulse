// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";

import { Setting, MarkdownRenderer } from "obsidian";

export const activityHistoryWidget = {
  type: "activity-history",
  displayName: "Activity History",
  shell: "canvas",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W4H2", w: 4, h: 2 },
  defaultConfig: { title: "activity history", sourcePath: "/" },
  defaultState: {},
  async render(container, api) {
    const sourcePath = api.widgetData.config.sourcePath || "/";
    const yearRow = container.createDiv({ cls: "yh-activity-year-row" });
    const yearSlot = yearRow.createDiv({ cls: "yh-activity-year-slot" });
    const host = container.createDiv({ cls: "yh-activity-wrap" });
    const footer = container.createDiv({ cls: "yh-activity-footer" });
    const status = footer.createDiv({ cls: "yh-activity-status", text: "Reading activity rhythm..." });
    const legend = footer.createDiv({ cls: "yh-activity-legend" });
    legend.createSpan({ text: "less" });
    for (let i = 0; i < 4; i += 1) {
      legend.createSpan({ cls: `yh-activity-legend-swatch is-level-${i}` });
    }
    legend.createSpan({ text: "more" });
    await MarkdownRenderer.renderMarkdown(
      `\`\`\`ActivityHistory\n${sourcePath}\n\`\`\``,
      host,
      "",
      api.component
    );
    const moveYearSelector = () => {
      const yearSelector = host.querySelector("#SelectYear");
      if (yearSelector) yearSlot.appendChild(yearSelector);
    };
    const refreshStatus = () => {
      const cells = Array.from(host.querySelectorAll("svg rect"));
      const activeCells = cells.filter((cell) => {
        const value = cell.getAttribute("data-value");
        return value && value !== "0";
      });
      status.setText(
        activeCells.length
          ? `${activeCells.length} active days this year · steady notes rhythm`
          : "No activity recorded yet this year"
      );
    };
    moveYearSelector();
    refreshStatus();
    window.requestAnimationFrame(moveYearSelector);
    window.requestAnimationFrame(refreshStatus);
    window.setTimeout(refreshStatus, 250);
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Source path").setDesc("Use / for the whole vault.").addText((text) => {
      text.setValue(draft.sourcePath || "/");
      text.onChange((value) => {
        draft.sourcePath = value.trim() || "/";
      });
    });
  }
};
