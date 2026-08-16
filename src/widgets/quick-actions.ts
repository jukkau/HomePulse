// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";
import {
  normalizeArray,
  renderEmpty
} from "./widget-api";

const { FuzzySuggestModal: ObsidianFuzzySuggestModal, Notice, Setting, setIcon } = require("obsidian");
const FuzzySuggestModal = ObsidianFuzzySuggestModal || class {};

// Default icon used when a command has no registered icon and no keyword
// hint matches. Kept as the final fallback.
const FALLBACK_COMMAND_ICON = "command";

// Keyword hints used as a fallback when a command has no registered icon of
// its own. Each entry is [needle, lucide-icon]. Matching is case-insensitive
// against the command id and the user-visible label.
const COMMAND_ICON_HINTS = [
  ["open-settings", "settings"],
  ["settings", "settings"],
  ["app-settings", "settings"],
  ["global-search", "search"],
  ["search", "search"],
  ["graph", "share-2"],
  ["graph-view", "share-2"],
  ["new-file", "file-plus-2"],
  ["file-explorer", "folder-open"],
  ["quickadd", "zap"],
  ["command-palette", "square-terminal"],
  ["zoom-in", "zoom-in"],
  ["zoom-out", "zoom-out"],
  ["toggle-pin", "pin"],
  ["pin", "pin"],
  ["theme", "palette"],
  ["reload", "refresh-cw"]
];

function actionIconName(item, commands) {
  if (item.type === "daily-note") return "calendar-days";

  if (item.type === "command") {
    // Prefer the icon registered with the command itself. Obsidian commands
    // can declare a Lucide icon name when they call addCommand({ icon }),
    // and most built-ins / plugins do. This is what the command palette
    // shows next to each entry, so it is the most accurate choice.
    const registeredIcon = commands?.[item.value]?.icon;
    if (registeredIcon) return registeredIcon;

    // Fall back to keyword hints so commands without a registered icon
    // still get a sensible picture (e.g. open-settings -> settings).
    const haystacks = [
      String(item.value || "").toLowerCase(),
      String(item.label || "").toLowerCase()
    ];
    const match = COMMAND_ICON_HINTS.find(([needle]) =>
      haystacks.some((h) => h.includes(needle))
    );
    if (match) return match[1];

    return FALLBACK_COMMAND_ICON;
  }

  return FALLBACK_COMMAND_ICON;
}

function renderActionIcon(button, item, commands) {
  const icon = button.createDiv({ cls: "yh-action-icon" });
  if (item.type !== "url") {
    setIcon(icon, actionIconName(item, commands));
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

function actionLabel(language, item) {
  const label = String(item.label || "").trim();
  if (item.type === "daily-note" && (!label || label === "daily" || label === "日记")) return t(language, "daily");
  if (item.type === "command" && item.value === "global-search:open" && (!label || label === "search" || label === "搜索")) {
    return t(language, "search");
  }
  return label || t(language, "untitled");
}

function getCommandEntries(app) {
  return Object.entries(app.commands.commands || {})
    .map(([id, command]) => ({ id, name: String(command?.name || id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

class SystemCommandPicker extends FuzzySuggestModal {
  constructor(app, commands, language, onChoose) {
    super(app);
    this.commands = commands;
    this.language = language;
    this.onChoose = onChoose;
    this.setPlaceholder(t(language, "chooseCommand"));
    this.emptyStateText = t(language, "noCommandsFound");
  }

  getItems() {
    return this.commands;
  }

  getItemText(command) {
    return `${command.name} ${command.id}`;
  }

  renderSuggestion(match, el) {
    const command = match.item;
    el.createDiv({ cls: "yh-command-suggest-name", text: command.name });
    el.createDiv({ cls: "yh-command-suggest-id", text: command.id });
  }

  onChooseItem(command) {
    this.onChoose(command);
  }
}

function renderActionManager(container, draft, ctx) {
  const manager = container.createDiv({ cls: "yh-system-actions-manager" });
  const toolbar = manager.createDiv({ cls: "yh-system-actions-toolbar" });
  const selected = manager.createDiv({ cls: "yh-selected-actions" });
  const count = toolbar.createDiv({ cls: "yh-system-actions-label", attr: { "aria-live": "polite" } });
  const add = toolbar.createEl("button", { cls: "yh-system-add-command", attr: { "aria-label": t(ctx.language, "addCommand") } });
  setIcon(add, "plus");
  let draggingIndex = -1;

  const updateActions = (items) => {
    draft.items = items;
    renderSelected();
  };

  const move = (items, from, to) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    updateActions(next);
  };

  const renderSelected = () => {
    selected.empty();
    const items = normalizeArray(draft.items, []);
    count.setText(t(ctx.language, "selectedCommands", { count: items.length }));
    if (!items.length) {
      selected.createDiv({ cls: "yh-system-actions-empty", text: t(ctx.language, "noSystemActions") });
      return;
    }
    const list = selected.createDiv({ cls: "yh-selected-action-list", attr: { role: "list" } });
    items.forEach((item, index) => {
      const label = actionLabel(ctx.language, item);
      const row = list.createDiv({
        cls: "yh-selected-action",
        attr: {
          draggable: "true",
          role: "listitem",
          tabindex: "0",
          "aria-label": `${label}. ${t(ctx.language, "dragToReorder")}`
        }
      });
      const dragHandle = row.createDiv({ cls: "yh-selected-action-drag", attr: { "aria-hidden": "true" } });
      setIcon(dragHandle, "grip-vertical");
      const details = row.createDiv({ cls: "yh-selected-action-details" });
      details.createDiv({ cls: "yh-selected-action-name", text: label });
      if (item.type === "command") {
        details.createDiv({ cls: "yh-selected-action-id", text: item.value });
      }
      const controls = row.createDiv({ cls: "yh-selected-action-controls" });
      const remove = controls.createEl("button", { attr: { "aria-label": `${t(ctx.language, "removeAction")}: ${label}` } });
      setIcon(remove, "trash-2");

      dragHandle.addEventListener("pointerdown", () => row.setAttribute("draggable", "true"));
      row.addEventListener("dragstart", (event) => {
        if (event.target.closest("button")) {
          event.preventDefault();
          return;
        }
        draggingIndex = index;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
        row.addClass("is-dragging");
      });
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (draggingIndex !== index) row.addClass("is-drag-over");
      });
      row.addEventListener("dragleave", () => row.removeClass("is-drag-over"));
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData("text/plain"));
        move(items, Number.isFinite(from) ? from : draggingIndex, index);
      });
      row.addEventListener("dragend", () => {
        draggingIndex = -1;
        row.setAttribute("draggable", "false");
        list.querySelectorAll(".is-dragging, .is-drag-over").forEach((element) => {
          element.removeClass("is-dragging");
          element.removeClass("is-drag-over");
        });
      });
      row.addEventListener("keydown", (event) => {
        if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const target = event.key === "ArrowUp" ? index - 1 : index + 1;
        move(items, index, target);
        window.setTimeout(() => selected.querySelectorAll(".yh-selected-action")[target]?.focus(), 0);
      });
      remove.addEventListener("click", () => updateActions(items.filter((_, itemIndex) => itemIndex !== index)));
      row.setAttribute("draggable", "false");
    });
  };

  add.addEventListener("click", () => {
    const selectedIds = new Set(normalizeArray(draft.items, [])
      .filter((item) => item.type === "command")
      .map((item) => item.value));
    const commands = getCommandEntries(ctx.app).filter((command) => !selectedIds.has(command.id));
    new SystemCommandPicker(ctx.app, commands, ctx.language, (command) => {
      updateActions([...normalizeArray(draft.items, []), { label: command.name, type: "command", value: command.id }]);
    }).open();
  });

  renderSelected();
}

export const quickActionsWidget = {
  type: "quick-actions",
  displayName: "System",
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
    // Snapshot the registered commands so we can look up each command's own
    // icon. This is what gives "打开设置" the gear icon, "放大" the zoom
    // icon, and so on, instead of every system action collapsing to a
    // generic fallback.
    const commandMap = api.app?.commands?.commands || {};
    if (!items.length && !secondaryItems.length) {
      renderEmpty(container, t(api.language, "noQuickActions"));
      return;
    }
    const runAction = async (item) => {
      if (item.type === "command") {
        if (!api.app.commands.commands[item.value]) {
          new Notice(t(api.language, "commandNotFound", { command: item.value }));
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
          new Notice(t(api.language, "noDailyNoteCommand"));
        }
      }
    };
    const renderButton = (parent, item, compact) => {
      const button = parent.createEl("button", {
        cls: `yh-action-btn ${compact ? "is-compact" : ""}`
      });
      renderActionIcon(button, item, commandMap);
      button.createDiv({ cls: "yh-action-label", text: actionLabel(api.language, item) });
      button.addEventListener("click", () => void runAction(item));
    };
    if (variant === "stack") {
      const stack = container.createDiv({ cls: "yh-action-stack" });
      const groups = [
        { title: api.widgetData.config.sectionTitle || t(api.language, "bookmarks"), items },
        { title: api.widgetData.config.secondaryTitle || t(api.language, "system"), items: secondaryItems }
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
  renderSettings(container, draft, ctx) {
    container.addClass("yh-system-widget-settings");
    new Setting(container).setName(t(ctx.language, "title")).addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    const layoutSetting = new Setting(container).setName(t(ctx.language, "layout"));
    layoutSetting.settingEl.addClass("yh-system-layout-setting");
    const layoutSelect = layoutSetting.controlEl.createEl("select", { cls: "yh-system-layout-select" });
    layoutSelect.createEl("option", { value: "grid", text: t(ctx.language, "grid") });
    layoutSelect.createEl("option", { value: "compact", text: t(ctx.language, "compactList") });
    layoutSelect.value = draft.variant === "compact" ? "compact" : "grid";
    layoutSelect.addEventListener("change", () => {
      draft.variant = layoutSelect.value;
    });
    const actionsSetting = new Setting(container)
      .setName(t(ctx.language, "systemActions"))
      .setDesc(t(ctx.language, "systemActionsDesc"));
    actionsSetting.settingEl.addClass("yh-system-actions-setting");
    renderActionManager(actionsSetting.controlEl, draft, ctx);
  }
};
