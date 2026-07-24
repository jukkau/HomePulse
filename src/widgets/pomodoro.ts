// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { formatSeconds, reconcilePomodoroState } from "./widget-api";

const { Setting, setIcon } = require("obsidian");

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
      const stored = api.plugin.getWidgetData(api.widget.id, "pomodoro");
      const computed = reconcilePomodoroState(stored.state, stored.config);
      const total = (computed.status === "break"
        ? (Number(stored.config.breakMinutes) || 5) * 60
        : (Number(stored.config.workMinutes) || 25) * 60) || 1;
      const pct = Math.max(0, Math.min(100, ((total - computed.remainingSeconds) / total) * 100));
      timerText.setText(formatSeconds(computed.remainingSeconds));
      progressFill.style.width = `${pct}%`;
      progressFill.style.background = computed.status === "break" ? "var(--komo-green)" : "var(--komo-sakura)";
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
      const stored = api.plugin.getWidgetData(api.widget.id, "pomodoro");
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
    settingsBtn.addEventListener("click", async () => {
      const work = window.prompt("Work minutes", String(api.widgetData.config.workMinutes || 25));
      if (work == null) return;
      const pause = window.prompt("Break minutes", String(api.widgetData.config.breakMinutes || 5));
      if (pause == null) return;
      const nextWork = Number(work) || 25;
      const nextBreak = Number(pause) || 5;
      await api.saveConfig({
        ...api.widgetData.config,
        workMinutes: nextWork,
        breakMinutes: nextBreak
      }, false);
      await api.saveState({
        status: "idle",
        remainingSeconds: nextWork * 60,
        phaseStartedAt: 0
      }, true);
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
