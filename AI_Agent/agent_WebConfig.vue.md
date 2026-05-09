# WebConfig.vue 维护说明

本文总结 [src/renderer/views/WebConfig.vue](src/renderer/views/WebConfig.vue) 的结构与方法，便于后续 AI 快速维护。

## 模块概览
- 作用：Web 配置页（多标签配置 + 运行日志 + 更新检查）。
- 技术：Vue 3 `<script setup>`，`axios` 请求，SSE 日志流。
- 右侧日志面板固定占屏幕右 1/3，日志可滚动，长日志自动换行。

## 页面结构（Template）
- 顶部标题：页面标题 + 提示文字。
- Tabs：
  - `list` 花名册导入（文本输入 + CSV/TXT 文件导入）。
  - `students` 花名册管理（权重滑条、删除、重置权重、允许重复抽取开关）。
  - `floating` 悬浮按钮配置（大小、透明度、置顶、位置）。
  - `pickCount` 抽取动画配置（BGM、抽取音效、音量、背景暗度、默认人数）。
  - `web` 系统服务（端口设置 + 更新检查卡片）。
    - 额外：管理员置顶增强开关、管理员权限申请按钮、开机计划任务配置。
- 保存按钮：提交配置。
- 右侧日志面板：
  - 标题行：运行日志 + 调试模式徽章（可选）+ 版本号（总是显示）。
  - 日志列表：SSE 实时日志 + 本地记录。

## 关键状态（Refs）
- `activeTab` / `transitionName`：控制标签页与切换动画。
- `config`：配置对象（与后端 `/api/config` 同结构）。
- `rawListText`：名单原始文本。
- `logs`：日志数组（前端聚合 + SSE）。
- `updateState`：更新检查状态（按钮状态、提示文案、链接）。
- `isDebugMode`：是否调试模式（来自 `/api/app-info`）。
- `appVersion`：当前版本号（来自 `/api/app-info`）。

## 主要方法与职责
- `switchTab(tab)`：切换标签页，设置左右滑动动画。
- `checkUpdate()`：
  - 调用 `/api/check-update` 获取更新状态。
  - 读取 `debug` 数组并写入日志。
  - 根据 `status` 更新 UI（`update` / `ok` / `easter` / `error`）。
- `addLog(level, text, timeOverride)`：写入本地日志（顶部插入 + 最多 200 条）。
- `startLogStream()`：使用 `EventSource` 连接 `/api/logs` 获取后端日志流。
- `fetchConfig()`：GET `/api/config` 初始化配置与名单文本。
- `saveConfig()`：
  - `syncTextToList()` 生成学生名单。
  - 组装 payload 并 POST `/api/config` 保存。
- `requestAdminElevation()`：请求管理员权限并重启。
- `createAdminStartupTask()`：创建/更新管理员权限开机计划任务。
- `fetchAppInfo()`：GET `/api/app-info` 获取 `isDebugMode` 与版本号。
- 名单处理：
  - `syncTextToList()`：文本解析为去重名单 + 权重。
  - `syncListToText()`：名单回写成文本。
  - `handleFileUpload()`：读取 CSV/TXT -> 文本 -> 名单。
  - `removeStudent(index)` / `resetWeights()`：名单操作。
- 数值处理：`maybeNumber(value)` 把空值变 `null`，用于位置保存。

## 后端接口依赖
- `GET /api/config`：读取配置。
- `POST /api/config`：保存配置。
- `GET /api/logs`：SSE 日志流。
- `GET /api/check-update`：更新检查。
- `GET /api/app-info`：版本号 + 调试模式。
- `POST /api/admin/elevate`：请求管理员权限并重启。
- `POST /api/task/create-admin-startup`：创建/更新管理员权限开机任务。

## 更新检查返回约定
`/api/check-update` 返回结构（简化）：
- `status`: `update` | `ok` | `easter` | `error`
- `title`: 标题文案
- `detail`: 详情文案
- `commitUrl` / `releaseUrl`: 链接
- `debug`: 诊断数组（写入日志）

## 样式关键点
- 布局：`.layout` 为 `grid`，`2fr : 1fr` 固定右侧 1/3。
- 内部滚动（左侧配置区域）：为了防止深层嵌套导致元素越界或引发整个页面的滚动，在 Tab 容器应用了严格的滚动与高度限制：
  - `.tab-container` 必须设置 `overflow-y: scroll`，以处理超出部分并在容器内部分解滚动。
  - `.tab-content` 必须设置 `height: 100%`，约束自身的高度必须遵循祖先节点分配的高度边界。
- 右侧日志：`.panel-right` 设置 `max-height`，`.log-list` 滚动。
- 长日志：`.log-text` 使用 `word-break` + `overflow-wrap`。
- 徽章：`.debug-badge`（蓝色）、`.version-badge`（浅色）。

## 关键样式命名约定
- **布局层级**：`.page` 页面背景与全局字体；`.layout` 主栅格；`.panel` 通用卡片底板；`.panel-left`/`.panel-right` 分栏容器。
- **标题与说明**：`.header`、`.hint` 负责顶部提示文字；`.desc` 用作段落说明。
- **Tab 区域**：`.tabs` 容器；`.tab-btn` 按钮；`.tab-btn.active` 激活态；`.tab-container` 过渡容器；`.tab-content` 标签内容；`.slide-left-*`/`.slide-right-*` 动画类。
- **通用排版**：`.row` 为两列输入栅格；`.inline` 为横向对齐的 label + 控件。
- **名单导入**：`.list-manager`、`.list-actions`、`.upload-btn`、`.count-badge`、`.list-textarea`。
- **名单管理表格**：`.student-manager`、`.table-wrapper`、`.student-table`、`.col-name`/`.col-weight`/`.col-action`、`.weight-slider`、`.weight-val`、`.del-svg-btn`、`.reset-btn`。
- **更新检查区**：`.update-header`、`.update-card`、`.update-row`、`.update-btn`、`.update-status`、`.update-detail`、`.update-links`。
- **状态修饰类**：
  - `.update-status.status-update|status-ok|status-easter|status-error` 控制颜色。
  - `.log-item.log-success|log-error|log-info` 控制日志条的底色。
- **日志面板**：`.log-header`、`.log-title-row`、`.log-list`、`.log-item`、`.log-time`、`.log-text`、`.log-empty`。
- **徽章类**：`.debug-badge` 与 `.version-badge` 仅用于右侧标题行的标识。
- **按钮 hover**：如需渐变平滑过渡，优先使用伪元素叠层或 `background-position` 动画，避免直接切换不同渐变。

## 维护注意事项
- 如果新增配置项，必须同时修改 `config` 默认值、`fetchConfig()` 读取、`saveConfig()` payload。
- 更新检查失败时建议保留 `debug` 输出，便于定位代理/网络问题。
- Tab 名称与 `tabs` 数组需一致，否则切换动画会错位。
