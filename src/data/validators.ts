/* eslint-disable @typescript-eslint/no-explicit-any */

// Migration note: minimal validation for widget config/state and layout items.
// Invalid values fall back to defaults; never throw — one bad widget must not crash the homepage.

import { parseQuickActions, normalizeArray } from "../widgets/widget-api";
import { isKnownSizePreset } from "../layout/size-presets";

const POMO_STATUS = new Set(["idle", "running", "paused", "break"]);
const QUICK_ACTION_TYPES = new Set(["command", "url", "daily-note"]);

export function clampNumber(value: any, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function asString(value: any, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

export function asStringArray(value: any, fallback: any = []): string[] {
  if (!Array.isArray(value)) return Array.isArray(fallback) ? fallback.slice() : [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function asPlainObject(value: any, fallback: any = {}): any {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return fallback && typeof fallback === "object" ? { ...fallback } : {};
}

/**
 * Validate a single layout widget entry. Returns a cleaned partial or null if unusable.
 */
export function validateLayoutWidget(widget: any): any {
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
export function validateWidgetConfig(type: string, config: any, defaultConfig: any = {}): any {
  const base = asPlainObject(defaultConfig, {});
  const raw = asPlainObject(config, {});
  const next = { ...base, ...raw };

  switch (type) {
    case "focus":
      next.title = asString(raw.title, base.title || "today's goal");
      next.placeholder = asString(raw.placeholder, base.placeholder || "");
      break;

    case "projects":
    case "tasks":
      next.title = asString(raw.title, base.title || type);
      next.folders = asStringArray(raw.folders, base.folders || []);
      next.limit = clampNumber(raw.limit, 1, 200, Number(base.limit) || 10);
      break;

    case "calendar":
      next.title = asString(raw.title, base.title || "calendar");
      break;

    case "pomodoro":
      next.title = asString(raw.title, base.title || "pomodoro");
      next.workMinutes = clampNumber(raw.workMinutes, 1, 180, Number(base.workMinutes) || 25);
      next.breakMinutes = clampNumber(raw.breakMinutes, 1, 60, Number(base.breakMinutes) || 5);
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
        .map((item: any) => {
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
        .map((item: any) => {
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
        .map((item: any) => {
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
      next.sourcePath = asString(raw.sourcePath, base.sourcePath || "").trim();
      break;

    case "activity-history":
      next.title = asString(raw.title, base.title || "activity history");
      next.sourcePath = asString(raw.sourcePath, base.sourcePath || "/").trim() || "/";
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
export function validateWidgetState(type: string, state: any, defaultState: any = {}): any {
  const base = asPlainObject(defaultState, {});
  const raw = asPlainObject(state, {});

  switch (type) {
    case "focus":
      return { text: asString(raw.text, base.text || "") };

    case "pomodoro": {
      const workMinutes = 25;
      const status = POMO_STATUS.has(raw.status) ? raw.status : base.status || "idle";
      return {
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
export function validateWidgetStoredData(type: string, stored: any, definition: any): any {
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
export function validateSettings(settings: any, defaults: any): any {
  const base = asPlainObject(defaults, {});
  const raw = asPlainObject(settings, {});
  return {
    openOnStartup: typeof raw.openOnStartup === "boolean" ? raw.openOnStartup : Boolean(base.openOnStartup),
    lockHomepage: typeof raw.lockHomepage === "boolean" ? raw.lockHomepage : Boolean(base.lockHomepage),
    themePreset: asString(raw.themePreset, base.themePreset || "petal"),
    profileName: asString(raw.profileName, base.profileName || "Your name"),
    profileSignature: asString(raw.profileSignature, base.profileSignature || "A personal Obsidian homepage"),
    obsidianStartDate: /^\d{4}-\d{2}-\d{2}$/.test(asString(raw.obsidianStartDate))
      ? asString(raw.obsidianStartDate)
      : asString(base.obsidianStartDate, ""),
    techTreeSource: asString(raw.techTreeSource, base.techTreeSource || ""),
    techTreeAreaRoot: asString(raw.techTreeAreaRoot, base.techTreeAreaRoot || "20_Areas"),
    techTreeActiveProjectRoot: asString(raw.techTreeActiveProjectRoot, base.techTreeActiveProjectRoot || "10_Projects/进行中")
  };
}

// Re-export helpers widgets may need when wiring settings patches.
export { normalizeArray, parseQuickActions };
