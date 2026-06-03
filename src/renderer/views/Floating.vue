<!--
# Floating.vue 维护说明

本文总结 [src/renderer/views/Floating.vue](src/renderer/views/Floating.vue) 的结构与方法，便于后续 AI 维护。

## 模块概览
- 作用：悬浮按钮窗口入口，包含按钮与人数环绕选择 UI。
- 技术：Vue 3 `<script setup>`，通过 `floatingButtonApi` 读取配置。通过 `floatingPickerApi` 执行抽取。

## 页面结构（Template）
- `FloatingButton`：可拖拽圆形按钮。
- `picker-layer`：点击按钮后出现的环绕人数选择 UI。
  - 上方弧形环。
  - 中部人数显示。
  - 左侧 `- / MIN`，右侧 `+ / MAX`。
  - 左侧 `X` 关闭，右侧 `✓` 确认。

## 关键状态
- `isPickerOpen`：是否展示环绕选择 UI。
- `count`：当前人数（1-10）。
- `sizePx`：按钮像素尺寸（基于 50px 乘以百分比）。

## IPC / API 依赖
来自 `window.floatingButtonApi`：
- `getConfig()`：读取悬浮按钮配置。
- `setExpanded(expanded, size)`：切换悬浮窗扩展尺寸。

来自 `window.floatingPickerApi`：
- `getConfig()`：读取人数选择默认值。
- `confirm(count)`：触发抽取流程。
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
        <svg class="picker-svg" :width="pickerMetrics.windowSize" :height="pickerMetrics.windowSize" :viewBox="`0 0 ${pickerMetrics.windowSize} ${pickerMetrics.windowSize}`">
          <circle
            class="svg-track-border"
            :cx="pickerMetrics.arcCenter" :cy="pickerMetrics.arcCenter" :r="pickerMetrics.placementRadius"
            fill="none" stroke="#66ccff" :stroke-width="pickerMetrics.ringThickness"
            stroke-linecap="round"
            :stroke-dasharray="`${pickerMetrics.arcLength} ${pickerMetrics.circum}`"
            :transform="`rotate(${-90 - pickerMetrics.arcSpan / 2} ${pickerMetrics.arcCenter} ${pickerMetrics.arcCenter})`"
          />
          <circle
            class="svg-track-bg"
            :cx="pickerMetrics.arcCenter" :cy="pickerMetrics.arcCenter" :r="pickerMetrics.placementRadius"
            fill="none" stroke="#ffffff" :stroke-width="pickerMetrics.ringThickness - 4"
            stroke-linecap="round"
            :stroke-dasharray="`${pickerMetrics.arcLength} ${pickerMetrics.circum}`"
            :transform="`rotate(${-90 - pickerMetrics.arcSpan / 2} ${pickerMetrics.arcCenter} ${pickerMetrics.arcCenter})`"
          />
        </svg>

        <div class="picker-actions">
          <div class="pos-node node-count" :class="{ 'is-pulse': countPulse }">
            <span class="picker-count-value">{{ count }}</span>
            <span class="picker-count-label"></span>
          </div>
          
          <button class="pos-node node-minus" :disabled="!canDecrease" @click="decreaseCount" aria-label="减少">-</button>
          <button class="pos-node node-min" :disabled="!canDecrease" @click="setMinCount" aria-label="最小">MIN</button>
          
          <button class="pos-node node-plus" :disabled="!canIncrease" @click="increaseCount" aria-label="增加">+</button>
          <button class="pos-node node-max" :disabled="!canIncrease" @click="setMaxCount" aria-label="最大">MAX</button>

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
  pointer-events: none;
  z-index: 5;
}

.picker-svg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.svg-glow {
  animation: arc-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes arc-pulse {
  0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 6px rgba(60, 255, 220, 0.4)); }
  50% { opacity: 1; filter: drop-shadow(0 0 12px rgba(98, 204, 255, 0.8)); }
}

/* 节点容器属性 */

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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  pointer-events: auto;
  border: 1.5px solid rgba(120, 200, 255, 0.5);
  box-shadow: 0 4px 12px rgba(6, 22, 48, 0.4);
  background:#fff;
  color: #e9f7ff;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  backdrop-filter: blur(8px);
  outline: none;
}

.pos-node:not(:disabled):hover {
  border-color: rgba(60, 255, 220, 0.8);
  box-shadow: 0 6px 16px rgba(60, 255, 220, 0.4), inset 0 0 8px rgba(60, 255, 220, 0.2);
}

.pos-node:not(:disabled):active {
  filter: brightness(0.85);
}

.pos-node:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(1);
}

.node-count {
  width: var(--count-size);
  height: var(--count-size);
  transform: translate(-50%, -50%) translateY(calc(-1 * var(--placement-radius)));
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  cursor: default;
}
.node-count:hover {
  transform: translate(-50%, -50%) translateY(calc(-1 * var(--placement-radius))) scale(1.05) !important;
}

.picker-count-value {
  font-size: clamp(20px, calc(var(--count-size) * 0.5), 32px);
  line-height: 1.1;
  font-weight: bold;
  color: #333333;
  text-shadow: none;
}
.picker-count-label {
  font-size: clamp(8px, calc(var(--count-size) * 0.2), 11px);
  color: rgba(50, 50, 50, 0.75);
  letter-spacing: 1px;
}
.node-count.is-pulse .picker-count-value {
  animation: txt-pulse 0.25s ease-out;
}
@keyframes txt-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.node-minus {
  width: var(--btn-l-size); height: var(--btn-l-size); font-size: 20px;
  transform: translate(-50%, -50%) rotate(-20deg) translateY(calc(-1 * var(--placement-radius))) rotate(20deg);
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #333333;
  font-weight: bold;
}
.node-minus:hover { transform: translate(-50%, -50%) rotate(-20deg) translateY(calc(-1 * var(--placement-radius))) rotate(20deg) scale(1.1) !important; }

.node-plus {
  width: var(--btn-l-size); height: var(--btn-l-size); font-size: 20px;
  transform: translate(-50%, -50%) rotate(20deg) translateY(calc(-1 * var(--placement-radius))) rotate(-20deg);
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #333333;
  font-weight: bold;
}
.node-plus:hover { transform: translate(-50%, -50%) rotate(20deg) translateY(calc(-1 * var(--placement-radius))) rotate(-20deg) scale(1.1) !important; }

.node-min {
  width: var(--btn-s-size); height: var(--btn-s-size); font-size: 13px;
  transform: translate(-50%, -50%) rotate(-40deg) translateY(calc(-1 * var(--placement-radius))) rotate(40deg);
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #666666;
  font-weight: bold;
}
.node-min:hover { transform: translate(-50%, -50%) rotate(-40deg) translateY(calc(-1 * var(--placement-radius))) rotate(40deg) scale(1.1) !important; }

.node-max {
  width: var(--btn-s-size); height: var(--btn-s-size); font-size: 13px;
  transform: translate(-50%, -50%) rotate(40deg) translateY(calc(-1 * var(--placement-radius))) rotate(-40deg);
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #666666;
  font-weight: bold;
}
.node-max:hover { transform: translate(-50%, -50%) rotate(40deg) translateY(calc(-1 * var(--placement-radius))) rotate(-40deg) scale(1.1) !important; }

.node-close {
  width: var(--action-size); height: var(--action-size);
  transform: translate(-50%, -50%) rotate(-80deg) translateY(calc(-1 * var(--placement-radius))) rotate(80deg);
  border: 2px solid #ffb0b9;
  background-color: #ff9494;
  color: #ffffff;
}
.node-close:hover { 
  transform: translate(-50%, -50%) rotate(-80deg) translateY(calc(-1 * var(--placement-radius))) rotate(80deg) scale(1.1) !important; 
  border-color: rgba(255, 90, 110, 1);
  box-shadow: 0 4px 16px rgba(255, 90, 110, 0.4);
}

.node-confirm {
  width: var(--action-size); height: var(--action-size);
  transform: translate(-50%, -50%) rotate(80deg) translateY(calc(-1 * var(--placement-radius))) rotate(-80deg);
  border: 2px solid rgba(80, 255, 140, 0.6);
  color: #ffffff;
  background-color: #66ccff;
}
.node-confirm:hover { 
  transform: translate(-50%, -50%) rotate(80deg) translateY(calc(-1 * var(--placement-radius))) rotate(-80deg) scale(1.1) !important; 
  border-color: #17e3f2;
  box-shadow: 0 4px 16px rgba(80, 255, 140, 0.4);
}

.picker-pop-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.picker-pop-leave-active {
  transition: all 0.3s cubic-bezier(0.5, 0, 0.1, 1);
}
.picker-pop-enter-from,
.picker-pop-leave-to {
  opacity: 0;
  transform: scale(0.6) translateY(20px);
}

@keyframes count-pulse {
  0% {
    transform: translate(-50%, -50%) translateY(calc(-1 * var(--placement-radius))) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) translateY(calc(-1 * var(--placement-radius))) scale(1.08);
  }
  100% {
    transform: translate(-50%, -50%) translateY(calc(-1 * var(--placement-radius))) scale(1);
  }
}
</style>


