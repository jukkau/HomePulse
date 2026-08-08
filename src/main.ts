// @ts-nocheck
// Migration note: this file is the current published main.js moved under src/.
// Re-enable type checking module by module as responsibilities are split out.
import {
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
import { normalizeLanguage, t, widgetName, widgetTitle } from "./i18n";
import { SnapshotBuilder } from "./services/snapshot-builder";
import { ManualTimeRecordModal } from "./services/time/ManualTimeRecordModal";
import { TimeLogListModal } from "./services/time/TimeLogListModal";
import { TimeAggregation } from "./services/time/TimeAggregation";
import { TimeLogService } from "./services/time/TimeLogService";
import { withInheritedAreaFolders, withInheritedProjectFolders } from "./services/project-filter";
import { calculateObsidianUsageDays, formatDateKey } from "./services/obsidian-usage";
import { createWidgetRegistry } from "./widgets/registry";
import { SetupWizardModal } from "./data/setup-wizard";
import { clamp, deepClone, mergeDefaults, normalizeArray, randomId } from "./core/utils";

const {
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  normalizePath
} = require("obsidian");

function stripHoverHints(root) {
  root.querySelectorAll("[title], [aria-label]").forEach((element) => {
    element.removeAttribute("title");
    element.removeAttribute("aria-label");
  });
  root.querySelectorAll("title").forEach((element) => element.remove());
}

function formatLongDate(date, language = "en") {
  return date.toLocaleDateString(normalizeLanguage(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });
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

function getResponsiveBasisWidth(frame) {
  return Math.max(window.innerWidth || 0, frame?.clientWidth || 0);
}

function clampLayoutColumns(value, fallback = 5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), 1, 5);
}

function normalizeHexColor(value, fallback = "#f5c2e7") {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function isCustomAccent(settings) {
  return settings?.accentColorMode === "custom";
}

function getAccentCssValue(settings) {
  return isCustomAccent(settings)
    ? normalizeHexColor(settings.accentColor)
    : "var(--interactive-accent, #f5c2e7)";
}

class LayoutManagerModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.name = "";
    this.columns = clampLayoutColumns(plugin.data.layout.columns, 5);
  }

  onOpen() {
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.addClass("yh-settings-shell");
    contentEl.addClass("yh-modal", "yh-settings-modal");
    contentEl.createEl("h2", { text: this.plugin.t("manageLayouts") });

    const saveRow = contentEl.createDiv({ cls: "yh-layout-save-row" });
    const input = saveRow.createEl("input", { type: "text", placeholder: this.plugin.t("nameThisLayout") });
    input.value = this.name;
    input.addEventListener("input", () => {
      this.name = input.value;
    });
    const columns = saveRow.createEl("select");
    for (let value = 1; value <= 5; value += 1) {
      columns.createEl("option", { value: String(value), text: this.plugin.t("columnsShort", { count: value }) });
    }
    columns.value = String(this.columns);
    columns.addEventListener("change", () => {
      this.columns = clampLayoutColumns(columns.value, 5);
    });
    const save = saveRow.createEl("button", { cls: "mod-cta", text: this.plugin.t("save") });
    save.addEventListener("click", async () => {
      const saved = await this.plugin.saveCurrentLayoutPreset(this.name, this.columns);
      this.name = "";
      new Notice(this.plugin.t("layoutSaved", { name: saved.name }));
      this.render();
    });

    const list = contentEl.createDiv({ cls: "yh-layout-list" });
    for (const preset of this.plugin.getLayoutPresets()) {
      const row = list.createDiv({ cls: "yh-layout-row" });
      const info = row.createDiv({ cls: "yh-layout-info" });
      const title = info.createDiv({ cls: "yh-layout-title" });
      title.createSpan({ text: this.plugin.getLayoutPresetDisplayName(preset) });
      if (preset.id === this.plugin.data.defaultLayoutPresetId) {
        title.createSpan({ cls: "yh-layout-current", text: this.plugin.t("current") });
      }
      const meta = [this.plugin.t("columns", { count: preset.layout.columns || 5 })];
      if (preset.updatedAt) meta.push(this.plugin.t("modified", { time: this.formatRelativeTime(preset.updatedAt) }));
      info.createDiv({ cls: "yh-layout-meta", text: meta.join(" · ") });

      const actions = row.createDiv({ cls: "yh-layout-actions" });
      const load = actions.createEl("button", { text: this.plugin.t("load") });
      load.addEventListener("click", async () => {
        await this.plugin.loadLayoutPreset(preset.id);
        new Notice(this.plugin.t("layoutLoaded", { name: this.plugin.getLayoutPresetDisplayName(preset) }));
        this.render();
      });
      if (!preset.isBuiltIn) {
        const remove = actions.createEl("button", { cls: "yh-icon-btn danger", text: "×" });
        remove.addEventListener("click", async () => {
          await this.plugin.deleteLayoutPreset(preset.id);
          new Notice(this.plugin.t("layoutDeleted", { name: preset.name }));
          this.render();
        });
      }
    }
  }

  formatRelativeTime(timestamp) {
    const age = Date.now() - Number(timestamp || 0);
    if (!Number.isFinite(age) || age < 0) return this.plugin.t("justNow");
    const minutes = Math.floor(age / 60000);
    if (minutes < 1) return this.plugin.t("justNow");
    if (minutes < 60) return this.plugin.t("minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.plugin.t("hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 365) return this.plugin.t("daysAgo", { count: days });
    return this.plugin.t("yearsAgo", { count: Math.floor(days / 365) });
  }
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
    this.modalEl.addClass("yh-add-widget-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal");
    contentEl.createEl("h2", { text: this.plugin.t("addWidget") });
    const grid = contentEl.createDiv({ cls: "yh-modal-grid" });
    for (const definition of this.plugin.registry) {
      const button = grid.createEl("button", { cls: "yh-widget-picker" });
      button.createDiv({ cls: "yh-widget-picker-title", text: widgetName(this.plugin.language, definition.type, definition.displayName) });
      button.createDiv({ cls: "yh-widget-picker-meta", text: this.plugin.t("addWidgetMeta") });
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
    if (Object.prototype.hasOwnProperty.call(this.draft, "title")) {
      this.draft.title = widgetTitle(plugin.language, definition.type, this.draft.title, definition.displayName);
    }
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal");
    contentEl.createEl("h2", {
      text: this.plugin.t("widgetSettings", {
        name: widgetName(this.plugin.language, this.definition.type, this.definition.displayName)
      })
    });
    contentEl.createDiv({
      cls: "yh-settings-subtitle",
      text: this.plugin.t("widgetSettingsDesc")
    });
    const body = contentEl.createDiv({ cls: "yh-settings-body" });
    this.definition.renderSettings(body, this.draft, {
      app: this.app,
      state: this.widgetData.state,
      config: this.widgetData.config,
      settings: this.plugin.data.settings,
      language: this.plugin.language,
      t: (key, vars = {}) => this.plugin.t(key, vars)
    });

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: this.plugin.t("cancel") });
    const save = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: this.plugin.t("save") });
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
    this.modalEl.style.setProperty("--yh-modal-accent", getAccentCssValue(this.plugin.data.settings));
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal", "yh-dashboard-settings-modal");
    contentEl.createEl("h2", { text: this.plugin.t("headerSettings") });
    contentEl.createDiv({
      cls: "yh-settings-subtitle yh-dashboard-settings-subtitle",
      text: this.plugin.t("headerSettingsDesc")
    });

    const draft = {
      profileName: this.plugin.data.settings.profileName || this.plugin.t("yourName"),
      profileSignature: this.plugin.data.settings.profileSignature || "",
      accentColorMode: isCustomAccent(this.plugin.data.settings) ? "custom" : "theme",
      accentColor: normalizeHexColor(this.plugin.data.settings.accentColor),
      obsidianStartDate: this.plugin.data.settings.obsidianStartDate || "",
      lockHomepage: Boolean(this.plugin.data.settings.lockHomepage)
    };
    const body = contentEl.createDiv({ cls: "yh-settings-body" });

    new Setting(body).setName(this.plugin.t("username")).addText((text) => {
      text.setValue(draft.profileName);
      text.onChange((value) => {
        draft.profileName = value;
      });
    });

    new Setting(body).setName(this.plugin.t("signature")).addText((text) => {
      text.setValue(draft.profileSignature);
      text.onChange((value) => {
        draft.profileSignature = value;
      });
    });

    let accentSetting = null;
    let accentPicker = null;
    let accentText = null;
    const updateAccentControlState = () => {
      if (!accentSetting) return;
      accentSetting.settingEl.style.display = draft.accentColorMode === "custom" ? "" : "none";
    };
    new Setting(body)
      .setName(this.plugin.t("accentMode"))
      .setDesc(this.plugin.t("accentModeDesc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("theme", this.plugin.t("followObsidianTheme"));
        dropdown.addOption("custom", this.plugin.t("useCustomAccent"));
        dropdown.setValue(draft.accentColorMode);
        dropdown.onChange((value) => {
          draft.accentColorMode = value === "custom" ? "custom" : "theme";
          this.modalEl.style.setProperty("--yh-modal-accent", draft.accentColorMode === "custom" ? draft.accentColor : "var(--interactive-accent, #f5c2e7)");
          updateAccentControlState();
        });
      });
    accentSetting = new Setting(body)
      .setName(this.plugin.t("accentColor"))
      .setDesc(this.plugin.t("accentColorDesc"));
    const syncAccentControls = (value) => {
      const next = normalizeHexColor(value, draft.accentColor);
      draft.accentColorMode = "custom";
      draft.accentColor = next;
      this.modalEl.style.setProperty("--yh-modal-accent", next);
      if (accentPicker && accentPicker.getValue() !== next) accentPicker.setValue(next);
      if (accentText && accentText.getValue() !== next) accentText.setValue(next);
      updateAccentControlState();
    };
    accentSetting.addText((text) => {
      accentPicker = text;
      text.inputEl.type = "color";
      text.setValue(draft.accentColor);
      text.onChange((value) => {
        syncAccentControls(value);
      });
    });
    accentSetting.addText((text) => {
      accentText = text;
      text.setPlaceholder("#f5c2e7");
      text.setValue(draft.accentColor);
      text.onChange((value) => {
        syncAccentControls(value);
      });
    });
    updateAccentControlState();

    new Setting(body)
      .setName(this.plugin.t("lockHomepageTab"))
      .setDesc(this.plugin.t("lockHomepageModalDesc"))
      .addToggle((toggle) => {
        toggle.setValue(draft.lockHomepage);
        toggle.onChange((value) => {
          draft.lockHomepage = value;
        });
      });

    const usageSetting = new Setting(body)
      .setName(this.plugin.t("obsidianStartDate"))
      .setDesc(this.plugin.t("obsidianStartDateModalDesc"));
    usageSetting.settingEl.addClass("yh-start-date-setting");
    usageSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.max = formatDateKey(new Date());
      text.setValue(draft.obsidianStartDate);
      const updateDescription = (value) => {
        const days = calculateObsidianUsageDays(value, new Date());
        usageSetting.descEl.setText(
          days === null ? this.plugin.t("chooseStartDateShort") : this.plugin.t("todayIsDayShort", { count: days })
        );
      };
      updateDescription(draft.obsidianStartDate);
      text.onChange((value) => {
        const next = value.trim();
        if (next && calculateObsidianUsageDays(next, new Date()) === null) {
          new Notice(this.plugin.t("invalidStartDate"));
          text.setValue(draft.obsidianStartDate);
          return;
        }
        draft.obsidianStartDate = next;
        updateDescription(next);
      });
    });

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: this.plugin.t("cancel") });
    const save = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: this.plugin.t("save") });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", async () => {
      this.plugin.data.settings.profileName = draft.profileName.trim() || "Your name";
      this.plugin.data.settings.profileSignature = draft.profileSignature.trim();
      this.plugin.data.settings.accentColorMode = draft.accentColorMode;
      this.plugin.data.settings.accentColor = normalizeHexColor(draft.accentColor);
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

    new Setting(containerEl)
      .setName(VIEW_NAME)
      .setHeading();

    new Setting(containerEl)
      .setName(this.plugin.t("language"))
      .setDesc(this.plugin.t("languageDesc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("en", this.plugin.t("english"));
        dropdown.addOption("zh-CN", this.plugin.t("simplifiedChinese"));
        dropdown.setValue(this.plugin.language);
        dropdown.onChange(async (value) => {
          this.plugin.data.settings.language = normalizeLanguage(value);
          await this.plugin.persist();
          this.plugin.updatePersistentUiLanguage();
          this.plugin.refreshOpenViews();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName(this.plugin.t("openOnStartup"))
      .setDesc(this.plugin.t("openOnStartupDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.data.settings.openOnStartup);
        toggle.onChange(async (value) => {
          this.plugin.data.settings.openOnStartup = value;
          await this.plugin.persist();
        });
      });

    new Setting(containerEl)
      .setName(this.plugin.t("lockHomepageTab"))
      .setDesc(this.plugin.t("lockHomepageTabDesc"))
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
      .setName(this.plugin.t("accentMode"))
      .setDesc(this.plugin.t("accentModeDesc"))
      .addDropdown((dropdown) => {
        dropdown.addOption("theme", this.plugin.t("followObsidianTheme"));
        dropdown.addOption("custom", this.plugin.t("useCustomAccent"));
        dropdown.setValue(isCustomAccent(this.plugin.data.settings) ? "custom" : "theme");
        dropdown.onChange(async (value) => {
          this.plugin.data.settings.accentColorMode = value === "custom" ? "custom" : "theme";
          await this.plugin.persist();
          this.plugin.refreshOpenViews();
          this.display();
        });
      });

    if (isCustomAccent(this.plugin.data.settings)) {
      new Setting(containerEl)
        .setName(this.plugin.t("accentColor"))
        .setDesc(this.plugin.t("accentColorDesc"))
        .addText((text) => {
          text.inputEl.type = "color";
          text.setValue(normalizeHexColor(this.plugin.data.settings.accentColor));
          text.onChange(async (value) => {
            this.plugin.data.settings.accentColor = normalizeHexColor(value);
            await this.plugin.persist();
            this.plugin.refreshOpenViews();
          });
        })
        .addText((text) => {
          text.setPlaceholder("#f5c2e7");
          text.setValue(normalizeHexColor(this.plugin.data.settings.accentColor));
          text.onChange(async (value) => {
            const next = normalizeHexColor(value, this.plugin.data.settings.accentColor);
            this.plugin.data.settings.accentColor = next;
            text.setValue(next);
            await this.plugin.persist();
            this.plugin.refreshOpenViews();
          });
        });
    }

    const usageSetting = new Setting(containerEl)
      .setName(this.plugin.t("obsidianStartDate"))
      .setDesc(this.plugin.t("obsidianStartDateDesc"));
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
            ? this.plugin.t("chooseStartDate")
            : this.plugin.t("todayIsDay", { count: days })
        );
      };
      updateDescription(currentValue);
      text.onChange(async (value) => {
        const next = value.trim();
        if (next && calculateObsidianUsageDays(next, new Date()) === null) {
          new Notice(this.plugin.t("invalidStartDate"));
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
      .setName(this.plugin.t("techTreeAreaFolder"))
      .setDesc(this.plugin.t("techTreeAreaFolderDesc"))
      .addText((text) => {
        text.setPlaceholder("Areas");
        text.setValue(this.plugin.data.settings.techTreeAreaRoot || "Areas");
        text.onChange(async (value) => {
          this.plugin.data.settings.techTreeAreaRoot = value.trim() || "Areas";
          await this.plugin.persist();
          this.plugin.refreshOpenViews();
        });
      });

    new Setting(containerEl)
      .setName(this.plugin.t("techTreeProjectFolder"))
      .setDesc(this.plugin.t("techTreeProjectFolderDesc"))
      .addText((text) => {
        text.setPlaceholder("Projects");
        text.setValue(this.plugin.data.settings.techTreeActiveProjectRoot || "Projects");
        text.onChange(async (value) => {
          this.plugin.data.settings.techTreeActiveProjectRoot = value.trim() || "Projects";
          await this.plugin.persist();
          this.plugin.refreshOpenViews();
        });
      });

    new Setting(containerEl)
      .setName(this.plugin.t("manageLayouts"))
      .setDesc(this.plugin.t("manageLayoutsDesc"))
      .addButton((button) => {
        button.setButtonText(this.plugin.t("open"));
        button.setCta();
        button.onClick(() => {
          new LayoutManagerModal(this.app, this.plugin).open();
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
    this.windowResizeHandler = null;
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.windowResizeHandler) {
      window.removeEventListener("resize", this.windowResizeHandler);
      this.windowResizeHandler = null;
    }
  }

  observeResponsiveLayout(frame, columns) {
    this.responsiveColumns = columns;
    const refreshIfColumnsChanged = () => {
      const layoutColumns = clampLayoutColumns(this.plugin.data.layout.columns, 5);
      const nextColumns = this.editMode ? layoutColumns : Math.min(layoutColumns, getResponsiveColumnCount(getResponsiveBasisWidth(frame)));
      if (nextColumns === this.responsiveColumns) return;
      this.responsiveColumns = nextColumns;
      void this.renderView();
    };
    this.windowResizeHandler = refreshIfColumnsChanged;
    window.addEventListener("resize", this.windowResizeHandler);
    if (typeof ResizeObserver === "undefined") return;
    this.resizeObserver = new ResizeObserver(refreshIfColumnsChanged);
    this.resizeObserver.observe(frame);
  }

  async renderView() {
    const token = ++this.renderToken;
    this.clearIntervals();
    this.disconnectResizeObserver();

    const container = this.contentEl;
    container.empty();
    container.addClass("yh-view");
    const accentColor = getAccentCssValue(this.plugin.data.settings);
    container.style.setProperty("--yh-accent", accentColor);
    container.style.setProperty("--komo-sakura", accentColor);
    container.style.setProperty("--komo-border-sakura", "color-mix(in srgb, var(--yh-accent) 26%, transparent)");

    const frame = container.createDiv({ cls: "yh-frame" });
    const loading = frame.createDiv({ cls: "yh-loading", text: this.plugin.t("loadingWidgets") });
    const snapshot = await new SnapshotBuilder(this.app, this.plugin).load();
    if (token !== this.renderToken) return;
    loading.remove();

    const header = frame.createDiv({ cls: `yh-header ${this.editMode ? "is-editing" : ""}` });
    const brand = header.createDiv({ cls: "yh-brand" });
    brand.createDiv({ cls: "yh-brand-title", text: this.plugin.data.settings.profileName || this.plugin.t("yourName") });
    brand.createDiv({ cls: "yh-brand-subtitle", text: this.plugin.data.settings.profileSignature || "" });
    if (snapshot.obsidianDays != null) {
      const usage = brand.createDiv({ cls: "yh-brand-usage" });
      usage.createSpan({ text: this.plugin.t("usingObsidianFor") });
      usage.createSpan({ cls: "yh-brand-usage-days", text: String(snapshot.obsidianDays) });
      usage.createSpan({ text: this.plugin.t(snapshot.obsidianDays === 1 ? "day" : "days") });
    }

    const clockBlock = header.createDiv({ cls: "yh-clock-block" });
    const timeEl = clockBlock.createDiv({ cls: "yh-time" });

    const rightHdr = header.createDiv({ cls: "yh-header-right" });
    const periodRow = rightHdr.createDiv({ cls: "yh-period-row" });
    const periodEl = periodRow.createDiv({ cls: "yh-period" });
    const configBtn = periodRow.createEl("button", {
      cls: `yh-header-config-btn ${this.editMode ? "is-active" : ""}`,
      text: `⚙ ${this.plugin.t(this.editMode ? "editing" : "config")}`
    });
    const dateEl = rightHdr.createDiv({ cls: "yh-date" });

    configBtn.addEventListener("click", async () => {
      this.editMode = !this.editMode;
      await this.renderView();
    });

    const tick = () => {
      const now = new Date();
      const hour = now.getHours();
      const period = hour < 5 || hour >= 22
        ? this.plugin.t("periodNight")
        : hour < 12
          ? this.plugin.t("periodMorning")
          : hour < 18
            ? this.plugin.t("periodAfternoon")
            : this.plugin.t("periodEvening");
      timeEl.setText(now.toLocaleTimeString(this.plugin.language === "en" ? "en-US" : "zh-CN", { hour12: false }));
      dateEl.setText(`${formatLongDate(now, this.plugin.language)} · ${now.toLocaleDateString(this.plugin.language === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric", year: "numeric" })}`);
      periodEl.setText(period);
    };
    tick();
    this.rememberInterval(window.setInterval(tick, 1000));

    frame.createDiv({ cls: "yh-divider" });

    const layoutColumns = clampLayoutColumns(this.plugin.data.layout.columns, 5);
    const viewportColumns = getResponsiveColumnCount(getResponsiveBasisWidth(frame));
    const responsiveColumns = this.editMode ? layoutColumns : Math.min(layoutColumns, viewportColumns);
    const renderedWidgets = responsiveColumns === layoutColumns
      ? this.plugin.data.layout.widgets
      : buildResponsiveLayout(this.plugin.data.layout.widgets, responsiveColumns);
    const canEditLayout = this.editMode;
    const canDragLayout = this.editMode;

    if (this.editMode) {
      const toolbar = frame.createDiv({ cls: "yh-toolbar yh-toolbar-compact" });
      toolbar.createDiv({
        cls: "yh-toolbar-label",
        text: canDragLayout
          ? this.plugin.t("layoutEditing", { count: layoutColumns })
          : this.plugin.t("layoutEditingResize", { count: layoutColumns })
      });
      const actions = toolbar.createDiv({ cls: "yh-toolbar-actions" });
      const headerSettingsBtn = actions.createEl("button", { text: this.plugin.t("headerSettings") });
      const addBtn = actions.createEl("button", { text: this.plugin.t("addWidget") });
      const manageLayoutBtn = actions.createEl("button", { text: this.plugin.t("manageLayouts") });
      headerSettingsBtn.addEventListener("click", () => {
        new HeaderSettingsModal(this.app, this.plugin).open();
      });
      addBtn.addEventListener("click", () => this.openAddWidgetModal());
      manageLayoutBtn.addEventListener("click", () => {
        new LayoutManagerModal(this.app, this.plugin).open();
      });
    }

    const grid = frame.createDiv({ cls: "yh-grid" });
    grid.style.setProperty("--yh-columns", String(responsiveColumns));
    grid.style.setProperty("--yh-rows", String(getGridRows(renderedWidgets)));
    if (canEditLayout) grid.addClass("is-editing");

    grid.addEventListener("dragover", (event) => {
      if (!canDragLayout || !this.draggingWidgetId) return;
      event.preventDefault();
      grid.addClass("is-drop-target");
    });

    grid.addEventListener("dragleave", () => {
      grid.removeClass("is-drop-target");
    });

    grid.addEventListener("drop", async (event) => {
      if (!canDragLayout || !this.draggingWidgetId) return;
      event.preventDefault();
      grid.removeClass("is-drop-target");
      const widget = this.plugin.data.layout.widgets.find((item) => item.id === this.draggingWidgetId);
      if (!widget) return;
      const bounds = grid.getBoundingClientRect();
      const cellWidth = bounds.width / layoutColumns;
      const cellHeight = 132;
      const x = clamp(Math.floor((event.clientX - bounds.left) / cellWidth), 0, layoutColumns - widget.w);
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

      if (canDragLayout) {
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
            const maxWidth = renderedColumns === layoutColumns ? layoutColumns - widget.x : renderedColumns;
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
      cardHeader.createDiv({
        cls: "yh-card-title",
        text: widgetTitle(this.plugin.language, widget.type, widgetData.config.title, definition.displayName)
      });
      if (canEditLayout) {
        const controls = cardHeader.createDiv({ cls: "yh-card-controls" });
        const widthSelect = controls.createEl("select", { cls: "yh-size-select" });
        for (let width = 1; width <= layoutColumns; width += 1) {
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
      // Minimal render surface. Widgets get Obsidian's `app`, their own data,
      // the shared snapshot, and a few scoped operations — but no direct handle
      // on the plugin or view internals.
      const api = {
        app: this.app,
        language: this.plugin.language,
        settings: this.plugin.data.settings,
        t: (key, vars = {}) => this.plugin.t(key, vars),
        component: this,
        widget,
        widgetData,
        snapshot,
        rememberInterval: (id) => this.rememberInterval(id),
        requestRender: () => this.renderView(),
        getState: () => this.plugin.getWidgetData(widget.id, widget.type).state,
        getConfig: () => this.plugin.getWidgetData(widget.id, widget.type).config,
        getTimeLogs: (query = {}) => this.plugin.getTimeLogService().query(query),
        createTimeLog: async (input) => this.plugin.getTimeLogService().create(input),
        updateTimeLog: async (id, patch) => this.plugin.getTimeLogService().update(id, patch),
        deleteTimeLog: async (id) => this.plugin.getTimeLogService().delete(id),
        getTimeSummary: (range = "all", now = new Date()) => this.plugin.getTimeAggregation().summarize(range, now),
        getUiState: () => (this.widgetUiState[widget.id] ||= {}),
        setUiState: (patch) => {
          this.widgetUiState[widget.id] = { ...(this.widgetUiState[widget.id] || {}), ...patch };
        },
        openPath: async (path) => {
          await this.app.workspace.openLinkText(path, "", false);
        },
        openLink: async (link) => {
          await openExternalOrInternal(this.app, link);
        },
        openSettings: () => {
          this.openWidgetSettings(widget, widgetData, definition);
        },
        openManualTimeRecord: () => this.plugin.openManualTimeRecordModal(),
        openTimeLogList: () => this.plugin.openTimeLogListModal(),
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
        body.createDiv({ cls: "yh-empty", text: this.plugin.t("widgetFailed", { message: error.message }) });
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
  get language() {
    return normalizeLanguage(this.data?.settings?.language);
  }

  t(key, vars = {}) {
    return t(this.language, key, vars);
  }

  async onload() {
    this.registry = createWidgetRegistry(this);
    this.data = this.normalizeData(await this.loadData());
    this.refreshTimer = 0;

    this.registerView(VIEW_TYPE, (leaf) => new YukiHomepageView(leaf, this));
    this.openHomepageRibbonEl = this.addRibbonIcon(VIEW_ICON, this.t("openHomePulse"), () => {
      void this.openHomepage();
    });
    this.openHomepageCommand = this.addCommand({
      id: "open-homepulse",
      name: this.t("openHomePulse"),
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
      if (!this.data.initialized) {
        new SetupWizardModal(this.app, this).open();
      }
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

  getTimeLogService() {
    const plugin = this;
    return new TimeLogService({
      get timeLogs() {
        return plugin.data.timeLogs || [];
      },
      set timeLogs(value) {
        plugin.data.timeLogs = value;
      },
      persist: async () => {
        plugin.data = plugin.normalizeData(plugin.data);
        await plugin.persist();
        plugin.scheduleRefresh();
      }
    });
  }

  getTimeAggregation() {
    return new TimeAggregation(this.data.timeLogs || []);
  }

  getTimeSourceConfig() {
    return withInheritedAreaFolders(
      withInheritedProjectFolders(this.getFirstWidgetConfig("pomodoro"), this.data.settings),
      this.data.settings
    );
  }

  openManualTimeRecordModal() {
    new ManualTimeRecordModal(this.app, this.getTimeSourceConfig(), async (input) => {
      await this.getTimeLogService().create(input);
    }, this.language).open();
  }

  openTimeLogListModal() {
    new TimeLogListModal(
      this.app,
      () => this.getTimeLogService().query(),
      async (id) => {
        await this.getTimeLogService().delete(id);
      },
      this.language
    ).open();
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

  getLayoutPresets() {
    const presets = Array.isArray(this.data.layoutPresets) && this.data.layoutPresets.length
      ? this.data.layoutPresets
      : DEFAULT_DATA.layoutPresets;
    return presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      isBuiltIn: Boolean(preset.isBuiltIn),
      updatedAt: preset.updatedAt,
      layout: deepClone(preset.layout)
    }));
  }

  updatePersistentUiLanguage() {
    const label = this.t("openHomePulse");
    if (this.openHomepageCommand) this.openHomepageCommand.name = label;
    if (this.openHomepageRibbonEl) {
      this.openHomepageRibbonEl.setAttribute("aria-label", label);
      this.openHomepageRibbonEl.setAttribute("title", label);
    }
  }

  getLayoutPresetDisplayName(preset) {
    return preset?.id === "public-default" ? this.t("publicDefaultLayout") : preset?.name || this.t("selectedLayout");
  }

  getLayoutPresetName(id) {
    return this.getLayoutPresetDisplayName(this.getLayoutPresets().find((preset) => preset.id === id));
  }

  getLayoutPreset(id) {
    return this.getLayoutPresets().find((preset) => preset.id === id) || this.getLayoutPresets()[0];
  }

  async resetToLayoutPreset(presetId) {
    await this.applyLayoutPreset(presetId);
  }

  async loadLayoutPreset(presetId) {
    await this.applyLayoutPreset(presetId);
  }

  async applyLayoutPreset(presetId) {
    const preset = this.getLayoutPreset(presetId);
    const targetLayout = deepClone(preset?.layout || DEFAULT_DATA.layout);
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
    this.data.defaultLayoutPresetId = preset?.id || "public-default";
    this.data = this.normalizeData(this.data);
    await this.persist();
    this.refreshOpenViews();
  }

  async deleteLayoutPreset(presetId) {
    const presets = this.getLayoutPresets();
    const target = presets.find((preset) => preset.id === presetId);
    if (!target || target.isBuiltIn) return;
    this.data.layoutPresets = presets.filter((preset) => preset.id !== presetId);
    if (this.data.defaultLayoutPresetId === presetId) {
      this.data.defaultLayoutPresetId = "public-default";
    }
    this.data = this.normalizeData(this.data);
    await this.persist();
    this.refreshOpenViews();
  }

  async resetToDefaults() {
    await this.resetToLayoutPreset(this.data.defaultLayoutPresetId || "public-default");
  }

  async saveCurrentLayoutAsDefault() {
    await this.saveCurrentLayoutPreset(this.t("savedDefaultLayout"));
  }

  async saveCurrentLayoutPreset(name, columns = this.data.layout.columns) {
    const trimmed = String(name || "").trim();
    const date = new Date().toLocaleString(this.language === "en" ? "en-US" : "zh-CN", { hour12: false });
    const presetName = trimmed || this.t("defaultLayoutName", { date });
    const presets = this.getLayoutPresets();
    const existing = presets.find((preset) => !preset.isBuiltIn && preset.name === presetName);
    const layoutColumns = clampLayoutColumns(columns, this.data.layout.columns || 5);
    const layout = {
      ...deepClone(this.data.layout),
      columns: layoutColumns,
      widgets: packLayout(this.data.layout.widgets, layoutColumns, {}, [], true)
    };
    const nextPreset = {
      id: existing?.id || randomId("layout"),
      name: presetName,
      updatedAt: Date.now(),
      layout
    };
    this.data.layoutPresets = [
      ...presets.filter((preset) => preset.isBuiltIn || preset.id !== nextPreset.id),
      nextPreset
    ];
    this.data.defaultLayoutPresetId = nextPreset.id;
    this.data.layout = deepClone(layout);
    this.data = this.normalizeData(this.data);
    await this.persist();
    this.refreshOpenViews();
    return nextPreset;
  }

  async addWidget(type) {
    const definition = this.getDefinition(type);
    if (!definition) return;
    const columns = clampLayoutColumns(this.data.layout.columns, 5);
    const id = randomId(type);
    const widget = applySizePreset({
      id,
      type,
      x: 0,
      y: this.data.layout.widgets.reduce((max, item) => Math.max(max, item.y + item.h), 0),
      sizePreset: definition.defaultSize.preset
    }, definition.defaultSize.preset, columns);
    this.data.layout.widgets.push(widget);
    this.data.widgets[id] = {
      config: deepClone(definition.defaultConfig),
      state: deepClone(definition.defaultState)
    };
    this.data.layout.widgets = packLayout(this.data.layout.widgets, columns, {}, [], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async removeWidget(id) {
    const columns = clampLayoutColumns(this.data.layout.columns, 5);
    this.data.layout.widgets = this.data.layout.widgets.filter((widget) => widget.id !== id);
    delete this.data.widgets[id];
    this.data.layout.widgets = packLayout(this.data.layout.widgets, columns, {}, [], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async moveWidget(id, x, y) {
    const columns = clampLayoutColumns(this.data.layout.columns, 5);
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
    this.data.layout.widgets = packLayout(next, columns, preferred, [id], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async cycleWidgetSize(id) {
    const columns = clampLayoutColumns(this.data.layout.columns, 5);
    const next = this.data.layout.widgets.map((widget) => {
      const copy = deepClone(widget);
      if (copy.id !== id) return copy;
      const definition = this.getDefinition(copy.type);
      copy.sizePreset = cycleValue(definition.allowedSizes, copy.sizePreset);
      return applySizePreset(copy, copy.sizePreset, columns);
    });
    this.data.layout.widgets = packLayout(next, columns, {}, [id], true);
    await this.persist();
    this.refreshOpenViews();
  }

  async setWidgetSize(id, sizePreset) {
    const columns = clampLayoutColumns(this.data.layout.columns, 5);
    const next = this.data.layout.widgets.map((widget) => {
      const copy = deepClone(widget);
      if (copy.id !== id) return copy;
      return applySizePreset(copy, sizePreset, columns);
    });
    this.data.layout.widgets = packLayout(next, columns, {}, [id], true);
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
    // Widgets may translate settings-only draft fields into config/state here,
    // keeping widget-specific knowledge out of the plugin core.
    if (definition && typeof definition.normalizeConfig === "function") {
      const normalized = definition.normalizeConfig(nextConfig, nextState) || {};
      if (normalized.config) nextConfig = normalized.config;
      if (normalized.state) nextState = normalized.state;
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
