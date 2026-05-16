<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const results = ref([])
const animationKey = ref(0)
const instructionText = ref('点击任意位置关闭')
const revealStarted = ref(false)
const canClose = ref(false)
const isClosing = ref(false)
const lastToken = ref(0)

const resolveAssetUrl = (relativePath) => {
  const base = window.location.protocol === 'file:'
    ? new URL('.', window.location.href).toString()
    : `${window.location.origin}/`
  return new URL(relativePath.replace(/^\/+/, ''), base).toString()
}
const gachaSoundUrl = resolveAssetUrl('sound/gacha_loading.wav')
let gachaAudio = null
let revealTimer = null
let closeTimer = null
let closeFadeTimer = null

const playGachaSound = ref(true)
const gachaSoundVolume = ref(0.6)

const topRow = computed(() => results.value.slice(0, 5))
const bottomRow = computed(() => results.value.slice(5))
const isTwoRows = computed(() => results.value.length > 5)

function normalizeResults(payload) {
  const list = Array.isArray(payload?.results) ? payload.results : payload
  if (!Array.isArray(list)) return []
  return list
    .map((item) => {
      if (!item) return null
      if (typeof item === 'string') return { name: item.trim() }
      if (typeof item === 'object') return { name: String(item.name || '').trim() }
      return null
    })
    .filter((item) => item && item.name)
}

function applyResults(payload) {
  resetResultState({ stopSound: false })
  results.value = normalizeResults(payload)
  const token = Number(payload?.token)
  if (Number.isFinite(token)) {
    lastToken.value = token
  }

  if (results.value.length === 0) {
    canClose.value = true
    return
  }

  if (results.value.length > 0) {
    const totalDelayMs = (Math.max(results.value.length - 1, 0) * 120) + 600
    revealTimer = setTimeout(() => {
      revealStarted.value = true
    }, totalDelayMs)

    const totalDurationMs = totalDelayMs + 450
    closeTimer = setTimeout(() => {
      canClose.value = true
    }, totalDurationMs)
  }

  if (playGachaSound.value && results.value.length > 0) {
    playGachaLoadingSound()
  }
}

function resetResultState({ stopSound = true } = {}) {
  results.value = []
  animationKey.value += 1
  revealStarted.value = false
  canClose.value = false
  isClosing.value = false
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (closeFadeTimer) {
    clearTimeout(closeFadeTimer)
    closeFadeTimer = null
  }
  if (stopSound) {
    stopGachaLoadingSound()
  }
}

function handleReset(payload) {
  const token = Number(payload?.token)
  const reason = payload?.reason
  if (Number.isFinite(token)) {
    if (reason === 'before-open' && token === lastToken.value) {
      return
    }
    if (token < lastToken.value) {
      return
    }
    lastToken.value = token
  }
  resetResultState()
}

function handleStageClick() {
  if (!canClose.value || isClosing.value) return
  closeResult()
}

function handleKeydown(event) {
  if (event.key === 'Escape' && canClose.value && !isClosing.value) {
    closeResult()
  }
}

async function closeResult() {
  if (isClosing.value) return
  isClosing.value = true
  closeFadeTimer = setTimeout(async () => {
    resetResultState()
    await nextTick()
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
    if (window.pickResultApi) {
      window.pickResultApi.close()
    }
  }, 220)
}

function stopGachaLoadingSound() {
  if (gachaAudio) {
    gachaAudio.pause()
    gachaAudio.currentTime = 0
  }
}

async function playGachaLoadingSound() {
  try {
    stopGachaLoadingSound()
    if (!gachaAudio) {
      gachaAudio = new Audio(gachaSoundUrl)
      gachaAudio.addEventListener('error', () => {
        console.error('Gacha sound load failed', { src: gachaAudio.src, error: gachaAudio.error })
      })
    }
    gachaAudio.volume = Math.max(0, Math.min(1, Number(gachaSoundVolume.value) || 0))
    gachaAudio.currentTime = 0
    await gachaAudio.play().catch((error) => {
      console.warn('Gacha sound play blocked', error)
    })
  } catch (error) {
    console.warn('Failed to play gacha loading sound:', error)
  }
}

async function loadSoundConfig() {
  if (!window.pickResultApi || typeof window.pickResultApi.getConfig !== 'function') {
    return
  }
  const cfg = await window.pickResultApi.getConfig()
  playGachaSound.value = Boolean(cfg?.defaultPlayGachaSound)
  gachaSoundVolume.value = Number(cfg?.gachaSoundVolume)
}

let removeOpenListener = null
let removeResetListener = null

onMounted(async () => {
  await loadSoundConfig()

  if (window.pickResultApi && typeof window.pickResultApi.getResults === 'function') {
    const initial = await window.pickResultApi.getResults()
    applyResults({ results: initial })
  }

  if (window.pickResultApi && typeof window.pickResultApi.onOpen === 'function') {
    removeOpenListener = window.pickResultApi.onOpen(async (payload) => {
      await loadSoundConfig()
      applyResults(payload)
    })
  }

  if (window.pickResultApi && typeof window.pickResultApi.onReset === 'function') {
    removeResetListener = window.pickResultApi.onReset((payload) => {
      handleReset(payload)
    })
  }
})

onBeforeUnmount(() => {
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (closeFadeTimer) {
    clearTimeout(closeFadeTimer)
    closeFadeTimer = null
  }
  stopGachaLoadingSound()
  if (typeof removeOpenListener === 'function') {
    removeOpenListener()
  }
  if (typeof removeResetListener === 'function') {
    removeResetListener()
  }
})
</script>

<template>
  <div
    class="result-stage"
    :class="{ 'is-closing': isClosing }"
    tabindex="0"
    @click="handleStageClick"
    @keydown="handleKeydown"
  >
    <div class="result-rows" :class="{ 'is-two-rows': isTwoRows }" :key="animationKey">
      <div class="result-row">
        <div
          v-for="(item, index) in topRow"
          :key="`top-${index}-${item.name}`"
          class="letter-card"
          :style="{ '--index': index }"
        >
          <img class="letter-img" src="/image/letter.png" alt="letter" />
          <div class="name-card" :class="{ 'is-reveal': revealStarted }" :style="{ '--reveal-index': index }">
            <span>{{ item.name }}</span>
          </div>
        </div>
      </div>
      <div v-if="isTwoRows" class="result-row">
        <div
          v-for="(item, index) in bottomRow"
          :key="`bottom-${index}-${item.name}`"
          class="letter-card"
          :style="{ '--index': index + 5 }"
        >
          <img class="letter-img" src="/image/letter.png" alt="letter" />
          <div class="name-card" :class="{ 'is-reveal': revealStarted }" :style="{ '--reveal-index': index + 5 }">
            <span>{{ item.name }}</span>
          </div>
        </div>
      </div>
    </div>
    <p v-if="results.length" class="result-hint">{{ instructionText }}</p>
    <p v-else class="result-empty">暂无抽取结果</p>
  </div>
</template>

<style scoped>
.result-stage {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 26px;
  background: rgba(0, 0, 0, 0.35);
  outline: none;
}

.result-stage.is-closing {
  pointer-events: none;
  animation: result-fade-out 220ms ease forwards;
}

.result-rows {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
}

.letter-card {
  position: relative;
  width: clamp(120px, 16vw, 200px);
  aspect-ratio: 4 / 3;
  opacity: 0;
  transform: scale(2.5) rotate(15deg);
  animation: letter-fly-in 0.6s ease-out forwards;
  animation-delay: calc(var(--index) * 0.12s);
}

.letter-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.25));
}

.name-card {
  position: absolute;
  inset: 18% 10%;
  background: #ffffff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6px 10px;
  font-size: clamp(16px, 2.1vw, 26px);
  font-weight: 700;
  color: #1c2741;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.25);
  opacity: 0;
  transform: translateY(12px) scale(0.96);
  animation: none;
}

.name-card.is-reveal {
  animation: name-reveal 0.45s ease-out forwards;
  animation-delay: calc(var(--reveal-index) * 0.12s + 0.1s);
}

.result-hint {
  margin: 0;
  font-size: 16px;
  color: rgb(255, 255, 255);
  letter-spacing: 2px;
  border: 2px dashed rgba(255, 255, 255, 0.75);
  padding: 4px 12px;
  border-radius: 12px;
}

.result-empty {
  margin: 0;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 2px;
}

@keyframes letter-fly-in {
  0% {
    opacity: 0;
    transform: scale(2.5) rotate(15deg) translateY(-24px);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(15deg) translateY(0);
  }
}

@keyframes name-reveal {
  0% {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes result-fade-out {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
