import { localDateKey } from "../widgets/widget-api";
import { toTimeLog } from "./time/TimeLogService";
import type { TimeLog } from "../types";
import type { TimeLogTarget } from "./time/types";

export type PomodoroState = {
  status: "idle" | "running" | "paused" | "break";
  pausedPhase?: "work" | "break";
  remainingSeconds: number;
  phaseStartedAt: number;
  todayCountDate: string;
  todayCount: number;
  activeTarget?: TimeLogTarget | null;
  recentTargets?: TimeLogTarget[];
  sessionId?: string;
};
export type PomodoroConfig = { workMinutes?: number; breakMinutes?: number };

/** Advances expired phases in one step, including both phases after sleep. */
export function advancePomodoro(state: PomodoroState, config: PomodoroConfig, now = Date.now()): {
  state: PomodoroState; log?: TimeLog; completed: Array<"work" | "break">;
} {
  const today = localDateKey(new Date(now));
  const next = { ...state, todayCountDate: today, todayCount: state.todayCountDate === today ? state.todayCount : 0 };
  const result: ReturnType<typeof advancePomodoro> = { state: next, completed: [] };
  if ((next.status !== "running" && next.status !== "break") || !next.phaseStartedAt) return result;
  const deadline = next.phaseStartedAt + next.remainingSeconds * 1000;
  if (now < deadline) return result;
  const workSeconds = (Number(config.workMinutes) || 25) * 60;
  const breakSeconds = (Number(config.breakMinutes) || 5) * 60;
  if (next.status === "running") {
    result.completed.push("work");
    if (localDateKey(new Date(deadline)) === today) next.todayCount += 1;
    if (next.activeTarget) {
      result.log = toTimeLog({ startTime: deadline - workSeconds * 1000, endTime: deadline,
        source: "pomodoro", target: next.activeTarget, activityType: "work" },
        `pomodoro-${next.sessionId || `${state.phaseStartedAt}-${deadline}`}`, deadline);
    }
    next.status = "break";
    next.pausedPhase = "break";
    next.phaseStartedAt = deadline;
    next.remainingSeconds = breakSeconds;
    if (now < deadline + breakSeconds * 1000) return result;
  }
  result.completed.push("break");
  next.status = "idle";
  next.pausedPhase = "work";
  next.remainingSeconds = workSeconds;
  next.phaseStartedAt = 0;
  return result;
}
