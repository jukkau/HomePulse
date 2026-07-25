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
  themePreset: string;
  profileName: string;
  profileSignature: string;
  obsidianStartDate: string;
  techTreeSource: string;
  techTreeAreaRoot: string;
  techTreeActiveProjectRoot: string;
};

export type HomepageLayout = {
  columns: number;
  widgets: WidgetLayoutItem[];
};

export type WidgetStoredData<
  Config extends Record<string, unknown> = Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>
> = {
  config: Config;
  state: State;
};

export type PluginData = {
  schemaVersion: number;
  /** false on first run; set to true after SetupWizardModal completes */
  initialized: boolean;
  settings: HomepageSettings;
  layout: HomepageLayout;
  defaultLayout?: HomepageLayout;
  widgets: Record<string, WidgetStoredData>;
};

export type WidgetDefinition = {
  type: string;
  displayName: string;
  shell: WidgetShell;
  allowedSizes: string[];
  defaultSize: SizePresetName | string;
  defaultConfig: Record<string, unknown>;
  defaultState: Record<string, unknown>;
  render: (api: Record<string, any>, containerEl: HTMLElement) => void | Promise<void>;
  renderSettings?: (api: {
    app: App;
    containerEl: HTMLElement;
    draft: Record<string, any>;
    updateDraft: (patch: Record<string, any>) => void;
  }) => void;
};

export type DefinitionResolver = (type: string) => WidgetDefinition | undefined;
