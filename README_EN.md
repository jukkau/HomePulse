# HomePulse

<p align="center">
  <a href="./README.md">中文</a> · <strong>English</strong>
</p>

HomePulse is a local-first Obsidian homepage plugin that brings focus, time flow, execution pulse, knowledge profile, activity heatmap, and a capability map into one cohesive dashboard. It uses a draggable grid layout with responsive compact reflow for both 14-inch laptops and widescreen displays.

![Homepage](docs/images/homepage.png)

## Who It Is For

HomePulse is for users who want Obsidian to act as a personal knowledge execution system: not only showing information, but also helping you see what you are moving forward, where your time goes, and which projects and capabilities are forming.

## Features

- **Editable Grid Layout**: Drag, resize, and arrange widgets in a responsive multi-column grid.
- **Named Layout Presets**: Save different homepage layouts, name them, set their column count, and switch between devices or work modes.
- **Header Settings**: Configure homepage identity, lock behavior, Obsidian start date, and theme accent color from the homepage toolbar.
- **Homepage View**: Register a custom Obsidian view as your homepage, pin it as a persistent tab, and auto-open on startup.
- **First-Run Setup Wizard**: Configure homepage name, project folder, area folder, and widget toggles on first launch.
- **Local First**: Core data comes from local Markdown, frontmatter, task checkboxes, file modification times, and the plugin data file.

## Widgets

| Widget | Description |
|---|---|
| **Focus / Today's goal** | Daily focus / intention input |
| **Projects** | Active projects from configurable folders, tags, and filename prefixes |
| **Tasks** | Aggregated tasks from vault Markdown files |
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

## Time Flow

HomePulse includes a local TimeLog layer for tracking focused time without external services.

- Pomodoro sessions can be assigned to a Project, Area, Task Pool, or Quick target.
- Manual time entries can be recorded from the Pomodoro widget.
- Recent TimeLog entries can be reviewed and deleted from the Pomodoro log button.
- Execution Pulse uses TimeLog aggregation for the Focus metric when time records are available.
- Activity History remains a file-activity heatmap and does not manage TimeLog records.

## Default Layout

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

## Dependencies and Privacy

HomePulse is self-contained and does not require any community plugin. Dashboard data is read directly from your local Markdown files, including task checkboxes, frontmatter metadata, and file timestamps.

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

## Installation

### From Obsidian Community Plugins

1. Open Obsidian -> Settings -> Community Plugins
2. Search for "HomePulse"
3. Install and enable

### Manual Installation

Copy this directory into your vault:

```text
.obsidian/plugins/homepulse/
```

Then enable **HomePulse** in Settings -> Community Plugins.

## Configuration

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
- Task Pool targets point to a configured Markdown file and are used for loose task-count context, not individual checkbox-level tracking.
- Quick targets can be entered directly when a time entry does not belong to a known Project, Area, or Task Pool.

## Development

```bash
npm install
npm run dev        # watch + dev build
npm run check      # type-check
npm run smoke      # smoke test
npm run build      # production build
```

## Credits

- Visual design inspired by **Dashboard-Komorebi.css** (Komorebi / Catppuccin style) by **InlitX**. See [docs/UI-Credits.md](docs/UI-Credits.md) for full attribution.

## Roadmap

- [x] Grid layout with drag & resize
- [x] Widget system (Focus, Projects, Tasks, Calendar, Habits, Pomodoro, Music Player, Bookmarks, System, Activity History, Tech Tree, Execution Pulse, Knowledge Profile, Recent Notes)
- [x] First-run setup wizard
- [x] TypeScript strict mode
- [x] GitHub Actions release workflow with artifact attestation
- [x] Time Flow MVP with Pomodoro attribution, manual records, and local log deletion
- [ ] More theme adaptations
- [ ] Widget configuration enhancements
- [ ] Capability Growth from aggregated time records

## License

MIT License. See [LICENSE](LICENSE).
