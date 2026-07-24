// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { getExecutionMetrics } from "./stats-overview";

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
    const metrics = getExecutionMetrics(api);
    const items = [
      { label: "Obsidian days", value: api.snapshot.obsidianDays ?? "—" },
      { label: "Notes", value: api.snapshot.files.length },
      { label: "Open", value: api.snapshot.openTaskCount },
      { label: "Done", value: api.snapshot.doneTaskCount },
      metrics.projects,
      metrics.pomodoro,
      metrics.habits
    ];
    const toolbar = container.createDiv({ cls: "yh-activity-toolbar" });
    const metricGrid = toolbar.createDiv({ cls: "yh-activity-metrics" });
    for (const metric of items) {
      const item = metricGrid.createDiv({ cls: "yh-activity-metric" });
      item.createDiv({ cls: "yh-activity-metric-value", text: String(metric.value) });
      item.createDiv({ cls: "yh-activity-metric-label", text: metric.label });
    }
    const yearSlot = toolbar.createDiv({ cls: "yh-activity-year-slot" });
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
