# 开发项目 AI Context

## Obsidian 任务项目

- 任务项目文件夹：D:\Documents\97-坚果云同步\Obsidian_note_2026\10_Projects\Project_2607_Yuki首页组件化
- 主要读取文档：Project_2607_HomePulse.md、项目治理/HomePulse_变更记录.md
- 持续回写文档：AI_Context.md、Project_2607_HomePulse.md、项目治理/HomePulse_变更记录.md

## 当前开发状态

- 当前目标：在不改变主题色、保留列表左侧竖线强调的前提下，收口工作台交互与配置界面的可读性、响应式和可访问性。
- 当前阶段：实现和自动验证完成，待 Obsidian 真实界面验收。
- 最近完成：System actions 参考 cMenu 改为“加号 → Obsidian 原生命令选择器 → 已选列表”交互：配置页不再常驻搜索结果，已选项可拖拽排序、Alt + 上/下调整，右侧单一删除；Knowledge Profile 多尺寸适配保持有效。主题色与列表左侧竖线均未改动。
- 当前阻塞：无；新增任务功能按用户要求暂缓。
- 下一步：重载 HomePulse，验证 System 的加号选择器、拖拽排序、Alt + 上/下和删除；再验证 Knowledge Profile 的 W1H2、W2H2、W3H1、W4H2 尺寸。新增任务仍暂缓。

## 开发约定

- 重点模块：src/widgets/tasks.ts、src/services/snapshot-builder.ts、src/widgets/quick-actions.ts、src/widgets/time-flow.ts、scripts/smoke-entry.ts。
- 禁止修改区域：任务新增流程；本轮不改变任务来源与项目筛选规则，保留既有 System actions 数据格式。
- 测试命令：npm run check、npm run smoke、npm run build、git diff --check。
- 构建或部署方式：npm run build；在 Obsidian 中重载 HomePulse 插件进行界面验收。

## 待回写 Obsidian

- [x] 记录 Tasks 就地完成和 System actions 命令选择的实现范围、验证结果与真实 Obsidian 验收事项。
