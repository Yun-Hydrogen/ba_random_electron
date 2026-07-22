<!--
================================================================================
  组件：Floating.vue
  所属：悬浮按钮窗口（主进程 BrowserWindow 直接加载，不经 vue-router）
  父组件：无（作为独立 Electron 窗口运行，路由为 /）

================================================================================
  一、功能概述
================================================================================
  本组件是悬浮按钮窗口的完整界面，包含三个视觉层次：

    层次          | 说明
    ──────────────┼──────────────────────────────────────────
    1. 悬浮按钮   | 可拖拽圆形按钮，居中显示，点击触发 picker
    2. 人数选择器 | 胶囊形控件条，悬浮按钮正上方，MIN/−/N/+/MAX
    3. 确认/取消  | 左右两侧圆形按钮（X 关闭 / ✓ 确认抽取）
  4. 鼠标穿透   | setShape 区域裁剪（D3D9 透明窗口唯一穿透方案）
  5. 淡入淡出   | 主进程 win.setOpacity() 窗口级动画

  2026-07-20 架构变更：
    - D3D9 作为全模式默认渲染后端。
    - setShape（SetWindowRgn）回归，D3D9 下透明窗口不支持像素级穿透。
    - 淡入淡出回归 win.setOpacity()（D3D9 下 JS/CSS 动画不被合成器逐帧执行）。
    - 展开态允许拖拽悬浮按钮。
    - 窗口最小尺寸从 340px 降至 200px。
    - FloatingButton 子组件已内联到本文件。

================================================================================
  二、数据流架构
================================================================================

  +-------------------------------------------------------------+
  |  主进程 (main.js / ipc.js)                                    |
  |  - floatingButtonApi.getConfig() → 返回 floatingButton 配置   |
  |  - floatingPickerApi.getConfig() → 返回 pickCountDialog 配置  |
  |  - floatingPickerApi.confirm(count) → 触发随机抽取            |
  |  - floatingButtonApi.setExpanded / startDrag / moveDrag ...  |
  +--------------------------+----------------------------------+
                             | IPC (contextBridge via preload.js)
                             v
  +-------------------------------------------------------------+
  |  Floating.vue（本组件）                                       |
  |                                                             |
  |  状态（refs）：                                              |
  |    sizePx, transparencyPercent, iconDataUrl, iconSize        |
  |    borderColor, count, isPickerOpen, countPulse              |
  |    pointerDown, isDragging, startGlobalX, rAF ...            |
  |                                                             |
  |  核心计算（computed）：                                       |
  |    pickerMetrics — 环形布局的几何参数（半径、尺寸等）          |
  |    pickerStyle   — CSS 自定义属性注入                         |
  |    canDecrease / canIncrease — 人数边界判断                   |
  +-------------------------------------------------------------+

================================================================================
  三、picker 展开/收缩机制
================================================================================

  打开 picker（用户点击悬浮按钮）：
    1. isPickerOpen = true
    2. watch 触发 → setExpanded(true, windowSize) 窗口扩大到容纳环绕控件

  关闭 picker（用户点击 X / ✓ 或确认抽取）：
    1. isPickerOpen = false
    2. watch 触发 → setExpanded(false) 窗口收缩为按钮大小

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
  淡入淡出：主进程 win.setOpacity()，与渲染后端无关

================================================================================
  六、维护注意事项
================================================================================
  - pickerMetrics 和 windows.js 的 getFloatingButtonWindowSize 使用了相同的
    尺寸计算公式，修改任一处需同步另一处
  - CSS 自定义属性（--size-px 等）由 pickerStyle computed 注入，模板中通过 var() 引用
  - .picker-layer 不得设置 pointer-events: none，否则所有子元素无法点击
  - .floating-root 严禁 width/height: 100%
  - watch(isPickerOpen) 是处理窗口展开/收缩和 setShape 切换的关键
  - 展开态拖拽已放开（handlePointerDown/Move 无 isPickerOpen 门控）

  最后更新：2026-07-20
================================================================================
-->
<template>
  <div
    class="floating-stage"
    :class="{ 'is-picker-open': isPickerOpen }"
    :style="pickerStyle"
  >

    <!-- ====== 第 1 层：悬浮按钮 ====== -->
    <div class="floating-root main-floating-btn">
      <button
        class="floating-button"
        :class="{ 'is-dragging': isDragging }"
        :style="buttonStyle"
        @contextmenu.prevent
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerCancel"
        title=""
      >
        <img :src="iconSrc" alt="随机抽取" draggable="false" :style="iconStyle" />
      </button>
    </div>

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

// ============================================================
//  1. 点击音效（Web Audio API）
// ============================================================
const CLICK_SOUND_GAIN = 1
const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const clickBufferPromise = fetch('/sound/button_click.wav')
  .then(r => r.arrayBuffer())
  .then(buf => audioContext.decodeAudioData(buf.slice(0)))

function playClickSound() {
  clickBufferPromise.then(async (buffer) => {
    if (audioContext.state === 'suspended') await audioContext.resume()
    const src = audioContext.createBufferSource()
    src.buffer = buffer
    const gain = audioContext.createGain()
    gain.gain.value = CLICK_SOUND_GAIN
    src.connect(gain).connect(audioContext.destination)
    src.start(0)
  }).catch(() => {})
}

// ============================================================
//  2. 按钮外观状态（从 floatingButtonApi.getConfig() 加载）
// ============================================================
const sizePx              = ref(50)
const transparencyPercent = ref(20)
const iconDataUrl         = ref('')
const iconSize            = ref(48)
const borderColor         = ref('#66ccff')

const styleOpacity = computed(() =>
  Math.max(0, Math.min(1, 1 - transparencyPercent.value / 100)))

const buttonStyle = computed(() => ({
  width: `${sizePx.value}px`,
  height: `${sizePx.value}px`,
  opacity: String(styleOpacity.value),
  borderColor: borderColor.value || '#66ccff'
}))

const iconSrc = computed(() =>
  (iconDataUrl.value || '').trim() || './image/app.ico')

const iconStyle = computed(() => {
  const maxPx = Math.max(16, Math.min(iconSize.value, Math.round(sizePx.value * 0.8)))
  return { width: `${maxPx}px`, height: `${maxPx}px` }
})

// ============================================================
//  3. 拖拽状态
// ============================================================
const DRAG_THRESHOLD_PX = 3

const pointerDown     = ref(false)
const activePointerId = ref(null)
const isDragging      = ref(false)
const startGlobalX    = ref(0)
const startGlobalY    = ref(0)
const pendingDx       = ref(0)
const pendingDy       = ref(0)
const rafId           = ref(0)

function getGlobalPoint(event) {
  const sx = Number(event.screenX)
  const sy = Number(event.screenY)
  if (Number.isFinite(sx) && Number.isFinite(sy)) return { x: sx, y: sy }
  return { x: window.screenX + event.clientX, y: window.screenY + event.clientY }
}

function flushMove() {
  if (!isDragging.value || !window.floatingButtonApi) { rafId.value = 0; return }
  window.floatingButtonApi.moveDrag(pendingDx.value, pendingDy.value)
  rafId.value = 0
}
function scheduleMove() {
  if (rafId.value !== 0) return
  rafId.value = window.requestAnimationFrame(flushMove)
}
function cancelScheduledMove() {
  if (rafId.value !== 0) { window.cancelAnimationFrame(rafId.value); rafId.value = 0 }
}

// ============================================================
//  4. 拖拽事件处理器
// ============================================================
function handlePointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  pointerDown.value = true
  activePointerId.value = event.pointerId
  isDragging.value = false

  /* 展开态也允许拖拽，方便调整位置后继续操作 picker */
  const pt = getGlobalPoint(event)
  startGlobalX.value = pt.x
  startGlobalY.value = pt.y
  pendingDx.value = 0
  pendingDy.value = 0
  cancelScheduledMove()
  if (event.currentTarget?.setPointerCapture) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

function handlePointerMove(event) {
  if (activePointerId.value !== event.pointerId) return
  if (!pointerDown.value || !window.floatingButtonApi) return

  const pt = getGlobalPoint(event)
  const dx = pt.x - startGlobalX.value
  const dy = pt.y - startGlobalY.value

  if (!isDragging.value && (Math.abs(dx) >= DRAG_THRESHOLD_PX || Math.abs(dy) >= DRAG_THRESHOLD_PX)) {
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

  if (isDragging.value && window.floatingButtonApi) {
    const pt = getGlobalPoint(event)
    cancelScheduledMove()
    window.floatingButtonApi.moveDrag(pt.x - startGlobalX.value, pt.y - startGlobalY.value)
    window.floatingButtonApi.endDrag()
  } else if (!isDragging.value) {
    playClickSound()
    handleFloatingButtonClick()
  }

  pointerDown.value = false
  activePointerId.value = null
  isDragging.value = false
  if (event.currentTarget?.releasePointerCapture) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
}

function handlePointerCancel(event) {
  if (activePointerId.value !== null && activePointerId.value !== event.pointerId) return
  if (isDragging.value && window.floatingButtonApi) {
    cancelScheduledMove()
    window.floatingButtonApi.endDrag()
  }
  pointerDown.value = false
  activePointerId.value = null
  isDragging.value = false
}

// ============================================================
//  5. 人数选择器状态
// ============================================================
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

// ============================================================
//  6. 环形布局几何计算（pickerMetrics）
// ============================================================
const pickerMetrics = computed(() => {
  const base = Math.max(40, sizePx.value)
  const actionBtnSize = Math.round(Math.max(36, base * 0.7))
  const btnSize = actionBtnSize
  const ringThickness = actionBtnSize
  const countSize = actionBtnSize
  const placementRadius = Math.round(Math.max(55, base * 1.05))
  const ringRadius = placementRadius + Math.round(ringThickness / 2)
  const windowSize = Math.round(Math.max(200, ringRadius * 2 + 40))
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
//  7. CSS 自定义属性注入（pickerStyle）
// ============================================================
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

// ============================================================
//  8. 人数脉冲动画
// ============================================================
function triggerPulse() {
  countPulse.value = false
  if (pulseTimer) clearTimeout(pulseTimer)
  window.requestAnimationFrame(() => { countPulse.value = true })
  pulseTimer = window.setTimeout(() => { countPulse.value = false }, 260)
}

// ============================================================
//  9. 初始化配置（从主进程加载）
// ============================================================
async function initConfig() {
  if (window.floatingButtonApi) {
    const cfg = await window.floatingButtonApi.getConfig()
    sizePx.value              = Math.round(50 * (cfg.sizePercent / 100))
    transparencyPercent.value = cfg.transparencyPercent
    iconDataUrl.value         = cfg.iconDataUrl || ''
    iconSize.value            = cfg.iconSize || 48
    borderColor.value         = cfg.borderColor || '#66ccff'
  }

  if (window.floatingPickerApi) {
    const pickCfg = await window.floatingPickerApi.getConfig()
    count.value = clampInt(pickCfg.defaultCount, MIN_COUNT, MAX_COUNT, MIN_COUNT)
  }
}

// ============================================================
//  10. picker 开关逻辑
// ============================================================
function handleFloatingButtonClick() { isPickerOpen.value = !isPickerOpen.value }
function handleClosePicker()         { isPickerOpen.value = false }

function handleConfirm() {
  const selectedCount = clampInt(count.value, MIN_COUNT, MAX_COUNT, MIN_COUNT)
  isPickerOpen.value = false
  /*
   * 延迟触发抽取，让 shape 先收缩为按钮大小（~220ms），
   * 再由主进程 fadeOut。避免大窗口下淡出被截断。
   */
  setTimeout(() => {
    if (window.floatingPickerApi) {
      window.floatingPickerApi.confirm(selectedCount)
    }
  }, 250)
}

// ============================================================
//  11. 人数增减操作
// ============================================================
function increaseCount() { if (canIncrease.value) { count.value += 1; triggerPulse() } }
function decreaseCount() { if (canDecrease.value) { count.value -= 1; triggerPulse() } }
function setMinCount()   { if (count.value !== MIN_COUNT) { count.value = MIN_COUNT; triggerPulse() } }
function setMaxCount()   { if (count.value !== MAX_COUNT) { count.value = MAX_COUNT; triggerPulse() } }

// ============================================================
//  12. 鼠标穿透（setShape 区域裁剪）
//
//  D3D9 下透明窗口不支持像素级命中测试。
//  使用 setShape（SetWindowRgn）在 OS 层面精确裁剪窗口命中区域：
//    收缩态：仅悬浮按钮矩形区域捕获鼠标
//    展开态：大矩形覆盖按钮 + 胶囊 + X/✓ 整个控件区域
//  矩形外区域自动穿透鼠标事件，零性能开销。
// ============================================================

const shapeExpanded = ref(false)
let shapeCloseTimer = null

function applyShape(expanded) {
  if (!window.floatingButtonApi || typeof window.floatingButtonApi.setShape !== 'function') return
  const w = pickerMetrics.value.windowSize

  if (expanded) {
    /* 展开态：一个大矩形覆盖整个控件区域（按钮 + 上方胶囊 + 两侧按钮） */
    const bs = sizePx.value + 20
    const bh = bs / 2
    const rad = pickerMetrics.value.placementRadius
    const actHalf = pickerMetrics.value.actionBtnSize * 0.65
    const ringH = pickerMetrics.value.ringThickness
    const capTop = w / 2 - (sizePx.value / 2) - ringH - 10
    const btnBottom = w / 2 + bh
    const pad = 6
    const rx = Math.round(w / 2 - rad - actHalf - pad)
    const ry = Math.round(capTop - pad)
    const rw = Math.round(rad * 2 + actHalf * 2 + pad * 2)
    const rh = Math.round(btnBottom - capTop + pad * 2)
    window.floatingButtonApi.setShape([{ x: rx, y: ry, width: rw, height: rh }])
  } else {
    /* 收缩态：仅按钮矩形（含少量 padding 便于点击） */
    const bs = sizePx.value + 20
    const bx = Math.round((w - bs) / 2)
    const by = Math.round((w - bs) / 2)
    window.floatingButtonApi.setShape([{ x: bx, y: by, width: bs, height: bs }])
  }
  shapeExpanded.value = expanded
}

watch(isPickerOpen, (open) => {
  if (!window.floatingButtonApi) return
  if (shapeCloseTimer) { clearTimeout(shapeCloseTimer); shapeCloseTimer = null }

  if (open) {
    count.value = MIN_COUNT
    applyShape(true)
  } else {
    /* 延迟收缩 shape，等 CSS leave 动画播完（~220ms）再切小矩形 */
    shapeCloseTimer = setTimeout(() => {
      applyShape(false)
      shapeCloseTimer = null
    }, 220)
  }

  if (typeof window.floatingButtonApi.setExpanded === 'function') {
    window.floatingButtonApi.setExpanded(open)
  }
})

watch([sizePx, pickerMetrics], () => {
  if (shapeExpanded.value) applyShape(true)
  else applyShape(false)
})

// ============================================================
//  13. 生命周期
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

  /*
   * 淡入淡出由主进程 win.setOpacity() 驱动（SetLayeredWindowAttributes），
   * 渲染进程不参与动画。
   */
  opacity: 1;
}

/* 悬浮按钮在舞台中的层级（高于 picker-layer 的 z-index: 5） */
.main-floating-btn {
  z-index: 10;
  position: relative;
}

/* =================================================================
   2. 悬浮按钮本体
   ================================================================= */

.floating-root {
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  padding: 10px;
  border: 2px solid #66ccff;
  border-radius: 50%;
  outline: none;
  cursor: pointer;
  background: #fff;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 260ms ease, box-shadow 260ms ease, background 260ms ease, border-color 260ms ease;
}

.floating-button:hover:not(.is-dragging) {
  background: #fff;
  border-color: rgba(40, 130, 230, 0.9);
}

.floating-button.is-dragging {
  transition: none;
}

.floating-button img {
  width: 120%;
  height: 120%;
  object-fit: contain;
  pointer-events: none;
}

/* =================================================================
   3. picker 层（含胶囊条 + X/✓ 按钮）
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

/* =================================================================
   4. 胶囊形控件条（悬浮按钮正上方）
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

/* 竖线分隔符（MIN | − | 人数 | + | MAX 中的 |） */
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
   5. X / ✓ 操作按钮容器
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
   6. picker 进出场动画（Vue Transition）
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
   7. 人数脉冲动画 keyframes
   ================================================================= */
@keyframes txt-pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}
</style>
