// @ts-nocheck
import { Modal, Notice } from "obsidian";

function formatDuration(minutes) {
  const safe = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDateTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return `${date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} ${date.toLocaleTimeString("zh-CN", {
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

export class TimeLogListModal extends Modal {
  constructor(app, getLogs, onDelete) {
    super(app);
    this.getLogs = getLogs;
    this.onDelete = onDelete;
  }

  onOpen() {
    this.render();
  }

  render() {
    const { contentEl } = this;
    this.modalEl.addClass("yh-settings-shell");
    contentEl.empty();
    contentEl.addClass("yh-modal", "yh-settings-modal", "yh-time-log-modal");
    contentEl.createEl("h2", { text: "Time log" });
    contentEl.createDiv({ cls: "yh-settings-subtitle", text: "Recent time entries from Pomodoro and manual records." });

    const logs = this.getLogs().slice().sort((a, b) => b.startTime - a.startTime).slice(0, 20);
    const list = contentEl.createDiv({ cls: "yh-time-log-list" });
    if (!logs.length) {
      list.createDiv({ cls: "yh-empty", text: "No time logs yet." });
    }

    for (const log of logs) {
      const row = list.createDiv({ cls: "yh-time-log-row" });
      const main = row.createDiv({ cls: "yh-time-log-main" });
      main.createDiv({ cls: "yh-time-log-title", text: targetTitle(log) || "Untitled" });
      const meta = main.createDiv({ cls: "yh-time-log-meta" });
      meta.createSpan({ text: formatDateTime(log.startTime) });
      meta.createSpan({ text: formatDuration(log.duration) });
      meta.createSpan({ text: log.source || "" });
      if (log.activityType) meta.createSpan({ text: log.activityType });

      const remove = row.createEl("button", { cls: "yh-time-log-delete", text: "Delete" });
      remove.addEventListener("click", async () => {
        await this.onDelete(log.id);
        new Notice("Time log deleted.");
        this.render();
      });
    }

    const footer = contentEl.createDiv({ cls: "yh-modal-footer" });
    const close = footer.createEl("button", { cls: "yh-modal-cancel", text: "Close" });
    close.addEventListener("click", () => this.close());
  }
}
