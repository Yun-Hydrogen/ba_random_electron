<!--
================================================================================
  组件：UiColorPicker.vue
  所属：RizUI（src/renderer/RizUI）
  类型：颜色选择器组件

================================================================================
  一、功能
================================================================================
  内置触发 swatch + HSL 调色盘 Dialog。v-model 绑定 hex 颜色值。
  拖拽选取饱和度/明度（SV 面板）+ 色相条，支持 hex 直接输入。

================================================================================
  二、Props
================================================================================
  modelValue — v-model 绑定的 hex 颜色（如 "#66ccff"）
  color      — 主题色，用于 swatch hover 边框和 Dialog 按钮（默认 #39c5bb）
  teleport   — Dialog 挂载目标选择器，默认 "body"。设为 ".config-left" 则仅覆盖左面板

================================================================================
  三、使用示例

    // 挂载到 body（全屏遮罩）
    // <UiColorPicker v-model="color" :color="tabTheme" />

    // 挂载到指定容器（避免遮挡右侧日志面板）
    // <UiColorPicker v-model="color" :color="tabTheme" teleport=".config-left" />

================================================================================
-->
<template>
  <div class="ucp-root">
    <!-- 触发 swatch -->
    <div class="ucp-swatch" @click="open">
      <span class="ucp-swatch-dot" :style="{ background: modelValue || '#ffffff' }"></span>
      <span class="ucp-swatch-hex">{{ modelValue || '#ffffff' }}</span>
    </div>

    <!-- Dialog -->
    <Teleport :to="teleport">
      <Transition name="ucp-dialog">
        <div v-if="show" class="ucp-overlay" :class="{ 'ucp-anchored': isAnchored }" @click.self="cancel">
        <div class="ucp-dialog">
          <div class="ucp-header">
            <span>选取颜色</span>
            <button class="ucp-close" @click="cancel">✕</button>
          </div>

          <!-- SV 面板 -->
          <div class="ucp-sv" ref="svRef" :style="svBg" @mousedown="startSVDrag" @touchstart.prevent="startSVDrag">
            <div class="ucp-sv-thumb" :style="{ left: svX + '%', top: svY + '%' }"></div>
          </div>

          <!-- 色相条 -->
          <div class="ucp-hue" ref="hueRef" @mousedown="startHueDrag" @touchstart.prevent="startHueDrag">
            <div class="ucp-hue-thumb" :style="{ left: huePct + '%' }"></div>
          </div>

          <!-- 底部 -->
          <div class="ucp-footer">
            <span class="ucp-preview" :style="{ background: tempColor }"></span>
            <input
              type="text"
              class="ucp-hex"
              :value="tempColor"
              @input="onHexInput"
              @blur="onHexBlur"
              placeholder="#ffffff"
            />
            <button class="ucp-confirm" :style="confirmStyle" @click="confirm">确定</button>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '#ffffff' },
  color:      { type: String, default: '#39c5bb' },
  teleport:   { type: String, default: 'body' }
})

const emit = defineEmits(['update:modelValue'])

/* Teleport 到非 body 容器时标记 anchored */
const isAnchored = computed(() => props.teleport !== 'body')

/* ---- 状态 ---- */
const show = ref(false)
const tempColor = ref('#ffffff')
const svRef = ref(null)
const hueRef = ref(null)
const hueVal = ref(0)
const huePct = ref(0)
const svX = ref(100)
const svY = ref(0)
let dragHue = false
let dragSV = false

/* ---- 计算属性 ---- */
const svBg = computed(() => {
  const base = hslToHex(hueVal.value, 100, 50)
  return { background: `linear-gradient(to right, #fff, ${base})` }
})

const confirmStyle = computed(() => ({
  background: props.color,
  borderColor: props.color
}))

/* ---- HSL ↔ Hex ---- */
function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0') }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHsl(hex) {
  let r = 0, g = 0, b = 0; hex = hex.replace('#', '')
  if (hex.length === 3) { r = parseInt(hex[0] + hex[0], 16) / 255; g = parseInt(hex[1] + hex[1], 16) / 255; b = parseInt(hex[2] + hex[2], 16) / 255 }
  else if (hex.length >= 6) { r = parseInt(hex.slice(0, 2), 16) / 255; g = parseInt(hex.slice(2, 4), 16) / 255; b = parseInt(hex.slice(4, 6), 16) / 255 }
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h2 = 0, s2 = 0
  if (max !== min) { const d = max - min; s2 = l > 0.5 ? d / (2 - max - min) : d / (max + min); if (max === r) h2 = ((g - b) / d + (g < b ? 6 : 0)) / 6; else if (max === g) h2 = ((b - r) / d + 2) / 6; else h2 = ((r - g) / d + 4) / 6 }
  h2 = Math.round(h2 * 360); if (h2 < 0) h2 += 360
  return { h: h2, s: Math.round(s2 * 100), l: Math.round(l * 100) }
}

/* ---- 面板 ↔ hex ---- */
function syncFromHex(hex) {
  const hsl = hexToHsl(hex)
  hueVal.value = hsl.h
  huePct.value = (hsl.h / 360) * 100
  svX.value = hsl.s
  const denom = 100 - hsl.s * 0.5
  svY.value = denom > 0 ? Math.max(0, Math.min(100, Math.round(100 - hsl.l * 100 / denom))) : 0
}

function updateFromHSL() {
  const s = svX.value
  const baseL = 100 - s * 0.5
  const l = Math.round(baseL * (100 - svY.value) / 100)
  tempColor.value = hslToHex(hueVal.value, s, l)
}

/* ---- 开关 ---- */
function open() {
  tempColor.value = props.modelValue || '#ffffff'
  syncFromHex(tempColor.value)
  show.value = true
}

function confirm() {
  emit('update:modelValue', tempColor.value)
  show.value = false
}

function cancel() {
  show.value = false
}

/* ---- hex 输入 ---- */
function onHexInput(e) {
  const v = e.target.value.trim()
  tempColor.value = v
  if (/^#[0-9a-fA-F]{6}$/.test(v)) syncFromHex(v)
}

function onHexBlur() {
  if (/^#[0-9a-fA-F]{6}$/.test(tempColor.value)) syncFromHex(tempColor.value)
}

/* ---- 拖拽 ---- */
function hueFromX(cx) {
  const r = hueRef.value.getBoundingClientRect()
  const p = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100))
  huePct.value = p
  hueVal.value = Math.round((p / 100) * 360)
  updateFromHSL()
}

function startHueDrag(e) {
  dragHue = true
  hueFromX(e.clientX || e.touches[0].clientX)
}

function svFromClient(cx, cy) {
  const r = svRef.value.getBoundingClientRect()
  svX.value = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100))
  svY.value = Math.max(0, Math.min(100, ((cy - r.top) / r.height) * 100))
  updateFromHSL()
}

function startSVDrag(e) {
  dragSV = true
  svFromClient(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY)
}

function onMove(e) {
  if (dragHue) hueFromX(e.clientX || e.touches[0].clientX)
  if (dragSV) svFromClient(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY)
}

function onUp() { dragHue = false; dragSV = false }

onMounted(() => {
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.addEventListener('touchmove', onMove, { passive: false })
  document.addEventListener('touchend', onUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMove)
  document.removeEventListener('mouseup', onUp)
  document.removeEventListener('touchmove', onMove)
  document.removeEventListener('touchend', onUp)
})
</script>

<style scoped>
/* ---- 根容器 ---- */
.ucp-root {
  display: inline-flex;
  align-items: center;
}

/* ---- 触发 swatch ---- */
.ucp-swatch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border: 1.5px solid #d0d8e0;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  user-select: none;
}

.ucp-swatch:hover {
  border-color: v-bind('props.color');
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.06);
}

.ucp-swatch-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.ucp-swatch-hex {
  font-size: 12px;
  color: #556;
  font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif;
}

/* ---- Dialog ---- */
.ucp-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 挂载到指定容器时使用 absolute 定位 */
.ucp-anchored {
  position: absolute;
}

.ucp-dialog-enter-active,
.ucp-dialog-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.ucp-dialog-enter-from,
.ucp-dialog-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.ucp-dialog {
  background: #fff;
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  width: 280px;
}

.ucp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #444;
}

.ucp-close {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: #f0f2f5;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.ucp-close:hover {
  background: #e55;
  color: #fff;
}

/* ---- SV 面板 ---- */
.ucp-sv {
  position: relative;
  width: 100%;
  height: 160px;
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: crosshair;
  overflow: hidden;
}

.ucp-sv::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #000, transparent);
}

.ucp-sv-thumb {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
}

/* ---- 色相条 ---- */
.ucp-hue {
  position: relative;
  width: 100%;
  height: 16px;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
}

.ucp-hue-thumb {
  position: absolute;
  top: -2px;
  width: 16px;
  height: 20px;
  border: 2px solid #fff;
  border-radius: 4px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
  transform: translateX(-50%);
  pointer-events: none;
}

/* ---- 底部 ---- */
.ucp-footer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ucp-preview {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.ucp-hex {
  flex: 1;
  padding: 5px 10px;
  border: 1.5px solid #d0d8e0;
  border-radius: 999px;
  font-size: 12px;
  font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif;
  text-align: center;
  outline: none;
  transition: border-color 0.2s;
}

.ucp-hex:focus {
  border-color: v-bind('props.color');
}

.ucp-confirm {
  padding: 5px 14px;
  border: none;
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: filter 0.2s;
}

.ucp-confirm:hover {
  filter: brightness(1.08);
}
</style>
