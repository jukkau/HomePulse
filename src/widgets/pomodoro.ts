// @ts-nocheck
import { ALL_SIZE_PRESETS } from "../layout/size-presets";
import { t } from "../i18n";
import {
  formatSeconds,
  parseLineList,
  reconcilePomodoroState,
  shouldPersistPomodoroState
} from "./widget-api";
import {
  listAreaTargets,
  listProjectTargets,
  quickCaptureTaskTarget,
  quickTarget
} from "../services/time/target-resolver";
import {
  getInheritedAreaFolders,
  getInheritedProjectFolders,
  withInheritedAreaFolders,
  withInheritedProjectFolders
} from "../services/project-filter";

import { Modal, Setting, setIcon } from "obsidian";

function clampMinutes(value, fallback, max) {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next) || next < 1) return fallback;
  return Math.min(max, next);
}

// Replaces the old window.prompt flow (disallowed by Obsidian review) with a
// proper Modal, while keeping a quick settings entry on the widget face.
class PomodoroSettingsModal extends Modal {
  constructor(app, config, onSave, language) {
    super(app);
    this.config = config;
    this.onSave = onSave;
    this.language = language;
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
    contentEl.createEl("h2", { text: t(this.language, "pomodoroSettings") });
    contentEl.createDiv({ cls: "yh-settings-subtitle", text: t(this.language, "pomodoroSettingsDesc") });
    const body = contentEl.createDiv({ cls: "yh-settings-body" });

    new Setting(body).setName(t(this.language, "workMinutes")).addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "180";
      text.setValue(String(this.draft.workMinutes));
      text.onChange((value) => {
        this.draft.workMinutes = clampMinutes(value, 25, 180);
      });
    });
    new Setting(body).setName(t(this.language, "breakMinutes")).addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "60";
      text.setValue(String(this.draft.breakMinutes));
      text.onChange((value) => {
        this.draft.breakMinutes = clampMinutes(value, 5, 60);
      });
    });

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: t(this.language, "cancel") });
    const save = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: t(this.language, "save") });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", async () => {
      await this.onSave(this.draft);
      this.close();
    });
  }
}

class TargetSelectorModal extends Modal {
  constructor(app, options, onSelect, language) {
    super(app);
    this.options = options;
    this.onSelect = onSelect;
    this.resolved = false;
    this.language = language;
  }

  resolve(target) {
    if (this.resolved) return;
    this.resolved = true;
    this.onSelect(target);
    this.close();
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal", "yh-target-modal");
    contentEl.createEl("h2", { text: t(this.language, "startFocus") });
    contentEl.createDiv({ cls: "yh-settings-subtitle", text: t(this.language, "startFocusDesc") });
    const body = contentEl.createDiv({ cls: "yh-settings-body" });

    this.renderSection(body, t(this.language, "recent"), this.options.recentTargets || []);
    this.renderSection(body, t(this.language, "project"), this.options.projectTargets || []);
    this.renderSection(body, t(this.language, "area"), this.options.areaTargets || []);
    this.renderSection(body, t(this.language, "task"), [this.options.taskTarget || quickCaptureTaskTarget()]);

    const quickWrap = body.createDiv({ cls: "yh-target-section" });
    quickWrap.createDiv({ cls: "yh-target-section-title", text: t(this.language, "quick") });
    const quickRow = quickWrap.createDiv({ cls: "yh-target-quick-row" });
    const input = quickRow.createEl("input", {
      type: "text",
      placeholder: t(this.language, "temporaryFocus")
    });
    const button = quickRow.createEl("button", { text: t(this.language, "start") });
    button.addEventListener("click", () => {
      const target = quickTarget(input.value);
      if (target) this.resolve(target);
    });

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: t(this.language, "cancel") });
    cancel.addEventListener("click", () => this.resolve(null));
  }

  onClose() {
    if (!this.resolved) this.resolve(null);
  }

  renderSection(parent, title, targets) {
    const items = (targets || []).filter(Boolean);
    if (!items.length) return;
    const section = parent.createDiv({ cls: "yh-target-section" });
    section.createDiv({ cls: "yh-target-section-title", text: title });
    const grid = section.createDiv({ cls: "yh-target-grid" });
    for (const target of items) {
      const button = grid.createEl("button", { cls: `yh-target-choice is-${target.type}` });
      button.createSpan({ cls: "yh-target-choice-title", text: target.title });
      button.createSpan({
        cls: "yh-target-choice-type",
        text: target.type === "task" ? t(this.language, "taskPool") : t(this.language, target.type)
      });
      button.addEventListener("click", () => this.resolve(target));
    }
  }
}

function chooseTarget(app, options, language) {
  return new Promise((resolve) => {
    new TargetSelectorModal(app, options, resolve, language).open();
  });
}

function rememberTarget(state, target) {
  const recent = [target, ...(state.recentTargets || [])]
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((other) => other.type === item.type && other.id === item.id) === index)
    .slice(0, 8);
  return recent;
}

export const pomodoroWidget = {
  type: "pomodoro",
  displayName: "Pomodoro",
  shell: "strip",
  allowedSizes: ALL_SIZE_PRESETS,
  defaultSize: { preset: "W1H2", w: 1, h: 2 },
  defaultConfig: {
    title: "pomodoro",
    workMinutes: 25,
    breakMinutes: 5,
    projectFolders: [],
    projectTags: ["type/project"],
    projectNamePrefixes: ["Project_"],
    areaFolders: ["Areas"],
    areaTags: [],
    areaNamePrefixes: ["Area_"],
    taskFile: "QuickCapture.md"
  },
  defaultState: {
    status: "idle",
    remainingSeconds: 1500,
    phaseStartedAt: 0,
    todayCountDate: "",
    todayCount: 0,
    recentTargets: []
  },
  async render(container, api) {
    const timer = container.createDiv({ cls: "yh-pomo" });
    const timerText = timer.createDiv({ cls: "yh-pomo-time" });
    const progress = timer.createDiv({ cls: "yh-pomo-progress" });
    const progressFill = progress.createDiv({ cls: "yh-pomo-progress-fill" });
    const meta = timer.createDiv({ cls: "yh-pomo-meta" });
    const targetLabel = timer.createDiv({ cls: "yh-pomo-target" });
    const controls = timer.createDiv({ cls: "yh-pomo-controls" });
    const startBtn = controls.createEl("button", {
      cls: "yh-pomo-btn yh-pomo-btn-primary"
    });
    const resetBtn = controls.createEl("button", {
      cls: "yh-pomo-btn"
    });
    const addTimeBtn = controls.createEl("button", {
      cls: "yh-pomo-btn"
    });
    const logBtn = controls.createEl("button", {
      cls: "yh-pomo-btn"
    });
    const settingsBtn = controls.createEl("button", {
      cls: "yh-pomo-btn"
    });
    setIcon(startBtn, "play");
    setIcon(resetBtn, "rotate-ccw");
    setIcon(addTimeBtn, "plus");
    setIcon(logBtn, "history");
    setIcon(settingsBtn, "settings");
    const count = timer.createDiv({ cls: "yh-pomo-count" });
    const updateVisual = async () => {
      const stored = { state: api.getState(), config: api.getConfig() };
      const computed = reconcilePomodoroState(stored.state, stored.config);
      const workSeconds = (Number(stored.config.workMinutes) || 25) * 60;
      const total = (computed.status === "break"
        ? (Number(stored.config.breakMinutes) || 5) * 60
        : workSeconds) || 1;
      const pct = Math.max(0, Math.min(100, ((total - computed.remainingSeconds) / total) * 100));
      timerText.setText(formatSeconds(computed.remainingSeconds));
      progressFill.style.setProperty("--yh-pomo-fill", `${pct}%`);
      progressFill.toggleClass("is-break", computed.status === "break");
      const activeTarget = computed.activeTarget || stored.state.activeTarget;
      meta.setText(
        computed.status === "idle"
          ? t(api.language, "readyToFocus")
          : computed.status === "running"
            ? t(api.language, "focusing")
            : computed.status === "paused"
              ? t(api.language, "paused")
              : t(api.language, "breakTime")
      );
      targetLabel.setText(activeTarget ? activeTarget.title : t(api.language, "noTargetSelected"));
      const summary = api.getTimeSummary("today");
      count.setText(t(api.language, "todayFocus", { count: summary.totalDuration }));
      const isActive = computed.status === "running" || computed.status === "break";
      setIcon(startBtn, isActive ? "pause" : "play");
      if (shouldPersistPomodoroState(stored.state, computed)) {
        const sameActivePhase = isActive && stored.state.status === computed.status;
        if (stored.state.status === "running" && computed.status === "break" && activeTarget) {
          const ui = api.getUiState();
          if (!ui.loggingPomodoro) {
            ui.loggingPomodoro = true;
            const endTime = Date.now();
            await api.createTimeLog({
              source: "pomodoro",
              startTime: endTime - workSeconds * 1000,
              endTime,
              target: activeTarget,
              activityType: "work"
            });
            ui.loggingPomodoro = false;
          }
        }
        await api.saveState({
          status: computed.status,
          remainingSeconds: sameActivePhase ? stored.state.remainingSeconds : computed.remainingSeconds,
          phaseStartedAt: sameActivePhase ? stored.state.phaseStartedAt : computed.phaseStartedAt,
          todayCountDate: computed.todayCountDate,
          todayCount: computed.todayCount,
          activeTarget,
          recentTargets: computed.recentTargets || stored.state.recentTargets || []
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
          todayCount: computed.todayCount,
          activeTarget: computed.activeTarget,
          recentTargets: computed.recentTargets || []
        }, true);
      } else {
        let activeTarget = computed.activeTarget;
        if (!activeTarget && computed.status !== "break") {
          const targetConfig = withInheritedAreaFolders(
            withInheritedProjectFolders(api.getConfig(), api.settings),
            api.settings
          );
          activeTarget = await chooseTarget(api.app, {
            recentTargets: computed.recentTargets || [],
            projectTargets: listProjectTargets(api.app, targetConfig),
            areaTargets: listAreaTargets(api.app, targetConfig),
            taskTarget: quickCaptureTaskTarget(api.app, targetConfig.taskFile)
          }, api.language);
          if (!activeTarget) return;
        }
        await api.saveState({
          status: computed.status === "break" ? "break" : "running",
          remainingSeconds: computed.remainingSeconds,
          phaseStartedAt: Date.now(),
          todayCountDate: computed.todayCountDate,
          todayCount: computed.todayCount,
          activeTarget,
          recentTargets: activeTarget ? rememberTarget(computed, activeTarget) : computed.recentTargets || []
        }, true);
      }
    });
    resetBtn.addEventListener("click", async () => {
      await api.saveState({
        status: "idle",
        remainingSeconds: (Number(api.widgetData.config.workMinutes) || 25) * 60,
        phaseStartedAt: 0,
        activeTarget: null
      }, true);
    });
    addTimeBtn.addEventListener("click", () => {
      api.openManualTimeRecord();
    });
    logBtn.addEventListener("click", () => {
      api.openTimeLogList();
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
      }, api.language).open();
    });
  },
  renderSettings(container, draft, ctx) {
    new Setting(container).setName(t(ctx.language, "title")).addText((text) => {
      text.setValue(draft.title || "");
      text.onChange((value) => {
        draft.title = value;
      });
    });
    new Setting(container).setName(t(ctx.language, "workMinutes")).addText((text) => {
      text.setValue(String(draft.workMinutes || 25));
      text.onChange((value) => {
        draft.workMinutes = Number(value) || 25;
      });
    });
    new Setting(container).setName(t(ctx.language, "breakMinutes")).addText((text) => {
      text.setValue(String(draft.breakMinutes || 5));
      text.onChange((value) => {
        draft.breakMinutes = Number(value) || 5;
      });
    });
    new Setting(container).setName(t(ctx.language, "projectFolders")).setDesc(t(ctx.language, "projectFoldersDesc")).addTextArea((text) => {
      text.setValue(serializeLines(draft.projectFolders?.length ? draft.projectFolders : getInheritedProjectFolders(ctx.settings, [])));
      text.onChange((value) => {
        draft.projectFolders = parseLineList(value);
      });
    });
    new Setting(container).setName(t(ctx.language, "projectTags")).setDesc(t(ctx.language, "projectTagsDesc")).addTextArea((text) => {
      text.setValue(serializeLines(draft.projectTags));
      text.onChange((value) => {
        draft.projectTags = parseLineList(value);
      });
    });
    new Setting(container).setName(t(ctx.language, "projectPrefixes")).setDesc(t(ctx.language, "projectPrefixesDesc")).addTextArea((text) => {
      text.setValue(serializeLines(draft.projectNamePrefixes));
      text.onChange((value) => {
        draft.projectNamePrefixes = parseLineList(value);
      });
    });
    new Setting(container).setName(t(ctx.language, "areaFolders")).setDesc(t(ctx.language, "areaFoldersDesc")).addTextArea((text) => {
      text.setValue(serializeLines(draft.areaFolders?.length ? draft.areaFolders : getInheritedAreaFolders(ctx.settings, ["Areas"])));
      text.onChange((value) => {
        draft.areaFolders = parseLineList(value);
      });
    });
    new Setting(container).setName(t(ctx.language, "areaTags")).setDesc(t(ctx.language, "areaTagsDesc")).addTextArea((text) => {
      text.setValue(serializeLines(draft.areaTags));
      text.onChange((value) => {
        draft.areaTags = parseLineList(value);
      });
    });
    new Setting(container).setName(t(ctx.language, "areaPrefixes")).setDesc(t(ctx.language, "areaPrefixesDesc")).addTextArea((text) => {
      text.setValue(serializeLines(draft.areaNamePrefixes));
      text.onChange((value) => {
        draft.areaNamePrefixes = parseLineList(value);
      });
    });
    new Setting(container).setName(t(ctx.language, "taskFile")).setDesc(t(ctx.language, "taskFileDesc")).addText((text) => {
      text.setValue(draft.taskFile || "QuickCapture.md");
      text.onChange((value) => {
        draft.taskFile = value.trim() || "QuickCapture.md";
      });
    });
  }
};

function serializeLines(value) {
  return Array.isArray(value) ? value.join("\n") : String(value || "");
}
