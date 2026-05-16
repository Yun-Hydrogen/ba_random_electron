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
      <img src="/image/random.svg" alt="随机抽取" draggable="false" />
      <span class="floating-button-label" :style="textStyle">抽取</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

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

function updateIgnoreMouse() {
  if (!window.floatingButtonApi || !window.floatingButtonApi.setIgnoreMouseEvents) return
  const shouldCapture = lastPointerType.value !== 'mouse' || pointerDown.value || isHovering.value
  window.floatingButtonApi.setIgnoreMouseEvents(!shouldCapture)
}

function handlePointerEnter(event) {
  if (event.pointerType === 'mouse') {
    isHovering.value = true
    updateIgnoreMouse()
  }
}

function handlePointerLeave(event) {
  if (event.pointerType === 'mouse') {
    isHovering.value = false
    updateIgnoreMouse()
  }
}

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
  updateIgnoreMouse()
}
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
  border: 0;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  border-radius: 16px;
  cursor: pointer;
  touch-action: none;
  padding: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background:  #66CCFFF0;
  transition: transform 300ms ease, box-shadow 300ms ease, background 300ms ease;
}

.floating-button.is-hovering:not(.is-dragging) {
  background: #81ffea;
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

.floating-button-label {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  font-size: 12px;
  line-height: 1;
  color: rgb(255, 255, 255);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.38);
  pointer-events: none;
}
</style>
