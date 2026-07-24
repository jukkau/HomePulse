// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import {
  normalizeArray,
  parseQuickActions,
  renderEmpty,
  serializeQuickActions
} from "./widget-api";

const { Notice, Setting, setIcon } = require("obsidian");

function actionIconName(item) {
  if (item.type === "daily-note") return "calendar-days";
  const commandIcons = [
    ["global-search", "search"],
    ["graph", "share-2"],
    ["new-file", "file-plus-2"],
    ["quickadd", "zap"],
    ["command-palette", "square-terminal"]
  ];
  const command = String(item.value || "").toLowerCase();
  return commandIcons.find(([needle]) => command.includes(needle))?.[1] || "command";
}

function renderActionIcon(button, item) {
  const icon = button.createDiv({ cls: "yh-action-icon" });
  if (item.type !== "url") {
    setIcon(icon, actionIconName(item));
    return;
  }

  icon.createSpan({ cls: "yh-action-icon-fallback", text: String(item.label || "?").slice(0, 1).toUpperCase() });
  try {
    const url = new URL(item.value);
    const faviconUrl = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url.href)}&sz=64`;
    const image = icon.createEl("img", {
      cls: "yh-action-favicon",
      attr: { src: faviconUrl, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }
    });
    image.addEventListener("load", () => icon.addClass("has-favicon"));
    image.addEventListener("error", () => image.remove());
  } catch {
    // Invalid custom URLs keep the local monogram fallback.
  }
}

export const quickActionsWidget = {
  type: "quick-actions",
  displayName: "Quick Actions",
  shell: "strip",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H2", w: 1, h: 2 },
  defaultConfig: {
    title: "system",
    variant: "grid",
    sectionTitle: "",
    secondaryTitle: "",
    secondaryItems: [],
    items: [
      { label: "daily", type: "daily-note", value: "" },
      { label: "search", type: "command", value: "global-search:open" }
    ]
  },
  defaultState: {},
  async render(container, api) {
    const items = normalizeArray(api.widgetData.config.items, []);
    const secondaryItems = normalizeArray(api.widgetData.config.secondaryItems, []);
    const configuredVariant = api.widgetData.config.variant;
    const variant = configuredVariant === "stack" ? "stack" : configuredVariant === "compact" ? "compact" : "grid";
    if (!items.length && !secondaryItems.length) {
      renderEmpty(container, "No quick actions configured.");
      return;
    }
    const runAction = async (item) => {
      if (item.type === "command") {
        if (!api.app.commands.commands[item.value]) {
          new Notice(`Command not found: ${item.value}`);
          return;
        }
        api.app.commands.executeCommandById(item.value);
        return;
      }
      if (item.type === "url") {
        window.open(item.value, "_blank", "noopener,noreferrer");
        return;
      }
      if (item.type === "daily-note") {
        if (api.app.commands.commands["daily-notes:goto-today"]) {
          api.app.commands.executeCommandById("daily-notes:goto-today");
        } else {
          new Notice("No daily note command found.");
        }
      }
    };
    const renderButton = (parent, item, compact) => {
      const button = parent.createEl("button", {
        cls: `yh-action-btn ${compact ? "is-compact" : ""}`
      });
      renderActionIcon(button, item);
      button.createDiv({ cls: "yh-action-label", text: item.label });
      button.addEventListener("click", () => void runAction(item));
    };
    if (variant === "stack") {
      const stack = container.createDiv({ cls: "yh-action-stack" });
      const groups = [
        { title: api.widgetData.config.sectionTitle || "AI tools", items },
        { title: api.widgetData.config.secondaryTitle || "system", items: secondaryItems }
      ];
      for (const group of groups) {
        if (!group.items.length) continue;
        const section = stack.createDiv({ cls: "yh-action-section" });
        section.createDiv({ cls: "yh-action-section-title", text: group.title });
        const grid = section.createDiv({ cls: "yh-action-mini-grid" });
        for (const item of group.items) renderButton(grid, item, false);
      }
      return;
    }
    const grid = container.createDiv({ cls: `yh-action-grid is-${variant}` });
    for (const item of items) renderButton(grid, item, variant === "compact");
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Layout").addDropdown((drop) => {
      drop.addOption("grid", "Grid");
      drop.addOption("compact", "Compact list");
      drop.addOption("stack", "Two sections");
      drop.setValue(draft.variant === "stack" ? "stack" : draft.variant === "compact" ? "compact" : "grid");
      drop.onChange((value) => {
        draft.variant = value;
      });
    });
    new Setting(container).setName("Primary section title").addText((text) => {
      text.setValue(draft.sectionTitle || "");
      text.onChange((value) => {
        draft.sectionTitle = value;
      });
    });
    new Setting(container).setName("Actions").setDesc("Format: label|type|value").addTextArea((text) => {
      text.setValue(serializeQuickActions(draft.items || []));
      text.onChange((value) => {
        draft.items = parseQuickActions(value);
      });
    });
    new Setting(container).setName("Secondary section title").addText((text) => {
      text.setValue(draft.secondaryTitle || "");
      text.onChange((value) => {
        draft.secondaryTitle = value;
      });
    });
    new Setting(container).setName("Secondary actions").setDesc("Format: label|type|value").addTextArea((text) => {
      text.setValue(serializeQuickActions(draft.secondaryItems || []));
      text.onChange((value) => {
        draft.secondaryItems = parseQuickActions(value);
      });
    });
  }
};
