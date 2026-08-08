// @ts-nocheck
import { Modal, Notice, Setting } from "obsidian";
import {
  listAreaTargets,
  listProjectTargets,
  quickCaptureTaskTarget,
  quickTarget
} from "./target-resolver";
import { normalizeLanguage, t } from "../../i18n";

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDurationMinutes(raw) {
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return 0;
  const hourMatch = /(\d+(?:\.\d+)?)\s*h/.exec(text);
  const minuteMatch = /(\d+(?:\.\d+)?)\s*m/.exec(text);
  if (hourMatch || minuteMatch) {
    return Math.round((Number(hourMatch?.[1] || 0) * 60) + Number(minuteMatch?.[1] || 0));
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function parseDateInput(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export class ManualTimeRecordModal extends Modal {
  constructor(app, config, onSave, language = "en") {
    super(app);
    this.config = config || {};
    this.onSave = onSave;
    this.language = normalizeLanguage(language);
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 60 * 1000);
    this.draft = {
      mode: "duration",
      duration: "30m",
      startInput: toLocalInputValue(start),
      endInput: toLocalInputValue(now),
      note: "",
      target: null,
      targetButtons: []
    };
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal", "yh-time-record-modal");
    contentEl.createEl("h2", { text: this.t("recordTime") });
    contentEl.createDiv({ cls: "yh-settings-subtitle", text: this.t("recordTimeDesc") });

    const body = contentEl.createDiv({ cls: "yh-settings-body" });
    this.renderTargetPicker(body);
    const timeFields = body.createDiv({ cls: "yh-time-fields" });
    this.renderTimeFields(timeFields);
    this.renderDetails(body);

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const cancel = footer.createEl("button", { cls: "yh-modal-cancel", text: this.t("cancel") });
    const save = footer.createEl("button", { cls: "mod-cta yh-modal-save", text: this.t("save") });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", async () => {
      const input = this.buildInput();
      if (!input) return;
      await this.onSave(input);
      this.close();
    });
  }

  renderTargetPicker(parent) {
    const host = parent.createDiv({ cls: "yh-target-section" });
    this.draft.targetButtons = [];
    const renderTarget = (target) => {
      this.draft.target = target;
      for (const entry of this.draft.targetButtons) {
        entry.button.toggleClass("is-selected", entry.target.type === target.type && entry.target.id === target.id);
      }
    };
    this.renderTargetGroup(host, this.t("project"), listProjectTargets(this.app, this.config), renderTarget);
    this.renderTargetGroup(host, this.t("area"), listAreaTargets(this.app, this.config), renderTarget);
    this.renderTargetGroup(host, this.t("task"), [quickCaptureTaskTarget(this.app, this.config.taskFile)], renderTarget);

    const quickRow = host.createDiv({ cls: "yh-target-quick-row" });
    const input = quickRow.createEl("input", { type: "text", placeholder: this.t("quickTarget") });
    const button = quickRow.createEl("button", { text: this.t("use") });
    button.addEventListener("click", () => {
      const target = quickTarget(input.value);
      if (target) renderTarget(target);
    });
  }

  renderTargetGroup(parent, title, targets, onSelect) {
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
        text: target.type === "task" ? this.t("taskPool") : this.t(target.type)
      });
      this.draft.targetButtons.push({ button, target });
      button.addEventListener("click", () => onSelect(target));
    }
  }

  renderTimeFields(parent) {
    parent.empty();
    new Setting(parent).setName(this.t("mode")).addDropdown((dropdown) => {
      dropdown.addOption("duration", this.t("duration"));
      dropdown.addOption("range", this.t("timeRange"));
      dropdown.setValue(this.draft.mode);
      dropdown.onChange((value) => {
        this.draft.mode = value;
        this.renderTimeFields(parent);
      });
    });

    if (this.draft.mode === "duration") {
      new Setting(parent).setName(this.t("duration")).setDesc(this.t("durationExamples")).addText((text) => {
        text.setValue(this.draft.duration);
        text.onChange((value) => {
          this.draft.duration = value;
        });
      });
      return;
    }

    new Setting(parent).setName(this.t("start")).addText((text) => {
      text.inputEl.type = "datetime-local";
      text.setValue(this.draft.startInput);
      text.onChange((value) => {
        this.draft.startInput = value;
      });
    });
    new Setting(parent).setName(this.t("end")).addText((text) => {
      text.inputEl.type = "datetime-local";
      text.setValue(this.draft.endInput);
      text.onChange((value) => {
        this.draft.endInput = value;
      });
    });
  }

  renderDetails(parent) {
    new Setting(parent).setName(this.t("note")).addTextArea((text) => {
      text.setValue(this.draft.note);
      text.onChange((value) => {
        this.draft.note = value;
      });
    });
  }

  buildInput() {
    if (!this.draft.target) {
      new Notice(this.t("chooseTargetFirst"));
      return null;
    }
    let startTime = 0;
    let endTime = 0;
    if (this.draft.mode === "range") {
      startTime = parseDateInput(this.draft.startInput);
      endTime = parseDateInput(this.draft.endInput);
    } else {
      const minutes = parseDurationMinutes(this.draft.duration);
      if (minutes <= 0) {
        new Notice(this.t("enterValidDuration"));
        return null;
      }
      endTime = Date.now();
      startTime = endTime - minutes * 60 * 1000;
    }
    if (!startTime || !endTime || endTime <= startTime) {
      new Notice(this.t("enterValidTimeRange"));
      return null;
    }
    return {
      source: "manual",
      startTime,
      endTime,
      target: this.draft.target,
      note: this.draft.note
    };
  }

  t(key, vars = {}) {
    return t(this.language, key, vars);
  }
}
