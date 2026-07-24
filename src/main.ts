// @ts-nocheck
// Migration note: this file is the current published main.js moved under src/.
// Re-enable type checking module by module as responsibilities are split out.
import {
  DEFAULT_TECH_TREE_SOURCE,
  VIEW_ICON,
  VIEW_NAME,
  VIEW_TYPE
} from "./constants";
import { DEFAULT_DATA } from "./data/defaults";
import { normalizeData as normalizePluginData } from "./data/normalize";
import { validateWidgetConfig, validateWidgetState } from "./data/validators";
import { getGridRows, packLayout, sortLayoutForReadingOrder } from "./layout/pack-layout";
import { buildResponsiveLayout, getResponsiveColumnCount } from "./layout/responsive-layout";
import { getResponsiveSpanClasses } from "./layout/responsive-classes";
import { applySizePreset, toSizePreset } from "./layout/size-presets";
import { SnapshotBuilder } from "./services/snapshot-builder";
import { calculateObsidianUsageDays, formatDateKey } from "./services/obsidian-usage";
import { createWidgetRegistry } from "./widgets/registry";

const {
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  normalizePath
} = require("obsidian");

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(base, saved) {
  if (Array.isArray(base)) {
    return Array.isArray(saved) ? deepClone(saved) : deepClone(base);
  }
  if (!base || typeof base !== "object") {
    return saved === undefined ? base : saved;
  }
  const next = {};
  const source = saved && typeof saved === "object" ? saved : {};
  for (const key of Object.keys(base)) {
    next[key] = mergeDefaults(base[key], source[key]);
  }
  for (const key of Object.keys(source)) {
    if (!(key in next)) {
      next[key] = source[key];
    }
  }
  return next;
}

function normalizeArray(value, fallback) {
  return Array.isArray(value) ? value.filter(Boolean) : deepClone(fallback);
}

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stripHoverHints(root) {
  root.querySelectorAll("[title], [aria-label]").forEach((element) => {
    element.removeAttribute("title");
    element.removeAttribute("aria-label");
  });
  root.querySelectorAll("title").forEach((element) => element.remove());
}

function formatLongDate(date) {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });
}

function parseLineList(raw) {
  return String(raw || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWikilink(link) {
  const match = /^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/.exec(String(link || "").trim());
  if (!match) return null;
  return { path: match[1], label: match[2] || match[1] };
}

function cycleValue(values, current) {
  if (!values.length) return current;
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

async function confirmResetLayout() {
  return window.confirm("Reset layout to the saved default arrangement? This cannot be undone.");
}

async function openExternalOrInternal(app, link) {
  const target = String(link || "").trim();
  const wikilink = parseWikilink(target);
  if (wikilink) {
    await app.workspace.openLinkText(wikilink.path, "", false);
    return;
  }
  if (/^https?:\/\//.test(target)) {
    window.open(target, "_blank", "noopener,noreferrer");
    return;
  }
  if (target) await app.workspace.openLinkText(target, "", false);
}

class AddWidgetModal extends Modal {
  constructor(app, plugin, onPick) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("yh-modal");
    contentEl.createEl("h2", { text: "Add widget" });
    const grid = contentEl.createDiv({ cls: "yh-modal-grid" });
    for (const definition of this.plugin.registry) {
      const button = grid.createEl("button", { cls: "yh-widget-picker" });
      button.createDiv({ cls: "yh-widget-picker-title", text: definition.displayName });
      button.createDiv({ cls: "yh-widget-picker-meta", text: "Resizable · 1–5 columns · 1–5 rows" });
      button.addEventListener("click", () => {
        this.onPick(definition.type);
        this.close();
      });
    }
  }
}

class WidgetSettingsModal extends Modal {
  constructor(app, plugin, widget, widgetData, definition, onSave) {
    super(app);
    this.plugin = plugin;
    this.widget = widget;
    this.widgetData = widgetData;
    this.definition = definition;
    this.onSave = onSave;
    this.draft = deepClone(widgetData.config);
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal");
    contentEl.createEl("h2", { text: `${this.definition.displayName} settings` });
    contentEl.createDiv({
      cls: "yh-settings-subtitle",
      text: "Configure this widget's content and display."
    });
    const body = contentEl.createDiv({ cls: "yh-settings-body" });
    this.definition.renderSettings(body, this.draft, this.plugin, this.widget);

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: "Cancel" });
    const save = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: "Save" });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", async () => {
      await this.onSave(this.draft);
      this.close();
    });
  }
}

class HeaderSettingsModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-dashboard-settings-shell", "yh-settings-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal", "yh-dashboard-settings-modal");
    contentEl.createEl("h2", { text: "Header settings" });
    contentEl.createDiv({
      cls: "yh-settings-subtitle yh-dashboard-settings-subtitle",
      text: "Identity and usage details shown in the homepage header."
    });

    const draft = {
      profileName: this.plugin.data.settings.profileName || "Yuki",
      profileSignature: this.plugin.data.settings.profileSignature || "",
      obsidianStartDate: this.plugin.data.settings.obsidianStartDate || "",
      lockHomepage: Boolean(this.plugin.data.settings.lockHomepage)
    };
    const body = contentEl.createDiv({ cls: "yh-settings-body" });

    new Setting(body).setName("Username").addText((text) => {
      text.setValue(draft.profileName);
      text.onChange((value) => {
        draft.profileName = value;
      });
    });

    new Setting(body).setName("Signature").addText((text) => {
      text.setValue(draft.profileSignature);
      text.onChange((value) => {
        draft.profileSignature = value;
      });
    });

    new Setting(body)
      .setName("Lock homepage tab")
      .setDesc("Keep this homepage pinned so other notes always open elsewhere.")
      .addToggle((toggle) => {
        toggle.setValue(draft.lockHomepage);
        toggle.onChange((value) => {
          draft.lockHomepage = value;
        });
      });

    const usageSetting = new Setting(body)
      .setName("Obsidian start date")
      .setDesc("Choose the first day you used Obsidian. The start day counts as day one.");
    usageSetting.settingEl.addClass("yh-start-date-setting");
    usageSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.max = formatDateKey(new Date());
      text.setValue(draft.obsidianStartDate);
      const updateDescription = (value) => {
        const days = calculateObsidianUsageDays(value, new Date());
        usageSetting.descEl.setText(
          days === null ? "Choose a date to enable the usage counter." : `Today is day ${days}.`
        );
      };
      updateDescription(draft.obsidianStartDate);
      text.onChange((value) => {
        const next = value.trim();
        if (next && calculateObsidianUsageDays(next, new Date()) === null) {
          new Notice("Choose a valid date that is not in the future.");
          text.setValue(draft.obsidianStartDate);
          return;
        }
        draft.obsidianStartDate = next;
        updateDescription(next);
      });
    });

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: "Cancel" });
    const save = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: "Save" });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", async () => {
      this.plugin.data.settings.profileName = draft.profileName.trim() || "Yuki";
      this.plugin.data.settings.profileSignature = draft.profileSignature.trim();
      this.plugin.data.settings.obsidianStartDate = draft.obsidianStartDate;
      this.plugin.data.settings.lockHomepage = draft.lockHomepage;
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        leaf.setPinned(draft.lockHomepage);
      }
      await this.plugin.persist();
      this.plugin.refreshOpenViews();
      this.close();
    });
  }
}

class YukiHomepageSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: VIEW_NAME });

    new Setting(containerEl)
      .setName("Open on startup")
      .setDesc("Keep the homepage available when Obsidian opens, without replacing the active work tab.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.data.settings.openOnStartup);
        toggle.onChange(async (value) => {
          this.plugin.data.settings.openOnStartup = value;
          await this.plugin.persist();
        });
      });

    new Setting(containerEl)
      .setName("Lock homepage tab")
      .setDesc("Pin the homepage so opening notes cannot replace it. The sidebar button will always return to this tab.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.data.settings.lockHomepage);
        toggle.onChange(async (value) => {
          this.plugin.data.settings.lockHomepage = value;
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
            leaf.setPinned(value);
          }
          await this.plugin.persist();
        });
      });

    new Setting(containerEl)
      .setName("Theme preset")
      .setDesc("Visual preset for the homepage view.")
      .addDropdown((drop) => {
        drop.addOption("petal", "Petal");
        drop.setValue(this.plugin.data.settings.themePreset);
        drop.onChange(async (value) => {
          this.plugin.data.settings.themePreset = value;
          await this.plugin.persist();
          this.plugin.refreshOpenViews();
        });
      });

    const usageSetting = new Setting(containerEl)
      .setName("Obsidian start date")
      .setDesc("Set the first day you started using Obsidian. The homepage counts from this date through today.");
    usageSetting.settingEl.addClass("yh-start-date-setting");
    usageSetting.addText((text) => {
      const currentValue = this.plugin.data.settings.obsidianStartDate || "";
      text.inputEl.type = "date";
      text.inputEl.max = formatDateKey(new Date());
      text.setValue(currentValue);
      const updateDescription = (value) => {
        const days = calculateObsidianUsageDays(value, new Date());
        usageSetting.descEl.setText(
          days === null
            ? "Choose a start date to show an accurate usage duration on the homepage."
            : `Counting the start day, today is day ${days}.`
        );
      };
      updateDescription(currentValue);
      text.onChange(async (value) => {
        const next = value.trim();
        if (next && calculateObsidianUsageDays(next, new Date()) === null) {
          new Notice("Choose a valid date that is not in the future.");
          text.setValue(this.plugin.data.settings.obsidianStartDate || "");
          return;
        }
        this.plugin.data.settings.obsidianStartDate = next;
        updateDescription(next);
        await this.plugin.persist();
        this.plugin.refreshOpenViews();
      });
    });

    new Setting(containerEl)
      .setName("Tech tree source")
      .setDesc("Metadata note for the automatic Value → Area → active Project tree.")
      .addText((text) => {
        text.setPlaceholder(DEFAULT_TECH_TREE_SOURCE);
        text.setValue(this.plugin.data.settings.techTreeSource || DEFAULT_TECH_TREE_SOURCE);
        text.onChange(async (value) => {
          this.plugin.data.settings.techTreeSource = value.trim() || DEFAULT_TECH_TREE_SOURCE;
          await this.plugin.persist();
          this.plugin.refreshOpenViews();
        });
      });

    new Setting(containerEl)
      .setName("Default layout")
      .setDesc("Save the current widget positions, sizes, and widget set as the layout used by Reset.")
      .addButton((button) => {
        button.setButtonText("Save current");
        button.setCta();
        button.onClick(async () => {
          await this.plugin.saveCurrentLayoutAsDefault();
          new Notice("Current Yuki Homepage layout saved as default.");
        });
      });

    new Setting(containerEl)
      .setName("Reset layout")
      .setDesc("Restore the saved default widget positions, sizes, and widget set.")
      .addButton((button) => {
        button.setButtonText("Reset");
        button.setWarning();
        button.onClick(async () => {
          if (!(await confirmResetLayout())) return;
          await this.plugin.resetToDefaults();
          new Notice("Yuki Homepage layout reset.");
        });
      });
  }
}

class YukiHomepageView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.editMode = false;
    this.renderToken = 0;
    this.draggingWidgetId = "";
    this.widgetUiState = {};
    this.intervals = [];
    this.resizeObserver = null;
    this.responsiveColumns = 5;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return VIEW_NAME;
  }

  getIcon() {
    return VIEW_ICON;
  }

  async onOpen() {
    await this.renderView();
  }

  async onClose() {
    this.clearIntervals();
    this.disconnectResizeObserver();
  }

  clearIntervals() {
    while (this.intervals.length) {
      window.clearInterval(this.intervals.pop());
    }
  }

  rememberInterval(id) {
    this.intervals.push(id);
  }

  disconnectResizeObserver() {
    if (!this.resizeObserver) return;
    this.resizeObserver.disconnect();
    this.resizeObserver = null;
  }

  observeResponsiveLayout(frame, columns) {
    this.responsiveColumns = columns;
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(([entry]) => {
      const nextColumns = getResponsiveColumnCount(entry.contentRect.width);
      if (nextColumns === this.responsiveColumns) return;
      this.responsiveColumns = nextColumns;
      void this.renderView();
    });
    this.resizeObserver.observe(frame);
  }

  async renderView() {
    const token = ++this.renderToken;
    this.clearIntervals();
    this.disconnectResizeObserver();

    const container = this.contentEl;
    container.empty();
    container.addClass("yh-view");

    const frame = container.createDiv({ cls: "yh-frame" });
    const loading = frame.createDiv({ cls: "yh-loading", text: "Loading widgets..." });
    const snapshot = await new SnapshotBuilder(this.app, this.plugin).load();
    if (token !== this.renderToken) return;
    loading.remove();

    const header = frame.createDiv({ cls: `yh-header ${this.editMode ? "is-editing" : ""}` });
    const brand = header.createDiv({ cls: "yh-brand" });
    brand.createDiv({ cls: "yh-brand-title", text: this.plugin.data.settings.profileName || "Yuki" });
    brand.createDiv({ cls: "yh-brand-subtitle", text: this.plugin.data.settings.profileSignature || "" });

    const clockBlock = header.createDiv({ cls: "yh-clock-block" });
    const timeEl = clockBlock.createDiv({ cls: "yh-time" });

    const rightHdr = header.createDiv({ cls: "yh-header-right" });
    const periodRow = rightHdr.createDiv({ cls: "yh-period-row" });
    const periodEl = periodRow.createDiv({ cls: "yh-period" });
    const configBtn = periodRow.createEl("button", {
      cls: `yh-header-config-btn ${this.editMode ? "is-active" : ""}`,
      text: this.editMode ? "⚙ editing" : "⚙ config"
    });
    const dateEl = rightHdr.createDiv({ cls: "yh-date" });

    configBtn.addEventListener("click", async () => {
      this.editMode = !this.editMode;
      await this.renderView();
    });

    if (this.editMode) {
      const headerControls = header.createDiv({ cls: "yh-header-controls" });
      const settingsBtn = headerControls.createEl("button", { text: "Header settings" });
      settingsBtn.addEventListener("click", () => {
        new HeaderSettingsModal(this.app, this.plugin).open();
      });
    }

    const tick = () => {
      const now = new Date();
      const hour = now.getHours();
      const period = hour < 5 || hour >= 22
        ? "NIGHT /"
        : hour < 12
          ? "MORNING /"
          : hour < 18
            ? "AFTERNOON /"
            : "EVENING /";
      timeEl.setText(now.toLocaleTimeString("zh-CN", { hour12: false }));
      dateEl.setText(`${formatLongDate(now)} · ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
      periodEl.setText(period);
    };
    tick();
    this.rememberInterval(window.setInterval(tick, 1000));

    frame.createDiv({ cls: "yh-divider" });

    const responsiveColumns = getResponsiveColumnCount(frame.clientWidth);
    const renderedWidgets = buildResponsiveLayout(this.plugin.data.layout.widgets, responsiveColumns);
    const canEditLayout = this.editMode && responsiveColumns === 5;

    if (this.editMode) {
      const toolbar = frame.createDiv({ cls: "yh-toolbar yh-toolbar-compact" });
      toolbar.createDiv({
        cls: "yh-toolbar-label",
        text: canEditLayout ? "layout editing" : "layout editing · resize window to edit"
      });
      const actions = toolbar.createDiv({ cls: "yh-toolbar-actions" });
      if (canEditLayout) {
        const addBtn = actions.createEl("button", { text: "Add widget" });
        const resetBtn = actions.createEl("button", { text: "Reset" });
        addBtn.addEventListener("click", () => this.openAddWidgetModal());
        resetBtn.addEventListener("click", async () => {
          if (!(await confirmResetLayout())) return;
          await this.plugin.resetToDefaults();
        });
      }
    }

    const grid = frame.createDiv({ cls: "yh-grid" });
    grid.style.setProperty("--yh-columns", String(responsiveColumns));
    grid.style.setProperty("--yh-rows", String(getGridRows(renderedWidgets)));
    if (canEditLayout) grid.addClass("is-editing");

    grid.addEventListener("dragover", (event) => {
      if (!canEditLayout || !this.draggingWidgetId) return;
      event.preventDefault();
      grid.addClass("is-drop-target");
    });

    grid.addEventListener("dragleave", () => {
      grid.removeClass("is-drop-target");
    });

    grid.addEventListener("drop", async (event) => {
      if (!canEditLayout || !this.draggingWidgetId) return;
      event.preventDefault();
      grid.removeClass("is-drop-target");
      const widget = this.plugin.data.layout.widgets.find((item) => item.id === this.draggingWidgetId);
      if (!widget) return;
      const bounds = grid.getBoundingClientRect();
      const cellWidth = bounds.width / this.plugin.data.layout.columns;
      const cellHeight = 132;
      const x = clamp(Math.floor((event.clientX - bounds.left) / cellWidth), 0, this.plugin.data.layout.columns - widget.w);
      const y = Math.max(0, Math.floor((event.clientY - bounds.top) / cellHeight));
      this.draggingWidgetId = "";
      await this.plugin.moveWidget(widget.id, x, y);
    });

    for (const widget of sortLayoutForReadingOrder(renderedWidgets)) {
      const definition = this.plugin.getDefinition(widget.type);
      if (!definition) continue;
      const widgetData = this.plugin.getWidgetData(widget.id, widget.type);
      const shell = grid.createDiv({
        cls: `yh-card yh-widget-${definition.type} yh-shell-${definition.shell} yh-size-${widget.sizePreset.toLowerCase()} ${getResponsiveSpanClasses(widget.sizePreset)}`
      });
      shell.style.gridColumn = `${widget.x + 1} / span ${widget.w}`;
      shell.style.gridRow = `${widget.y + 1} / span ${widget.h}`;
      shell.style.setProperty("--yh-widget-w", String(widget.w || 1));
      shell.style.setProperty("--yh-widget-h", String(widget.h || 1));
      shell.style.setProperty("--yh-tablet-w", String(Math.min(widget.w || 1, 3)));
      shell.style.setProperty("--yh-compact-w", String(Math.min(widget.w || 1, 2)));
      shell.dataset.widgetId = widget.id;

      if (canEditLayout) {
        shell.setAttribute("draggable", "true");
        shell.addClass("is-editing");
        shell.addEventListener("dragstart", (event) => {
          this.draggingWidgetId = widget.id;
          shell.addClass("is-dragging");
          event.dataTransfer.effectAllowed = "move";
        });
        shell.addEventListener("dragend", () => {
          this.draggingWidgetId = "";
          shell.removeClass("is-dragging");
          grid.removeClass("is-drop-target");
        });

        const resizeHandle = shell.createDiv({
          cls: "yh-resize-handle",
          attr: {
            role: "slider"
          }
        });
        resizeHandle.setAttribute("draggable", "false");
        resizeHandle.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          shell.setAttribute("draggable", "false");
          shell.addClass("is-resizing");
          resizeHandle.setPointerCapture?.(event.pointerId);

          const gridBounds = grid.getBoundingClientRect();
          const shellBounds = shell.getBoundingClientRect();
          const gap = 14;
          const renderedColumns = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
          const columnWidth = (gridBounds.width - gap * (renderedColumns - 1)) / renderedColumns;
          const rowHeight = 132;
          let nextW = widget.w || 1;
          let nextH = widget.h || 1;

          const onMove = (moveEvent) => {
            const width = Math.max(columnWidth, moveEvent.clientX - shellBounds.left);
            const height = Math.max(rowHeight, moveEvent.clientY - shellBounds.top);
            const maxWidth = renderedColumns === 5 ? 5 - widget.x : renderedColumns;
            nextW = clamp(Math.round((width + gap) / (columnWidth + gap)), 1, Math.min(5, maxWidth));
            nextH = clamp(Math.round((height + gap) / (rowHeight + gap)), 1, 5);
            shell.style.gridColumn = `${widget.x + 1} / span ${nextW}`;
            shell.style.gridRow = `${widget.y + 1} / span ${nextH}`;
            shell.style.setProperty("--yh-widget-w", String(nextW));
            shell.style.setProperty("--yh-widget-h", String(nextH));
            shell.style.setProperty("--yh-tablet-w", String(Math.min(nextW, 3)));
            shell.style.setProperty("--yh-compact-w", String(Math.min(nextW, 2)));
            shell.dataset.resizeLabel = `${nextW} × ${nextH}`;
          };

          const onEnd = async () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onEnd);
            window.removeEventListener("pointercancel", onEnd);
            shell.removeClass("is-resizing");
            shell.removeAttribute("data-resize-label");
            shell.setAttribute("draggable", "true");
            await this.plugin.setWidgetDimensions(widget.id, nextW, nextH);
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onEnd, { once: true });
          window.addEventListener("pointercancel", onEnd, { once: true });
        });
      }

      const cardHeader = shell.createDiv({ cls: "yh-card-header" });
      cardHeader.createDiv({ cls: "yh-card-title", text: widgetData.config.title || definition.displayName });
      if (canEditLayout) {
        const controls = cardHeader.createDiv({ cls: "yh-card-controls" });
        const widthSelect = controls.createEl("select", { cls: "yh-size-select" });
        for (let width = 1; width <= 5; width += 1) {
          const option = widthSelect.createEl("option", { value: String(width), text: `W${width}` });
          option.selected = width === widget.w;
        }
        const heightSelect = controls.createEl("select", { cls: "yh-size-select" });
        for (let height = 1; height <= 5; height += 1) {
          const option = heightSelect.createEl("option", { value: String(height), text: `H${height}` });
          option.selected = height === widget.h;
        }
        const settingsBtn = controls.createEl("button", {
          cls: "yh-icon-btn",
          text: "⚙"
        });
        const removeBtn = controls.createEl("button", {
          cls: "yh-icon-btn danger",
          text: "×"
        });
        widthSelect.addEventListener("click", (event) => {
          event.stopPropagation();
        });
        heightSelect.addEventListener("click", (event) => {
          event.stopPropagation();
        });
        const applyDimensions = async (event) => {
          event.stopPropagation();
          await this.plugin.setWidgetDimensions(widget.id, Number(widthSelect.value), Number(heightSelect.value));
        };
        widthSelect.addEventListener("change", applyDimensions);
        heightSelect.addEventListener("change", applyDimensions);
        settingsBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openWidgetSettings(widget, widgetData, definition);
        });
        removeBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          await this.plugin.removeWidget(widget.id);
        });
      }

      const body = shell.createDiv({ cls: "yh-card-body" });
      const api = {
        app: this.app,
        plugin: this.plugin,
        view: this,
        widget,
        widgetData,
        snapshot,
        rememberInterval: (id) => this.rememberInterval(id),
        openPath: async (path) => {
          await this.app.workspace.openLinkText(path, "", false);
        },
        openLink: async (link) => {
          await openExternalOrInternal(this.app, link);
        },
        saveState: async (patch, rerender = false) => {
          await this.plugin.updateWidgetState(widget.id, patch);
          if (rerender) await this.renderView();
        },
        saveConfig: async (patch, rerender = true) => {
          await this.plugin.updateWidgetConfig(widget.id, patch);
          if (rerender) await this.renderView();
        }
      };

      try {
        await definition.render(body, api);
      } catch (error) {
        body.createDiv({ cls: "yh-empty", text: `Widget failed to render: ${error.message}` });
      }
    }
    stripHoverHints(frame);
    this.observeResponsiveLayout(frame, responsiveColumns);
  }

  openAddWidgetModal() {
    new AddWidgetModal(this.app, this.plugin, async (type) => {
      await this.plugin.addWidget(type);
    }).open();
  }

  openWidgetSettings(widget, widgetData, definition) {
    new WidgetSettingsModal(this.app, this.plugin, widget, widgetData, definition, async (draft) => {
      await this.plugin.updateWidgetConfig(widget.id, draft);
    }).open();
  }
}

class YukiHomepagePlugin extends Plugin {
  async onload() {
    this.registry = createWidgetRegistry(this);
    this.data = this.normalizeData(await this.loadData());
    this.refreshTimer = 0;

    this.registerView(VIEW_TYPE, (leaf) => new YukiHomepageView(leaf, this));
    this.addRibbonIcon(VIEW_ICON, "Open Yuki Homepage", () => {
      void this.openHomepage();
    });
    this.addCommand({
      id: "open-yuki-homepage",
      name: `Open ${VIEW_NAME}`,
      callback: () => {
        void this.openHomepage();
      }
    });
    this.addSettingTab(new YukiHomepageSettingTab(this.app, this));

    const refresh = () => this.scheduleRefresh();
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));

    this.app.workspace.onLayoutReady(() => {
      if (this.data.settings.openOnStartup) {
        void this.openHomepage({ reveal: false });
      }
    });
  }

  onunload() {
    window.clearTimeout(this.refreshTimer);
  }

  normalizeData(saved) {
    return normalizePluginData(saved, {
      mergeDefaults,
      normalizeArray,
      randomId,
      applySizePreset,
      packLayout,
      deepClone,
      getDefinition: (type) => this.getDefinition(type)
    });
  }

  getDefinition(type) {
    return this.registry.find((item) => item.type === type);
  }

  getWidgetData(id, type) {
    const definition = this.getDefinition(type);
    const raw = this.data.widgets[id] || {};
    return {
      config: mergeDefaults(definition.defaultConfig, raw.config || {}),
      state: mergeDefaults(definition.defaultState, raw.state || {})
    };
  }

  findFirstWidgetState(type) {
    const widget = this.data.layout.widgets.find((item) => item.type === type);
    return widget ? this.getWidgetData(widget.id, type).state : {};
  }

  getFirstWidgetConfig(type) {
    const widget = this.data.layout.widgets.find((item) => item.type === type);
    return widget ? this.getWidgetData(widget.id, type).config : {};
  }

  async persist() {
    await this.saveData(this.data);
  }

  scheduleRefresh() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshOpenViews();
    }, 250);
  }

  refreshOpenViews() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof YukiHomepageView) {
        void leaf.view.renderView();
      }
    }
  }

  async openHomepage({ reveal = true } = {}) {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length) {
      const leaf = existing[0];
      leaf.setPinned(Boolean(this.data.settings.lockHomepage));
      if (reveal) await this.app.workspace.revealLeaf(leaf);
      return leaf;
    }

    const previousLeaf = this.app.workspace.activeLeaf;
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE,
      active: reveal,
      pinned: Boolean(this.data.settings.lockHomepage)
    });
    leaf.setPinned(Boolean(this.data.settings.lockHomepage));
    if (reveal) {
      await this.app.workspace.revealLeaf(leaf);
    } else if (previousLeaf && previousLeaf !== leaf) {
      this.app.workspace.setActiveLeaf(previousLeaf, { focus: false });
    }
    return leaf;
  }

  async resetToDefaults() {
    const targetLayout = deepClone(this.data.defaultLayout || DEFAULT_DATA.layout);
    const currentWidgets = this.data.widgets || {};
    const nextWidgets = {};

    for (const widget of targetLayout.widgets) {
      const definition = this.getDefinition(widget.type);
      nextWidgets[widget.id] = currentWidgets[widget.id] || {
        config: deepClone(definition?.defaultConfig || {}),
        state: deepClone(definition?.defaultState || {})
      };
    }

    this.data.layout = targetLayout;
    this.data.widgets = nextWidgets;
    this.data = this.normalizeData(this.data);
    await this.persist();
    this.refreshOpenViews();
  }

  async saveCurrentLayoutAsDefault() {
    this.data.defaultLayout = deepClone(this.data.layout);
    this.data = this.normalizeData(this.data);
    await this.persist();
  }

  async addWidget(type) {
    const definition = this.getDefinition(type);
    if (!definition) return;
    const id = randomId(type);
    const widget = applySizePreset({
      id,
      type,
      x: 0,
      y: this.data.layout.widgets.reduce((max, item) => Math.max(max, item.y + item.h), 0),
      sizePreset: definition.defaultSize.preset
    }, definition.defaultSize.preset, 5);
    this.data.layout.widgets.push(widget);
    this.data.widgets[id] = {
      config: deepClone(definition.defaultConfig),
      state: deepClone(definition.defaultState)
    };
    this.data.layout.widgets = packLayout(this.data.layout.widgets, 5, {}, [], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async removeWidget(id) {
    this.data.layout.widgets = this.data.layout.widgets.filter((widget) => widget.id !== id);
    delete this.data.widgets[id];
    this.data.layout.widgets = packLayout(this.data.layout.widgets, 5, {}, [], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async moveWidget(id, x, y) {
    const preferred = {};
    const next = this.data.layout.widgets.map((widget) => {
      const copy = deepClone(widget);
      if (copy.id === id) {
        copy.x = x;
        copy.y = y;
        preferred[id] = { x, y };
      }
      return copy;
    });
    this.data.layout.widgets = packLayout(next, 5, preferred, [id], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async cycleWidgetSize(id) {
    const next = this.data.layout.widgets.map((widget) => {
      const copy = deepClone(widget);
      if (copy.id !== id) return copy;
      const definition = this.getDefinition(copy.type);
      copy.sizePreset = cycleValue(definition.allowedSizes, copy.sizePreset);
      return applySizePreset(copy, copy.sizePreset, 5);
    });
    this.data.layout.widgets = packLayout(next, 5, {}, [id], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async setWidgetSize(id, sizePreset) {
    const next = this.data.layout.widgets.map((widget) => {
      const copy = deepClone(widget);
      if (copy.id !== id) return copy;
      return applySizePreset(copy, sizePreset, 5);
    });
    this.data.layout.widgets = packLayout(next, 5, {}, [id], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async setWidgetDimensions(id, width, height) {
    const preset = toSizePreset(width, height);
    await this.setWidgetSize(id, preset);
  }

  async updateWidgetConfig(id, patch) {
    const current = this.data.widgets[id] || { config: {}, state: {} };
    const widget = this.data.layout.widgets.find((item) => item.id === id);
    const type = widget ? widget.type : "";
    const definition = type ? this.getDefinition(type) : null;
    let nextConfig = deepClone(patch);
    let nextState = { ...(current.state || {}) };
    if (widget && widget.type === "habits" && typeof nextConfig._habitList === "string") {
      nextState.habits = parseLineList(nextConfig._habitList);
      delete nextConfig._habitList;
    }
    nextConfig = validateWidgetConfig(type, nextConfig, definition ? definition.defaultConfig : {});
    nextState = validateWidgetState(type, nextState, definition ? definition.defaultState : {});
    this.data.widgets[id] = {
      config: nextConfig,
      state: nextState
    };
    await this.persist();
    this.refreshOpenViews();
  }

  async updateWidgetState(id, patch) {
    const current = this.data.widgets[id] || { config: {}, state: {} };
    const widget = this.data.layout.widgets.find((item) => item.id === id);
    const type = widget ? widget.type : "";
    const definition = type ? this.getDefinition(type) : null;
    const mergedState = { ...(current.state || {}), ...(patch || {}) };
    this.data.widgets[id] = {
      config: current.config || {},
      state: validateWidgetState(type, mergedState, definition ? definition.defaultState : {})
    };
    await this.persist();
  }
}

module.exports = YukiHomepagePlugin;
