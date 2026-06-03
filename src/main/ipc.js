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
  registerIpcHandlers
};
