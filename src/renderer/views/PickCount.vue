<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const resolveAssetUrl = (relativePath) => {
  const base = window.location.protocol === 'file:'
    ? new URL('.', window.location.href).toString()
    : `${window.location.origin}/`
  return new URL(relativePath.replace(/^\/+/, ''), base).toString()
}
const bgmUrl = resolveAssetUrl('sound/bgm.mp3')
const clickSoundUrl = resolveAssetUrl('sound/button_click.wav')

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const rounded = Math.round(n)
  return Math.max(min, Math.min(max, rounded))
}

const count = ref(1)
const playMusic = ref(false)
const isLeaving = ref(false)
const backgroundDarknessPercent = ref(50)
const isDialogOpen = ref(false)
const isInitializing = ref(false)

const MIN_COUNT = 1
const MAX_COUNT = 10
const BGM_GAIN = 0.3
const CLICK_SOUND_GAIN = 1
const EXIT_ANIMATION_MS = 400

let removeOnOpenListener = null
let removeStopListener = null
let bgmAudio = null
let clickAudio = null

const attachAudioDebug = (audio, label) => {
  audio.addEventListener('error', () => {
    console.error(`${label} load failed`, { src: audio.src, error: audio.error })
  })
}
const canDecrease = computed(() => count.value > MIN_COUNT)
const canIncrease = computed(() => count.value < MAX_COUNT)

const overlayStyle = computed(() => {
  const darkness = Math.max(0, Math.min(100, backgroundDarknessPercent.value))
  const alpha = darkness / 100

  return {
    backgroundColor: `rgba(0, 0, 0, ${alpha})`
  }
})

async function initConfig() {
  isInitializing.value = true
  if (!window.pickCountApi) return
  const cfg = await window.pickCountApi.getConfig()

  count.value = clampInt(cfg.defaultCount, MIN_COUNT, MAX_COUNT, MIN_COUNT)
  playMusic.value = Boolean(cfg.defaultPlayMusic)
  backgroundDarknessPercent.value = clampInt(cfg.backgroundDarknessPercent, 0, 100, 50)

  if (bgmAudio) {
    bgmAudio.volume = BGM_GAIN
  }
  isInitializing.value = false
}

function increaseCount() {
  if (count.value < MAX_COUNT) {
    playClickSound()
    count.value += 1
  }
}

function decreaseCount() {
  if (count.value > MIN_COUNT) {
    playClickSound()
    count.value -= 1
  }
}

function setMinCount() {
  if (count.value !== MIN_COUNT) {
    playClickSound()
    count.value = MIN_COUNT
  }
}

function setMaxCount() {
  if (count.value !== MAX_COUNT) {
    playClickSound()
    count.value = MAX_COUNT
  }
}

function stopAudio() {
  if (bgmAudio) {
    bgmAudio.pause()
    bgmAudio.currentTime = 0
  }
}

async function playBgm() {
  if (!bgmAudio) {
    bgmAudio = new Audio(bgmUrl)
    bgmAudio.loop = true
    attachAudioDebug(bgmAudio, 'BGM')
  }
  bgmAudio.volume = BGM_GAIN
  bgmAudio.currentTime = 0
  await bgmAudio.play().catch((error) => {
    console.warn('BGM play blocked', error)
  })
}

async function resetDialogStateFromConfig(shouldPlayBgm) {
  isLeaving.value = false
  stopAudio()
  await initConfig()

  if (shouldPlayBgm && playMusic.value) {
    try {
      await playBgm()
    } catch (error) {
      console.warn('Failed to play bgm on open:', error)
    }
  }
}

function playClickSound() {
  if (!clickAudio) {
    clickAudio = new Audio(clickSoundUrl)
    attachAudioDebug(clickAudio, 'Click sound')
  }
  clickAudio.volume = CLICK_SOUND_GAIN
  clickAudio.currentTime = 0
  clickAudio.play().catch((error) => {
    console.warn('Click sound play blocked', error)
  })
}

function beginExit(action) {
  if (isLeaving.value) {
    return
  }

  isLeaving.value = true
  isDialogOpen.value = false
  playClickSound()
  window.setTimeout(() => {
    if (action !== 'confirm') {
      stopAudio()
    }
    if (!window.pickCountApi) {
      return
    }

    if (action === 'confirm') {
      window.pickCountApi.confirm(count.value, playMusic.value)
    } else {
      window.pickCountApi.cancel()
    }
  }, EXIT_ANIMATION_MS)
}

function handleCancel() {
  beginExit('cancel')
}

function handleConfirm() {
  beginExit('confirm')
}

watch(playMusic, async (enabled) => {
  if (!isDialogOpen.value || isInitializing.value) {
    return
  }
  if (enabled) {
    try {
      await playBgm()
    } catch (error) {
      console.warn('Failed to play bgm:', error)
    }
  } else {
    stopAudio()
  }
})

onMounted(async () => {
  isLeaving.value = false
  isDialogOpen.value = false
  stopAudio()
  await initConfig()

  if (window.pickCountApi && typeof window.pickCountApi.onOpen === 'function') {
    removeOnOpenListener = window.pickCountApi.onOpen(async () => {
      isDialogOpen.value = true
      await resetDialogStateFromConfig(true)
    })
  }

  if (window.pickCountApi && typeof window.pickCountApi.onStopBgm === 'function') {
    removeStopListener = window.pickCountApi.onStopBgm(() => {
      stopAudio()
    })
  }
})

onBeforeUnmount(() => {
  stopAudio()
  if (typeof removeOnOpenListener === 'function') {
    removeOnOpenListener()
  }
  if (typeof removeStopListener === 'function') {
    removeStopListener()
  }
})
</script>

<template>
  <div class="pick-overlay" :class="{ 'is-leaving': isLeaving }" :style="overlayStyle">
    <div class="pick-panel">
      <h1 class="pick-title">选择人数</h1>

      <div class="pick-counter-row">
        <button class="pick-circle-btn" :disabled="isLeaving || !canDecrease" @click="decreaseCount" aria-label="减少人数">-</button>
        <div class="pick-count-box">{{ count }}</div>
        <button class="pick-circle-btn" :disabled="isLeaving || !canIncrease" @click="increaseCount" aria-label="增加人数">+</button>
      </div>

      <div class="pick-range-row">
        <button class="pick-range-btn" :disabled="isLeaving || !canDecrease" @click="setMinCount">最小</button>
        <span class="pick-range-hint">可选范围 {{ MIN_COUNT }}-{{ MAX_COUNT }}</span>
        <button class="pick-range-btn" :disabled="isLeaving || !canIncrease" @click="setMaxCount">最大</button>
      </div>

      <div class="pick-actions">
        <button class="pick-action-btn pick-action-cancel" :disabled="isLeaving" @click="handleCancel">取消</button>
        <button class="pick-action-btn pick-action-confirm" :disabled="isLeaving" @click="handleConfirm">确定</button>
      </div>

      <label class="pick-music-row">
        <input class="pick-checkbox" type="checkbox" v-model="playMusic" :disabled="isLeaving" />
        <span>播放(*喜庆的)点名背景音乐</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.pick-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  animation: pick-overlay-fade-in 0.4s ease forwards;
}

.pick-overlay.is-leaving {
  animation: pick-overlay-fade-out 0.4s ease forwards;
}

.pick-panel {
  width: min(560px, 92vw);
  border-radius: 20px;
  padding: 30px 30px 20px;
  background: #eff6ff;
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow:
    0 24px 68px rgba(3, 17, 44, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  opacity: 0;
  transform: translateY(18px);
  animation: pick-panel-fly-fade-in 0.4s ease-out forwards;
}

.pick-overlay.is-leaving .pick-panel {
  animation: pick-panel-fly-fade-out 0.4s ease-in forwards;
}

.pick-title {
  margin: 0;
  text-align: center;
  color: #0b325f;
  font-size: 32px;
  line-height: 1;
  letter-spacing: 3px;
  font-weight: 800;
  text-shadow: 0 2px 10px rgba(255, 255, 255, 0.45);
}

.pick-counter-row {
  margin-top: 26px;
  display: grid;
  grid-template-columns: 80px 1fr 80px;
  align-items: center;
  gap: 14px;
}

.pick-range-row {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 88px 1fr 88px;
  align-items: center;
  gap: 12px;
}

.pick-range-btn {
  height: 36px;
  border-radius: 12px;
  border: 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  color: #0b3955;
  background: #e3e9f3;
  box-shadow: 0 10px 16px rgba(19, 35, 62, 0.2);
  transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
}

.pick-range-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.pick-range-btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.985);
}

.pick-range-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
}

.pick-range-hint {
  text-align: center;
  color: rgba(15, 35, 66, 0.78);
  font-size: 16px;
  letter-spacing: 0.3px;
}

.pick-circle-btn {
  width: 70px;
  height: 70px;
  border-radius: 15%;
  border: 2px dashed #88d1ff;
  cursor: pointer;
  font-size: 60px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1a61ad;
  background: #ffffffb0;
  transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
}

.pick-circle-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 18px 30px rgba(9, 27, 58, 0.42);
}

.pick-circle-btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.985);
}

.pick-circle-btn:disabled {
  cursor: not-allowed;
  background: #747474;
  color: rgba(255, 255, 255, 0.7);
  box-shadow: none;
  border: 2px dashed #000000;
}

.pick-count-box {
  height: 76px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d1356;
  border: 1px solid rgba(161, 204, 255, 0.42);
  color: #eff6ff;
  font-size: 44px;
  font-weight: 700;
  letter-spacing: 2px;
  box-shadow: inset 0 1px 10px rgba(115, 180, 255, 0.32);
}

.pick-actions {
  margin-top: 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.pick-action-btn {
  height: 50px;
  border-radius: 13px;
  border: 0;
  cursor: pointer;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 1px;
  transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
}

.pick-action-btn:hover:not(:disabled) {
  filter: brightness(1.04);
}

.pick-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  filter: grayscale(0.15);
  box-shadow: none;
}

.pick-action-cancel {
  color: #152131;
  background: #fdfeff;
  box-shadow: 0 10px 18px rgba(22, 31, 50, 0.2);
}

.pick-action-confirm {
  color: #3a2800;
  background: #ffe713e2;
  border: 2px solid #ffbf00;
}

.pick-music-row {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: rgba(17, 39, 71, 0.9);
  font-size: 14px;
  letter-spacing: 0.4px;
}

.pick-checkbox {
  width: 17px;
  height: 17px;
  accent-color: #2662ad;
}

@keyframes pick-overlay-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pick-overlay-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes pick-panel-fly-fade-in {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pick-panel-fly-fade-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(22px);
  }
}
</style>