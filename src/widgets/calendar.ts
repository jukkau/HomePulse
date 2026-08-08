// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";
import { localDateKey } from "./widget-api";

import { Notice, Setting } from "obsidian";

export const calendarWidget = {
  type: "calendar",
  displayName: "Calendar",
  shell: "panel",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H2", w: 1, h: 2 },
  defaultConfig: { title: "calendar" },
  defaultState: {},
  async render(container, api) {
    const state = api.getUiState();
    if (state.year === undefined) {
      state.year = api.snapshot.now.getFullYear();
      state.month = api.snapshot.now.getMonth();
    }
    const nav = container.createDiv({ cls: "yh-calendar-nav" });
    const prev = nav.createEl("button", { text: "‹" });
    nav.createDiv({
      cls: "yh-calendar-title",
      text: new Date(state.year, state.month).toLocaleDateString(api.language === "zh-CN" ? "zh-CN" : "en-US", { year: "numeric", month: "long" })
    });
    const next = nav.createEl("button", { text: "›" });
    prev.addEventListener("click", async () => {
      state.month -= 1;
      if (state.month < 0) {
        state.month = 11;
        state.year -= 1;
      }
      await api.requestRender();
    });
    next.addEventListener("click", async () => {
      state.month += 1;
      if (state.month > 11) {
        state.month = 0;
        state.year += 1;
      }
      await api.requestRender();
    });
    const head = container.createDiv({ cls: "yh-calendar-grid yh-calendar-head" });
    ["weekdayMon", "weekdayTue", "weekdayWed", "weekdayThu", "weekdayFri", "weekdaySat", "weekdaySun"].forEach((key, index) => {
      const day = t(api.language, key);
      const label = head.createDiv({ text: day });
      if (index === 5) label.addClass("is-saturday");
      if (index === 6) label.addClass("is-sunday");
    });
    const days = container.createDiv({ cls: "yh-calendar-grid" });
    const first = new Date(state.year, state.month, 1);
    const shift = (first.getDay() + 6) % 7;
    const total = new Date(state.year, state.month + 1, 0).getDate();
    for (let i = 0; i < shift; i += 1) {
      days.createDiv({ cls: "yh-calendar-cell is-empty" });
    }
    for (let day = 1; day <= total; day += 1) {
      const key = localDateKey(new Date(state.year, state.month, day));
      const notes = api.snapshot.getDailyNotesForDate(key);
      const cell = days.createEl("button", { cls: "yh-calendar-cell" });
      const weekdayIndex = (shift + day - 1) % 7;
      if (weekdayIndex === 5) cell.addClass("is-saturday");
      if (weekdayIndex === 6) cell.addClass("is-sunday");
      if (key === localDateKey(api.snapshot.now)) {
        cell.addClass("is-today");
      }
      const dayLabel = cell.createDiv({ cls: "yh-calendar-day", text: String(day) });
      dayLabel.setAttr("aria-hidden", "true");
      const dots = cell.createDiv({ cls: "yh-calendar-dots" });
      if (notes.length) {
        for (let i = 0; i < Math.min(notes.length, 3); i += 1) {
          dots.createDiv({ cls: "yh-calendar-dot" });
        }
      }
      cell.addEventListener("click", async () => {
        if (notes.length) {
          await api.openPath(notes[0].path);
          return;
        }
        if (key === localDateKey(api.snapshot.now) && api.app.commands.commands["daily-notes:goto-today"]) {
          api.app.commands.executeCommandById("daily-notes:goto-today");
          return;
        }
        new Notice(t(api.language, "noDailyNoteForDate", { date: key }));
      });
    }
  },
  renderSettings(container, draft, ctx) {
    new Setting(container).setName(t(ctx.language, "title")).addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
  }
};
