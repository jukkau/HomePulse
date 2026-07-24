# Yuki Homepage

一个面向 Obsidian 的本地首页插件。它提供可调整的仪表盘组件，让任务、日历、习惯、番茄钟、活动热力图和能力地图在一个视图中协作。

## 功能

- 可编辑的网格布局，并针对 14 寸笔记本与宽屏进行响应式紧凑重排。
- Focus、Tasks、Habits、Pomodoro、Calendar、Activity History、Quick Actions 等首页组件。
- 侧边栏首页入口；可设为启动时打开，并可锁定为固定标签页。
- 自动生成能力地图：`Value → Area → Project`，从 Area 元数据与项目的 `area` 关联读取层级。
- 项目位于 `10_Projects/进行中`，或同时带有 `type/project`、`status/ing` 标签时，会显示在能力地图中。

## 配置

插件设置中可修改首页名称、能力地图来源、Area 文件夹和活跃项目文件夹。Quick Actions 组件的设置支持按 `label|type|value` 编辑链接、Obsidian 命令和每日笔记入口；新安装不会预置个人 AI 服务链接。

## 安装

将本目录放到 Obsidian Vault 的：

```text
.obsidian/plugins/yuki-homepage/
```

然后在 Obsidian 的“第三方插件”中启用 **Yuki Homepage**。

## 开发

```bash
npm install
npm run dev
```

验证与生产构建：

```bash
npm run check
npm run smoke
npm run build
```

## 能力地图元数据

Area 需要位于 `20_Areas`，并带有 `type: area` 和一个 `value/*` 标签：

```yaml
type: area
tags:
  - value/理解世界
```

项目通过 `area` 关联 Area：

```yaml
area:
  - "[[20_Areas/Area_学习与知识管理|学习与知识管理]]"
tags: [type/project, status/ing]
```

Daily、Task 与单篇输出不会进入能力地图。

## 隐私

`data.json` 保存个人首页配置、习惯记录与本地库路径，已被 `.gitignore` 排除。请不要提交自己的插件数据、Vault 内容、令牌或密钥。

## License

UNLICENSED。发布前请根据实际开源意图补充许可证。
