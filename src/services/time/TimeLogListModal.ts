// @ts-nocheck
import { Modal, Notice } from "obsidian";
import { normalizeLanguage, t } from "../../i18n";

function formatDuration(minutes) {
  const safe = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDateTime(timestamp, language) {
  const date = new Date(Number(timestamp) || Date.now());
  const locale = language === "zh-CN" ? "zh-CN" : "en-US";
  return `${date.toLocaleDateString(locale, { month: "2-digit", day: "2-digit" })} ${date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })}`;
}

function targetTitle(log) {
  if (log.targetType === "project") return log.projectTitle || log.projectId || log.targetId;
  if (log.targetType === "area") return log.areaTitle || log.areaId || log.targetId;
  if (log.targetType === "task") return log.taskId || log.targetId;
  return log.targetId;
}

const ACTIVITY_KEYS = {
  work: "activityWork",
  learning: "activityLearning",
  creative: "activityCreative",
  exercise: "activityExercise",
  reading: "activityReading",
  travel: "activityTravel",
  other: "activityOther"
};

export class TimeLogListModal extends Modal {
  constructor(app, getLogs, onDelete, language = "en") {
    super(app);
    this.getLogs = getLogs;
    this.onDelete = onDelete;
    this.language = normalizeLanguage(language);
  }

  onOpen() {
    this.render();
  }

  render() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal", "yh-time-log-modal");
    contentEl.createEl("h2", { text: this.t("timeLog") });
    contentEl.createDiv({ cls: "yh-settings-subtitle", text: this.t("timeLogDesc") });

    const logs = this.getLogs().slice().sort((a, b) => b.startTime - a.startTime).slice(0, 20);
    const list = contentEl.createDiv({ cls: "yh-time-log-list" });
    if (!logs.length) {
      list.createDiv({ cls: "yh-empty", text: this.t("noTimeLogs") });
    }

    for (const log of logs) {
      const row = list.createDiv({ cls: "yh-time-log-row" });
      const main = row.createDiv({ cls: "yh-time-log-main" });
      main.createDiv({ cls: "yh-time-log-title", text: targetTitle(log) || this.t("untitled") });
      const meta = main.createDiv({ cls: "yh-time-log-meta" });
      meta.createSpan({ text: formatDateTime(log.startTime, this.language) });
      meta.createSpan({ text: formatDuration(log.duration) });
      meta.createSpan({ text: this.t(log.source === "manual" ? "sourceManual" : "sourcePomodoro") });
      if (log.activityType) meta.createSpan({ text: this.t(ACTIVITY_KEYS[log.activityType] || "activityOther") });

      const remove = row.createEl("button", { cls: "yh-time-log-delete", text: this.t("delete") });
      remove.addEventListener("click", async () => {
        await this.onDelete(log.id);
        new Notice(this.t("timeLogDeleted"));
        this.render();
      });
    }

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const close = footer.createEl("button", { cls: "yh-modal-cancel", text: this.t("close") });
    close.addEventListener("click", () => this.close());
  }

  t(key, vars = {}) {
    return t(this.language, key, vars);
  }
}
