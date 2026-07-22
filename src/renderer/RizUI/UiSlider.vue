<!--
================================================================================
  组件：UiSlider.vue
  所属：RizUI（src/renderer/RizUI）
  类型：步进滑条组件

================================================================================
  一、功能
================================================================================
  圆角矩形步进器：左侧 "−" 按钮、右侧 "+" 按钮，中间显示当前值。
  背景色从左向右随数值比例填充（透明 → color 20% 透明度），无拖动滑块。
  支持长按 +/- 快速连续增减（400ms 延迟后每 60ms 触发一次）。

================================================================================
  二、Props
================================================================================
  modelValue   — v-model 绑定的数值
  min          — 最小值（默认 0）
  max          — 最大值（默认 100）
  step         — 步长（默认 1，<1 时自动处理浮点）
  color        — 填充色 / 边框色（默认 #39c5bb）
  display      — 后缀，如 "%"、"px"、"s"。不传则仅显示数值。
  displayValue — 完全自定义显示文本，优先级高于 value+display 拼接

================================================================================
  三、使用示例

    // <UiSlider v-model="volume" :min="0" :max="100" :color="tabTheme" display="%" />
    // <UiSlider v-model="size"    :min="50" :max="200" :color="tabTheme" display="px" />
================================================================================
-->
<template>
  <div ref="rootRef" class="uist-root" :class="{ 'uist-dragging': isDragging }" :style="rootStyle" @mousedown.left="startDrag" @touchstart.prevent="startDrag">
    <button class="uist-btn uist-minus">−</button>
    <span class="uist-value">{{ displayText }}</span>
    <button class="uist-btn uist-plus">+</button>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue:   { type: Number, default: 0 },
  min:          { type: Number, default: 0 },
  max:          { type: Number, default: 100 },
  step:         { type: Number, default: 1 },
  color:        { type: String, default: '#39c5bb' },
  display:      { type: String, default: '' },
  displayValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

/* ---- DOM 引用 ---- */
const rootRef = ref(null)

/* ---- 填充进度 ---- */
const fillPct = computed(() => {
  const range = props.max - props.min
  if (range <= 0) return 0
  return Math.max(0, Math.min(100, ((props.modelValue - props.min) / range) * 100))
})

const rootStyle = computed(() => ({
  background: `linear-gradient(to right, ${props.color}33 ${fillPct.value}%, transparent ${fillPct.value}%)`,
  borderColor: props.color
}))

/* ---- 数值变更 ---- */
function parseNum(v) {
  return props.step < 1 ? parseFloat(v) : parseInt(v)
}

function change(delta) {
  const raw = props.modelValue + delta * props.step
  const clamped = Math.max(props.min, Math.min(props.max, raw))
  const rounded = parseNum(clamped.toFixed(10))
  if (rounded !== props.modelValue) {
    emit('update:modelValue', rounded)
  }
}

/* ---- 拖拽设定值 ---- */
const isDragging = ref(false)

function clientXToValue(cx) {
  if (!rootRef.value) return props.modelValue
  const r = rootRef.value.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (cx - r.left) / r.width))
  const raw = props.min + pct * (props.max - props.min)
  const stepped = Math.round(raw / props.step) * props.step
  return parseNum(Math.max(props.min, Math.min(props.max, stepped)).toFixed(10))
}

function startDrag(e) {
  isDragging.value = true
  const target = e.target
  const isMinus = target.closest('.uist-minus')
  const isPlus  = target.closest('.uist-plus')

  if (isMinus) {
    change(-1)
    startRepeat(-1)
  } else if (isPlus) {
    change(1)
    startRepeat(1)
  } else {
    // 点击/拖拽进度条区域 → 直接跳转到对应位置
    const val = clientXToValue(e.clientX || e.touches?.[0]?.clientX || 0)
    if (val !== props.modelValue) emit('update:modelValue', val)
  }
}

function onDragMove(e) {
  if (!isDragging.value) return
  // 一旦开始移动，停止按钮长按重复（切换为拖拽模式）
  stopRepeat()
  const val = clientXToValue(e.clientX || e.touches?.[0]?.clientX || 0)
  if (val !== props.modelValue) emit('update:modelValue', val)
}

function onDragEnd() {
  isDragging.value = false
  stopRepeat()
}

/* ---- 长按重复 ---- */
const repeatTimer = ref(null)
const REPEAT_DELAY = 400
const REPEAT_RATE = 60

function startRepeat(dir) {
  stopRepeat()
  repeatTimer.value = setTimeout(() => {
    repeatTimer.value = setInterval(() => change(dir), REPEAT_RATE)
  }, REPEAT_DELAY)
}

function stopRepeat() {
  if (repeatTimer.value) {
    clearTimeout(repeatTimer.value)
    clearInterval(repeatTimer.value)
    repeatTimer.value = null
  }
}

onMounted(() => {
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.addEventListener('touchmove', onDragMove, { passive: false })
  document.addEventListener('touchend', onDragEnd)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('touchmove', onDragMove)
  document.removeEventListener('touchend', onDragEnd)
  stopRepeat()
})

/* ---- 显示文本 ---- */
const displayText = computed(() => {
  if (props.displayValue) return props.displayValue
  const v = props.step < 1 ? props.modelValue.toFixed(1) : props.modelValue
  return props.display ? `${v}${props.display}` : String(v)
})
</script>

<style scoped>
.uist-root {
  display: inline-flex;
  align-items: center;
  height: 26px;
  min-width: 160px;
  border-radius: 999px;
  border: 1.5px solid #d0d8e0;
  background: #fff;
  overflow: hidden;
  user-select: none;
  cursor: col-resize;
  transition: border-color 0.2s;
}

.uist-btn {
  width: 28px;
  height: 100%;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #667;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
  line-height: 1;
  padding: 0;
  outline: none;
}

.uist-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #334;
}

.uist-btn:active {
  background: rgba(0, 0, 0, 0.08);
}

.uist-minus {
  border-right: 1px solid #e8ecf2;
  border-radius: 999px 0 0 999px;
}

.uist-plus {
  border-left: 1px solid #e8ecf2;
  border-radius: 0 999px 999px 0;
}

.uist-value {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #445;
  padding: 0 6px;
  white-space: nowrap;
  position: relative;
  z-index: 1;
  line-height: 1;
}

/* 拖拽时让按钮透明化，避免截获鼠标事件 */
.uist-dragging .uist-btn {
  pointer-events: none;
}
</style>
