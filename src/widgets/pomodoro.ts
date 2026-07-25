// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { formatSeconds, reconcilePomodoroState } from "./widget-api";

import { Modal, Setting, setIcon } from "obsidian";

function clampMinutes(value, fallback, max) {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next) || next < 1) return fallback;
  return Math.min(max, next);
}

// Replaces the old window.prompt flow (disallowed by Obsidian review) with a
// proper Modal, while keeping a quick settings entry on the widget face.
class PomodoroSettingsModal extends Modal {
  constructor(app, config, onSave) {
    super(app);
    this.config = config;
    this.onSave = onSave;
    this.draft = {
      workMinutes: Number(config.workMinutes) || 25,
      breakMinutes: Number(config.breakMinutes) || 5
    };
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal");
    contentEl.createEl("h2", { text: "Pomodoro settings" });
    contentEl.createDiv({ cls: "yh-settings-subtitle", text: "Set the work and break lengths." });
    const body = contentEl.createDiv({ cls: "yh-settings-body" });

    new Setting(body).setName("Work minutes").addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "180";
      text.setValue(String(this.draft.workMinutes));
      text.onChange((value) => {
        this.draft.workMinutes = clampMinutes(value, 25, 180);
      });
    });
    new Setting(body).setName("Break minutes").addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "60";
      text.setValue(String(this.draft.breakMinutes));
      text.onChange((value) => {
        this.draft.breakMinutes = clampMinutes(value, 5, 60);
      });
    });

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

export const pomodoroWidget = {
  type: "pomodoro",
  displayName: "Pomodoro",
  shell: "strip",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H2", w: 1, h: 2 },
  defaultConfig: { title: "pomodoro", workMinutes: 25, breakMinutes: 5 },
  defaultState: {
    status: "idle",
    remainingSeconds: 1500,
    phaseStartedAt: 0,
    todayCountDate: "",
    todayCount: 0
  },
  async render(container, api) {
    const timer = container.createDiv({ cls: "yh-pomo" });
    const timerText = timer.createDiv({ cls: "yh-pomo-time" });
    const progress = timer.createDiv({ cls: "yh-pomo-progress" });
    const progressFill = progress.createDiv({ cls: "yh-pomo-progress-fill" });
    const meta = timer.createDiv({ cls: "yh-pomo-meta" });
    const controls = timer.createDiv({ cls: "yh-pomo-controls" });
    const startBtn = controls.createEl("button", {
      cls: "yh-pomo-btn yh-pomo-btn-primary"
    });
    const resetBtn = controls.createEl("button", {
      cls: "yh-pomo-btn"
    });
    const settingsBtn = controls.createEl("button", {
      cls: "yh-pomo-btn"
    });
    setIcon(startBtn, "play");
    setIcon(resetBtn, "rotate-ccw");
    setIcon(settingsBtn, "settings");
    const count = timer.createDiv({ cls: "yh-pomo-count" });
    const updateVisual = async () => {
      const stored = { state: api.getState(), config: api.getConfig() };
      const computed = reconcilePomodoroState(stored.state, stored.config);
      const total = (computed.status === "break"
        ? (Number(stored.config.breakMinutes) || 5) * 60
        : (Number(stored.config.workMinutes) || 25) * 60) || 1;
      const pct = Math.max(0, Math.min(100, ((total - computed.remainingSeconds) / total) * 100));
      timerText.setText(formatSeconds(computed.remainingSeconds));
      progressFill.style.setProperty("--yh-pomo-fill", `${pct}%`);
      progressFill.toggleClass("is-break", computed.status === "break");
      meta.setText(
        computed.status === "idle"
          ? "READY TO FOCUS"
          : computed.status === "running"
            ? "FOCUSING..."
            : computed.status === "paused"
              ? "PAUSED"
              : "BREAK TIME"
      );
      count.setText(`today: ${computed.todayCount} pomodoros`);
      const isActive = computed.status === "running" || computed.status === "break";
      setIcon(startBtn, isActive ? "pause" : "play");
      const changed = JSON.stringify(computed) !== JSON.stringify(stored.state);
      if (changed) {
        await api.saveState({
          status: computed.status,
          remainingSeconds: computed.remainingSeconds,
          phaseStartedAt: computed.phaseStartedAt,
          todayCountDate: computed.todayCountDate,
          todayCount: computed.todayCount
        }, computed.status === "idle" && stored.state.status !== "idle");
      }
    };
    await updateVisual();
    api.rememberInterval(window.setInterval(() => {
      void updateVisual();
    }, 1000));
    startBtn.addEventListener("click", async () => {
      const stored = { state: api.getState(), config: api.getConfig() };
      const computed = reconcilePomodoroState(stored.state, stored.config);
      if (computed.status === "running" || computed.status === "break") {
        await api.saveState({
          status: "paused",
          remainingSeconds: computed.remainingSeconds,
          phaseStartedAt: 0,
          todayCountDate: computed.todayCountDate,
          todayCount: computed.todayCount
        }, true);
      } else {
        await api.saveState({
          status: computed.status === "break" ? "break" : "running",
          remainingSeconds: computed.remainingSeconds,
          phaseStartedAt: Date.now(),
          todayCountDate: computed.todayCountDate,
          todayCount: computed.todayCount
        }, true);
      }
    });
    resetBtn.addEventListener("click", async () => {
      await api.saveState({
        status: "idle",
        remainingSeconds: (Number(api.widgetData.config.workMinutes) || 25) * 60,
        phaseStartedAt: 0
      }, true);
    });
    settingsBtn.addEventListener("click", () => {
      new PomodoroSettingsModal(api.app, api.getConfig(), async (draft) => {
        await api.saveConfig({
          ...api.getConfig(),
          workMinutes: draft.workMinutes,
          breakMinutes: draft.breakMinutes
        }, false);
        await api.saveState({
          status: "idle",
          remainingSeconds: draft.workMinutes * 60,
          phaseStartedAt: 0
        }, true);
      }).open();
    });
  },
  renderSettings(container, draft) {
    new Setting(container).setName("Title").addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName("Work minutes").addText((text) => {
      text.setValue(String(draft.workMinutes || 25));
      text.onChange((value) => {
        draft.workMinutes = Number(value) || 25;
      });
    });
    new Setting(container).setName("Break minutes").addText((text) => {
      text.setValue(String(draft.breakMinutes || 5));
      text.onChange((value) => {
        draft.breakMinutes = Number(value) || 5;
      });
    });
  }
};
