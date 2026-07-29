export type HomepageLanguage = "zh-CN" | "en";

const TEXT: Record<HomepageLanguage, Record<string, string>> = {
  "zh-CN": {
    language: "语言",
    languageDesc: "选择 HomePulse 的界面语言。",
    simplifiedChinese: "简体中文",
    english: "English",
    manageLayouts: "管理布局",
    manageLayoutsDesc: "为不同设备或工作模式保存、加载和删除布局。",
    nameThisLayout: "输入名称以保存当前布局...",
    save: "保存",
    load: "加载",
    current: "使用中",
    columnsShort: "{count} 列",
    columns: "{count} 列",
    modified: "修改于 {time}",
    justNow: "刚刚",
    minutesAgo: "{count} 分钟前",
    hoursAgo: "{count} 小时前",
    daysAgo: "{count} 天前",
    yearsAgo: "{count} 年前",
    layoutSaved: "布局已保存：{name}。",
    layoutLoaded: "布局已加载：{name}。",
    layoutDeleted: "布局已删除：{name}。",
    addWidget: "添加组件",
    layoutEditing: "布局编辑 · {count} 列",
    layoutEditingResize: "布局编辑 · {count} 列 · 放大窗口后可拖拽",
    open: "打开",
    recordTime: "记录时间",
    recordTimeDesc: "手动补录一条 Time Flow 时间记录。",
    project: "项目",
    area: "领域",
    task: "任务",
    taskPool: "任务池",
    quickTarget: "快速目标...",
    use: "使用",
    mode: "模式",
    duration: "时长",
    timeRange: "时间范围",
    durationExamples: "例如：45m、2h 30m，或直接输入分钟数。",
    start: "开始",
    end: "结束",
    note: "备注",
    cancel: "取消",
    chooseTargetFirst: "请先选择目标。",
    enterValidDuration: "请输入有效时长。",
    enterValidTimeRange: "请输入有效时间范围。"
  },
  en: {
    language: "Language",
    languageDesc: "Choose the HomePulse interface language.",
    simplifiedChinese: "简体中文",
    english: "English",
    manageLayouts: "Manage layouts",
    manageLayoutsDesc: "Save, load, and delete layout presets for different devices or work modes.",
    nameThisLayout: "Name this layout...",
    save: "Save",
    load: "Load",
    current: "Current",
    columnsShort: "{count} cols",
    columns: "{count} columns",
    modified: "modified {time}",
    justNow: "just now",
    minutesAgo: "{count} minutes ago",
    hoursAgo: "{count} hours ago",
    daysAgo: "{count} days ago",
    yearsAgo: "{count} years ago",
    layoutSaved: "HomePulse layout saved: {name}.",
    layoutLoaded: "HomePulse layout loaded: {name}.",
    layoutDeleted: "HomePulse layout deleted: {name}.",
    addWidget: "Add widget",
    layoutEditing: "layout editing · {count} columns",
    layoutEditingResize: "layout editing · {count} columns · resize window to drag",
    open: "Open",
    recordTime: "Record time",
    recordTimeDesc: "Add a manual time entry to Time Flow.",
    project: "Project",
    area: "Area",
    task: "Task",
    taskPool: "task pool",
    quickTarget: "Quick target...",
    use: "Use",
    mode: "Mode",
    duration: "Duration",
    timeRange: "Time range",
    durationExamples: "Examples: 45m, 2h 30m, or plain minutes.",
    start: "Start",
    end: "End",
    note: "Note",
    cancel: "Cancel",
    chooseTargetFirst: "Choose a target first.",
    enterValidDuration: "Enter a valid duration.",
    enterValidTimeRange: "Enter a valid time range."
  }
};

export function normalizeLanguage(value: unknown): HomepageLanguage {
  return value === "en" ? "en" : "zh-CN";
}

export function t(language: unknown, key: string, vars: Record<string, string | number> = {}): string {
  const table = TEXT[normalizeLanguage(language)];
  const fallback = TEXT.en[key] || key;
  let text = table[key] || fallback;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
  }
  return text;
}
