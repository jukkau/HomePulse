// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { normalizeArray } from "./widget-api";

const { Notice, Setting, setIcon } = require("obsidian");

function renderBookmarkIcon(button, item, useFavicons) {
  const icon = button.createDiv({ cls: "yh-action-icon" });
  icon.createSpan({ cls: "yh-action-icon-fallback", text: String(item.label || "?").slice(0, 1).toUpperCase() });

  const target = String(item.value || "").trim();
  if (!useFavicons) return;

  try {
    const url = new URL(target);
    const image = icon.createEl("img", {
      cls: "yh-action-favicon",
      attr: {
        src: `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url.href)}&sz=64`,
        alt: "",
        loading: "lazy",
        referrerpolicy: "no-referrer"
      }
    });
    image.addEventListener("load", () => icon.addClass("has-favicon"));
    image.addEventListener("error", () => image.remove());
  } catch {
    setIcon(icon, "bookmark");
  }
}

export function serializeBookmarks(items) {
  return normalizeArray(items, []).map((item) => `${item.label}|${item.value}`).join("\n");
}

export function parseBookmarks(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (!line.includes("|")) {
        const value = line.trim();
        let label = value;
        try {
          label = new URL(value).hostname.replace(/^www\./, "");
        } catch {
          // Keep the raw text visible so a mistaken line is not silently discarded.
        }
        return {
          label: label || "bookmark",
          type: "url",
          value
        };
      }
      const [label, ...rest] = line.split("|").map((part) => part.trim());
      return {
        label: label || "bookmark",
        type: "url",
        value: rest.join("|")
      };
    })
    .filter((item) => item.label || item.value);
}

export const bookmarksWidget = {
  type: "bookmarks",
  displayName: "Bookmarks",
  shell: "strip",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H2", w: 1, h: 2 },
  defaultConfig: {
    title: "bookmarks",
    variant: "grid",
    useFavicons: false,
    items: []
  },
  defaultState: {},
  async render(container, api) {
    const items = normalizeArray(api.widgetData.config.items, []);
    const variant = api.widgetData.config.variant === "compact" ? "compact" : "grid";
    const useFavicons = api.widgetData.config.useFavicons === true;
    if (!items.length) {
      const empty = container.createEl("button", { cls: "yh-empty yh-empty-action yh-bookmarks-empty" });
      const icon = empty.createDiv({ cls: "yh-empty-icon" });
      setIcon(icon, "bookmark-plus");
      empty.createDiv({ cls: "yh-empty-title", text: "No bookmarks configured." });
      empty.createDiv({ cls: "yh-empty-subtitle", text: "Add your first link" });
      empty.addEventListener("click", () => {
        api.openSettings?.();
      });
      return;
    }

    const grid = container.createDiv({ cls: `yh-action-grid is-${variant}` });
    for (const item of items) {
      const button = grid.createEl("button", {
        cls: `yh-action-btn ${variant === "compact" ? "is-compact" : ""}`
      });
      renderBookmarkIcon(button, item, useFavicons);
      button.createDiv({ cls: "yh-action-label", text: item.label || "bookmark" });
      button.addEventListener("click", () => {
        const target = String(item.value || "").trim();
        if (!/^https?:\/\//i.test(target)) {
          new Notice(`Invalid bookmark URL: ${target}`);
          return;
        }
        window.open(target, "_blank", "noopener,noreferrer");
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
    new Setting(container).setName("Layout").addDropdown((drop) => {
      drop.addOption("grid", "Grid");
      drop.addOption("compact", "Compact list");
      drop.setValue(draft.variant === "compact" ? "compact" : "grid");
      drop.onChange((value) => {
        draft.variant = value;
      });
    });
    new Setting(container).setName("Use native favicons").setDesc("Loads each site's /favicon.ico. This may make network requests to bookmark domains.").addToggle((toggle) => {
      toggle.setValue(draft.useFavicons === true);
      toggle.onChange((value) => {
        draft.useFavicons = value;
      });
    });
    new Setting(container).setName("Bookmarks").setDesc("One per line. Format: label|url, or paste a URL directly.").addTextArea((text) => {
      text.setValue(serializeBookmarks(draft.items || []));
      text.onChange((value) => {
        draft.items = parseBookmarks(value);
      });
    });
  }
};
