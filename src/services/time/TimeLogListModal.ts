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
    this.page = 0;
    this.fromDate = "";
    this.toDate = "";
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

    const filters = contentEl.createDiv({ cls: "yh-time-log-filters" });
    for (const [key, label] of [["fromDate", "filterFrom"], ["toDate", "filterTo"]]) {
      const wrapper = filters.createEl("label", { text: this.t(label) });
      const input = wrapper.createEl("input", { type: "date", value: this[key] });
      input.addEventListener("change", () => { this[key] = input.value; this.page = 0; this.render(); });
    }
    const from = this.fromDate ? new Date(`${this.fromDate}T00:00:00`).getTime() : -Infinity;
    const toDay = this.toDate ? new Date(`${this.toDate}T00:00:00`) : null;
    if (toDay) toDay.setDate(toDay.getDate() + 1);
    const to = toDay?.getTime() ?? Infinity;
    const filtered = this.getLogs().filter((log) => log.endTime > from && log.startTime < to).sort((a, b) => b.startTime - a.startTime);
    const pages = Math.max(1, Math.ceil(filtered.length / 20));
    this.page = Math.min(this.page, pages - 1);
    const logs = filtered.slice(this.page * 20, (this.page + 1) * 20);
    contentEl.createDiv({ text: this.t("recordsFiltered", { count: filtered.length }) });
    const exportButton = filters.createEl("button", { text: this.t("exportRecords") });
    exportButton.addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" }));
      const anchor = contentEl.createEl("a", { attr: { href: url, download: "homepulse-time-records.json" } });
      anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
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
        remove.disabled = true;
        try {
          if (await this.onDelete(log.id)) new Notice(this.t("timeLogDeleted"));
          this.render();
        } catch {
          new Notice(this.t("saveFailed"));
          remove.disabled = false;
        }
      });
    }

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const previous = footer.createEl("button", { text: this.t("earlier") });
    previous.disabled = this.page === 0;
    previous.addEventListener("click", () => { this.page -= 1; this.render(); });
    footer.createSpan({ text: this.t("pageOf", { page: this.page + 1, total: pages }) });
    const next = footer.createEl("button", { text: this.t("next") });
    next.disabled = this.page >= pages - 1;
    next.addEventListener("click", () => { this.page += 1; this.render(); });
    const close = footer.createEl("button", { cls: "yh-modal-cancel", text: this.t("close") });
    close.addEventListener("click", () => this.close());
  }

  t(key, vars = {}) {
    return t(this.language, key, vars);
  }
}
