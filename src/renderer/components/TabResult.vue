<!--
  组件：TabResult.vue
  所属：配置面板 - 结果显示 Tab
  父组件：ConfigPanel.vue

  功能概述：
    1. 面板外观 —— 背景颜色 / 边框颜色 / 面板透明度
    2. 音效设置 —— 抽卡音效开关 & 音量 / 抽卡音乐开关 & 音量

  数据流：
    props.pickResult 接收完整配置对象，通过 emit('update:pickResult', newObj) 回传

  主题色：翠绿 #55cc99，所有控件颜色硬编码

  注意事项：
    - 面板透明度存储为 0-1 小数，UI 显示 0-100%
    - 颜色选择器复用与悬浮按钮 Tab 相同的自定义调色盘组件
    - 所有滑条需要轨道填充(rangeFill)
-->

<template>
  <div class="tab-page">
    <!-- 一、面板外观 -->
    <div class="card">
      <div class="card-title">面板外观</div>
      <div v-if="showDesc" class="card-desc">调整抽取结果弹窗的视觉样式</div>
      <div v-else class="card-desc-skeleton"></div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>面板背景颜色</label>
          <span class="cfg-hint-text">结果弹窗的整体底色</span>
        </div>
        <div class="color-swatch" @click="openPicker('bg')">
          <span class="color-swatch-dot" :style="{ background: pickResult.panelBgColor || '#ffffff' }"></span>
          <span class="color-swatch-hex">{{ pickResult.panelBgColor || '#ffffff' }}</span>
        </div>
      </div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>面板边框颜色</label>
          <span class="cfg-hint-text">结果弹窗的外框描边</span>
        </div>
        <div class="color-swatch" @click="openPicker('border')">
          <span class="color-swatch-dot" :style="{ background: pickResult.panelBorderColor || '#66ccff' }"></span>
          <span class="color-swatch-hex">{{ pickResult.panelBorderColor || '#66ccff' }}</span>
        </div>
      </div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>面板透明度</label>
          <span class="cfg-hint-text">数值越低越透明，100% 为完全不透明</span>
        </div>
        <div class="cfg-slider">
          <input type="range" min="10" max="100" :value="opacityPercent" @input="setOpacity" :style="rangeFill(opacityPercent, 10, 100)" />
          <span>{{ opacityPercent }}%</span>
        </div>
      </div>
    </div>

    <!-- 二、效果 -->
    <div class="card">
      <div class="card-title">效果</div>
      <div v-if="showDesc" class="card-desc">抽卡时的音频反馈设置</div>
      <div v-else class="card-desc-skeleton"></div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>播放抽卡音效</label>
          <span class="cfg-hint-text">抽卡时播放短促的提示音</span>
        </div>
        <label class="switch">
          <input type="checkbox" :checked="pickResult.defaultPlayGachaSound" @change="$emit('update:pickResult',{...pickResult,defaultPlayGachaSound:$event.target.checked})" />
          <span class="switch-track"></span>
        </label>
      </div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>抽卡音效音量</label>
          <span class="cfg-hint-text">提示音的响度百分比</span>
        </div>
        <div class="cfg-slider">
          <input type="range" min="0" max="100" :value="pickResult.soundVolume || 80" @input="$emit('update:pickResult',{...pickResult,soundVolume:parseInt($event.target.value)})" :style="rangeFill(pickResult.soundVolume || 80, 0, 100)" />
          <span>{{ pickResult.soundVolume || 80 }}%</span>
        </div>
      </div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>播放抽卡音乐</label>
          <span class="cfg-hint-text">抽卡时播放完整的背景音乐</span>
        </div>
        <label class="switch">
          <input type="checkbox" :checked="pickResult.playMusic" @change="$emit('update:pickResult',{...pickResult,playMusic:$event.target.checked})" />
          <span class="switch-track"></span>
        </label>
      </div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>抽卡音乐音量</label>
          <span class="cfg-hint-text">背景音乐的响度百分比</span>
        </div>
        <div class="cfg-slider">
          <input type="range" min="0" max="100" :value="pickResult.musicVolume || 60" @input="$emit('update:pickResult',{...pickResult,musicVolume:parseInt($event.target.value)})" :style="rangeFill(pickResult.musicVolume || 60, 0, 100)" />
          <span>{{ pickResult.musicVolume || 60 }}%</span>
        </div>
      </div>
    </div>

    <!-- 颜色选择器 Dialog -->
    <Transition name="dialog">
      <div v-if="showPicker" class="picker-overlay" @click.self="showPicker = false">
        <div class="picker-dialog">
          <div class="picker-header">
            <span>选取颜色</span>
            <button class="picker-close" @click="showPicker = false">✕</button>
          </div>
          <div class="picker-sv" ref="svRef" :style="svBg" @mousedown="startSVDrag"></div>
          <div class="picker-hue" ref="hueRef" @mousedown="startHueDrag"></div>
          <div class="picker-footer">
            <span class="picker-preview" :style="{ background: tempColor }"></span>
            <input type="text" class="picker-hex" :value="tempColor" @input="onHexInput" @blur="onHexBlur" placeholder="#ffffff" />
            <button class="picker-btn" @click="applyColor">确定</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({ pickResult: Object })
const emit = defineEmits(['update:pickResult'])

/* LCP 优化 */
const showDesc = ref(false)
onMounted(() => requestAnimationFrame(() => { showDesc.value = true }))

/* 透明度：存储 0-1，UI 显示 0-100 */
const opacityPercent = computed(() => Math.round((props.pickResult.panelOpacity || 0.9) * 100))
function setOpacity(e) {
  emit('update:pickResult', { ...props.pickResult, panelOpacity: parseInt(e.target.value) / 100 })
}

/* 滑条轨道填充 */
function rangeFill(val, min, max) {
  const pct = ((val - min) / (max - min)) * 100
  return { background: `linear-gradient(to right, #55cc99 0%, #55cc99 ${pct}%, #e0e5ea ${pct}%, #e0e5ea 100%)` }
}

/* 自定义颜色选择器（与 TabFloating 相同的 HSL 调色盘） */
const showPicker = ref(false)
const pickerTarget = ref('bg') /* 'bg' 或 'border' */
const tempColor = ref('#ffffff')
const svRef = ref(null)
const hueRef = ref(null)
const hueVal = ref(0)
const svX = ref(100)
const svY = ref(0)
let dragHue = false
let dragSV = false

const svBg = computed(() => {
  const base = hslToHex(hueVal.value, 100, 50)
  return { background: `linear-gradient(to right, #fff, ${base})` }
})

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

function syncFromHex(hex) { const hsl = hexToHsl(hex); hueVal.value = hsl.h; svX.value = hsl.s; svY.value = 100 - hsl.l }
function updateColor() { tempColor.value = hslToHex(hueVal.value, svX.value, 100 - svY.value) }

function openPicker(target) {
  pickerTarget.value = target
  const c = target === 'bg' ? (props.pickResult.panelBgColor || '#ffffff') : (props.pickResult.panelBorderColor || '#66ccff')
  tempColor.value = c
  syncFromHex(c)
  showPicker.value = true
}

function applyColor() {
  const key = pickerTarget.value === 'bg' ? 'panelBgColor' : 'panelBorderColor'
  emit('update:pickResult', { ...props.pickResult, [key]: tempColor.value })
  showPicker.value = false
}

function onHexInput(e) { const v = e.target.value.trim(); tempColor.value = v; if (/^#[0-9a-fA-F]{6}$/.test(v)) syncFromHex(v) }
function onHexBlur() { if (/^#[0-9a-fA-F]{6}$/.test(tempColor.value)) syncFromHex(tempColor.value) }

function hueFromX(cx) { const r = hueRef.value.getBoundingClientRect(); const p = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100)); hueVal.value = Math.round((p / 100) * 360); updateColor() }
function startHueDrag(e) { dragHue = true; hueFromX(e.clientX || e.touches[0].clientX) }
function svFromClient(cx, cy) { const r = svRef.value.getBoundingClientRect(); svX.value = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100)); svY.value = Math.max(0, Math.min(100, ((cy - r.top) / r.height) * 100)); updateColor() }
function startSVDrag(e) { dragSV = true; svFromClient(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY) }

function onMove(e) { if (dragHue) hueFromX(e.clientX || e.touches[0].clientX); if (dragSV) svFromClient(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY) }
function onUp() { dragHue = false; dragSV = false }

onMounted(() => { document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.addEventListener('touchmove', onMove); document.addEventListener('touchend', onUp) })
onBeforeUnmount(() => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp) })
</script>

<style scoped>
/* ===== 主题色 #55cc99 ===== */
.tab-page { animation: slide-in 0.3s cubic-bezier(0.25, 0, 0.25, 1); }
@keyframes slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }

/* ===== 滚动条 ===== */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(85, 204, 153, 0.35); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(85, 204, 153, 0.55); }
::-webkit-scrollbar-button { display: none; }
::-webkit-scrollbar-corner { background: transparent; }

/* ===== 卡片 ===== */
.card { padding: 14px 16px; margin-bottom: 12px; border-radius: 14px; background: #f8fafc; border: 1px solid #e8ecf2; }
.card-title { font-size: 14px; font-weight: 700; color: #334; margin-bottom: 4px; }
.card-desc { font-size: 12px; color: #99a; margin-bottom: 12px; line-height: 1.5; }
.card-desc-skeleton { height: 36px; margin-bottom: 12px; border-radius: 6px; background: linear-gradient(90deg, #e8ecf2 25%, #f0f2f5 50%, #e8ecf2 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ===== 配置行 ===== */
.cfg-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.cfg-label-col { display: flex; flex-direction: column; gap: 2px; }
.cfg-hint-text { font-size: 11px; color: #99a; }
.cfg-slider { display: flex; align-items: center; gap: 8px; }
.cfg-slider span { font-size: 13px; color: #888; min-width: 36px; }

/* ===== 颜色选择触发器 ===== */
.color-swatch { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border: 1.5px solid #d0d8e0; border-radius: 999px; background: #fff; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; user-select: none; }
.color-swatch:hover { border-color: #55cc99; box-shadow: 0 0 0 3px rgba(85, 204, 153, 0.12); }
.color-swatch-dot { width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(0, 0, 0, 0.08); flex-shrink: 0; }
.color-swatch-hex { font-size: 12px; color: #556; font-family: 'SF Mono', 'Consolas', monospace; }

/* ===== Switch ===== */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch-track { position: absolute; inset: 0; border-radius: 12px; background: #ccc; transition: 0.2s; }
.switch-track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: 0.2s; }
.switch input:checked + .switch-track { background: #55cc99; }
.switch input:checked + .switch-track::after { transform: translateX(20px); }

/* ===== 滑条 ===== */
input[type=range] { -webkit-appearance: none; appearance: none; width: 140px; height: 6px; border-radius: 3px; background: #e0e5ea; outline: none; cursor: pointer; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #55cc99; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); }

/* ===== 颜色选择器 Dialog ===== */
.picker-overlay { position: fixed; inset: 0; z-index: 9999; background: transparent; display: flex; align-items: center; justify-content: center; }
.picker-dialog { background: #fff; border-radius: 16px; padding: 16px 18px; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2); width: 280px; }
.picker-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 13px; font-weight: 600; color: #444; }
.picker-close { width: 24px; height: 24px; border: none; border-radius: 50%; background: #f0f2f5; color: #888; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.picker-close:hover { background: #e55; color: #fff; }

.picker-sv { position: relative; width: 100%; height: 160px; border-radius: 8px; margin-bottom: 10px; cursor: crosshair; overflow: hidden; }
.picker-sv::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, #000, transparent); }

.picker-hue { position: relative; width: 100%; height: 16px; border-radius: 8px; margin-bottom: 12px; cursor: pointer; background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%); }

.picker-footer { display: flex; align-items: center; gap: 10px; }
.picker-preview { width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(0, 0, 0, 0.08); flex-shrink: 0; }
.picker-hex { flex: 1; padding: 5px 10px; border: 1.5px solid #d0d8e0; border-radius: 999px; font-size: 12px; text-align: center; outline: none; font-family: inherit; }
.picker-hex:focus { border-color: #55cc99; }
.picker-btn { padding: 5px 14px; border: none; border-radius: 999px; background: #55cc99; color: #fff; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }

/* Dialog 动画 */
.dialog-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.dialog-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.dialog-enter-from { opacity: 0; transform: translateY(40px); }
.dialog-leave-to { opacity: 0; transform: translateY(20px); }
</style>
