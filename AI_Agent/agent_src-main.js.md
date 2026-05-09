# src/main/main.js 维护说明

本文总结 [src/main/main.js](src/main/main.js) 的结构、模块与逻辑，便于后续 AI 维护。

## 模块概览
- 作用：Electron 主进程入口，负责配置管理、窗口生命周期、托盘、日志流、更新检查与 IPC。
- 关键点：
  - `isDebugMode` 由 `VITE_DEV_SERVER_URL` 或启动参数 `-debug/--debug` 决定。
  - 通过 `app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')` 允许音频自动播放。

## 关键全局状态
- 配置相关：`DEFAULT_CONFIG`、`currentConfig`。
- 窗口：`floatingButtonWindow`、`pickCountWindow`、`pickResultWindow`。
- 结果：`currentPickResults`。
- Web 服务：`configServer`、`configServerPort`。
- 退出标记：`isQuitting`。
- 悬浮窗守护：`floatingWindowWatchdog`。
- 日志流：`logBuffer`、`logClients`。

## 配置管理
- `normalizeConfig(input)`：归一化配置结构、范围与默认值。
- `getConfigPath()`：配置文件固定在 `AppData/Local/BlueRandom/config.yml`。
- `getLegacyConfigPaths()`：兼容旧路径（可执行文件目录、开发环境 `process.cwd()`、以及旧的 `Blue Random` 目录）。
- `toConfigYamlWithComments(config)`：生成带中文注释的 YAML。
- `saveConfig(config)`：写入 YAML。
- `writeDefaultConfigIfMissing(configPath)`：不存在时写默认配置或复制旧配置。
- `loadConfig()`：读取 YAML，失败则使用默认值。
- `refreshConfig()`：刷新并更新 `currentConfig`。

## 抽取逻辑
- `pickStudentsByWeight(count)`：
  - 支持权重随机与允许/禁止重复抽取。
  - 允许重复：先对权重做指数强化（`weight^WEIGHT_BOOST_GAMMA`），再进行轮盘赌抽样。
  - 不允许重复：使用 Efraimidis-Spirakis 无放回加权抽样（`key = -ln(U)/weight`，取最小的 N 个）。
  - 若全部权重为 0，则退化为均匀随机。
  - 为空名单或 `count<=0` 时直接返回空数组。

## 日志系统
- `pushLog(level, text)`：写入日志缓冲并广播 SSE。
- 重写 `console.log/info/warn/error`：自动转入日志流。
- `ipcMain.on('renderer:log')`：渲染进程日志入口。

## 更新检查（后端）
- `fetchUrl(url, options)`：用 `electron.net` 发起请求，适合走系统代理。
- `checkUpdateFromMain()`：
  - 读取 GitHub `releases/latest`。
  - 下载 `version.yml`，解析版本与 commit。
  - 比较版本返回 `update/ok/easter/error` 状态。
- 辅助函数：`parseVersionYaml()`、`normalizeVersion()`、`compareVersion()`。

## 配置 Web 服务
- `createConfigServerRequestHandler()`：处理以下接口：
  - `GET /api/config`：返回配置。
  - `POST /api/config`：保存配置，必要时重启配置服务并刷新悬浮窗。
  - `GET /api/logs`：SSE 日志流。
  - `GET /api/app-info`：返回 `version` 与 `isDebugMode`。
  - `POST /api/config/open-file`：打开配置文件。
  - `POST /api/config/open-dir`：打开配置目录。
  - `GET /api/check-update`：更新检查。
  - `POST /api/restart`：重启应用。
  - `POST /api/admin/elevate`：申请管理员权限并重启。
  - `POST /api/task/create-admin-startup`：创建/更新管理员权限开机计划任务。
  - 静态资源：开发环境重定向至 Vite；生产环境读取 `dist`。
- `startConfigServer()`：按配置端口启动/重启服务。

## 窗口与动画
- `createFloatingButtonWindow()`：
  - 创建悬浮按钮窗口，使用透明 + 置顶 + 鼠标穿透。
  - 在非调试模式设置 `type: toolbar` 与 `focusable` 以规避系统隐藏。
- `startFloatingWindowWatchdog()`：防止悬浮窗被隐藏或销毁。
- `animateWindowOpacity()` / `fadeOutFloatingButtonWindow()` / `fadeInFloatingButtonWindow()`：淡入淡出动画。
- `createPickCountWindowInstance()` / `createPickCountWindow()`：全屏人数选择窗口。
- `createPickResultWindowInstance()` / `openPickResultWindow()`：抽取结果窗口。
- `closePickCountWindow()` / `closePickResultWindow()`：关闭并恢复悬浮窗（关闭时向渲染端发送 `pick-result:reset` 并用短暂 `opacity=0` + `show()` 强制刷新以清除残留）。
- `persistFloatingButtonPosition()`：退出前保存悬浮窗位置。

## 托盘
- `createTray()`：创建托盘图标与菜单，包含“配置”和“退出”。
- `openConfigPageInBrowser()`：打开 Web 配置页。

## IPC 通道
- 悬浮按钮：
  - `floating-button:get-config` / `floating-button:clicked`
  - 拖拽：`floating-button:drag-start/move/end`
  - 鼠标穿透：`floating-button:set-ignore-mouse`
- 人数窗口：
  - `pick-count:get-config` / `pick-count:confirm` / `pick-count:cancel`
- 结果窗口：
  - `pick-result:get-results` / `pick-result:get-config` / `pick-result:close`

## 生命周期
- `app.whenReady()`：启动配置服务、托盘、三个窗口实例、悬浮窗守护。
- `app.on('before-quit')`：保存悬浮窗位置、停止守护。
- `app.on('window-all-closed')`：保持常驻托盘。

## 维护注意事项
- 配置字段新增时需同步：`DEFAULT_CONFIG`、`normalizeConfig()`、`toConfigYamlWithComments()`。
- 若调整窗口加载 URL，需同时覆盖 dev / prod 两种模式。
- 日志 SSE 与 `console.*` 重写耦合，删除时注意日志面板依赖。
- 更新检查依赖 `version.yml`，CI 需确保产物中包含该文件。

## 异常处理清单
- `process.on('uncaughtException')` 和 `process.on('unhandledRejection')` 已接管，新增异步逻辑时务必保证错误能被捕获并输出日志。
- Web 服务接口中返回 JSON 时，注意统一使用 `sendJson`，避免 `res.writeHead` 混用造成响应异常。
- 更新检查失败时要返回 `status: 'error'`，并附带 `detail` 与 `debug`，便于前端诊断。
- 读写 `config.yml` 失败必须回退默认配置，避免启动阻塞。
- 任何窗口 `BrowserWindow` 操作前需判断 `isDestroyed()`，避免崩溃。
- 拖拽逻辑依赖 `dragSessions`，确保 `drag-end` 时清理，防止内存泄漏。

## 主进程调试技巧
- 启动参数：`-debug` 或 `--debug` 可强制启用调试模式并显示窗口任务栏。
- DevTools：
  - `floatingButtonWindow` / `pickCountWindow` / `pickResultWindow` 在调试模式下会自动 `openDevTools({ mode: 'detach' })`。
- 日志：
  - 所有 `console.*` 会进入日志流，可在 Web 配置页右侧查看。
  - 若日志过多，可临时提高 `LOG_BUFFER_LIMIT` 以排查问题。
- 配置定位：
  - 当前配置文件固定在 `AppData/Local/BlueRandom/config.yml`。
- 端口冲突：
  - 配置页端口修改后需重启服务，错误会输出 `Failed to start config web server`。
