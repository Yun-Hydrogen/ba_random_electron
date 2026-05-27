<!--
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
-->
<template>
  <div class="floating-root">
    <button
      class="floating-button"
      :class="{ 'is-dragging': isDragging, 'is-hovering': isHovering }"
      :style="buttonStyle"
      @contextmenu.prevent
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @pointerenter="handlePointerEnter"
      @pointerleave="handlePointerLeave"
      title=""
    >
      <img src="/image/app.ico" alt="随机抽取" draggable="false" />
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  sizePx: {
    type: Number,
    required: true
  },
  transparencyPercent: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['click'])

const CLICK_SOUND_GAIN = 1
const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const clickBufferPromise = fetch('/sound/button_click.wav')
  .then((response) => response.arrayBuffer())
  .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer.slice(0)))

function playClickSound() {
  clickBufferPromise
    .then(async (buffer) => {
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const source = audioContext.createBufferSource()
      source.buffer = buffer

      const gainNode = audioContext.createGain()
      gainNode.gain.value = CLICK_SOUND_GAIN

      source.connect(gainNode)
      gainNode.connect(audioContext.destination)
      source.start(0)
    })
    .catch(() => {})
}

const styleOpacity = computed(() => {
  return Math.max(0, Math.min(1, 1 - props.transparencyPercent / 100))
})

const buttonStyle = computed(() => {
  return {
    width: `${props.sizePx}px`,
    height: `${props.sizePx}px`,
    opacity: String(styleOpacity.value)
  }
})

const textStyle = computed(() => {
  return {
    opacity: String(styleOpacity.value)
  }
})

const pointerDown = ref(false)
const activePointerId = ref(null)
const isDragging = ref(false)
const isHovering = ref(false)
const lastPointerType = ref('mouse')
const startGlobalX = ref(0)
const startGlobalY = ref(0)
const pendingDx = ref(0)
const pendingDy = ref(0)
const rafId = ref(0)
const DRAG_THRESHOLD_PX = 3

function getGlobalPoint(event) {
  const fallbackX = window.screenX + event.clientX
  const fallbackY = window.screenY + event.clientY

  if (event.pointerType === 'touch') {
    return { x: fallbackX, y: fallbackY }
  }

  const screenX = Number(event.screenX)
  const screenY = Number(event.screenY)
  return {
    x: Number.isFinite(screenX) ? screenX : fallbackX,
    y: Number.isFinite(screenY) ? screenY : fallbackY
  }
}

function flushMove() {
  if (!isDragging.value || !window.floatingButtonApi) {
    rafId.value = 0
    return
  }
  window.floatingButtonApi.moveDrag(pendingDx.value, pendingDy.value)
  rafId.value = 0
}

function scheduleMove() {
  if (rafId.value !== 0) return
  rafId.value = window.requestAnimationFrame(flushMove)
}

function cancelScheduledMove() {
  if (rafId.value !== 0) {
    window.cancelAnimationFrame(rafId.value)
    rafId.value = 0
  }
}

function updateIgnoreMouse() {}

function clearHoverState() {
  if (!isHovering.value) return
  isHovering.value = false
  updateIgnoreMouse()
}

function isPointerInside(event) {
  if (!event || !event.currentTarget) return false
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom
}

function handlePointerEnter(event) {
  if (event.pointerType === 'mouse') {
    isHovering.value = true
    updateIgnoreMouse()
  }
}

function handlePointerLeave(event) { isHovering.value = false; updateIgnoreMouse(); }

function handlePointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  lastPointerType.value = event.pointerType || 'mouse'
  pointerDown.value = true
  activePointerId.value = event.pointerId
  isDragging.value = false
  updateIgnoreMouse()
  const point = getGlobalPoint(event)
  startGlobalX.value = point.x
  startGlobalY.value = point.y
  pendingDx.value = 0
  pendingDy.value = 0
  cancelScheduledMove()
  if (event.currentTarget && event.currentTarget.setPointerCapture) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

function handlePointerMove(event) {
  if (activePointerId.value !== event.pointerId) return
  if (!pointerDown.value || !window.floatingButtonApi) return

  lastPointerType.value = event.pointerType || lastPointerType.value

  const point = getGlobalPoint(event)
  const dx = point.x - startGlobalX.value
  const dy = point.y - startGlobalY.value
  const movedEnough = Math.abs(dx) >= DRAG_THRESHOLD_PX || Math.abs(dy) >= DRAG_THRESHOLD_PX

  if (!isDragging.value && movedEnough) {
    isDragging.value = true
    window.floatingButtonApi.startDrag()
  }

  if (isDragging.value) {
    pendingDx.value = dx
    pendingDy.value = dy
    scheduleMove()
  }
}

function handlePointerUp(event) {
  if (activePointerId.value !== event.pointerId) return
  if (!pointerDown.value) return

  lastPointerType.value = event.pointerType || lastPointerType.value

  if (isDragging.value) {
    if (window.floatingButtonApi) {
      cancelScheduledMove()
      window.floatingButtonApi.moveDrag(pendingDx.value, pendingDy.value)
      window.floatingButtonApi.endDrag()
    }
  } else {
    playClickSound()
    isHovering.value = false // 抽卡时强制取消Hover状态，避免隐藏恢复后依然残留高亮
    if (event.currentTarget && event.currentTarget.blur) {
      event.currentTarget.blur() // 移除触控/点击后系统的持续焦点残留
    }
    emit('click')
  }

  pointerDown.value = false
  activePointerId.value = null
  isDragging.value = false
  if (event.pointerType === 'mouse' && !isPointerInside(event)) {
    clearHoverState()
  }
  updateIgnoreMouse()
  if (event.currentTarget && event.currentTarget.releasePointerCapture) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
}

function handlePointerCancel(event) {
  if (activePointerId.value !== null && activePointerId.value !== event.pointerId) return
  lastPointerType.value = event.pointerType || lastPointerType.value
  if (isDragging.value && window.floatingButtonApi) {
    cancelScheduledMove()
    window.floatingButtonApi.endDrag()
  }
  pointerDown.value = false
  activePointerId.value = null
  isDragging.value = false
  clearHoverState()
  updateIgnoreMouse()
}

function handleWindowMouseLeave(event) {
  if (event && event.relatedTarget) return
  clearHoverState()
}

function handleVisibilityChange() {
  if (document.hidden) {
    clearHoverState()
  }
}

onMounted(() => {
  window.addEventListener('blur', clearHoverState)
  window.addEventListener('mouseleave', handleWindowMouseLeave)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', clearHoverState)
  window.removeEventListener('mouseleave', handleWindowMouseLeave)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.floating-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-button {
  position: relative;
  border: 3px dashed #66ccff;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  border-radius: 16px;
  cursor: pointer;
  touch-action: none;
  padding: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background:  #bfeafff0;
  transition: transform 300ms ease, box-shadow 300ms ease, background 300ms ease;
}

.floating-button.is-hovering:not(.is-dragging) {
  background: #66ccff;
}

.floating-button:active {
  transform: translateY(1px) scale(0.985);
}

.floating-button.is-dragging,
.floating-button.is-dragging:hover,
.floating-button.is-dragging:active {
  transform: none;
  transition: none;
}

.floating-button img {
  width: 120%;
  height: 120%;
  object-fit: contain;
  pointer-events: none;
}

</style>

