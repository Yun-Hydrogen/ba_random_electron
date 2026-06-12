<!--
# Floating.vue 维护说明

本文总结 [src/renderer/views/Floating.vue](src/renderer/views/Floating.vue) 的结构与方法，便于后续 AI 维护。

## 模块概览
- 作用：悬浮按钮窗口入口，包含按钮、胶囊形人数控件条、确认/取消按钮。
- 技术：Vue 3 `<script setup>`，通过 `floatingButtonApi` / `floatingPickerApi` 与主进程通信。

## 页面结构（Template）
- `FloatingButton`：可拖拽圆形悬浮按钮（居中）。
- `picker-capsule`：悬浮按钮正上方的胶囊形水平控件条（间距 8px）。
  - 从左到右：`MIN` | `−` | 人数 | `+` | `MAX`，竖线分隔。
  - 样式：`border-radius: 999px` 胶囊形，白底 `#66ccff` 描边 + 发光阴影。
  - 人数格：`background: #66ccff` + 白色字，`align-self: stretch` 撑满胶囊高度。
  - `−` / `+` 按钮字体加大：`clamp(16px, …, 22px)`。
- `picker-actions`：X 关闭（左侧）与 ✓ 确认（右侧）圆形按钮。
  - 定位：±90° 旋转，与悬浮按钮圆心水平持平。
  - 尺寸：`calc(var(--action-size) * 1.05)`。

## 关键布局约束
- **`.picker-layer`** 不得设置 `pointer-events: none`，否则子元素全部无法点击。
- **`FloatingButton` 的 `.floating-root`** 不得有 `width/height: 100%`，否则全屏遮挡胶囊控件。

## 关键状态
- `isPickerOpen`：是否展示选择 UI。
- `count`：当前人数（1-10）。
- `sizePx`：按钮像素尺寸。
- `countPulse`：人数变更时的脉冲动画触发。

## 核心设计：鼠标穿透与窗口扩展
- **`setPickerOpen(open)`**：纯状态设置。
- **`watch(isPickerOpen)`**：Vue prop 传播后执行窗口级副作用：
  - 打开 → `setIgnoreMouseEvents(false)` + `setExpanded(true, size)`。
  - 关闭 → `setExpanded(false)`，穿透由 FloatingButton 自行管理。

## 动画
- 入场：`0.22s cubic-bezier(0.2, 0.8, 0.2, 1)` 飞入（`scale(0.85) + translateY(12px) → 正常`）。
- 退场：`0.18s cubic-bezier(0.5, 0, 0.1, 1)` 淡出。
- 人数脉冲：`txt-pulse 0.25s` 缩放弹跳。

## IPC / API 依赖
来自 `window.floatingButtonApi`：
- `getConfig()` / `setExpanded(expanded, size)` / `setIgnoreMouseEvents(ignore)`

来自 `window.floatingPickerApi`：
- `getConfig()` / `confirm(count)`
-->
<template>
  <div class="floating-stage" :class="{ 'is-picker-open': isPickerOpen }" :style="pickerStyle">
    <FloatingButton
      class="main-floating-btn"
      :size-px="sizePx"
      :transparency-percent="transparencyPercent"
      :drag-disabled="isPickerOpen"
      @click="handleFloatingButtonClick"
    />
    <transition name="picker-pop">
      <div v-if="isPickerOpen" class="picker-layer" aria-live="polite">

        <!-- 胶囊形控件条：悬浮按钮正上方 -->
        <div class="picker-capsule">
          <button class="capsule-btn" :disabled="!canDecrease" @click="setMinCount" aria-label="最小">MIN</button>
          <span class="capsule-divider"></span>
          <button class="capsule-btn" :disabled="!canDecrease" @click="decreaseCount" aria-label="减少">−</button>
          <span class="capsule-divider"></span>
          <div class="capsule-count" :class="{ 'is-pulse': countPulse }">
            <span class="capsule-count-value">{{ count }}</span>
          </div>
          <span class="capsule-divider"></span>
          <button class="capsule-btn" :disabled="!canIncrease" @click="increaseCount" aria-label="增加">+</button>
          <span class="capsule-divider"></span>
          <button class="capsule-btn" :disabled="!canIncrease" @click="setMaxCount" aria-label="最大">MAX</button>
        </div>

        <div class="picker-actions">
          <button class="pos-node node-close" @click="handleClosePicker" aria-label="关闭">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <button class="pos-node node-confirm" @click="handleConfirm" aria-label="确认">
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import FloatingButton from '../components/FloatingButton.vue'

const sizePx = ref(50)
const transparencyPercent = ref(20)
const count = ref(1)
const isPickerOpen = ref(false)
const countPulse = ref(false)

const MIN_COUNT = 1
const MAX_COUNT = 10
let pulseTimer = null

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

const pickerMetrics = computed(() => {
  const base = Math.max(40, sizePx.value)
  
    // Action buttons (confirm/cancel on the sides) slightly smaller
    const actionBtnSize = Math.round(Math.max(36, base * 0.7)) 
    // Internal buttons match the arc and action button sizes
    const btnSize = actionBtnSize 
    // Ring thickness matches action button diameter exactly
    const ringThickness = actionBtnSize
  
  // Embed count size perfectly into the ring thickness
  const countSize = actionBtnSize
  const placementRadius = Math.round(Math.max(55, base * 1.05))
  const ringRadius = placementRadius + Math.round(ringThickness / 2)
      
  const windowSize = Math.round(Math.max(340, ringRadius * 2 + 40))
  // 上方弧形环绕角度 140-150°，为左右两侧确认/取消按钮留空间
  const arcSpan = 145
  const arcCenter = windowSize / 2
  const circum = 2 * Math.PI * placementRadius
  const arcLength = (arcSpan / 360) * circum

  return {
    actionBtnSize,
    placementRadius,
    ringRadius,
    ringThickness,
    countSize,
    btnLargeSize: btnSize,
    btnSmallSize: btnSize,
    windowSize,
    arcSpan,
    arcCenter,
    circum,
    arcLength
  }
})

const pickerStyle = computed(() => ({
  '--size-px': `${sizePx.value}px`,
  '--ring-radius': `${pickerMetrics.value.ringRadius}px`,
  '--placement-radius': `${pickerMetrics.value.placementRadius}px`,
  '--ring-thickness': `${pickerMetrics.value.ringThickness}px`,
  '--count-size': `${pickerMetrics.value.countSize}px`,
  '--btn-l-size': `${pickerMetrics.value.btnLargeSize}px`,
  '--btn-s-size': `${pickerMetrics.value.btnSmallSize}px`,
  '--action-size': `${pickerMetrics.value.actionBtnSize}px`,
  '--arc-span': `${pickerMetrics.value.arcSpan}deg`
}))

const canDecrease = computed(() => count.value > MIN_COUNT)
const canIncrease = computed(() => count.value < MAX_COUNT)

function triggerPulse() {
  countPulse.value = false
  if (pulseTimer) {
    clearTimeout(pulseTimer)
  }
  window.requestAnimationFrame(() => {
    countPulse.value = true
  })
  pulseTimer = window.setTimeout(() => {
    countPulse.value = false
  }, 260)
}

async function initConfig() {
  if (window.floatingButtonApi) {
    const cfg = await window.floatingButtonApi.getConfig()
    sizePx.value = Math.round(50 * (cfg.sizePercent / 100))
    transparencyPercent.value = cfg.transparencyPercent
  }

  if (window.floatingPickerApi) {
    const pickCfg = await window.floatingPickerApi.getConfig()
    count.value = clampInt(pickCfg.defaultCount, MIN_COUNT, MAX_COUNT, MIN_COUNT)
  }
}

function setPickerOpen(open) {
  isPickerOpen.value = open
}

function handleFloatingButtonClick() {
  setPickerOpen(!isPickerOpen.value)
}

function handleClosePicker() {
  setPickerOpen(false)
}

function handleConfirm() {
  const selectedCount = clampInt(count.value, MIN_COUNT, MAX_COUNT, MIN_COUNT)
  setPickerOpen(false)
  if (window.floatingPickerApi) {
    window.floatingPickerApi.confirm(selectedCount)
  }
}

function increaseCount() {
  if (!canIncrease.value) return
  count.value += 1
  triggerPulse()
}

function decreaseCount() {
  if (!canDecrease.value) return
  count.value -= 1
  triggerPulse()
}

function setMinCount() {
  if (count.value === MIN_COUNT) return
  count.value = MIN_COUNT
  triggerPulse()
}

function setMaxCount() {
  if (count.value === MAX_COUNT) return
  count.value = MAX_COUNT
  triggerPulse()
}

// 在 Vue 完成 prop 传播后再执行窗口级副作用，避免 FloatingButton 的
// updateIgnoreMouse() 因 dragDisabled 尚未更新而错误地设置鼠标穿透
watch(isPickerOpen, (open) => {
  if (!window.floatingButtonApi) return
  if (open) {
    // 每次展开重置为默认人数
    count.value = MIN_COUNT
    // picker 打开：窗口必须捕获鼠标事件，否则环绕控件无法点击
    window.floatingButtonApi.setIgnoreMouseEvents(false)
    if (typeof window.floatingButtonApi.setExpanded === 'function') {
      const size = pickerMetrics.value.windowSize
      window.floatingButtonApi.setExpanded(true, { width: size, height: size })
    }
  } else {
    // picker 关闭：收缩窗口，鼠标穿透由 FloatingButton 根据 hover 状态自行管理
    if (typeof window.floatingButtonApi.setExpanded === 'function') {
      window.floatingButtonApi.setExpanded(false)
    }
  }
})

onMounted(() => {
  initConfig()
})
</script>

<style scoped>
.floating-stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-family: "Bahnschrift", "Segoe UI Variable", "Microsoft YaHei UI", "PingFang SC", sans-serif;
  overflow: hidden;
}

.main-floating-btn {
  z-index: 10;
  position: relative;
}

.picker-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.picker-svg {
  display: none;
}

/* ===== 胶囊形控件条：悬浮按钮正上方 ===== */

.picker-capsule {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, calc(-50% - var(--size-px) / 2 - var(--ring-thickness) / 2 - 8px));
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--ring-thickness);
  padding: 0 2px;
  border-radius: 999px;
  background: #FFF;
  border: 2px solid #66ccff;
  pointer-events: auto;
  z-index: 7;
  white-space: nowrap;
}

.capsule-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: calc(var(--ring-thickness) - 6px);
  min-width: calc(var(--ring-thickness) * 0.7);
  padding: 0 6px;
  border: none;
  background: transparent;
  color: #4477aa;
  font-weight: 600;
  font-size: clamp(10px, calc(var(--ring-thickness) * 0.28), 13px);
  font-family: "Bahnschrift", "Segoe UI Variable", "Microsoft YaHei UI", sans-serif;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  letter-spacing: 0.3px;
  border-radius: 999px;
}

.capsule-btn:not(:disabled):hover {
  color: #1a6090;
  background: rgba(102, 180, 255, 0.12);
}

.capsule-btn:not(:disabled):active {
  color: #0d4a78;
  background: rgba(102, 180, 255, 0.2);
}

.capsule-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  filter: grayscale(1);
}

/* − / + 按钮加大，确保垂直居中 */
.capsule-btn:nth-of-type(2),
.capsule-btn:nth-of-type(3) {
  font-size: clamp(24px, calc(var(--ring-thickness) * 0.42), 24px);
  min-width: calc(var(--ring-thickness) * 0.65);
  line-height: 1;
}

.capsule-divider {
  display: inline-block;
  width: 1px;
  height: calc(var(--ring-thickness) * 0.45);
  background: rgba(102, 170, 220, 0.3);
  flex-shrink: 0;
}

.capsule-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  min-width: calc(var(--ring-thickness) * 0.9);
  padding: 0 8px;
  background: #66ccff;
  border-radius: 8px;
  color: #ffffff;
  font-size: clamp(16px, calc(var(--ring-thickness) * 0.42), 26px);
  font-weight: 700;
  font-family: "Bahnschrift", "Segoe UI Variable", "Microsoft YaHei UI", sans-serif;
}

.capsule-count-value {
  line-height: 1;
}

.capsule-count.is-pulse .capsule-count-value {
  animation: txt-pulse 0.25s ease-out;
}

/* ===== X / ✓ 操作按钮容器 ===== */

.picker-actions {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}

.pos-node {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  pointer-events: auto;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  outline: none;
}

.node-close {
  width: calc(var(--action-size) * 1.2); height: calc(var(--action-size) * 1.2);
  transform: translate(-50%, -50%) rotate(-90deg) translateY(calc(-1 * var(--placement-radius))) rotate(90deg);
  border-radius: 50%;
  border: 2px solid #ffb0b9;
  background: #ff9494;
  box-shadow: 0 4px 12px rgba(255, 120, 140, 0.3);
  color: #ffffff;
}
.node-close:hover { 
  transform: translate(-50%, -50%) rotate(-90deg) translateY(calc(-1 * var(--placement-radius))) rotate(90deg) scale(1.1) !important; 
  border-color: rgba(255, 90, 110, 1);
  box-shadow: 0 4px 16px rgba(255, 90, 110, 0.5);
  filter: none;
}

.node-confirm {
  width: calc(var(--action-size) * 1.2); height: calc(var(--action-size) * 1.2);
  transform: translate(-50%, -50%) rotate(90deg) translateY(calc(-1 * var(--placement-radius))) rotate(-90deg);
  border-radius: 50%;
  border: 2px solid rgba(80, 255, 140, 0.6);
  background: #66ccff;
  box-shadow: 0 4px 12px rgba(102, 204, 255, 0.3);
  color: #ffffff;
}
.node-confirm:hover { 
  transform: translate(-50%, -50%) rotate(90deg) translateY(calc(-1 * var(--placement-radius))) rotate(-90deg) scale(1.1) !important; 
  border-color: #17e3f2;
  box-shadow: 0 4px 16px rgba(80, 255, 140, 0.5);
  filter: none;
}

.picker-pop-enter-active {
  transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.picker-pop-leave-active {
  transition: all 0.18s cubic-bezier(0.5, 0, 0.1, 1);
}
.picker-pop-enter-from,
.picker-pop-leave-to {
  opacity: 0;
  transform: scale(0.85) translateY(12px);
}

@keyframes txt-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
</style>


