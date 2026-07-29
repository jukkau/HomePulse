import type { TimeLog } from "../../types";
import { QUICK_CAPTURE_TASK_ID, type TimeBucket, type TimeRangeKey, type TimeSummary } from "./types";

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function startOfWeek(date: Date): number {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay() === 0 ? 7 : copy.getDay();
  copy.setDate(copy.getDate() - day + 1);
  return copy.getTime();
}

function startOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

export function getTimeRange(range: TimeRangeKey, now = new Date()): { start?: number; end?: number } {
  if (range === "today") return { start: startOfDay(now), end: now.getTime() };
  if (range === "week") return { start: startOfWeek(now), end: now.getTime() };
  if (range === "month") return { start: startOfMonth(now), end: now.getTime() };
  return {};
}

export class TimeAggregation {
  logs: TimeLog[];

  constructor(logs: TimeLog[]) {
    this.logs = logs;
  }

  inRange(range: TimeRangeKey, now = new Date()): TimeLog[] {
    const { start, end } = getTimeRange(range, now);
    return this.logs.filter((item) => {
      if (start && item.endTime < start) return false;
      if (end && item.startTime > end) return false;
      return true;
    });
  }

  summarize(range: TimeRangeKey = "all", now = new Date()): TimeSummary {
    const logs = this.inRange(range, now);
    return {
      totalDuration: logs.reduce((sum, item) => sum + item.duration, 0),
      count: logs.length,
      byProject: bucketize(logs, (item) => item.projectId, (item) => item.projectTitle || item.projectId || ""),
      byArea: bucketize(logs, (item) => item.areaId, (item) => item.areaTitle || item.areaId || ""),
      byTask: bucketize(logs, (item) => item.taskId, (item) => item.taskId || QUICK_CAPTURE_TASK_ID),
      byQuick: bucketize(
        logs.filter((item) => item.targetType === "quick"),
        (item) => item.targetId,
        (item) => item.targetId
      )
    };
  }
}

function bucketize(
  logs: TimeLog[],
  idFor: (log: TimeLog) => string | undefined,
  titleFor: (log: TimeLog) => string
): TimeBucket[] {
  const buckets = new Map<string, TimeBucket>();
  for (const log of logs) {
    const id = idFor(log);
    if (!id) continue;
    const current = buckets.get(id) || { id, title: titleFor(log) || id, duration: 0, count: 0 };
    current.duration += log.duration;
    current.count += 1;
    buckets.set(id, current);
  }
  return Array.from(buckets.values()).sort((a, b) => b.duration - a.duration || a.title.localeCompare(b.title, "zh-CN"));
}
