/*
技术文档：src/main/ipc.js
职责：集中注册主进程 IPC 通道。

核心功能：
- 对外暴露悬浮按钮、人数选择环绕 UI、结果窗口相关 IPC。
- 将渲染层动作映射到 windows/config 模块能力。

维护建议：
- 新增通道统一放在本文件，保持命名规范：模块:动作。
*/
const { ipcMain } = require('electron');
const config = require('./config');
const windows = require('./windows');

// 主进程 IPC 通道注册
function registerIpcHandlers() {
  ipcMain.handle('floating-button:get-config', () => {
    return config.refreshConfig().floatingButton;
  });

  ipcMain.handle('floating-picker:get-config', () => {
    return config.refreshConfig().pickCountDialog;
  });

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

  ipcMain.handle('pick-result:get-results', () => {
    return windows.getCurrentPickResults();
  });

  ipcMain.handle('pick-result:get-config', () => {
    return config.refreshConfig().pickResultDialog;
  });

  ipcMain.on('pick-result:close', () => {
    windows.closePickResultWindow();
  });

  ipcMain.on('floating-button:drag-start', (event) => {
    windows.handleDragStart(event);
  });

  ipcMain.on('floating-button:drag-move', (event, payload) => {
    windows.handleDragMove(event, payload);
  });

  ipcMain.on('floating-button:drag-end', (event) => {
    windows.handleDragEnd(event);
  });

  ipcMain.on('floating-button:set-ignore-mouse', (event, ignore) => {
    windows.setIgnoreMouseEvents(event, ignore);
  });

  ipcMain.on('floating-button:set-expanded', (_event, payload) => {
    windows.setFloatingButtonExpanded(payload);
  });
}

module.exports = {
  registerIpcHandlers,
  registerConfigPanelIpc
};

// 配置面板 IPC（在 configPanel window 创建后注册，避免命名冲突）
function registerConfigPanelIpc() {
  ipcMain.handle('config-panel:get-config', () => {
    return config.refreshConfig();
  });

  ipcMain.handle('config-panel:save-config', (_event, payload) => {
    const normalized = config.normalizeConfig(payload);
    config.saveConfig(normalized);
    return { ok: true };
  });

  ipcMain.on('config-panel:close', (_event, payload) => {
    windows.closeConfigPanelWindow(Boolean(payload && payload.saved));
  });

  // 高级设置：系统信息
  ipcMain.handle('config-panel:get-app-info', () => {
    const admin = require('./admin');
    const update = require('./update');
    return {
      isAdmin: admin.isProcessElevated(),
      isUiAccess: process.argv.includes(admin.UIACCESS_ARG),
      isWindows: admin.IS_WINDOWS,
      uiAccessDllExists: require('fs').existsSync(admin.getDefaultUiAccessDllPath()),
      configPath: config.getConfigPath(),
      configDir: config.getConfigDir(),
      exePath: admin.getDefaultExePath(),
      version: require('electron').app.getVersion()
    };
  });

  // 管理员权限提升
  ipcMain.handle('config-panel:admin-elevate', () => {
    const admin = require('./admin');
    const result = admin.requestAdminRelaunch();
    if (result.ok) {
      windows.setQuitting(true);
      setTimeout(() => require('electron').app.exit(0), 150);
    }
    return result;
  });

  // 应用重启
  ipcMain.handle('config-panel:restart', () => {
    windows.setQuitting(true);
    setTimeout(() => {
      require('electron').app.relaunch();
      require('electron').app.exit(0);
    }, 80);
    return { ok: true };
  });

  // 开机计划任务
  ipcMain.handle('config-panel:create-startup-task', (_event, payload) => {
    const admin = require('./admin');
    return admin.createAdminStartupTask({
      taskName: payload.taskName,
      exePath: payload.exePath
    });
  });

  // 打开配置文件/目录
  ipcMain.handle('config-panel:open-config-file', () => {
    return config.openConfigFile();
  });

  ipcMain.handle('config-panel:open-config-dir', () => {
    return config.openConfigDir();
  });

  // 检查更新
  ipcMain.handle('config-panel:check-update', () => {
    const update = require('./update');
    return update.checkUpdateFromMain();
  });

  // 选取可执行文件路径
  ipcMain.handle('config-panel:pick-exe-file', async () => {
    const { dialog } = require('electron');
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
}
