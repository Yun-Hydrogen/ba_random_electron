/*
技术文档：src/main/tray.js
职责：系统托盘创建与菜单绑定。

核心功能：
- 根据 dev/prod 路径加载托盘图标。
- 通过 tray-menu 构建菜单，提供配置入口与退出入口。
*/
const { Tray, nativeImage } = require('electron');
const path = require('path');
const { buildTrayContextMenu } = require('./tray-menu');

// 创建系统托盘与菜单
function createTray({ onOpenConfig, onQuit }) {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  const trayIconPath = isDev
    ? path.join(__dirname, '../public/image/tray.png')
    : path.join(__dirname, '../dist/image/tray.png');
  const trayIcon = nativeImage.createFromPath(trayIconPath);
  const tray = new Tray(trayIcon);

  tray.setToolTip('Blue Random');
  const trayMenu = buildTrayContextMenu({
    onOpenConfig,
    onQuit
  });
  tray.setContextMenu(trayMenu);

  return tray;
}

module.exports = {
  createTray
};
