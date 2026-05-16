# FloatingButton.vue 维护说明

本文总结 [src/renderer/components/FloatingButton.vue](src/renderer/components/FloatingButton.vue) 的结构与方法，便于后续 AI 维护。

## 模块概览
- 作用：悬浮按钮组件，支持点击触发、拖拽移动、鼠标穿透控制与点击音效。
- 技术：Vue 3 `<script setup>`，使用 `PointerEvent` 进行拖拽。

## 页面结构（Template）
- 根容器：`.floating-root`。
- 按钮：`.floating-button`，包含图标与文字。
  - 绑定 `@pointerdown/move/up/cancel/enter/leave` 控制拖拽与 hover。
  - `is-dragging` class 阻止 hover/active 动画。

## Props
- `sizePx`：按钮像素尺寸。
- `transparencyPercent`：透明度百分比。

## 关键状态（Refs / Computed）
- `styleOpacity`：透明度计算（1 - percent/100）。
- `buttonStyle`：控制按钮尺寸与透明度。
- `textStyle`：控制文字透明度。
- 拖拽相关：
  - `pointerDown`、`activePointerId`、`isDragging`、`isHovering`。
  - `startGlobalX` / `startGlobalY`：拖拽起点。
  - `pendingDx` / `pendingDy`：待应用偏移。
  - `rafId`：`requestAnimationFrame` 句柄。
  - `DRAG_THRESHOLD_PX = 3`：开始拖拽的阈值。

## 主要方法与职责
- 音效：
  - `playClickSound()`：通过 `AudioContext` 播放点击音效。
- 拖拽与指针：
  - `getGlobalPoint(event)`：统一获取屏幕坐标，兼容触控。
  - `scheduleMove()` / `flushMove()` / `cancelScheduledMove()`：合并拖拽更新频率。
  - **状态重置**：触发点击(`emit('click')`)时强制重置 `isHovering.value = false`，避免窗口隐藏恢复由于判定中断导致的 Hover 残留。
  - `updateIgnoreMouse()`：根据 hover / press 状态切换窗口鼠标穿透。
  - `handlePointerEnter/Leave()`：更新 hover 并切换穿透。
  - `handlePointerDown()`：初始化拖拽状态并捕获指针。
  - `handlePointerMove()`：超过阈值时开始拖拽并更新偏移。
  - `handlePointerUp()`：
    - 若拖拽：提交移动并结束拖拽。
    - 若未拖拽：播放音效并触发 `emit('click')`。
  - `handlePointerCancel()`：拖拽中断时清理状态。

## IPC / API 依赖
来自 `window.floatingButtonApi`：
- `startDrag()` / `moveDrag(dx, dy)` / `endDrag()`：拖拽通知主进程。
- `setIgnoreMouseEvents(ignore)`：切换鼠标穿透。

## 资源依赖
- 图标：`/image/random.svg`
- 点击音效：`/sound/button_click.wav`

## 样式要点
- `.floating-button` 使用渐变背景、hover 阴影、active 反馈。
- `.floating-button.is-dragging` 禁用 hover/active 动画，避免拖拽抖动。
- 图标和文字 `pointer-events: none` 防止干扰拖拽。

## 维护注意事项
- 拖拽通过 `requestAnimationFrame` 节流，避免高频 IPC。
- `updateIgnoreMouse()` 依赖主进程 `setIgnoreMouseEvents`，修改逻辑需同步主进程行为。
- `AudioContext` 在用户手势下恢复，避免播放被阻止。
