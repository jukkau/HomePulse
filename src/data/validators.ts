// Migration note: minimal validation for widget config/state and layout items.
// Invalid values fall back to defaults; never throw — one bad widget must not crash the homepage.

import { DEFAULT_ACTIVE_PROJECT_TAGS, DEFAULT_PROJECT_NAME_PREFIXES } from "../constants";
import { parseLineList, parseQuickActions, normalizeArray } from "../widgets/widget-api";
import { isKnownSizePreset } from "../layout/size-presets";
import type { TimeLog, TimeLogActivityType, TimeLogSource, TimeLogTargetType } from "../types";

const POMO_STATUS = new Set(["idle", "running", "paused", "break"]);
const QUICK_ACTION_TYPES = new Set(["command", "url", "daily-note"]);
const TIME_LOG_SOURCES = new Set<TimeLogSource>(["pomodoro", "manual"]);
const TIME_LOG_TARGET_TYPES = new Set<TimeLogTargetType>(["project", "area", "task", "quick"]);
const TIME_LOG_ACTIVITY_TYPES = new Set<TimeLogActivityType>([
  "work",
  "learning",
  "creative",
  "exercise",
  "reading",
  "travel",
  "other"
]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function clampNumber(value: LooseValue, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function asString(value: LooseValue, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

export function asStringArray(value: LooseValue, fallback: LooseValue = []): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return parseLineList(value);
  return Array.isArray(fallback) ? fallback.slice() : [];
}

export function asPlainObject(value: LooseValue, fallback: LooseValue = {}): LooseValue {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return fallback && typeof fallback === "object" ? { ...fallback } : {};
}

/**
 * Validate a single layout widget entry. Returns a cleaned partial or null if unusable.
 */
export function validateLayoutWidget(widget: LooseValue): LooseValue {
  if (!widget || typeof widget !== "object") return null;
  const type = asString(widget.type).trim();
  if (!type) return null;
  const id = asString(widget.id).trim() || null;
  const sizePreset = isKnownSizePreset(widget.sizePreset) ? widget.sizePreset : "W2H2";
  return {
    id,
    type,
    x: clampNumber(widget.x, 0, 100, 0),
    y: clampNumber(widget.y, 0, 1000, 0),
    sizePreset
  };
}

/**
 * Type-aware config validation. Falls back field-by-field to definition.defaultConfig.
 */
export function validateWidgetConfig(type: string, config: LooseValue, defaultConfig: LooseValue = {}): LooseValue {
  const base = asPlainObject(defaultConfig, {});
  const raw = asPlainObject(config, {});
  const next = { ...base, ...raw };

  switch (type) {
    case "focus":
      next.title = asString(raw.title, base.title || "today's goal");
      if (next.title.trim().toLowerCase() === "focus today") {
        next.title = "today's goal";
      }
      next.placeholder = asString(raw.placeholder, base.placeholder || "");
      break;

    case "projects":
    case "tasks":
      next.title = asString(raw.title, base.title || type);
      next.projectFolders = asStringArray(raw.projectFolders ?? raw.folders, base.projectFolders || base.folders || []);
      next.projectTags = asStringArray(raw.projectTags ?? raw.tags, base.projectTags || []);
      next.projectNamePrefixes = asStringArray(
        raw.projectNamePrefixes ?? raw.namePrefixes,
        base.projectNamePrefixes || DEFAULT_PROJECT_NAME_PREFIXES
      );
      next.limit = clampNumber(raw.limit, 1, 200, Number(base.limit) || 10);
      delete next.folders;
      delete next.tags;
      delete next.namePrefixes;
      break;

    case "calendar":
      next.title = asString(raw.title, base.title || "calendar");
      break;

    case "pomodoro":
      next.title = asString(raw.title, base.title || "pomodoro");
      next.workMinutes = clampNumber(raw.workMinutes, 1, 180, Number(base.workMinutes) || 25);
      next.breakMinutes = clampNumber(raw.breakMinutes, 1, 60, Number(base.breakMinutes) || 5);
      next.projectFolders = asStringArray(raw.projectFolders, base.projectFolders || []);
      next.projectTags = asStringArray(raw.projectTags, base.projectTags || ["type/project"]);
      next.projectNamePrefixes = asStringArray(raw.projectNamePrefixes, base.projectNamePrefixes || ["Project_"]);
      next.areaFolders = asStringArray(raw.areaFolders, base.areaFolders || ["20_Areas"]);
      next.areaTags = asStringArray(raw.areaTags, base.areaTags || []);
      next.areaNamePrefixes = asStringArray(raw.areaNamePrefixes, base.areaNamePrefixes || ["Area_"]);
      next.taskFile = asString(raw.taskFile, base.taskFile || "10_Projects/进行中/QuickCapture.md").trim()
        || "10_Projects/进行中/QuickCapture.md";
      break;

    case "music-player":
      next.title = asString(raw.title, base.title || "music player");
      next.serviceName = asString(raw.serviceName, base.serviceName || "NetEase Cloud Music").trim() || "NetEase Cloud Music";
      next.loginUrl = asString(raw.loginUrl, base.loginUrl || "https://music.163.com/").trim() || "https://music.163.com/";
      next.playUrl = asString(raw.playUrl, base.playUrl || "https://music.163.com/").trim() || "https://music.163.com/";
      break;

    case "habits":
      next.title = asString(raw.title, base.title || "habits");
      // Transient settings field used by habits renderSettings — keep if present.
      if (typeof raw._habitList === "string") {
        next._habitList = raw._habitList;
      } else {
        delete next._habitList;
      }
      break;

    case "bookmarks": {
      next.title = asString(raw.title, base.title || "bookmarks");
      const variant = raw.variant ?? base.variant;
      next.variant = variant === "compact" ? "compact" : "grid";
      next.useFavicons = raw.useFavicons === true;
      const items = Array.isArray(raw.items) ? raw.items : base.items || [];
      next.items = items
        .map((item: LooseValue) => {
          if (!item || typeof item !== "object") return null;
          const value = asString(item.value, "").trim();
          if (!value) return null;
          return {
            label: asString(item.label, "bookmark").trim() || "bookmark",
            type: "url",
            value
          };
        })
        .filter(Boolean);
      break;
    }

    case "quick-actions": {
      next.title = asString(raw.title, base.title || "system");
      const variant = raw.variant ?? base.variant;
      next.variant = variant === "stack" ? "stack" : variant === "compact" ? "compact" : "grid";
      next.sectionTitle = asString(raw.sectionTitle, base.sectionTitle || "");
      next.secondaryTitle = asString(raw.secondaryTitle, base.secondaryTitle || "");
      const items = Array.isArray(raw.items) ? raw.items : base.items || [];
      next.items = items
        .map((item: LooseValue) => {
          if (!item || typeof item !== "object") return null;
          const actionType = QUICK_ACTION_TYPES.has(item.type) ? item.type : "command";
          return {
            label: asString(item.label, "action").trim() || "action",
            type: actionType,
            value: asString(item.value, "")
          };
        })
        .filter(Boolean);
      const secondaryItems = Array.isArray(raw.secondaryItems) ? raw.secondaryItems : base.secondaryItems || [];
      next.secondaryItems = secondaryItems
        .map((item: LooseValue) => {
          if (!item || typeof item !== "object") return null;
          const actionType = QUICK_ACTION_TYPES.has(item.type) ? item.type : "command";
          return {
            label: asString(item.label, "action").trim() || "action",
            type: actionType,
            value: asString(item.value, "")
          };
        })
        .filter(Boolean);
      break;
    }

    case "stats-overview":
      next.title = asString(raw.title, base.title || "execution pulse");
      if (next.title.trim().toLowerCase() === "execution overview") {
        next.title = "execution pulse";
      }
      delete next.metrics;
      break;

    case "time-flow":
      next.title = asString(raw.title, base.title || "time flow");
      next.recentLimit = clampNumber(raw.recentLimit, 3, 10, Number(base.recentLimit) || 6);
      break;

    case "knowledge-profile":
      next.title = asString(raw.title, base.title || "knowledge profile");
      next.projectNamePrefixes = asStringArray(
        raw.projectNamePrefixes ?? raw.projectNamePrefix,
        base.projectNamePrefixes || ["Project_"]
      );
      next.projectFolders = asStringArray(raw.projectFolders, base.projectFolders || []);
      next.projectTags = asStringArray(raw.projectTags, base.projectTags || []);
      delete next.recentLimit;
      delete next.projectNamePrefix;
      break;

    case "tech-tree":
      next.title = asString(raw.title, base.title || "tech tree");
      next.areaRoot = asString(raw.areaRoot, base.areaRoot || "").trim();
      next.projectFolders = asStringArray(raw.projectFolders ?? raw.activeProjectRoot, base.projectFolders || []);
      next.projectTags = asStringArray(raw.projectTags, base.projectTags || DEFAULT_ACTIVE_PROJECT_TAGS);
      next.projectNamePrefixes = asStringArray(
        raw.projectNamePrefixes,
        base.projectNamePrefixes || DEFAULT_PROJECT_NAME_PREFIXES
      );
      delete next.sourcePath;
      delete next.activeProjectRoot;
      break;

    case "activity-history":
      next.title = asString(raw.title, base.title || "activity history");
      next.sourcePath = asString(raw.sourcePath, base.sourcePath || "/").trim() || "/";
      next.year = /^\d{4}$/.test(asString(raw.year, base.year || "").trim())
        ? asString(raw.year, base.year || "").trim()
        : "";
      break;

    default:
      // Unknown widget types: keep object shape, coerce nothing aggressively.
      break;
  }

  return next;
}

/**
 * Type-aware state validation. Falls back field-by-field to definition.defaultState.
 */
export function validateWidgetState(type: string, state: LooseValue, defaultState: LooseValue = {}): LooseValue {
  const base = asPlainObject(defaultState, {});
  const raw = asPlainObject(state, {});

  switch (type) {
    case "focus":
      return { text: asString(raw.text, base.text || "") };

    case "pomodoro": {
      const workMinutes = 25;
      const status = POMO_STATUS.has(raw.status) ? raw.status : base.status || "idle";
      const next: LooseValue = {
        status,
        remainingSeconds: clampNumber(
          raw.remainingSeconds,
          0,
          180 * 60,
          Number(base.remainingSeconds) || workMinutes * 60
        ),
        phaseStartedAt: clampNumber(raw.phaseStartedAt, 0, Number.MAX_SAFE_INTEGER, 0),
        todayCountDate: asString(raw.todayCountDate, base.todayCountDate || ""),
        todayCount: clampNumber(raw.todayCount, 0, 9999, Number(base.todayCount) || 0)
      };
      const activeTarget = validatePomodoroTarget(raw.activeTarget);
      if (activeTarget) next.activeTarget = activeTarget;
      const recentTargets = normalizeArray(raw.recentTargets, [])
        .map((item: LooseValue) => validatePomodoroTarget(item))
        .filter(Boolean)
        .slice(0, 8);
      if (recentTargets.length) next.recentTargets = recentTargets;
      return next;
    }

    case "habits": {
      const habits = asStringArray(raw.habits, base.habits || []);
      const completionsIn = asPlainObject(raw.completions, base.completions || {});
      const completions: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(completionsIn)) {
        if (value) completions[String(key)] = true;
      }
      return { habits, completions };
    }

    default:
      // Most widgets use empty state objects — merge shallowly.
      return { ...base, ...raw };
  }
}

/**
 * Validate a full stored widget slot { config, state }.
 */
export function validateWidgetStoredData(type: string, stored: LooseValue, definition: LooseValue): LooseValue {
  const slot = asPlainObject(stored, {});
  const defaultConfig = definition ? definition.defaultConfig : {};
  const defaultState = definition ? definition.defaultState : {};
  return {
    config: validateWidgetConfig(type, slot.config, defaultConfig),
    state: validateWidgetState(type, slot.state, defaultState)
  };
}

/**
 * Validate settings object against defaults.
 */
export function validateSettings(settings: LooseValue, defaults: LooseValue): LooseValue {
  const base = asPlainObject(defaults, {});
  const raw = asPlainObject(settings, {});
  return {
    openOnStartup: typeof raw.openOnStartup === "boolean" ? raw.openOnStartup : Boolean(base.openOnStartup),
    lockHomepage: typeof raw.lockHomepage === "boolean" ? raw.lockHomepage : Boolean(base.lockHomepage),
    language: "en",
    themePreset: asString(raw.themePreset, base.themePreset || "petal"),
    accentColor: HEX_COLOR.test(asString(raw.accentColor, "")) ? asString(raw.accentColor) : asString(base.accentColor, "#f5c2e7"),
    profileName: asString(raw.profileName, base.profileName || "Your name"),
    profileSignature: asString(raw.profileSignature, base.profileSignature || "A personal Obsidian homepage"),
    obsidianStartDate: /^\d{4}-\d{2}-\d{2}$/.test(asString(raw.obsidianStartDate))
      ? asString(raw.obsidianStartDate)
      : asString(base.obsidianStartDate, ""),
    techTreeAreaRoot: asString(raw.techTreeAreaRoot, base.techTreeAreaRoot || "20_Areas"),
    techTreeActiveProjectRoot: asString(raw.techTreeActiveProjectRoot, base.techTreeActiveProjectRoot || "10_Projects/进行中")
  };
}

export function validateTimeLog(raw: LooseValue): TimeLog | null {
  const item = asPlainObject(raw, null);
  if (!item) return null;

  const source = TIME_LOG_SOURCES.has(item.source) ? item.source : null;
  const targetType = TIME_LOG_TARGET_TYPES.has(item.targetType) ? item.targetType : null;
  if (!source || !targetType) return null;

  const startTime = clampNumber(item.startTime, 0, Number.MAX_SAFE_INTEGER, 0);
  const endTime = clampNumber(item.endTime, 0, Number.MAX_SAFE_INTEGER, 0);
  if (!startTime || !endTime || endTime < startTime) return null;

  const computedDuration = Math.max(1, Math.round((endTime - startTime) / 60000));
  const duration = clampNumber(item.duration, 1, 24 * 60 * 7, computedDuration);
  const targetId = normalizeTimeTargetId(targetType, item.targetId);
  if (!targetId) return null;

  const next: TimeLog = {
    id: asString(item.id, "").trim() || `timelog-${item.createdAt || Date.now()}`,
    startTime,
    endTime,
    duration,
    source,
    targetType,
    targetId,
    createdAt: clampNumber(item.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now())
  };

  const note = asString(item.note, "").trim();
  if (note) next.note = note;

  if (TIME_LOG_ACTIVITY_TYPES.has(item.activityType)) {
    next.activityType = item.activityType;
  }

  if (targetType === "project") {
    next.projectId = targetId;
    next.projectTitle = asString(item.projectTitle, targetId).trim() || targetId;
    const areaId = asString(item.areaId, "").trim();
    if (areaId) {
      next.areaId = areaId;
      next.areaTitle = asString(item.areaTitle, areaId).trim() || areaId;
    }
  } else if (targetType === "area") {
    next.areaId = targetId;
    next.areaTitle = asString(item.areaTitle, targetId).trim() || targetId;
  } else if (targetType === "task") {
    next.taskId = targetId;
  }

  return next;
}

export function validateTimeLogs(value: LooseValue): TimeLog[] {
  return normalizeArray(value, [])
    .map((item: LooseValue) => validateTimeLog(item))
    .filter((item: TimeLog | null): item is TimeLog => Boolean(item))
    .sort((a: TimeLog, b: TimeLog) => b.startTime - a.startTime);
}

function normalizeTimeTargetId(targetType: TimeLogTargetType, value: LooseValue): string {
  if (targetType === "task") return asString(value, "QuickCapture").trim() || "QuickCapture";
  return asString(value, "").trim();
}

function validatePomodoroTarget(raw: LooseValue): LooseValue | null {
  const item = asPlainObject(raw, null);
  if (!item) return null;
  const type = TIME_LOG_TARGET_TYPES.has(item.type) ? item.type : null;
  const id = type === "task" ? asString(item.id, "QuickCapture").trim() : asString(item.id, "").trim();
  const title = type === "task" ? asString(item.title, id || "QuickCapture").trim() : asString(item.title, id).trim();
  if (!type || !id || !title) return null;
  const next: LooseValue = { type, id, title };
  if (type === "project") {
    const areaId = asString(item.areaId, "").trim();
    if (areaId) {
      next.areaId = areaId;
      next.areaTitle = asString(item.areaTitle, areaId).trim() || areaId;
    }
  }
  return next;
}

// Re-export helpers widgets may need when wiring settings patches.
export { normalizeArray, parseQuickActions };
