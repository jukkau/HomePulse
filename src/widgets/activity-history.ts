// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";

import { Setting, MarkdownRenderer } from "obsidian";

function getConfiguredYear(config) {
  const year = String(config.year || "").trim();
  return /^\d{4}$/.test(year) ? year : String(new Date().getFullYear());
}

export const activityHistoryWidget = {
  type: "activity-history",
  displayName: "Activity History",
  shell: "canvas",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W4H2", w: 4, h: 2 },
  defaultConfig: { title: "activity history", sourcePath: "/", year: "" },
  defaultState: {},
  async render(container, api) {
    const sourcePath = api.widgetData.config.sourcePath || "/";
    const selectedYear = getConfiguredYear(api.widgetData.config);
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
    const applyConfiguredYear = () => {
      const select = host.querySelector("#SelectYear select, .selectYear select, select.selectYear, select");
      if (!select) return;
      if (Array.from(select.options || []).some((option) => option.value === selectedYear || option.text === selectedYear)) {
        select.value = selectedYear;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    const refreshStatus = () => {
      const cells = Array.from(host.querySelectorAll("svg rect"));
      const activeCells = cells.filter((cell) => {
        const value = cell.getAttribute("data-value");
        return value && value !== "0";
      });
      status.setText(
        activeCells.length
          ? `${selectedYear} · ${activeCells.length} active days · steady notes rhythm`
          : `${selectedYear} · no activity recorded`
      );
    };
    applyConfiguredYear();
    refreshStatus();
    window.requestAnimationFrame(() => {
      applyConfiguredYear();
      refreshStatus();
    });
    window.setTimeout(() => {
      applyConfiguredYear();
      refreshStatus();
    }, 250);
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
    new Setting(container).setName("Year").setDesc("Four digits. Empty uses the current year.").addText((text) => {
      text.setPlaceholder(String(new Date().getFullYear()));
      text.setValue(draft.year || "");
      text.onChange((value) => {
        draft.year = /^\d{4}$/.test(value.trim()) ? value.trim() : "";
      });
    });
  }
};
