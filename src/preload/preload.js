/*
# preload.js 维护说明

本文总结 [src/preload/preload.js](src/preload/preload.js) 的结构、模块与逻辑，便于后续 AI 维护。

## 模块概览
- 作用：通过 `contextBridge` 向渲染进程暴露受控 API，统一封装 IPC 调用。
- 技术：Electron `contextBridge` + `ipcRenderer`。
- 原则：仅暴露需要的接口，避免在渲染进程直接访问 Node 能力。

## 暴露的全局 API
### `window.floatingButtonApi`
用于悬浮按钮窗口。
- `getConfig()`：`ipcRenderer.invoke('floating-button:get-config')`
- `startDrag()`：`ipcRenderer.send('floating-button:drag-start')`
- `moveDrag(dx, dy)`：`ipcRenderer.send('floating-button:drag-move', { dx, dy })`
- `endDrag()`：`ipcRenderer.send('floating-button:drag-end')`
- `setIgnoreMouseEvents(ignore)`：`ipcRenderer.send('floating-button:set-ignore-mouse', ignore)`
- `setExpanded(expanded, size)`：`ipcRenderer.send('floating-button:set-expanded', { expanded, size })`

### `window.floatingPickerApi`
用于悬浮按钮的环绕人数选择。
- `getConfig()`：`ipcRenderer.invoke('floating-picker:get-config')`
- `confirm(count)`：`ipcRenderer.send('floating-picker:confirm', { count })`

### `window.pickResultApi`
用于抽取结果窗口。
- `getResults()`：`ipcRenderer.invoke('pick-result:get-results')`
- `getConfig()`：`ipcRenderer.invoke('pick-result:get-config')`
- `close()`：`ipcRenderer.send('pick-result:close')`
- `onOpen(callback)`：监听 `pick-result:open` 事件并传递 payload
  - 返回一个取消监听函数。

### `window.logApi`
用于渲染进程写入日志。
- `send(level, text)`：`ipcRenderer.send('renderer:log', { level, text })`

## 逻辑要点
- 所有 `on*` 监听方法都会返回 **取消订阅函数**，调用后会 `removeListener`。
- `invoke` 用于需要返回值的请求（配置、结果）。
- `send` 用于单向通知（点击、拖拽、关闭、日志）。

## 维护注意事项
- 新增 IPC 通道时，需在主进程同步注册对应 `ipcMain` 处理逻辑。
- 避免在此暴露 Node 原生能力，保持渲染端安全边界。
- 监听函数必须成对移除，避免窗口复用时产生重复回调。

## IPC 命名规则
- 统一使用 `模块名:动作` 形式，例如：`floating-picker:confirm`、`pick-result:open`。
- `get/读取` 用 `ipcRenderer.invoke` + `ipcMain.handle`（有返回值）。
- `通知/事件` 用 `ipcRenderer.send` + `ipcMain.on`（无返回值）。
- 从主进程主动推送事件到渲染进程时，使用同样的 `模块名:事件` 约定。
*/
const { contextBridge, ipcRenderer } = require('electron');

// 悬浮按钮窗口桥接 API
contextBridge.exposeInMainWorld('floatingButtonApi', {
  getConfig: () => ipcRenderer.invoke('floating-button:get-config'),
  startDrag: () => ipcRenderer.send('floating-button:drag-start'),
  moveDrag: (dx, dy) => ipcRenderer.send('floating-button:drag-move', { dx, dy }),
  endDrag: () => ipcRenderer.send('floating-button:drag-end'),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('floating-button:set-ignore-mouse', ignore),
  setExpanded: (expanded, size) => ipcRenderer.send('floating-button:set-expanded', { expanded, size })
});

// 人数环绕选择桥接 API
contextBridge.exposeInMainWorld('floatingPickerApi', {
  getConfig: () => ipcRenderer.invoke('floating-picker:get-config'),
  confirm: (count) => ipcRenderer.send('floating-picker:confirm', { count })
});

// 抽取结果窗口桥接 API
contextBridge.exposeInMainWorld('pickResultApi', {
  getResults: () => ipcRenderer.invoke('pick-result:get-results'),
  getConfig: () => ipcRenderer.invoke('pick-result:get-config'),
  close: () => ipcRenderer.send('pick-result:close'),
  onOpen: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pick-result:open', listener);
    return () => {
      ipcRenderer.removeListener('pick-result:open', listener);
    };
  },
  onReset: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pick-result:reset', listener);
    return () => {
      ipcRenderer.removeListener('pick-result:reset', listener);
    };
  }
});

// 渲染进程日志上报
contextBridge.exposeInMainWorld('logApi', {
  send: (level, text) => ipcRenderer.send('renderer:log', { level, text })
});

