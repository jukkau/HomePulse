import type { TimeLog } from "../../types";
import { validateTimeLog, validateTimeLogs } from "../../data/validators";
import {
  QUICK_CAPTURE_TASK_ID,
  type TimeLogInput,
  type TimeLogPatch,
  type TimeLogQuery,
  type TimeLogStore
} from "./types";

function createId(): string {
  return `timelog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toTimeLog(input: TimeLogInput, id = createId(), createdAt = Date.now()): TimeLog {
  const duration = Math.max(1, Math.round((input.endTime - input.startTime) / 60000));
  const base: TimeLog = {
    id,
    startTime: input.startTime,
    endTime: input.endTime,
    duration,
    source: input.source,
    targetType: input.target.type,
    targetId: input.target.type === "task" ? input.target.id || QUICK_CAPTURE_TASK_ID : input.target.id,
    createdAt
  };

  if (input.activityType) base.activityType = input.activityType;
  if (input.note && input.note.trim()) base.note = input.note.trim();

  if (base.targetType === "project") {
    base.projectId = base.targetId;
    base.projectTitle = input.target.title || base.targetId;
    if (input.target.areaId) {
      base.areaId = input.target.areaId;
      base.areaTitle = input.target.areaTitle || input.target.areaId;
    }
  } else if (base.targetType === "area") {
    base.areaId = base.targetId;
    base.areaTitle = input.target.title || base.targetId;
  } else if (base.targetType === "task") {
    base.taskId = base.targetId || QUICK_CAPTURE_TASK_ID;
  }

  return base;
}

export class TimeLogService {
  store: TimeLogStore;

  constructor(store: TimeLogStore) {
    this.store = store;
  }

  async create(input: TimeLogInput): Promise<TimeLog> {
    const log = validateTimeLog(toTimeLog(input));
    if (!log) throw new Error("Invalid time log.");
    this.store.timeLogs = validateTimeLogs([log, ...this.store.timeLogs]);
    await this.store.persist();
    return log;
  }

  async update(id: string, patch: TimeLogPatch): Promise<TimeLog | null> {
    const current = this.store.timeLogs.find((item) => item.id === id);
    if (!current) return null;

    const target = patch.target || {
      type: patch.targetType || current.targetType,
      id: patch.targetId || current.targetId,
      title: patch.targetId || current.targetId
    };
    const next = validateTimeLog({
      ...current,
      ...toTimeLog({
        startTime: patch.startTime ?? current.startTime,
        endTime: patch.endTime ?? current.endTime,
        source: patch.source ?? current.source,
        target,
        activityType: patch.activityType ?? current.activityType,
        note: patch.note ?? current.note
      }, current.id, current.createdAt)
    });
    if (!next) throw new Error("Invalid time log update.");

    this.store.timeLogs = validateTimeLogs(
      this.store.timeLogs.map((item) => item.id === id ? next : item)
    );
    await this.store.persist();
    return next;
  }

  async delete(id: string): Promise<boolean> {
    const before = this.store.timeLogs.length;
    this.store.timeLogs = this.store.timeLogs.filter((item) => item.id !== id);
    if (this.store.timeLogs.length === before) return false;
    await this.store.persist();
    return true;
  }

  query(query: TimeLogQuery = {}): TimeLog[] {
    return this.store.timeLogs.filter((item) => {
      if (query.projectId && item.projectId !== query.projectId) return false;
      if (query.areaId && item.areaId !== query.areaId) return false;
      if (query.taskId && item.taskId !== query.taskId) return false;
      if (query.targetType && item.targetType !== query.targetType) return false;
      if (query.targetId && item.targetId !== query.targetId) return false;
      if (query.source && item.source !== query.source) return false;
      if (query.startDate && item.endTime < query.startDate) return false;
      if (query.endDate && item.startTime > query.endDate) return false;
      return true;
    });
  }
}
