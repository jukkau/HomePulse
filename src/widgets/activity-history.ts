// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";

import { Setting, MarkdownRenderer } from "obsidian";

function getConfiguredYear(config) {
  const year = String(config.year || "").trim();
  return /^\d{4}$/.test(year) ? year : String(new Date().getFullYear());
}

function removeRawActivitySource(host) {
  const selectors = [
    ".el-pre",
    "pre",
    "code.language-ActivityHistory",
    "code.language-activityhistory",
    ".copy-code-button"
  ];
  Array.from(host.querySelectorAll(selectors.join(","))).forEach((node) => {
    const target = node.closest(".el-pre") || node.closest("pre") || node;
    target.remove();
  });
  Array.from(host.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === "/") node.remove();
  });
}

function renderEmptyHeatmap(host, year, language) {
  removeRawActivitySource(host);
  const sourceCells = Array.from(host.querySelectorAll("svg:not(.yh-activity-empty-heatmap) rect"));
  const hasDataAttributes = sourceCells.some((cell) => cell.hasAttribute("data-value"));
  const hasActivityCells = sourceCells.some((cell) => {
    const value = cell.getAttribute("data-value");
    return value != null && value !== "0";
  });
  const hasHeatmapCells = hasActivityCells || (sourceCells.length >= 100 && !hasDataAttributes);
  const existing = host.querySelector(".yh-activity-empty-heatmap");
  if (hasHeatmapCells) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("yh-activity-empty-heatmap");
  svg.setAttribute("viewBox", "0 0 546 94");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", t(language, "noActivity", { year }));

  const left = 8;
  const top = 18;
  const step = 10;
  const monthFormatter = new Intl.DateTimeFormat(language === "zh-CN" ? "zh-CN" : "en-US", { month: "short" });
  const monthLabels = new Set();
  for (let month = 0; month < 12; month += 1) {
    const monthStart = new Date(Number(year), month, 1);
    const dayOffset = Math.floor((monthStart.getTime() - new Date(Number(year), 0, 1).getTime()) / 86400000);
    const column = Math.floor(dayOffset / 7);
    if (monthLabels.has(column)) continue;
    monthLabels.add(column);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(left + column * step));
    label.setAttribute("y", "10");
    label.textContent = monthFormatter.format(monthStart);
    svg.appendChild(label);
  }

  for (let week = 0; week < 53; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const cell = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      cell.setAttribute("x", String(left + week * step));
      cell.setAttribute("y", String(top + day * step));
      cell.setAttribute("width", "7");
      cell.setAttribute("height", "7");
      const seed = (Number(year) * 13 + week * 37 + day * 17) % 100;
      const level = seed < 56 ? 0 : seed < 76 ? 1 : seed < 90 ? 2 : seed < 98 ? 3 : 4;
      cell.setAttribute("data-value", String(level));
      cell.classList.add(`is-level-${level}`);
      cell.setAttribute("aria-hidden", "true");
      svg.appendChild(cell);
    }
  }
  host.appendChild(svg);
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
    const status = footer.createDiv({ cls: "yh-activity-status", text: t(api.language, "readingActivity") });
    const legend = footer.createDiv({ cls: "yh-activity-legend" });
    legend.createSpan({ text: t(api.language, "less") });
    for (let i = 0; i < 4; i += 1) {
      legend.createSpan({ cls: `yh-activity-legend-swatch is-level-${i}` });
    }
    legend.createSpan({ text: t(api.language, "more") });
    let refreshQueued = false;
    const scheduleRefresh = () => {
      if (refreshQueued) return;
      refreshQueued = true;
      window.requestAnimationFrame(() => {
        refreshQueued = false;
        applyConfiguredYear();
        refreshStatus();
      });
    };
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
      renderEmptyHeatmap(host, selectedYear, api.language);
      const cells = Array.from(host.querySelectorAll("svg:not(.yh-activity-empty-heatmap) rect"));
      const activeCells = cells.filter((cell) => {
        const value = cell.getAttribute("data-value");
        return value && value !== "0";
      });
      status.setText(
        activeCells.length
          ? t(api.language, "activityStatus", { year: selectedYear, count: activeCells.length })
          : t(api.language, "noActivity", { year: selectedYear })
      );
    };
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(host, { childList: true, subtree: true });
    api.component.register(() => observer.disconnect());
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
  renderSettings(container, draft, ctx) {
    new Setting(container).setName(t(ctx.language, "title")).addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName(t(ctx.language, "sourcePath")).setDesc(t(ctx.language, "sourcePathDesc")).addText((text) => {
      text.setValue(draft.sourcePath || "/");
      text.onChange((value) => {
        draft.sourcePath = value.trim() || "/";
      });
    });
    new Setting(container).setName(t(ctx.language, "year")).setDesc(t(ctx.language, "yearDesc")).addText((text) => {
      text.setPlaceholder(String(new Date().getFullYear()));
      text.setValue(draft.year || "");
      text.onChange((value) => {
        draft.year = /^\d{4}$/.test(value.trim()) ? value.trim() : "";
      });
    });
  }
};
