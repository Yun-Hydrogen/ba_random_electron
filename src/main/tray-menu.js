/*
技术文档：src/main/tray-menu.js
职责：托盘菜单模板定义。

核心功能：
- 构建“配置/退出”菜单并回调注入的行为函数。
*/
const { Menu } = require('electron');

// 托盘菜单结构
function buildTrayContextMenu({ onOpenConfig, onQuit }) {
  return Menu.buildFromTemplate([
    {
      label: '配置',
      click: () => {
        if (typeof onOpenConfig === 'function') {
          onOpenConfig();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        if (typeof onQuit === 'function') {
          onQuit();
        }
      }
    }
  ]);
}

module.exports = {
  buildTrayContextMenu
};
