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
- `dragDisabled`：是否禁用拖拽（picker 打开时为 true，同时强制窗口捕获鼠标）。

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
  - `scheduleMove()` / `flushMove()` / `cancelScheduledMove()`：合并拖拽更新频率（`requestAnimationFrame` 节流）。
  - `updateIgnoreMouse()`：核心鼠标穿透控制。
    - `dragDisabled` 为 true（picker 打开）→ 始终 `setIgnoreMouseEvents(false)`，确保环绕控件可点击。
    - 正常模式 → hover 或 press 时捕获（false），否则穿透（true）。
  - `handlePointerEnter/Leave()`：更新 hover 并触发 `updateIgnoreMouse()`。
  - `handlePointerDown()`：初始化拖拽状态、捕获指针、调用 `updateIgnoreMouse()`。
  - `handlePointerMove()`：超过 `DRAG_THRESHOLD_PX` 阈值时开始拖拽并累积偏移。
  - `handlePointerUp()`：
    - 若拖拽：提交移动（`moveDrag` + `endDrag`）。
    - 若未拖拽：播放音效，强制清 `isHovering` 避免残留高亮，`emit('click')`。
    - 统一收尾：`pointerDown/activePointerId/isDragging` 重置，若鼠标仍在按钮内则**恢复 `isHovering = true`**（确保后续鼠标穿透状态正确），最后调用 `updateIgnoreMouse()`。
  - `handlePointerCancel()`：拖拽中断时清理状态。
- 响应式监听：
  - `watch(dragDisabled)`：picker 打开/关闭导致 prop 变化时，主动调用 `updateIgnoreMouse()` 重新评估窗口鼠标穿透。

## IPC / API 依赖
来自 `window.floatingButtonApi`：
- `startDrag()` / `moveDrag(dx, dy)` / `endDrag()`：拖拽通知主进程。
- `setIgnoreMouseEvents(ignore)`：切换鼠标穿透。

## 资源依赖
- 图标：`/image/random.svg`
- 点击音效：`/sound/button_click.wav`

## 样式要点
- `.floating-root` 不得设 `width/height: 100%`，必须收缩到按钮自身大小，否则全屏遮挡 picker 控件。
- `.floating-button` 使用渐变背景、hover 阴影、active 反馈。
- `.floating-button.is-dragging` 禁用 hover/active 动画，避免拖拽抖动。
- 图标和文字 `pointer-events: none` 防止干扰拖拽。

## 维护注意事项
- 拖拽通过 `requestAnimationFrame` 节流，避免高频 IPC。
- `updateIgnoreMouse()` 是鼠标穿透的**唯一入口**，修改逻辑需同步主进程 `setIgnoreMouseEvents` 行为。
- `dragDisabled` prop 影响 `updateIgnoreMouse()` 的判断分支，picker 打开时强制捕获鼠标。
- `handlePointerUp` 中非拖拽分支强制清 `isHovering` 后，若鼠标仍在按钮内必须恢复，否则窗口会错误进入穿透模式。
- `watch(dragDisabled)` 解决 Vue prop 传播与同步 `updateIgnoreMouse()` 之间的时序竞争：picker 打开/关闭时确保以正确的 prop 值重评估。
- **`.floating-root` 严禁 `width/height: 100%`**，否则会形成全屏透明遮挡层，使胶囊控件和 X/✓ 按钮无法点击。
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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  sizePx: {
    type: Number,
    required: true
  },
  transparencyPercent: {
    type: Number,
    required: true
  },
  dragDisabled: {
    type: Boolean,
    default: false
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

function updateIgnoreMouse() {
  if (!window.floatingButtonApi) return
  // 当 picker 打开（dragDisabled）时，始终不穿透鼠标
  if (props.dragDisabled) {
    window.floatingButtonApi.setIgnoreMouseEvents(false)
    return
  }
  // 正常模式：hover 或按下时捕获鼠标，否则穿透
  const shouldIgnore = !isHovering.value && !pointerDown.value
  window.floatingButtonApi.setIgnoreMouseEvents(shouldIgnore)
}

function clearHoverState() {
  if (!isHovering.value) return
  isHovering.value = false
  updateIgnoreMouse()
}

// picker 打开/关闭导致 dragDisabled 变化时，重新评估鼠标穿透状态
watch(() => props.dragDisabled, () => {
  updateIgnoreMouse()
})

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
  if (props.dragDisabled) return

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
  } else if (event.pointerType === 'mouse' && isPointerInside(event)) {
    // 点击后鼠标仍在按钮上：恢复 hover，确保后续鼠标穿透状态正确
    isHovering.value = true
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
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-button {
  position: relative;
  border: 2px solid #66ccff;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  border-radius: 50%;
  cursor: pointer;
  touch-action: none;
  padding: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #FFF;
  transition: transform 260ms ease, box-shadow 260ms ease, background 260ms ease, border-color 260ms ease;
}

.floating-button.is-hovering:not(.is-dragging) {
  background: #FFF;
  border-color: rgba(40, 130, 230, 0.9);
  box-shadow: 0 14px 28px rgba(8, 32, 72, 0.28), inset 0 1px 3px rgba(255, 255, 255, 0.85);
}

.floating-button img {
  width: 120%;
  height: 120%;
  object-fit: contain;
  pointer-events: none;
}

</style>

