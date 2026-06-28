/*
================================================================================
技术文档：src/main/ipc.js
职责：主进程 IPC（进程间通信）通道集中注册。

================================================================================
基础概念
================================================================================
  IPC（Inter-Process Communication）：
    Electron 应用分为"主进程"（Node.js）和"渲染进程"（Chromium 网页）。
    两者不能直接互相调用函数，需要通过 IPC 通道传递消息。

  ipcMain.handle(channel, handler)：
    主进程注册一个"请求-响应"通道。渲染进程用 invoke() 发送请求并等待返回值。
    类似 HTTP GET/POST —— 请求方发消息，处理方返回结果。

  ipcMain.on(channel, listener)：
    主进程注册一个"单向通知"通道。渲染进程用 send() 发送消息，不等待返回值。
    类似 UDP 或 fire-and-forget —— 发出后不管结果。

  命名规范：
    统一使用"模块名:动作"格式，例如：
      floating-button:drag-start      floating-picker:confirm
      pick-result:close               config-panel:save-config

================================================================================
模块导入（文件顶部集中引用，避免函数内部重复 require）
================================================================================
  require('electron')      → Electron 框架：ipcMain（IPC）、app（生命周期）、
                              dialog（系统对话框）
  require('./config')      → 配置读写模块
  require('./windows')     → 窗口管理模块
  require('./admin')       → Windows 权限模块
  require('./update')      → 更新检查模块
  require('fs')            → Node.js 文件系统
================================================================================
*/

// ============================================================================
//  模块导入 —— 全部在此集中引用，避免函数体内部重复 require()
// ============================================================================
const { ipcMain, app, dialog } = require('electron');
const fs = require('fs');
const config = require('./config');
const windows = require('./windows');
const admin = require('./admin');
const update = require('./update');
const logging = require('./logging');


// ============================================================================
//  第 1 组：悬浮按钮与抽取功能（应用启动时注册，伴随整个生命周期）
// ============================================================================

function registerIpcHandlers() {

  /*
   *  floating-button:get-config
   *  方向：渲染 → 主（请求-响应）
   *  用途：悬浮按钮窗口（Floating.vue）初始化时获取按钮外观配置。
   *  返回：floatingButton 对象（sizePercent, iconDataUrl, borderColor 等）。
   */
  ipcMain.handle('floating-button:get-config', () => {
    return config.refreshConfig().floatingButton;
  });

  /*
   *  floating-picker:get-config
   *  方向：渲染 → 主（请求-响应）
   *  用途：获取人数选择器配置（默认抽取人数）。
   *  返回：pickCountDialog 对象。
   */
  ipcMain.handle('floating-picker:get-config', () => {
    return config.refreshConfig().pickCountDialog;
  });

  /*
   *  floating-picker:confirm
   *  方向：渲染 → 主（单向通知）
   *  用途：用户确认抽取人数后，执行按权重随机抽取并打开结果窗口。
   *  参数：payload.count — 用户选择的抽取人数（1-10）。
   *  流程：
   *    1. 校验 count 范围 1-10
   *    2. 调用 windows.pickStudentsByWeight(count) 执行抽取
   *    3. 将结果传给 windows.openPickResultWindow() 展示
   */
  ipcMain.on('floating-picker:confirm', (_event, payload) => {
    const selectedCount = Math.round(Number(payload && payload.count)) || 1;
    const count = Math.min(10, Math.max(1, selectedCount));
    console.log(`Pick count confirmed. count=${count}`);
    const pickedStudents = windows.pickStudentsByWeight(count);
    if (pickedStudents.length > 0) {
      console.log(`Picked students: ${pickedStudents.map(s => s.name).join(', ')}`);
    }
    windows.openPickResultWindow(pickedStudents);
  });

  /*
   *  pick-result:get-results
   *  方向：渲染 → 主（请求-响应）
   *  用途：结果窗口打开时获取当前抽取结果列表。
   *  返回：学生姓名数组。
   */
  ipcMain.handle('pick-result:get-results', () => {
    return windows.getCurrentPickResults();
  });

  /*
   *  pick-result:get-config
   *  方向：渲染 → 主（请求-响应）
   *  用途：结果窗口获取音效/外观配置（音量、面板颜色、BGM 起始位置等）。
   *  返回：pickResultDialog 对象。
   */
  ipcMain.handle('pick-result:get-config', () => {
    return config.refreshConfig().pickResultDialog;
  });

  /*
   *  pick-result:close
   *  方向：渲染 → 主（单向通知）
   *  用途：结果窗口关闭时通知主进程隐藏窗口并恢复悬浮按钮。
   */
  ipcMain.on('pick-result:close', () => {
    windows.closePickResultWindow();
  });

  /*
   *  floating-button:drag-start / drag-move / drag-end
   *  方向：渲染 → 主（单向通知）
   *  用途：悬浮按钮拖拽事件。渲染进程计算偏移量，主进程移动 BrowserWindow。
   *
   *  为什么不在渲染进程直接移动窗口：
   *    BrowserWindow 的位置只能由主进程控制（Electron 安全模型）。
   *    渲染进程通过 IPC 把拖拽偏移量发给主进程，由主进程执行 setPosition()。
   */
  ipcMain.on('floating-button:drag-start', (event) => {
    windows.handleDragStart(event);
  });

  ipcMain.on('floating-button:drag-move', (event, payload) => {
    windows.handleDragMove(event, payload);
  });

  ipcMain.on('floating-button:drag-end', (event) => {
    windows.handleDragEnd(event);
  });

  /*
   *  floating-button:set-ignore-mouse
   *  方向：渲染 → 主（单向通知）
   *  用途：切换悬浮窗口的鼠标穿透模式。
   *  参数：ignore — true 时鼠标事件穿透窗口（点击到下层应用），
   *               false 时窗口正常捕获鼠标事件。
   *  场景：悬浮按钮空闲时穿透（不遮挡操作），hover/拖拽/选择器打开时捕获。
   */
  ipcMain.on('floating-button:set-ignore-mouse', (event, ignore) => {
    windows.setIgnoreMouseEvents(event, ignore);
  });

  /*
   *  floating-button:set-expanded
   *  方向：渲染 → 主（单向通知）
   *  用途：切换悬浮窗口的展开/收缩状态。
   *  参数：payload.expanded — true 展开（显示人数选择器环绕 UI），
   *                          false 收缩（仅显示按钮）。
   *        payload.size     — 展开时的窗口尺寸 { width, height }。
   */
  ipcMain.on('floating-button:set-expanded', (_event, payload) => {
    windows.setFloatingButtonExpanded(payload);
  });
}


// ============================================================================
//  第 2 组：配置面板（configPanel 窗口创建后动态注册，避免命名冲突）
//
//  为什么分两组注册：
//    main.js 中先调用 registerIpcHandlers()（第 1 组），
//    再创建 configPanel 窗口、然后调用 registerConfigPanelIpc()（第 2 组）。
//    分开注册确保配置面板 IPC 通道在对应窗口启动后才生效。
// ============================================================================

function registerConfigPanelIpc() {

  /*
   *  config-panel:get-config
   *  方向：渲染 → 主（请求-响应）
   *  用途：配置面板打开时获取完整配置对象。
   *  返回：整个 config 对象（studentList, floatingButton, pickResultDialog 等）。
   */
  ipcMain.handle('config-panel:get-config', () => {
    return config.refreshConfig();
  });

  /*
   *  config-panel:save-config
   *  方向：渲染 → 主（请求-响应）
   *  用途：用户在配置面板中点击"应用"后保存配置。
   *  参数：payload — Vue draft 对象的完整配置（未经归一化）。
   *  流程：
   *    1. config.normalizeConfig(payload) — 清洗数据（范围校验、默认值填充）
   *    2. config.saveConfig(normalized)  — 写入 config.yml
   *    3. windows.refreshFloatingButtonWindow() — 重建悬浮窗以应用新外观
   */
  ipcMain.handle('config-panel:save-config', (_event, payload) => {
    const normalized = config.normalizeConfig(payload);
    config.saveConfig(normalized);
    windows.refreshFloatingButtonWindow();
    return { ok: true };
  });

  /*
   *  config-panel:close
   *  方向：渲染 → 主（单向通知）
   *  用途：关闭配置面板窗口。
   *  参数：payload.saved — true 表示关闭前已保存（需刷新悬浮窗），
   *                        false 表示取消（无需额外操作）。
   */
  ipcMain.on('config-panel:close', (_event, payload) => {
    windows.closeConfigPanelWindow(Boolean(payload && payload.saved));
  });

  /*
   *  config-panel:get-app-info
   *  方向：渲染 → 主（请求-响应）
   *  用途：配置面板 > 高级设置 Tab 获取系统信息（进程权限、路径、版本号）。
   *  返回：{ isAdmin, isUiAccess, isWindows, uiAccessDllExists,
   *           configPath, configDir, exePath, version }
   */
  ipcMain.handle('config-panel:get-app-info', () => {
    return {
      isAdmin: admin.isProcessElevated(),
      isUiAccess: process.argv.includes(admin.UIACCESS_ARG),
      isWindows: admin.IS_WINDOWS,
      uiAccessDllExists: fs.existsSync(admin.getDefaultUiAccessDllPath()),
      configPath: config.getConfigPath(),
      configDir: config.getConfigDir(),
      exePath: admin.getDefaultExePath(),
      version: app.getVersion()
    };
  });

  /*
   *  config-panel:admin-elevate
   *  方向：渲染 → 主（请求-响应）
   *  用途：以管理员权限重新启动应用（通过 PowerShell Start-Process -Verb RunAs）。
   *  行为：成功则 150ms 后退出当前进程（新进程以管理员身份启动）。
   *  返回：{ ok, message, detail? } — 与 admin.requestAdminRelaunch() 一致。
   */
  ipcMain.handle('config-panel:admin-elevate', () => {
    const result = admin.requestAdminRelaunch();
    if (result.ok) {
      windows.setQuitting(true);
      setTimeout(() => app.exit(0), 150);
    }
    return result;
  });

  /*
   *  config-panel:restart
   *  方向：渲染 → 主（请求-响应）
   *  用途：普通重启应用（不提升权限，保留当前权限级别）。
   *  行为：80ms 后调用 app.relaunch() + app.exit(0)。
   *  注意：app.relaunch() 仅在打包版本有效，开发模式下行为与 app.exit(0) 相同。
   */
  ipcMain.handle('config-panel:restart', () => {
    windows.setQuitting(true);
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 80);
    return { ok: true };
  });

  /*
   *  config-panel:create-startup-task
   *  方向：渲染 → 主（请求-响应）
   *  用途：创建或更新 Windows 计划任务（用户登录时自动启动应用）。
   *  参数：payload.taskName — 计划任务名称
   *        payload.exePath  — 要启动的 .exe 文件路径
   *  返回：{ ok, message, detail? } — 与 admin.createAdminStartupTask() 一致。
   */
  ipcMain.handle('config-panel:create-startup-task', (_event, payload) => {
    return admin.createAdminStartupTask({
      taskName: payload.taskName,
      exePath: payload.exePath
    });
  });

  /*
   *  config-panel:open-config-file / open-config-dir
   *  方向：渲染 → 主（请求-响应）
   *  用途：在系统默认应用中打开配置文件（config.yml）或所在文件夹。
   *  实现：调用 Electron shell.openPath()，在资源管理器/默认编辑器中打开。
   *  返回：{ ok, message } — 成功或失败的反馈。
   */
  ipcMain.handle('config-panel:open-config-file', () => {
    return config.openConfigFile();
  });

  ipcMain.handle('config-panel:open-config-dir', () => {
    return config.openConfigDir();
  });

  /*
   *  config-panel:check-update
   *  方向：渲染 → 主（请求-响应）
   *  用途：从 GitHub Releases API 检查是否有新版本。
   *  返回：{ status, title, detail, releaseUrl? } — 'update' / 'ok' / 'error'。
   *  注意：此操作涉及网络请求，可能耗时 1-3 秒。
   */
  ipcMain.handle('config-panel:check-update', () => {
    return update.checkUpdateFromMain();
  });

  /*
   *  config-panel:pick-exe-file
   *  方向：渲染 → 主（请求-响应，异步）
   *  用途：打开系统原生文件选择对话框，让用户选取一个 .exe 文件。
   *  返回：选中文件的绝对路径字符串，用户取消则返回 null。
   *  注意：dialog.showOpenDialog 返回 Promise，使用 async/await 等待用户操作。
   */
  ipcMain.handle('config-panel:pick-exe-file', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择可执行文件',
      filters: [
        { name: '可执行文件', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  /*
   *  config-panel:reset-config
   *  方向：渲染 → 主（请求-响应）
   *  用途：将所有配置重置为默认值（清空名单、恢复默认外观/音效等）。
   *  流程：
   *    1. normalizeConfig({}) — 空对象归一化后即得默认配置
   *    2. saveConfig() — 覆盖写入 config.yml
   *    3. refreshFloatingButtonWindow() — 重建悬浮窗
   *  注意：此操作不可撤销，前端会弹出二次确认对话框。
   */
  ipcMain.handle('config-panel:reset-config', () => {
    config.saveConfig(config.normalizeConfig({}));
    windows.refreshFloatingButtonWindow();
    return { ok: true };
  });

  /*
   *  config-panel:get-logs
   *  方向：渲染 → 主（请求-响应）
   *  用途：配置面板 > 日志 Tab 拉取磁盘日志文件内容。
   *  参数：maxLines（可选）— 最多返回的行数，默认 500。
   *  返回：日志条目数组（时间倒序，最新在前）。
   *  竞态保护：读取前等待所有待处理写入完成（logging 模块内部互斥锁）。
   */
  ipcMain.handle('config-panel:get-logs', async (_event, maxLines) => {
    return logging.getLogs(typeof maxLines === 'number' ? maxLines : 500);
  });
}


// ============================================================================
//  导出 —— main.js 在启动流程中按顺序调用这两个注册函数
//
//  调用顺序（见 main.js）：
//    1. ipc.registerIpcHandlers()        ← app.whenReady() 中最先调用
//    2. ...创建托盘、悬浮窗、configPanel...
//    3. ipc.registerConfigPanelIpc()     ← configPanel 窗口创建后调用
// ============================================================================
module.exports = {
  registerIpcHandlers,
  registerConfigPanelIpc
};
