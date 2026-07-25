// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";

const { Setting, MarkdownRenderer } = require("obsidian");

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
    await MarkdownRenderer.renderMarkdown(
      `\`\`\`ActivityHistory\n${sourcePath}\n\`\`\``,
      host,
      "",
      api.view
    );
    const moveYearSelector = () => {
      const yearSelector = host.querySelector("#SelectYear");
      if (yearSelector) yearSlot.appendChild(yearSelector);
    };
    moveYearSelector();
    window.requestAnimationFrame(moveYearSelector);
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
