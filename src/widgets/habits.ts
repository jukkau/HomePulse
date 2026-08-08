// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";
import { parseLineList } from "../core/utils";
import { addDays, createSvg, localDateKey, normalizeArray, renderEmpty } from "./widget-api";

import { Modal, Setting, setIcon } from "obsidian";

function treeStage(done, total) {
  if (!total || !done) return 0;
  return Math.min(4, Math.ceil((done / total) * 4));
}

function renderTree(container, stage, compact = false) {
  const tree = container.createDiv({
    cls: `yh-tree-visual is-stage-${stage} ${compact ? "is-compact" : ""}`,
    attr: { "aria-hidden": "true" }
  });
  tree.createDiv({ cls: "yh-tree-seed" });
  tree.createDiv({ cls: "yh-tree-trunk" });
  const crown = tree.createDiv({ cls: "yh-tree-crown" });
  crown.createSpan();
  crown.createSpan();
  crown.createSpan();
  tree.createDiv({ cls: "yh-tree-ground" });
  return tree;
}

function recordedYears(completions, currentYear) {
  const years = new Set([currentYear]);
  for (const key of Object.keys(completions || {})) {
    if (!completions[key]) continue;
    const dateKey = key.slice(key.lastIndexOf("|") + 1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) years.add(Number(dateKey.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}

class HabitForestModal extends Modal {
  constructor(app, habits, completions, now, language) {
    super(app);
    this.habits = habits;
    this.completions = completions;
    this.now = now;
    this.language = language;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-forest-modal");
    const years = recordedYears(this.completions, this.now.getFullYear());
    let selectedYear = years[0];

    const header = contentEl.createDiv({ cls: "yh-forest-modal-header" });
    const heading = header.createDiv();
    heading.createEl("h2", { text: t(this.language, "habitActivity") });
    heading.createDiv({ cls: "yh-forest-modal-subtitle", text: t(this.language, "habitActivityDesc") });
    const yearSelect = header.createEl("select", { cls: "yh-habit-year-select" });
    for (const year of years) yearSelect.createEl("option", { text: String(year), value: String(year) });

    const board = contentEl.createDiv({ cls: "yh-habit-history-board" });
    const renderYear = () => {
      board.empty();
      const first = new Date(selectedYear, 0, 1);
      const last = selectedYear === this.now.getFullYear() ? this.now : new Date(selectedYear, 11, 31);
      const daily = [];
      let activeDays = 0;
      let totalChecks = 0;
      for (let date = first; date <= last; date = addDays(date, 1)) {
        const dateKey = localDateKey(date);
        const done = this.habits.reduce(
          (count, habit) => count + (this.completions[`${habit}|${dateKey}`] ? 1 : 0),
          0
        );
        if (done) activeDays += 1;
        totalChecks += done;
        daily.push({ date: new Date(date), dateKey, done, level: treeStage(done, this.habits.length) });
      }

      const summary = board.createDiv({ cls: "yh-habit-history-summary" });
      const checks = summary.createDiv({ cls: "yh-habit-history-stat" });
      checks.createDiv({ cls: "yh-habit-history-value", text: String(totalChecks) });
      checks.createDiv({ cls: "yh-habit-history-label", text: t(this.language, "checkIns") });
      const days = summary.createDiv({ cls: "yh-habit-history-stat" });
      days.createDiv({ cls: "yh-habit-history-value", text: String(activeDays) });
      days.createDiv({ cls: "yh-habit-history-label", text: t(this.language, "activeDays") });

      const scroll = board.createDiv({ cls: "yh-habit-history-scroll" });
      const svg = createSvg(scroll, "svg", {
        class: "yh-habit-heatmap-svg",
        viewBox: "0 0 716 122",
        role: "img"
      });
      const cell = 10;
      const gap = 3;
      const left = 26;
      const top = 22;
      const offset = first.getDay();
      for (const [weekday, labelKey] of [[1, "weekdayMon"], [3, "weekdayWed"], [5, "weekdayFri"]]) {
        const text = createSvg(svg, "text", { x: 4, y: top + weekday * (cell + gap) + 8, class: "yh-heatmap-axis" });
        text.textContent = t(this.language, labelKey);
      }
      let lastMonth = -1;
      daily.forEach((item, index) => {
        const position = offset + index;
        const week = Math.floor(position / 7);
        const weekday = position % 7;
        const x = left + week * (cell + gap);
        const y = top + weekday * (cell + gap);
        if (item.date.getMonth() !== lastMonth && item.date.getDate() <= 7) {
          const month = createSvg(svg, "text", { x, y: 11, class: "yh-heatmap-axis yh-heatmap-month" });
          month.textContent = item.date.toLocaleDateString(this.language === "zh-CN" ? "zh-CN" : "en-US", { month: "short" });
          lastMonth = item.date.getMonth();
        }
        const rect = createSvg(svg, "rect", {
          x,
          y,
          width: cell,
          height: cell,
          rx: 2,
          class: `yh-heatmap-cell is-level-${item.level}`,
          "data-level": item.level
        });
      });

      const legend = board.createDiv({ cls: "yh-habit-history-legend" });
      legend.createSpan({ text: t(this.language, "less") });
      for (let level = 0; level <= 4; level += 1) legend.createSpan({ cls: `yh-heatmap-legend-cell is-level-${level}` });
      legend.createSpan({ text: t(this.language, "more") });
    };

    yearSelect.addEventListener("change", () => {
      selectedYear = Number(yearSelect.value);
      renderYear();
    });
    renderYear();
  }
}

class HabitRenameModal extends Modal {
  constructor(app, currentName, habits, onRename, language) {
    super(app);
    this.currentName = currentName;
    this.habits = habits;
    this.onRename = onRename;
    this.language = language;
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell", "yh-habit-add-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal", "yh-habit-add-modal");
    contentEl.createEl("h2", { text: t(this.language, "renameHabit") });
    contentEl.createDiv({ cls: "yh-settings-subtitle", text: t(this.language, "renameHabitDesc") });
    const body = contentEl.createDiv({ cls: "yh-settings-body" });
    let input;
    new Setting(body).setName(t(this.language, "newName")).addText((text) => {
      input = text;
      text.setValue(this.currentName);
      window.setTimeout(() => {
        text.inputEl.focus();
        text.inputEl.select();
      }, 0);
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") void submit();
      });
    });
    const error = contentEl.createDiv({ cls: "yh-habit-add-error" });
    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: t(this.language, "cancel") });
    const save = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: t(this.language, "rename") });
    const submit = async () => {
      const name = String(input?.getValue() || "").trim();
      if (!name || name === this.currentName) {
        this.close();
        return;
      }
      if (this.habits.some((habit) => habit.toLowerCase() === name.toLowerCase())) {
        error.setText(t(this.language, "habitExists"));
        return;
      }
      await this.onRename(name);
      this.close();
    };
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", () => void submit());
  }
}

class HabitAddModal extends Modal {
  constructor(app, habits, onAdd, language) {
    super(app);
    this.habits = habits;
    this.onAdd = onAdd;
    this.language = language;
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell", "yh-habit-add-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal", "yh-habit-add-modal");
    contentEl.createEl("h2", { text: t(this.language, "plantHabit") });
    contentEl.createDiv({ cls: "yh-settings-subtitle", text: t(this.language, "plantHabitDesc") });
    const body = contentEl.createDiv({ cls: "yh-settings-body" });
    let input;
    new Setting(body).setName(t(this.language, "habitName")).addText((text) => {
      input = text;
      text.setPlaceholder(t(this.language, "habitNamePlaceholder"));
      window.setTimeout(() => text.inputEl.focus(), 0);
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") void submit();
      });
    });
    const error = contentEl.createDiv({ cls: "yh-habit-add-error" });
    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: t(this.language, "cancel") });
    const add = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: t(this.language, "addHabit") });
    const submit = async () => {
      const name = String(input?.getValue() || "").trim();
      if (!name) {
        error.setText(t(this.language, "enterHabitName"));
        return;
      }
      if (this.habits.some((habit) => habit.toLowerCase() === name.toLowerCase())) {
        error.setText(t(this.language, "habitExists"));
        return;
      }
      await this.onAdd(name);
      this.close();
    };
    cancel.addEventListener("click", () => this.close());
    add.addEventListener("click", () => void submit());
  }
}

export const habitsWidget = {
  type: "habits",
  displayName: "Habits",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H2", w: 1, h: 2 },
  defaultConfig: { title: "habits" },
  defaultState: { habits: [], completions: {} },
  // Settings expose the habit list as a textarea (`_habitList`); translate it
  // back into state here so the plugin core stays widget-agnostic.
  normalizeConfig(config, state) {
    const nextConfig = { ...config };
    const nextState = { ...state };
    if (typeof nextConfig._habitList === "string") {
      nextState.habits = parseLineList(nextConfig._habitList);
      delete nextConfig._habitList;
    }
    return { config: nextConfig, state: nextState };
  },
  async render(container, api) {
    const state = api.widgetData.state;
    const habits = normalizeArray(state.habits, []);
    const completions = state.completions || {};
    const todayKey = localDateKey(api.snapshot.now);
    const completedToday = habits.filter((habit) => completions[`${habit}|${todayKey}`]);

    const forest = container.createDiv({ cls: "yh-habit-forest" });
    const today = forest.createDiv({ cls: "yh-habit-today yh-habit-checkins" });
    const todayHead = today.createDiv({ cls: "yh-habit-today-head" });
    todayHead.createDiv({ text: t(api.language, "habitsToday") });
    todayHead.createDiv({ text: api.snapshot.now.toLocaleDateString(api.language === "zh-CN" ? "zh-CN" : "en-US", { month: "short", day: "numeric" }) });

    if (!habits.length) {
      renderEmpty(today, t(api.language, "addFirstHabit"));
    } else {
      const orderedHabits = [...habits].sort((a, b) => {
        return Number(Boolean(completions[`${a}|${todayKey}`])) - Number(Boolean(completions[`${b}|${todayKey}`]));
      });
      const list = today.createDiv({ cls: "yh-habit-today-list" });
      const maxNameLength = Math.max(4, ...orderedHabits.map((habit) => String(habit || "").length));
      const minWidth = Math.max(108, Math.min(220, maxNameLength * 13 + 46));
      list.style.setProperty("--yh-habit-item-min", `${minWidth}px`);
      for (const habit of orderedHabits) {
        const key = `${habit}|${todayKey}`;
        const isDone = Boolean(completions[key]);
        const row = list.createDiv({ cls: `yh-habit-today-row ${isDone ? "is-done" : ""}` });
        const check = row.createEl("button", {
          cls: "yh-habit-today-check",
          text: isDone ? "✓" : ""
        });
        const name = row.createEl("button", {
          cls: "yh-habit-today-name",
          text: habit
        });
        check.addEventListener("click", async () => {
          const next = { ...completions };
          if (next[key]) delete next[key];
          else next[key] = true;
          await api.saveState({ completions: next }, true);
        });
        name.addEventListener("click", () => {
          new HabitRenameModal(api.app, habit, habits, async (trimmed) => {
            const updatedHabits = habits.map((item) => item === habit ? trimmed : item);
            const updatedCompletions = {};
            for (const [savedKey, value] of Object.entries(completions)) {
              if (savedKey.startsWith(`${habit}|`)) {
                updatedCompletions[`${trimmed}|${savedKey.split("|").slice(1).join("|")}`] = value;
              } else {
                updatedCompletions[savedKey] = value;
              }
            }
            await api.saveState({ habits: updatedHabits, completions: updatedCompletions }, true);
          }, api.language).open();
        });
      }
    }

    const footer = today.createDiv({ cls: "yh-habit-footer" });
    const addBtn = footer.createEl("button", {
      cls: "yh-habit-footer-icon"
    });
    const forestBtn = footer.createEl("button", {
      cls: "yh-habit-footer-icon"
    });
    setIcon(addBtn, "plus");
    setIcon(forestBtn, "trees");
    footer.createDiv({
      cls: "yh-habit-rate",
      text: t(api.language, "plantedToday", { done: completedToday.length, total: habits.length })
    });
    addBtn.addEventListener("click", () => {
      new HabitAddModal(api.app, habits, async (name) => {
        await api.saveState({ habits: [...habits, name] }, true);
      }, api.language).open();
    });
    forestBtn.addEventListener("click", () => {
      new HabitForestModal(api.app, habits, completions, api.snapshot.now, api.language).open();
    });
  },
  renderSettings(container, draft, ctx) {
    const state = ctx.state;
    new Setting(container).setName(t(ctx.language, "title")).addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName(t(ctx.language, "habitList")).setDesc(t(ctx.language, "habitListDesc")).addTextArea((text) => {
      text.setValue(normalizeArray(state.habits, []).join("\n"));
      text.onChange((value) => {
        draft._habitList = value;
      });
    });
    if (draft._habitList === undefined) {
      draft._habitList = normalizeArray(state.habits, []).join("\n");
    }
  }
};
