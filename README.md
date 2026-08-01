# HomePulse

HomePulse 是一个本地优先的 Obsidian 首页插件，用一个可拖拽、可调整大小、可响应式适配的 Dashboard，把今日目标、时间投入、执行状态、知识资产、文件活跃度和能力地图集中到一个首页里。

![Homepage](docs/images/homepage.png)

**语言 / Language**：默认中文。点击下方 **English** 可展开英文说明。

<details>
<summary><strong>English</strong></summary>

HomePulse is a local-first Obsidian homepage plugin that brings focus, time flow, execution pulse, knowledge profile, activity heatmap, and a capability map into one cohesive dashboard. It uses a draggable grid layout with responsive compact reflow for both 14-inch laptops and widescreen displays.

</details>

## 适合谁

HomePulse 适合希望把 Obsidian 用作个人知识执行系统的用户：不仅展示信息，也帮助你看到当前在推进什么、时间投向哪里、哪些项目和能力正在形成。

<details>
<summary><strong>English</strong></summary>

HomePulse is for users who want Obsidian to act as a personal knowledge execution system: not only showing information, but also helping you see what you are moving forward, where your time goes, and which projects and capabilities are forming.

</details>

## 主要功能

- **可编辑网格布局**：支持拖拽、调整大小和多列布局；普通查看时会根据屏幕宽度自动压缩，编辑模式下保持当前布局列数。
- **多套布局保存**：可以保存不同命名布局，并为每套布局设置列数，适合在不同设备或使用场景之间切换。
- **Header settings**：首页工具栏中提供 Header settings，可配置用户名、签名、首页锁定、Obsidian 使用起始日和主题强调色。
- **首页视图**：注册为独立 Obsidian View，可固定为首页标签页，并可在启动时自动打开。
- **首次设置向导**：首次启动时引导配置首页名称、项目目录、Area 目录和默认组件。
- **本地优先**：核心数据来自本地 Markdown、frontmatter、任务 checkbox、文件修改时间和插件数据文件。

<details>
<summary><strong>English</strong></summary>

- **Editable Grid Layout**: Drag, resize, and arrange widgets in a responsive multi-column grid.
- **Named Layout Presets**: Save different homepage layouts, name them, set their column count, and switch between devices or work modes.
- **Header Settings**: Configure homepage identity, lock behavior, Obsidian start date, and theme accent color from the homepage toolbar.
- **Homepage View**: Register a custom Obsidian view as your homepage, pin it as a persistent tab, and auto-open on startup.
- **First-Run Setup Wizard**: Configure homepage name, project folder, area folder, and widget toggles on first launch.
- **Local First**: Core data comes from local Markdown, frontmatter, task checkboxes, file modification times, and the plugin data file.

</details>

## 组件

| 组件 | 说明 |
|---|---|
| **Focus / Today's goal** | 今日目标输入 |
| **Projects** | 从配置的文件夹、标签和文件名前缀中读取活跃项目 |
| **Tasks** | 汇总 Vault Markdown 文件中的任务 checkbox |
| **Calendar** | 内置日历视图 |
| **Habits** | 习惯追踪与 streak 展示 |
| **Pomodoro** | 番茄钟计时，支持归因到 Project、Area、Task Pool 或 Quick target，并写入本地 TimeLog |
| **Music Player** | 打开配置的音乐服务登录页或播放页 |
| **Bookmarks** | 支持 `label|url` 或单行 URL 的快捷书签 |
| **System** | 支持命令和 Daily Note 等快捷动作 |
| **Activity History** | 基于 Vault 文件修改时间生成活跃热力图 |
| **Tech Tree** | 基于 Value -> Area -> Project 关系生成能力地图 |
| **Execution Pulse** | 汇总习惯、Focus、知识增长和任务状态，反馈近期执行情况 |
| **Knowledge Profile** | 展示笔记、Area、项目和标签等知识资产概览 |
| **Recent Notes** | 展示最近更新的笔记 |

<details>
<summary><strong>English</strong></summary>

| Widget | Description |
|---|---|
| **Focus / Today's goal** | Daily focus / intention input |
| **Projects** | Active projects from configurable folders, tags, and filename prefixes |
| **Tasks** | Aggregated tasks from vault markdown files |
| **Calendar** | Inline calendar view |
| **Habits** | Habit tracker with streak visualization |
| **Pomodoro** | Built-in pomodoro timer with Project, Area, Task Pool, or Quick target attribution and a local TimeLog |
| **Music Player** | Opens a configured music service login or playback page |
| **Bookmarks** | Configurable URL bookmarks using `label|url` entries or direct URL lines |
| **System** | Configurable commands and daily-note shortcuts |
| **Activity History** | Activity heatmap from vault file modification timestamps |
| **Tech Tree** | Capability map generated from Value -> Area -> Project relationships |
| **Execution Pulse** | Recent personal-system running status across habits, focus, knowledge growth, and tasks |
| **Knowledge Profile** | Knowledge asset totals for notes, Areas, projects, and tags |
| **Recent Notes** | Recently updated notes from the vault |

</details>

## 时间流

HomePulse 内置本地 TimeLog 记录层，不依赖外部服务。

- Pomodoro 完成的专注时间可以归因到 Project、Area、Task Pool 或 Quick target。
- 可以从 Pomodoro 组件手动补录时间。
- 可以查看和删除最近的 TimeLog 记录。
- 当存在 TimeLog 数据时，Execution Pulse 会优先使用时间聚合结果计算 Focus 指标。
- Activity History 仍然只负责文件活跃热力图，不承担 TimeLog 管理入口。

<details>
<summary><strong>English</strong></summary>

HomePulse includes a local TimeLog layer for tracking focused time without external services.

- Pomodoro sessions can be assigned to a Project, Area, Task Pool, or Quick target.
- Manual time entries can be recorded from the Pomodoro widget.
- Recent TimeLog entries can be reviewed and deleted from the Pomodoro log button.
- Execution Pulse uses TimeLog aggregation for the Focus metric when time records are available.
- Activity History remains a file-activity heatmap and does not manage TimeLog records.

</details>

## 默认布局

默认首页布局包含：

- **Today's goal**、**Knowledge Profile**、**Music Player**
- **Habits**、**Pomodoro**、**Tasks**、**Calendar**
- **Execution Pulse**、**Bookmarks**
- **Tech Tree**、**Projects**、**Recent Notes**、**System**
- **Activity History**

首页编辑工具栏包含：

- **Header settings**：配置首页身份信息、锁定、使用起始日和主题色
- **Add widget**：添加组件
- **Manage layouts**：保存、加载和删除命名布局，并设置布局列数

<details>
<summary><strong>English</strong></summary>

The default homepage layout includes:

- **Today's goal**, **Knowledge Profile**, and **Music Player**
- **Habits**, **Pomodoro**, **Tasks**, and **Calendar**
- **Execution Pulse** and **Bookmarks**
- **Tech Tree**, **Projects**, **Recent Notes**, and **System**
- **Activity History**

The editing toolbar includes:

- **Header settings**: Configure homepage identity, lock behavior, start date, and theme color
- **Add widget**: Add widgets
- **Manage layouts**: Save, load, and delete named layouts and set layout columns

</details>

## 依赖和隐私

HomePulse 不依赖其他 Obsidian 社区插件。Dashboard 数据主要来自本地 Markdown 文件、frontmatter、任务 checkbox 和文件修改时间。

| 插件 | 是否需要 | 使用场景 |
|---|---|---|
| **Daily Notes** | 可选核心插件 | 仅当 System 项使用 `daily-note` 动作时需要；未启用时只有该按钮不可用。 |
| **QuickAdd** | 可选社区插件 | 仅当你配置 `quickadd:runQuickAdd` 等 System 命令时需要；公开默认配置不包含它。 |
| **cMenu** | 不需要 | HomePulse 没有 cMenu 集成或依赖。 |

- 核心 Dashboard 数据不会上传。
- 书签 favicon 和外部音乐链接只有在启用或打开时，才可能访问对应第三方服务。
- 文件扫描仅用于生成 Dashboard 数据，包括项目、任务、能力地图、活跃热力图和 Time Flow 目标。
- TimeLog 记录保存在本地插件数据文件中。
- `data.json` 会保存个人配置、习惯记录、TimeLog 和 Vault 路径，已通过 `.gitignore` 排除，不应提交到版本库。

<details>
<summary><strong>English</strong></summary>

HomePulse is self-contained and does not require any community plugin. Dashboard data is read directly from your local markdown files, including task checkboxes, frontmatter metadata, and file timestamps.

| Plugin | Requirement | When it is used |
|---|---|---|
| **Daily Notes** | Optional core plugin | Required only when a System item uses the `daily-note` action. Without it, only that button is unavailable. |
| **QuickAdd** | Optional community plugin | Required only when you configure a System command such as `quickadd:runQuickAdd`. It is not included in the public defaults. |
| **cMenu** | Not required | HomePulse has no cMenu integration or dependency. |

- Core dashboard data stays local and no files are uploaded.
- Optional bookmark favicons and external music links may contact the configured third-party service only when you enable or open them.
- File scanning is limited to generating dashboard data, including projects, tasks, capability map, activity heatmap, and Time Flow targets.
- TimeLog records are stored locally in the plugin data file.
- `data.json` stores personal dashboard configuration, habit records, time logs, and vault paths. It is excluded from version control via `.gitignore`.

</details>

## 安装

### 从 Obsidian 社区插件安装

1. 打开 Obsidian -> Settings -> Community Plugins
2. 搜索 "HomePulse"
3. 安装并启用

### 手动安装

复制本目录到你的 Vault：

```text
.obsidian/plugins/homepulse/
```

然后在 Settings -> Community Plugins 中启用 **HomePulse**。

<details>
<summary><strong>English</strong></summary>

### From Obsidian Community Plugins

1. Open Obsidian -> Settings -> Community Plugins
2. Search for "HomePulse"
3. Install and enable

### Manual

Copy this directory into your vault:

```text
.obsidian/plugins/homepulse/
```

Then enable **HomePulse** in Settings -> Community Plugins.

</details>

## 配置

插件设置页和首页内设置入口支持配置：

- 首页名称 / 用户名
- 项目文件夹
- Area 文件夹
- Time Flow 数据来源
- Tech Tree 数据来源
- Activity History 数据来源
- Music Player URL
- Bookmarks
- System Actions
- Widget 开关
- Layout Presets
- Theme Color

### Tech Tree 元数据

Area notes 会从配置的 Area 文件夹中发现。带有 `value/*` 标签的笔记会被纳入能力地图，`type: area` 是可选项：

```yaml
tags:
  - value/understanding-the-world
```

Projects 通过 frontmatter 关联 Areas：

```yaml
area:
  - "[[20_Areas/Area_Learning|Learning]]"
tags: [type/project, status/ing]
```

Daily notes、任务文件和单输出笔记会从能力地图中排除。

### Time Flow 目标

- Project targets 来自项目笔记，并使用项目标题作为稳定 target id。
- 如果项目笔记在 frontmatter 中链接到 Area，时间记录可以聚合到该 Area。
- Area targets 来自 Area notes。
- Task Pool targets 指向一个配置的 Markdown 文件，用作松散任务池上下文，不追踪单个 checkbox。
- Quick targets 可直接输入，用于不属于已知 Project、Area 或 Task Pool 的时间记录。

<details>
<summary><strong>English</strong></summary>

Plugin settings allow you to customize:

- Homepage Name / Username
- Project Folder
- Area Folder
- Time Flow Sources
- Tech Tree Source
- Activity History Source
- Music Player URL
- Bookmarks
- System Actions
- Widget Toggles
- Layout Presets
- Theme Color

### Tech Tree Metadata

Area notes are discovered from the configured Area folder. Every note with a `value/*` tag is included; `type: area` is optional:

```yaml
tags:
  - value/understanding-the-world
```

Projects link to Areas via frontmatter:

```yaml
area:
  - "[[20_Areas/Area_Learning|Learning]]"
tags: [type/project, status/ing]
```

Daily notes, task files, and single-output notes are excluded from the capability map.

### Time Flow Targets

- Project targets come from project notes and use the project title as the stable target id.
- If a project note links to an Area in frontmatter, the time record can be aggregated into that Area.
- Area targets come from Area notes.
- Task Pool targets point to a configured markdown file and are used for loose task-count context, not individual checkbox-level tracking.
- Quick targets can be entered directly when a time entry does not belong to a known Project, Area, or Task Pool.

</details>

## 开发

```bash
npm install
npm run dev        # watch + dev build
npm run check      # type-check
npm run smoke      # smoke test
npm run build      # production build
```

<details>
<summary><strong>English</strong></summary>

```bash
npm install
npm run dev        # watch + dev build
npm run check      # type-check
npm run smoke      # smoke test
npm run build      # production build
```

</details>

## 致谢

- 视觉设计参考了 **InlitX** 的 **Dashboard-Komorebi.css**（Komorebi / Catppuccin 风格）。完整说明见 [docs/UI-Credits.md](docs/UI-Credits.md)。

<details>
<summary><strong>English</strong></summary>

- Visual design inspired by **Dashboard-Komorebi.css** (Komorebi / Catppuccin style) by **InlitX**. See [docs/UI-Credits.md](docs/UI-Credits.md) for full attribution.

</details>

## 路线图

- [x] 支持可拖拽、可调整大小的网格布局
- [x] 完成组件体系（Focus、Projects、Tasks、Calendar、Habits、Pomodoro、Music Player、Bookmarks、System、Activity History、Tech Tree、Execution Pulse、Knowledge Profile、Recent Notes）
- [x] 完成首次设置向导
- [x] 支持 TypeScript strict mode
- [x] 完成 GitHub Actions 发布流程和 artifact attestation
- [x] 完成 Time Flow MVP，支持 Pomodoro 归因、手动记录和本地日志删除
- [ ] 增加更多主题适配
- [ ] 增强 Widget 配置能力
- [ ] 基于聚合时间记录建设 Capability Growth

<details>
<summary><strong>English</strong></summary>

- [x] Grid layout with drag & resize
- [x] Widget system (Focus, Projects, Tasks, Calendar, Habits, Pomodoro, Music Player, Bookmarks, System, Activity History, Tech Tree, Execution Pulse, Knowledge Profile, Recent Notes)
- [x] First-run setup wizard
- [x] TypeScript strict mode
- [x] GitHub Actions release workflow with artifact attestation
- [x] Time Flow MVP with Pomodoro attribution, manual records, and local log deletion
- [ ] More theme adaptations
- [ ] Widget configuration enhancements
- [ ] Capability Growth from aggregated time records

</details>

## License

MIT License. See [LICENSE](LICENSE).
