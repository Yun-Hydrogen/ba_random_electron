<!--
================================================================================
  组件：Floating.vue
  所属：悬浮按钮窗口（主进程 BrowserWindow 直接加载，不经 vue-router）
  父组件：无（作为独立 Electron 窗口运行，路由为 /）

================================================================================
  一、功能概述
================================================================================
  本组件是悬浮按钮窗口的完整界面，包含三个视觉层次：

    层次          | 组件            | 说明
    ──────────────┼─────────────────┼──────────────────────────────────────────
    1. 悬浮按钮   | FloatingButton  | 可拖拽圆形按钮，居中显示，点击触发 picker
    2. 人数选择器 | picker-capsule  | 胶囊形控件条，悬浮按钮正上方，MIN/−/N/+/MAX
    3. 确认/取消  | picker-actions  | 左右两侧圆形按钮（X 关闭 / ✓ 确认抽取）

================================================================================
  二、数据流架构
================================================================================

  +-------------------------------------------------------------+
  |  主进程 (main.js / ipc.js)                                    |
  |  - floatingButtonApi.getConfig() → 返回 floatingButton 配置   |
  |  - floatingPickerApi.getConfig() → 返回 pickCountDialog 配置  |
  |  - floatingPickerApi.confirm(count) → 触发随机抽取            |
  |  - floatingButtonApi.setExpanded / setIgnoreMouseEvents       |
  +--------------------------+----------------------------------+
                             | IPC (contextBridge via preload.js)
                             v
  +-------------------------------------------------------------+
  |  Floating.vue（本组件）                                       |
  |                                                             |
  |  状态（refs）：                                              |
  |    sizePx, transparencyPercent, iconDataUrl, iconSize        |
  |    borderColor, count, isPickerOpen, countPulse              |
  |                                                             |
  |  核心计算（computed）：                                       |
  |    pickerMetrics — 环形布局的几何参数（半径、尺寸等）          |
  |    pickerStyle   — CSS 自定义属性注入                         |
  |    canDecrease / canIncrease — 人数边界判断                   |
  |                                                             |
  |  子组件：FloatingButton（接收 props + @click 事件）            |
  +-------------------------------------------------------------+

================================================================================
  三、picker 展开/收缩机制
================================================================================

  打开 picker（用户点击悬浮按钮）：
    1. isPickerOpen = true
    2. watch 触发 → setIgnoreMouseEvents(false)  强制捕获鼠标
    3. watch 触发 → setExpanded(true, windowSize) 窗口扩大到容纳环绕控件

  关闭 picker（用户点击 X / ✓ 或确认抽取）：
    1. isPickerOpen = false
    2. watch 触发 → setExpanded(false)            窗口收缩为按钮大小
    3. 鼠标穿透由 FloatingButton 根据 hover 状态自行管理

  为什么用 watch 而非直接在 setPickerOpen 中调用 IPC：
    Vue 的 prop 传递是异步的（nextTick），如果在 setPickerOpen 中立即调用
    setExpanded，FloatingButton 的 dragDisabled prop 可能尚未更新，
    导致 updateIgnoreMouse() 做出错误的穿透决策。watch 确保 prop 传播完成后再执行。

================================================================================
  四、pickerMetrics 几何计算
================================================================================
  环绕人数选择器是一个环形排列的 UI，需要计算：
    - 按钮核心尺寸（sizePx）→ 确认/取消按钮大小（actionBtnSize）
    - 环形排列半径（placementRadius）→ 环半径（ringRadius）
    - 窗口总尺寸（windowSize = ringRadius × 2 + 40）

  所有尺寸通过 CSS 自定义属性（--size-px, --ring-radius 等）注入到模板，
  实现 JS 计算 + CSS 渲染的分离。

================================================================================
  五、主题与样式
================================================================================
  胶囊条：白底 + #66ccff 边框 + 人数格 #66ccff 蓝底白字
  关闭按钮：粉色系（#ff9494 背景 + 红色阴影）
  确认按钮：蓝色系（#66ccff 背景 + 蓝绿阴影）
  入场动画：0.22s 飞入（scale 0.85→1 + translateY 12px→0）
  退场动画：0.18s 淡出
  人数脉冲：0.25s scale 弹跳

================================================================================
  六、维护注意事项
================================================================================
  - pickerMetrics 和 windows.js 的 getFloatingButtonWindowSize 使用了相同的
    尺寸计算公式，修改任一处需同步另一处
  - CSS 自定义属性（--size-px 等）由 pickerStyle computed 注入，模板中通过 var() 引用
  - .picker-layer 不得设置 pointer-events: none，否则所有子元素无法点击
  - FloatingButton 的 .floating-root 严禁 width/height: 100%
  - watch(isPickerOpen) 是处理 prop 异步传播的关键，不要改为直接调用

  最后更新：2026-06-28
================================================================================
-->
<template>
  <div class="floating-stage" :class="{ 'is-picker-open': isPickerOpen }" :style="pickerStyle">

    <!-- ====== 第 1 层：悬浮按钮（FloatingButton 子组件） ====== -->
    <FloatingButton
      class="main-floating-btn"
      :size-px="sizePx"
      :transparency-percent="transparencyPercent"
      :icon-data-url="iconDataUrl"
      :icon-size="iconSize"
      :border-color="borderColor"
      :drag-disabled="isPickerOpen"
      @click="handleFloatingButtonClick"
    />

    <!-- ====== 第 2 层：人数选择器 + 确认/取消（Vue Transition 控制进出动画） ====== -->
    <transition name="picker-pop">
      <div v-if="isPickerOpen" class="picker-layer" aria-live="polite">

        <!--
          胶囊形控件条：悬浮按钮正上方
          从左到右：MIN | − | 人数 | + | MAX
        -->
        <div class="picker-capsule">
          <button class="capsule-btn" :disabled="!canDecrease" @click="setMinCount" aria-label="最小">MIN</button>
          <span class="capsule-divider"></span>
          <button class="capsule-btn" :disabled="!canDecrease" @click="decreaseCount" aria-label="减少">-</button>
          <span class="capsule-divider"></span>
          <div class="capsule-count" :class="{ 'is-pulse': countPulse }">
            <span class="capsule-count-value">{{ count }}</span>
          </div>
          <span class="capsule-divider"></span>
          <button class="capsule-btn" :disabled="!canIncrease" @click="increaseCount" aria-label="增加">+</button>
          <span class="capsule-divider"></span>
          <button class="capsule-btn" :disabled="!canIncrease" @click="setMaxCount" aria-label="最大">MAX</button>
        </div>

        <!--
          X 关闭（左侧）与 ✓ 确认（右侧）圆形按钮
          通过 CSS transform rotate 定位到悬浮按钮左右两侧
        -->
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
// ============================================================
//  导入依赖
// ============================================================
import { ref, computed, watch, onMounted } from 'vue'
import FloatingButton from '../components/FloatingButton.vue'

// ============================================================
//  1. 按钮外观状态（从 floatingButtonApi.getConfig() 加载）
// ============================================================

/* 按钮核心像素尺寸：50 × (sizePercent/100)，默认 50px */
const sizePx = ref(50)

/* 透明度百分比：0=不透明，100=全透明，默认 20 */
const transparencyPercent = ref(20)

/* 自定义图标（base64 data URL），空字符串 = 使用内置默认图标 */
const iconDataUrl = ref('')

/* 图标在按钮内的显示尺寸（px），默认 48，实际被限制为按钮的 80% */
const iconSize = ref(48)

/* 按钮圆形边框颜色（hex），默认 #66ccff */
const borderColor = ref('#66ccff')

// ============================================================
//  2. 人数选择器状态
// ============================================================

/* 当前选择的人数（1-10） */
const count = ref(1)

/* 人数选择器是否展开 */
const isPickerOpen = ref(false)

/* 人数变更时的脉冲动画触发器 */
const countPulse = ref(false)

/* 人数范围常量 */
const MIN_COUNT = 1
const MAX_COUNT = 10

/* 脉冲动画定时器句柄（用于取消上一个动画） */
let pulseTimer = null

// ============================================================
//  3. 工具函数
// ============================================================

/*
 * 整数范围裁剪。
 * 非数字或 Infinity 返回 fallback，否则 clamp 到 [min, max] 并取整。
 */
function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

// ============================================================
//  4. 环形布局几何计算（pickerMetrics）
// ============================================================

/*
 * 计算环绕人数选择器的所有几何参数。
 *
 * 公式链（与 windows.js 的 getFloatingButtonWindowSize 保持一致）：
 *   base            = max(40, sizePx)
 *   actionBtnSize   = max(36, base × 0.7)    // X/✓ 按钮大小
 *   placementRadius = max(55, base × 1.05)    // 环形排列半径
 *   ringRadius      = placementRadius + ringThickness/2
 *   windowSize      = max(340, ringRadius × 2 + 40)
 *
 * 返回 11 个几何值，通过 pickerStyle 转为 CSS 自定义属性。
 */
const pickerMetrics = computed(() => {
  const base = Math.max(40, sizePx.value)
  const actionBtnSize = Math.round(Math.max(36, base * 0.7))
  const btnSize = actionBtnSize
  const ringThickness = actionBtnSize
  const countSize = actionBtnSize
  const placementRadius = Math.round(Math.max(55, base * 1.05))
  const ringRadius = placementRadius + Math.round(ringThickness / 2)
  const windowSize = Math.round(Math.max(340, ringRadius * 2 + 40))
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

// ============================================================
//  5. CSS 自定义属性注入（pickerStyle）
// ============================================================

/*
 * 将 pickerMetrics 的数值转为 CSS 自定义属性（--xxx）。
 * 模板中的 CSS 通过 var(--size-px) 等引用这些值，
 * 实现 JS 计算尺寸 + CSS 渲染布局的分离。
 */
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

// ============================================================
//  6. 人数边界判断
// ============================================================

/* 是否可以继续减少（count > 1） */
const canDecrease = computed(() => count.value > MIN_COUNT)

/* 是否可以继续增加（count < 10） */
const canIncrease = computed(() => count.value < MAX_COUNT)

// ============================================================
//  7. 人数脉冲动画
// ============================================================

/*
 * 触发人数格子的缩放弹跳动画（0.25s）。
 * 使用 requestAnimationFrame 重置动画状态，确保连续点击时动画重新播放。
 */
function triggerPulse() {
  countPulse.value = false
  if (pulseTimer) clearTimeout(pulseTimer)
  window.requestAnimationFrame(() => { countPulse.value = true })
  pulseTimer = window.setTimeout(() => { countPulse.value = false }, 260)
}

// ============================================================
//  8. 初始化配置（从主进程加载）
// ============================================================

/*
 * 组件挂载时调用，从主进程通过 IPC 获取配置。
 *
 * floatingButtonApi.getConfig() 返回 floatingButton 对象：
 *   sizePercent, transparencyPercent, iconDataUrl, iconSize, borderColor
 *
 * floatingPickerApi.getConfig() 返回 pickCountDialog 对象：
 *   defaultCount（1-10）
 */
async function initConfig() {
  if (window.floatingButtonApi) {
    const cfg = await window.floatingButtonApi.getConfig()
    sizePx.value = Math.round(50 * (cfg.sizePercent / 100))
    transparencyPercent.value = cfg.transparencyPercent
    iconDataUrl.value = cfg.iconDataUrl || ''
    iconSize.value = cfg.iconSize || 48
    borderColor.value = cfg.borderColor || '#66ccff'
  }

  if (window.floatingPickerApi) {
    const pickCfg = await window.floatingPickerApi.getConfig()
    count.value = clampInt(pickCfg.defaultCount, MIN_COUNT, MAX_COUNT, MIN_COUNT)
  }
}

// ============================================================
//  9. picker 开关逻辑
// ============================================================

/* 纯状态设置（不执行副作用，副作用由 watch 处理） */
function setPickerOpen(open) { isPickerOpen.value = open }

/* 点击悬浮按钮 → 切换 picker 开关 */
function handleFloatingButtonClick() { setPickerOpen(!isPickerOpen.value) }

/* 点击 X 关闭按钮 → 关闭 picker */
function handleClosePicker() { setPickerOpen(false) }

/*
 * 点击 ✓ 确认按钮 → 校验人数 → 关闭 picker → 通过 IPC 触发抽取。
 * 抽取的实际执行在 windows.js 的 pickStudentsByWeight() 中。
 */
function handleConfirm() {
  const selectedCount = clampInt(count.value, MIN_COUNT, MAX_COUNT, MIN_COUNT)
  setPickerOpen(false)
  if (window.floatingPickerApi) {
    window.floatingPickerApi.confirm(selectedCount)
  }
}

// ============================================================
//  10. 人数增减操作
// ============================================================

function increaseCount() { if (canIncrease.value) { count.value += 1; triggerPulse() } }
function decreaseCount() { if (canDecrease.value) { count.value -= 1; triggerPulse() } }
function setMinCount()   { if (count.value !== MIN_COUNT) { count.value = MIN_COUNT; triggerPulse() } }
function setMaxCount()   { if (count.value !== MAX_COUNT) { count.value = MAX_COUNT; triggerPulse() } }

// ============================================================
//  11. picker 展开/收缩的窗口副作用
// ============================================================

/*
 * 监听 isPickerOpen 变化，执行窗口级别的副作用。
 *
 * 为什么用 watch 而非在 setPickerOpen 中直接调用：
 *   Vue 的 prop 传递是异步的。如果在 setPickerOpen 中立即调用
 *   setExpanded，FloatingButton 的 dragDisabled prop 可能尚未更新，
 *   导致 updateIgnoreMouse() 使用过期的 prop 值做出错误决策。
 *   watch 在 Vue 完成响应式传播后才触发，确保时序正确。
 */
watch(isPickerOpen, (open) => {
  if (!window.floatingButtonApi) return

  if (open) {
    /* 打开 picker：重置人数、强制捕获鼠标、扩大窗口 */
    count.value = MIN_COUNT
    window.floatingButtonApi.setIgnoreMouseEvents(false)
    if (typeof window.floatingButtonApi.setExpanded === 'function') {
      const size = pickerMetrics.value.windowSize
      window.floatingButtonApi.setExpanded(true, { width: size, height: size })
    }
  } else {
    /* 关闭 picker：收缩窗口，穿透状态由 FloatingButton 管理 */
    if (typeof window.floatingButtonApi.setExpanded === 'function') {
      window.floatingButtonApi.setExpanded(false)
    }
  }
})

// ============================================================
//  12. 生命周期
// ============================================================
onMounted(() => { initConfig() })
</script>

<style scoped>
/*
 *  本文件 CSS 为 scoped。
 *  按功能分为 8 个分组，每组以分隔注释标识。
 *  大量使用 CSS 自定义属性（--size-px 等），由 pickerStyle computed 注入。
 */

/* =================================================================
   1. 舞台容器
   ================================================================= */

/*
 *  全屏 grid 容器，子元素居中（place-items: center）。
 *  overflow: hidden 防止环形控件超出窗口边界。
 */
.floating-stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-family: 'Bahnschrift', 'Segoe UI Variable', 'Microsoft YaHei UI', 'PingFang SC', sans-serif;
  overflow: hidden;
}

/* 悬浮按钮在舞台中的层级（高于 picker-layer 的 z-index: 5） */
.main-floating-btn {
  z-index: 10;
  position: relative;
}

/* =================================================================
   2. picker 层（含胶囊条 + X/✓ 按钮）
   ================================================================= */

/*
 *  绝对定位覆盖整个窗口。
 *  不得设置 pointer-events: none（否则所有子元素无法点击）。
 */
.picker-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

/* 隐藏的 SVG 定义容器（未使用） */
.picker-svg {
  display: none;
}

/* =================================================================
   3. 胶囊形控件条（悬浮按钮正上方）
   ================================================================= */

/*
 *  定位：按钮上方 8px 处。
 *  transform: translate(-50%, calc(-50% - buttonHalf - ringHalf - 8px))
 *  白底 + #66ccff 边框 + 999px 圆角 = 完美胶囊形。
 */
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
  background: #fff;
  border: 2px solid #66ccff;
  pointer-events: auto;
  z-index: 7;
  white-space: nowrap;
}

/*
 *  胶囊内的按钮（MIN / - / + / MAX）。
 *  透明背景，hover 时浅蓝底，disabled 时灰化。
 */
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
  font-family: 'Bahnschrift', 'Segoe UI Variable', 'Microsoft YaHei UI', sans-serif;
  cursor: pointer;
  outline: none;
  border-radius: 999px;
  letter-spacing: 0.3px;
  transition: all 0.2s ease;
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

/* - / + 按钮：字体更大，确保 UI 重心突出 */
.capsule-btn:nth-of-type(2),
.capsule-btn:nth-of-type(3) {
  font-size: clamp(24px, calc(var(--ring-thickness) * 0.42), 24px);
  min-width: calc(var(--ring-thickness) * 0.65);
  line-height: 1;
}

/* 竖线分隔符（MIN | - | 人数 | + | MAX 中的 |） */
.capsule-divider {
  display: inline-block;
  width: 1px;
  height: calc(var(--ring-thickness) * 0.45);
  background: rgba(102, 170, 220, 0.3);
  flex-shrink: 0;
}

/*
 *  当前人数显示格。
 *  #66ccff 蓝底 + 白色粗体数字 + 圆角矩形。
 *  align-self: stretch 撑满胶囊高度。
 */
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
  font-family: 'Bahnschrift', 'Segoe UI Variable', 'Microsoft YaHei UI', sans-serif;
}

.capsule-count-value {
  line-height: 1;
}

/* 人数脉冲动画：缩放弹跳 0.25s */
.capsule-count.is-pulse .capsule-count-value {
  animation: txt-pulse 0.25s ease-out;
}

/* =================================================================
   4. X / ✓ 操作按钮容器
   ================================================================= */

/*
 *  绝对定位在窗口中心，width/height 为 0（不占空间），
 *  子按钮通过 transform 位移到悬浮按钮左右两侧。
 *  pointer-events: none 使容器本身不拦截鼠标事件。
 */
.picker-actions {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}

/*
 *  确认/取消按钮的基础样式。
 *  transform: translate(-50%, -50%) rotate(±90deg) translateY(-radius) rotate(∓90deg)
 *  这个组合实现"以悬浮按钮为中心，左右各偏移 radius 距离"的定位。
 */
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
  outline: none;
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* X 关闭按钮：粉色系（#ff9494 背景 + 红色阴影） */
.node-close {
  width: calc(var(--action-size) * 1.2);
  height: calc(var(--action-size) * 1.2);
  transform: translate(-50%, -50%) rotate(-90deg) translateY(calc(-1 * var(--placement-radius))) rotate(90deg);
  border-radius: 50%;
  border: 2px solid #ffb0b9;
  background: #ff9494;
  box-shadow: 0 4px 12px rgba(255, 120, 140, 0.3);
  color: #ffffff;
}

.node-close:hover {
  transform: translate(-50%, -50%) rotate(-90deg) translateY(calc(-1 * var(--placement-radius))) rotate(90deg) !important;
  border-color: rgba(255, 90, 110, 1);
  box-shadow: 0 4px 16px rgba(255, 90, 110, 0.5);
  filter: none;
}

/* ✓ 确认按钮：蓝色系（#66ccff 背景 + 蓝绿阴影） */
.node-confirm {
  width: calc(var(--action-size) * 1.2);
  height: calc(var(--action-size) * 1.2);
  transform: translate(-50%, -50%) rotate(90deg) translateY(calc(-1 * var(--placement-radius))) rotate(-90deg);
  border-radius: 50%;
  border: 2px solid rgba(166, 233, 255, 0.6);
  background: #66ccff;
  box-shadow: 0 4px 12px rgba(102, 204, 255, 0.3);
  color: #ffffff;
}

.node-confirm:hover {
  transform: translate(-50%, -50%) rotate(90deg) translateY(calc(-1 * var(--placement-radius))) rotate(-90deg) !important;
  border-color: #17e3f2;
  box-shadow: 0 4px 16px rgba(80, 255, 140, 0.5);
  filter: none;
}

/* =================================================================
   5. picker 进出场动画（Vue Transition）
   ================================================================= */

/* 入场：0.22s 飞入（缩小 + 下移 → 正常） */
.picker-pop-enter-active {
  transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 退场：0.18s 淡出 */
.picker-pop-leave-active {
  transition: all 0.18s cubic-bezier(0.5, 0, 0.1, 1);
}

.picker-pop-enter-from,
.picker-pop-leave-to {
  opacity: 0;
  transform: scale(0.85) translateY(12px);
}

/* =================================================================
   6. 人数脉冲动画 keyframes
   ================================================================= */
@keyframes txt-pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}
</style>
