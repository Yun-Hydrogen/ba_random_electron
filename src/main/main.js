/*
技术文档：src/main/main.js
职责：主进程引导入口（Bootstrap）。

核心功能：
1) 汇总并初始化主进程模块（admin/config/config-server/ipc/logging/tray/update/windows）。
2) 设置运行参数：自动播放策略、UIAccess 进程下关闭 DirectComposition。
3) 检查启动配置，在需要时主动申请 UIAccess 或管理员权限，并执行主进程二次唤醒重启。
4) 在 app 就绪后启动本地配置服务、创建托盘、预创建窗口并启动悬浮窗 watchdog。
5) 绑定关键生命周期：activate 重建悬浮窗，before-quit 保存悬浮窗位置并停止 watchdog。

实现说明：
- 本文件只负责流程编排，不承载具体业务实现；业务逻辑已拆分到 src/main/*.js。
- 在 app.whenReady() 中先校验并控制进程提权（UAC/UIAccess）的启动流转。
- 通过 ipc.registerIpcHandlers() 注册全部 IPC 通道。
- 通过 logging.attachConsoleLogger() 将 console 输出纳入日志流。
- 通过 configServer.startConfigServer(...) 注入依赖，避免模块间硬耦合。

维护建议：
- 新增主进程能力优先放到独立模块，再在本文件接入。
- 避免在本文件新增大型函数，保持“入口编排”角色单一。
*/
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const admin = require('./admin');
const config = require('./config');
const configServer = require('./config-server');
const ipc = require('./ipc');
const logging = require('./logging');
const tray = require('./tray');
const update = require('./update');
const windows = require('./windows');

// 判断是否为调试模式
const isDebugMode = !!process.env.VITE_DEV_SERVER_URL || process.argv.includes('-debug') || process.argv.includes('--debug');

// 允许打包/启动模式下音频自动播放。
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (admin.IS_UIACCESS_PROCESS) {
  // 只禁用 DirectComposition 以修复 UIAccess 透明渲染问题。
  app.commandLine.appendSwitch('disable-direct-composition');
}

// 初始化 userData 路径（Windows 统一到 Local 目录）
admin.configureUserDataPath();
windows.setDebugMode(isDebugMode);

// 绑定日志与渲染进程日志管道
logging.attachConsoleLogger();
logging.registerRendererLogIpc(ipcMain);

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// 注册所有 IPC 通道
ipc.registerIpcHandlers();

// 应用就绪后启动配置服务、托盘与窗口
app.whenReady().then(() => {
  const startupConfig = config.refreshConfig();

  // UIAccess 自启动逻辑
  if (startupConfig.webConfig && startupConfig.webConfig.uiAccessEnabled && admin.IS_WINDOWS && !admin.IS_UIACCESS_PROCESS) {
    if (admin.isProcessElevated()) {
      const dllPath = admin.getDefaultUiAccessDllPath();
      if (fs.existsSync(dllPath)) {
        const result = admin.requestUiAccessRelaunch(dllPath);
        if (result.ok) {
          windows.setQuitting(true);
          app.exit(0);
          return;
        }
        console.error('UIAccess auto relaunch failed:', result.detail || result.message || 'unknown error');
      } else {
        console.error('UIAccess dll missing:', dllPath);
      }
    }
  }

  // 管理员权限自启动逻辑
  if (startupConfig.webConfig && startupConfig.webConfig.adminTopmostEnabled && admin.IS_WINDOWS && !admin.isProcessElevated()) {
    const result = admin.requestAdminRelaunch();
    if (result.ok) {
      windows.setQuitting(true);
      app.exit(0);
      return;
    }
  }

  configServer.startConfigServer({
    app,
    isDebugMode,
    config,
    update,
    logging,
    windows,
    admin
  });

  // 创建系统托盘
  tray.createTray({
    onOpenConfig: () => config.openConfigPageInBrowser(),
    onQuit: () => app.quit()
  });

  // 预创建窗口，保证打开速度与状态一致
  windows.createFloatingButtonWindow();
  windows.createPickCountWindowInstance();
  windows.createPickResultWindowInstance();
  windows.startFloatingWindowWatchdog();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windows.createFloatingButtonWindow();
    }
  });
});

// 退出前保存位置并停止 watchdog
app.on('before-quit', () => {
  windows.setQuitting(true);
  windows.stopFloatingWindowWatchdog();
  windows.persistFloatingButtonPosition();
});

app.on('window-all-closed', () => {
  // Keep app resident in tray; explicit quit should come from tray menu.
});
