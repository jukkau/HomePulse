# 开发项目 AI Context

## Obsidian 任务项目

- 任务项目文件夹：D:\Documents\97-坚果云同步\Obsidian_note_2026\10_Projects\Project_2607_Yuki首页组件化
- 主要读取文档：Project_2607_HomePulse.md、项目治理/HomePulse_变更记录.md
- 持续回写文档：AI_Context.md、Project_2607_HomePulse.md、项目治理/HomePulse_变更记录.md

## 当前开发状态

- 当前目标：为番茄钟增加系统级、Obsidian 内提醒、全局状态栏倒计时与安全的目标切换。
- 当前阶段：实现完成，待自动验证与 Obsidian 真实提醒验收。
- 最近完成：System actions 参考 cMenu 改为“加号 → Obsidian 原生命令选择器 → 已选列表”交互：配置页不再常驻搜索结果，已选项可拖拽排序、Alt + 上/下调整，右侧单一删除；Knowledge Profile 多尺寸适配保持有效。主题色与列表左侧竖线均未改动。
- 本轮实现：开始番茄钟时请求系统通知权限；专注完成进入休息、休息结束回到待开始时，各发送一次 Windows 系统通知和持续 10 秒的 Obsidian Notice。设置弹窗新增“测试提醒”，可即时验证权限和两类提醒。刷新过程互斥，避免保存较慢时重复提醒。
- 状态栏：在 Obsidian 窗口底部显示当前番茄钟阶段与剩余时间，每秒更新；点击或按 Enter/Space 可打开 HomePulse。
- 目标切换：目标名称右侧增加切换按钮；空闲、暂停或休息时可重选项目、领域、任务或临时目标，专注运行中提示先暂停。加号继续用于手动补录，重置继续用于清空本轮。
- 当前阻塞：无；新增任务功能按用户要求暂缓。
- 下一步：重载 HomePulse，允许系统通知权限；用短时长验证专注完成和休息结束各出现一次 Windows 通知与 Obsidian Notice。

## 开发约定

- 重点模块：src/widgets/tasks.ts、src/services/snapshot-builder.ts、src/widgets/quick-actions.ts、src/widgets/time-flow.ts、scripts/smoke-entry.ts。
- 禁止修改区域：任务新增流程；本轮不改变任务来源与项目筛选规则，保留既有 System actions 数据格式。
- 测试命令：npm run check、npm run smoke、npm run build、git diff --check。
- 构建或部署方式：npm run build；在 Obsidian 中重载 HomePulse 插件进行界面验收。

## 待回写 Obsidian

- [x] 记录 Tasks 就地完成和 System actions 命令选择的实现范围、验证结果与真实 Obsidian 验收事项。
