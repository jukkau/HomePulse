import type { TimeLog, TimeLogActivityType, TimeLogSource, TimeLogTargetType } from "../../types";

export const QUICK_CAPTURE_TASK_ID = "QuickCapture" as const;
export const QUICK_CAPTURE_PATH = "QuickCapture.md" as const;

export type TimeLogTarget = {
  type: TimeLogTargetType;
  id: string;
  title: string;
  areaId?: string;
  areaTitle?: string;
};

export type TimeLogInput = {
  startTime: number;
  endTime: number;
  source: TimeLogSource;
  target: TimeLogTarget;
  activityType?: TimeLogActivityType;
  note?: string;
};

export type TimeLogPatch = Partial<TimeLogInput> & {
  targetType?: TimeLogTargetType;
  targetId?: string;
};

export type TimeLogQuery = {
  projectId?: string;
  areaId?: string;
  taskId?: string;
  targetType?: TimeLogTargetType;
  targetId?: string;
  source?: TimeLogSource;
  startDate?: number;
  endDate?: number;
};

export type TimeRangeKey = "today" | "week" | "month" | "all";

export type TimeBucket = {
  id: string;
  title: string;
  duration: number;
  count: number;
};

export type TimeSummary = {
  totalDuration: number;
  count: number;
  byProject: TimeBucket[];
  byArea: TimeBucket[];
  byTask: TimeBucket[];
  byQuick: TimeBucket[];
};

export type TimeLogStore = {
  timeLogs: TimeLog[];
  persist: () => Promise<void>;
};
