import type { App } from "obsidian";
import { SIZE_PRESETS } from "./layout/size-presets";

export type SizePresetName = keyof typeof SIZE_PRESETS;
export type WidgetShell = "text" | "panel" | "strip" | "canvas";

export type WidgetLayoutItem = {
  id: string;
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  sizePreset: SizePresetName | string;
};

export type HomepageSettings = {
  openOnStartup: boolean;
  lockHomepage: boolean;
  language: "zh-CN" | "en";
  themePreset: string;
  accentColorMode: "theme" | "custom";
  accentColor: string;
  profileName: string;
  profileSignature: string;
  obsidianStartDate: string;
  techTreeAreaRoot: string;
  techTreeActiveProjectRoot: string;
};

export type HomepageLayout = {
  columns: number;
  widgets: WidgetLayoutItem[];
};

export type HomepageLayoutPreset = {
  id: string;
  name: string;
  layout: HomepageLayout;
  isBuiltIn?: boolean;
  updatedAt?: number;
};

export type WidgetStoredData<
  Config extends Record<string, unknown> = Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>
> = {
  config: Config;
  state: State;
};

export type TimeLogSource = "pomodoro" | "manual";
export type TimeLogTargetType = "project" | "area" | "task" | "quick";
export type TimeLogActivityType =
  | "work"
  | "learning"
  | "creative"
  | "exercise"
  | "reading"
  | "travel"
  | "other";

export type TimeLog = {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  source: TimeLogSource;
  targetType: TimeLogTargetType;
  targetId: string;
  projectId?: string;
  projectTitle?: string;
  areaId?: string;
  areaTitle?: string;
  taskId?: string;
  activityType?: TimeLogActivityType;
  note?: string;
  createdAt: number;
};

export type PluginData = {
  schemaVersion: number;
  /** false on first run; set to true after SetupWizardModal completes */
  initialized: boolean;
  settings: HomepageSettings;
  layout: HomepageLayout;
  defaultLayout?: HomepageLayout;
  layoutPresets?: HomepageLayoutPreset[];
  defaultLayoutPresetId?: string;
  widgets: Record<string, WidgetStoredData>;
  timeLogs: TimeLog[];
};

export type WidgetDefinition = {
  type: string;
  displayName: string;
  shell: WidgetShell;
  allowedSizes: string[];
  defaultSize: SizePresetName | string;
  defaultConfig: Record<string, unknown>;
  defaultState: Record<string, unknown>;
  render: (api: Record<string, LooseValue>, containerEl: HTMLElement) => void | Promise<void>;
  renderSettings?: (api: {
    app: App;
    containerEl: HTMLElement;
    draft: Record<string, LooseValue>;
    updateDraft: (patch: Record<string, LooseValue>) => void;
  }) => void;
};

export type DefinitionResolver = (type: string) => WidgetDefinition | undefined;
