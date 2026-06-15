/*
技术文档：src/main/windows.js
职责：主进程窗口管理与抽取执行。

核心功能：
- 负责悬浮按钮窗口、抽取结果窗口的创建/显示/关闭。
- 负责悬浮窗拖拽、透明动画、watchdog 常驻保障。
- 实现按权重抽取学生（可重复与不可重复两种模式）。
- 提供窗口状态 getter/setter 供其它模块协作。

维护建议：
- 所有 BrowserWindow 生命周期逻辑集中于此，避免分散到其它模块。
- 注意：在 UIAccess 模式 + GPU 硬件加速开启时，若对全屏透明无边框窗口进行销毁并重建，会导致 DWM 复合链路失效（动画帧冻结在初始帧）。因此必须对这类窗口（如抽取结果页）保持持久化实例，使用 hide() 与 show() 来控制隐显，并在复用时通过 IPC 让渲染进程重置内部状态，严禁使用 close() 销毁重建。
*/
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const config = require('./config');

// 窗口与拖拽状态
const dragSessions = new Map();
let floatingButtonWindow = null;
let isFloatingHiddenForPickCount = false;
let pickResultWindow = null;
let isPickResultWindowReady = false;
let currentPickResults = [];
let pickResultToken = 0;
let activePickResultToken = 0;
let floatingWindowWatchdog = null;
let isDebugMode = false;
let isQuitting = false;
let floatingExpanded = false;
let floatingExpandedSize = null;
let configPanelWindow = null;
let isConfigPanelOpen = false;

// 动画与抽取算法参数
const FLOATING_WINDOW_FADE_MS = 400;
const WEIGHT_BOOST_GAMMA = 1.5;

// 设置调试模式
function setDebugMode(value) {
  isDebugMode = Boolean(value);
}

function setQuitting(value) {
  isQuitting = Boolean(value);
}

function getFloatingButtonWindow() {
  return floatingButtonWindow;
}

function getPickResultWindow() {
  return pickResultWindow;
}

function getCurrentPickResults() {
  return currentPickResults;
}

function refreshFloatingButtonWindow() {
  if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) {
    floatingButtonWindow.close();
  }
}

function getFloatingButtonWindowSize() {
  const cfg = config.refreshConfig();
  const sizePx = Math.round(50 * (cfg.floatingButton.sizePercent / 100));
  
  // 固定为完整展开时所需的最大窗口尺寸，防止窗口边界截断问题
  const base = Math.max(40, sizePx);
  const actionBtnSize = Math.round(Math.max(36, base * 0.7));
  const ringThickness = actionBtnSize;
  const placementRadius = Math.round(Math.max(55, base * 1.05));
  const ringRadius = placementRadius + Math.round(ringThickness / 2);
  const windowSize = Math.round(Math.max(340, ringRadius * 2 + 40));
  
  return { width: windowSize, height: windowSize };
}

function clampBoundsToWorkArea(bounds, workArea) {
  if (!workArea) return bounds;
  
  const cfg = config.refreshConfig();
  const sizePx = Math.round(50 * (cfg.floatingButton.sizePercent / 100));
  
  // 允许透明扩展区越过屏幕边界，从而确保视觉中心的核心按钮能贴近屏幕边缘
  const paddingX = (bounds.width - sizePx) / 2;
  const paddingY = (bounds.height - sizePx) / 2;
  
  const minX = workArea.x - paddingX;
  const minY = workArea.y - paddingY;
  const maxX = workArea.x + workArea.width - bounds.width + paddingX;
  const maxY = workArea.y + workArea.height - bounds.height + paddingY;
  
  return {
    ...bounds,
    x: Math.max(minX, Math.min(bounds.x, maxX)),
    y: Math.max(minY, Math.min(bounds.y, maxY))
  };
}

function resizeFloatingButtonWindow({ width, height }) {
  if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
    return;
  }

  const current = floatingButtonWindow.getBounds();
  const centerX = current.x + current.width / 2;
  const centerY = current.y + current.height / 2;
  const targetWidth = Math.max(72, Math.round(width));
  const targetHeight = Math.max(72, Math.round(height));
  const nextBounds = {
    x: Math.round(centerX - targetWidth / 2),
    y: Math.round(centerY - targetHeight / 2),
    width: targetWidth,
    height: targetHeight
  };

  const display = screen.getDisplayNearestPoint({ x: Math.round(centerX), y: Math.round(centerY) });
  const clamped = clampBoundsToWorkArea(nextBounds, display && display.workArea ? display.workArea : null);
  floatingButtonWindow.setBounds(clamped, true);
}

function setFloatingButtonExpanded(payload) {
  const expanded = Boolean(payload && payload.expanded);
  floatingExpanded = expanded;
  if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
    return;
  }

  if (expanded) {
    const size = payload && payload.size ? payload.size : null;
    const width = size ? Number(size.width) : NaN;
    const height = size ? Number(size.height) : NaN;
    if (Number.isFinite(width) && Number.isFinite(height)) {
      floatingExpandedSize = { width, height };
      resizeFloatingButtonWindow({ width, height });
      return;
    }
  }

  floatingExpandedSize = null;
  const baseSize = getFloatingButtonWindowSize();
  resizeFloatingButtonWindow(baseSize);
}

// 退出前保存悬浮按钮位置
function persistFloatingButtonPosition() {
  if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
    return;
  }

  const baseConfig = config.refreshConfig();
  const bounds = floatingButtonWindow.getBounds();
  const updated = config.normalizeConfig({
    ...baseConfig,
    floatingButton: {
      ...baseConfig.floatingButton,
      position: {
        x: bounds.x,
        y: bounds.y
      }
    }
  });
  config.saveConfig(updated);
}

// 基础透明度动画
function animateWindowOpacity(win, fromOpacity, toOpacity, durationMs) {
  return new Promise((resolve) => {
    if (!win || win.isDestroyed()) {
      resolve();
      return;
    }

    const start = Date.now();
    const delta = toOpacity - fromOpacity;
    win.setOpacity(fromOpacity);

    const timer = setInterval(() => {
      if (!win || win.isDestroyed()) {
        clearInterval(timer);
        resolve();
        return;
      }

      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      win.setOpacity(fromOpacity + delta * t);

      if (t >= 1) {
        clearInterval(timer);
        resolve();
      }
    }, 16);
  });
}

// 隐藏悬浮按钮（带渐隐）
async function fadeOutFloatingButtonWindow() {
  if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
    return;
  }

  if (!floatingButtonWindow.isVisible()) {
    return;
  }

  const currentOpacity = floatingButtonWindow.getOpacity();
  await animateWindowOpacity(
    floatingButtonWindow,
    Number.isFinite(currentOpacity) ? currentOpacity : 1,
    0,
    FLOATING_WINDOW_FADE_MS
  );

  if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) {
    floatingButtonWindow.hide();
    floatingButtonWindow.setOpacity(1);
  }
}

// 显示悬浮按钮（带渐显）
async function fadeInFloatingButtonWindow() {
  if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
    return;
  }

  floatingButtonWindow.setOpacity(0);
  floatingButtonWindow.show();
  floatingButtonWindow.focus();

  await animateWindowOpacity(floatingButtonWindow, 0, 1, FLOATING_WINDOW_FADE_MS);
}

// 创建/恢复悬浮按钮窗口
function createFloatingButtonWindow() {
  if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) {
    return floatingButtonWindow;
  }

  const cfg = config.refreshConfig();
  const baseSize = getFloatingButtonWindowSize();
  const winWidth = baseSize.width;
  const winHeight = baseSize.height;

  const hasSavedX = Number.isFinite(Number(cfg.floatingButton.position.x));
  const hasSavedY = Number.isFinite(Number(cfg.floatingButton.position.y));

  const windowOptions = {
    width: winWidth,
    height: winHeight,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: false,
    transparent: true,
    alwaysOnTop: cfg.floatingButton.alwaysOnTop,
    skipTaskbar: !isDebugMode,
    type: isDebugMode ? undefined : 'toolbar',
    focusable: isDebugMode ? true : process.platform !== 'win32',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  };

  if (hasSavedX && hasSavedY) {
    windowOptions.x = Math.round(Number(cfg.floatingButton.position.x));
    windowOptions.y = Math.round(Number(cfg.floatingButton.position.y));
  }

  const win = new BrowserWindow(windowOptions);
  floatingButtonWindow = win;
  // win.setIgnoreMouseEvents(true, { forward: true });

  if (floatingExpanded && floatingExpandedSize) {
    resizeFloatingButtonWindow(floatingExpandedSize);
  }

  if (cfg.floatingButton.alwaysOnTop) {
    win.setAlwaysOnTop(true, 'screen-saver');
  }
  if (cfg.webConfig && cfg.webConfig.adminTopmostEnabled && typeof win.setVisibleOnAllWorkspaces === 'function') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.setMenuBarVisibility(false);
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    if (isDebugMode) {
      win.webContents.openDevTools({ mode: 'detach' });
    }

    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  win.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });

  win.on('hide', () => {
    if (isQuitting || isFloatingHiddenForPickCount) {
      return;
    }

    setTimeout(() => {
      if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
        return;
      }
      if (isQuitting || isFloatingHiddenForPickCount) {
        return;
      }

      if (!floatingButtonWindow.isVisible()) {
        floatingButtonWindow.setOpacity(1);
        floatingButtonWindow.show();
      }
    }, 0);
  });

  win.on('closed', () => {
    floatingButtonWindow = null;

    if (!isQuitting && !isFloatingHiddenForPickCount) {
      setTimeout(() => {
        if (!isQuitting && !isFloatingHiddenForPickCount) {
          createFloatingButtonWindow();
        }
      }, 60);
    }
  });

  return win;
}

// watchdog：保证悬浮按钮常驻
function startFloatingWindowWatchdog() {
  if (floatingWindowWatchdog) {
    clearInterval(floatingWindowWatchdog);
    floatingWindowWatchdog = null;
  }

  floatingWindowWatchdog = setInterval(() => {
    if (isQuitting || isFloatingHiddenForPickCount) {
      return;
    }

    if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
      createFloatingButtonWindow();
      return;
    }

    if (!floatingButtonWindow.isVisible()) {
      floatingButtonWindow.setOpacity(1);
      floatingButtonWindow.show();
    }
  }, 450);
}

// 停止 watchdog
function stopFloatingWindowWatchdog() {
  if (floatingWindowWatchdog) {
    clearInterval(floatingWindowWatchdog);
    floatingWindowWatchdog = null;
  }
}


// 关闭抽取结果窗口
function closePickResultWindow() {
  if (!pickResultWindow || pickResultWindow.isDestroyed()) {
    currentPickResults = [];
    activePickResultToken = 0;
    isFloatingHiddenForPickCount = false;
    fadeInFloatingButtonWindow();
    return;
  }

  if (pickResultWindow.isVisible()) {
    pickResultWindow.hide();
  }
  
  currentPickResults = [];
  activePickResultToken = 0;
  isFloatingHiddenForPickCount = false;
  fadeInFloatingButtonWindow();
}

// 预创建抽取结果窗口实例
function createPickResultWindowInstance() {
  if (pickResultWindow && !pickResultWindow.isDestroyed()) {
    return;
  }

  const win = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    fullscreen: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: !isDebugMode,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  pickResultWindow = win;
  isPickResultWindowReady = false;
  win.setMenuBarVisibility(false);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/pick-result`);
  } else {
    win.loadURL(`file://${path.join(__dirname, '../dist/index.html')}#/pick-result`);
  }

  if (isDebugMode) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.once('ready-to-show', () => {
    isPickResultWindowReady = true;
  });

  win.on('closed', () => {
    pickResultWindow = null;
    isPickResultWindowReady = false;
    currentPickResults = [];
    activePickResultToken = 0;
  });
}

// 展示抽取结果
function openPickResultWindow(results) {
  currentPickResults = Array.isArray(results) ? results : [];
  pickResultToken += 1;
  activePickResultToken = pickResultToken;
  createPickResultWindowInstance();

  if (!pickResultWindow || pickResultWindow.isDestroyed()) {
    return;
  }

  const openResultWindow = () => {
    if (!pickResultWindow || pickResultWindow.isDestroyed()) {
      return;
    }
    pickResultWindow.webContents.send('pick-result:open', {
      token: activePickResultToken,
      results: currentPickResults
    });
    pickResultWindow.show();
    pickResultWindow.focus();
  };

  if (isPickResultWindowReady) {
    openResultWindow();
  } else {
    pickResultWindow.once('ready-to-show', openResultWindow);
  }

  isFloatingHiddenForPickCount = true;
  fadeOutFloatingButtonWindow();
}

function getDragSession(eventId) {
  return dragSessions.get(eventId);
}

// 处理悬浮按钮拖拽
function handleDragStart(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const bounds = win.getBounds();
  dragSessions.set(event.sender.id, {
    startWinX: bounds.x,
    startWinY: bounds.y,
    width: bounds.width,
    height: bounds.height
  });
}

function handleDragMove(event, payload) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const session = getDragSession(event.sender.id);
  if (!win || !session || !payload) return;

  const dx = Number(payload.dx);
  const dy = Number(payload.dy);
  if (Number.isNaN(dx) || Number.isNaN(dy)) return;

  win.setBounds({
    x: Math.round(session.startWinX + dx),
    y: Math.round(session.startWinY + dy),
    width: session.width,
    height: session.height
  });
}

function handleDragEnd(event) {
  dragSessions.delete(event.sender.id);
}

function setIgnoreMouseEvents(event, ignore) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, { forward: true });
  }
}

// 按权重抽取学生
function pickStudentsByWeight(count) {
  const cfg = config.refreshConfig();
  const rawList = Array.isArray(cfg.studentList) ? cfg.studentList : [];
  const pool = rawList
    .map((s) => ({
      name: String(s.name || '').trim(),
      weight: Math.max(0, Number(s.weight) || 0)
    }))
    .filter((s) => s.name);

  if (pool.length === 0 || count <= 0) {
    return [];
  }

  const targetCount = Math.max(0, count);
  const picked = [];
  const allowRepeatDraw = Boolean(cfg.allowRepeatDraw);
  if (pool.length === 0) {
    return picked;
  }

  if (allowRepeatDraw) {
    const weightedPool = pool.map((s) => ({
      name: s.name,
      weight: Math.pow(s.weight, WEIGHT_BOOST_GAMMA)
    }));
    const totalWeight = weightedPool.reduce((sum, s) => sum + s.weight, 0);

    for (let i = 0; i < targetCount; i++) {
      let pickIndex = -1;
      if (totalWeight > 0) {
        let roll = Math.random() * totalWeight;
        for (let j = 0; j < weightedPool.length; j++) {
          roll -= weightedPool[j].weight;
          if (roll <= 0) {
            pickIndex = j;
            break;
          }
        }
      }

      if (pickIndex < 0) {
        pickIndex = Math.floor(Math.random() * weightedPool.length);
      }

      picked.push({ name: weightedPool[pickIndex].name });
    }

    return picked;
  }

  const positivePool = pool.filter((s) => s.weight > 0);
  const zeroPool = pool.filter((s) => s.weight <= 0);
  const hasPositiveWeight = positivePool.length > 0;

  if (hasPositiveWeight) {
    const keyed = positivePool.map((s) => ({
      name: s.name,
      key: -Math.log(Math.random()) / s.weight
    }));

    keyed.sort((a, b) => a.key - b.key);
    const limit = Math.min(targetCount, keyed.length);
    for (let i = 0; i < limit; i++) {
      picked.push({ name: keyed[i].name });
    }
  }

  if (picked.length < targetCount && zeroPool.length > 0) {
    const remaining = zeroPool.slice();
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const fillCount = Math.min(targetCount - picked.length, remaining.length);
    for (let i = 0; i < fillCount; i++) {
      picked.push({ name: remaining[i].name });
    }
  }

  return picked;
}

// 配置面板窗口
function createConfigPanelWindow() {
  if (configPanelWindow && !configPanelWindow.isDestroyed()) {
    configPanelWindow.show();
    configPanelWindow.focus();
    return configPanelWindow;
  }

  const win = new BrowserWindow({
    width: 720,
    height: 640,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: !isDebugMode,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  configPanelWindow = win;
  win.setMenuBarVisibility(false);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/config-panel`);
  } else {
    win.loadURL(`file://${path.join(__dirname, '../dist/index.html')}#/config-panel`);
  }

  if (isDebugMode) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.on('closed', () => {
    configPanelWindow = null;
    isConfigPanelOpen = false;
    fadeInFloatingButtonWindow();
  });

  return win;
}

function openConfigPanelWindow() {
  isConfigPanelOpen = true;
  isFloatingHiddenForPickCount = true;
  fadeOutFloatingButtonWindow();
  createConfigPanelWindow();
}

function closeConfigPanelWindow(saved) {
  isConfigPanelOpen = false;
  isFloatingHiddenForPickCount = false;

  if (saved) {
    refreshFloatingButtonWindow();
  }

  if (configPanelWindow && !configPanelWindow.isDestroyed()) {
    configPanelWindow.close();
  }
  configPanelWindow = null;
}

function getConfigPanelWindow() {
  return configPanelWindow;
}

module.exports = {
  closeConfigPanelWindow,
  closeConfigPanelWindow,
  closePickResultWindow,
  createConfigPanelWindow,
  createFloatingButtonWindow,
  createPickResultWindowInstance,
  fadeInFloatingButtonWindow,
  getConfigPanelWindow,
  getCurrentPickResults,
  getFloatingButtonWindow,
  getPickResultWindow,
  handleDragEnd,
  handleDragMove,
  handleDragStart,
  openConfigPanelWindow,
  openPickResultWindow,
  persistFloatingButtonPosition,
  pickStudentsByWeight,
  refreshFloatingButtonWindow,
  setFloatingButtonExpanded,
  setDebugMode,
  setIgnoreMouseEvents,
  setQuitting,
  startFloatingWindowWatchdog,
  stopFloatingWindowWatchdog
};



