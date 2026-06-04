<!--
# PickResult.vue 维护说明

本文总结 [src/renderer/views/PickResult.vue](src/renderer/views/PickResult.vue) 的结构与方法，便于后续维护。

## 模块概览
- 作用：抽取结果展示页，包含信件飞入动画 + 姓名依次展开 + 抽取音效。
- 技术：Vue 3 `<script setup>`，渲染端通过 `window.pickResultApi` 获取结果与配置。
- 行为：点击任意位置或按 `Esc` 关闭结果页。

## 页面结构（Template）
- 容器：`.result-stage` 全屏遮罩，负责点击关闭。
- 结果行：`.result-rows` 可单排或双排。
  - `topRow`：最多 5 个结果。
  - `bottomRow`：第 6 个及之后结果。
- 卡片：`.letter-card` 信封图片，延迟入场动画。
- 名字卡：`.name-card` 依次展开显示。
- 提示文案：有结果时显示 `.result-hint`，否则显示 `.result-empty`。

## 关键状态（Refs / Computed）
- `results`：当前抽取结果数组（对象含 `name`）。
- `animationKey`：用于强制重置动画 DOM。
- `stagePhase`：结果页状态机（`idle` | `opening` | `reveal` | `ready` | `closing`）。
- `revealStarted`：是否开始展开姓名。
- `canClose`：动画结束后才允许关闭。
- `activeToken`：当前结果批次 token（主进程下发，用于忽略过期 reset）。
- `isClosing`：`stagePhase === 'closing'` 的衍生状态。
- `topRow` / `bottomRow` / `isTwoRows`：拆分结果并判断是否双排。

## 主要方法与职责
- `normalizeResults(payload)`：兼容多种结果格式，统一为 `{ name }[]`。
- `startSession(payload)`：
  - 生成新的会话 ID，清理旧计时器与音效。
  - 重置动画 key 与状态机。
  - 根据结果数量计算展开延迟并设置 `revealStarted`、`canClose`。
- `resetResultState()`：清理计时器、音效、结果，重置状态机。
- `closeResult()`：触发淡出并通知主进程关闭窗口；使用会话 ID 避免旧计时器误伤。
- `handleReset(payload)`：根据 token 忽略过期 reset，避免清空刚打开的结果。
- `loadSoundConfig()` / `playGachaLoadingSound()` / `stopGachaLoadingSound()`：音效加载与播放。

## 生命周期
- `onMounted()`：加载音效配置，读取初始结果，绑定 `onOpen` / `onReset`。
- `onBeforeUnmount()`：清理计时器与事件监听。

## IPC / API 依赖
来自 `window.pickResultApi`：
- `getResults()`：获取初始结果。
- `getConfig()`：获取音效配置。
- `onOpen(callback)`：监听结果窗口打开事件。
- `onReset(callback)`：监听结果窗口重置事件。
- `close()`：关闭结果窗口。

## 动画与时序
- 信封飞入：`.letter-card` 使用 `letter-fly-in` 动画，延迟 `index * 0.12s`。
- 姓名展开：`.name-card.is-reveal` 使用 `name-reveal` 动画，延迟 `index * 0.12s + 0.1s`。
- 关闭淡出：`.result-stage.is-closing` 使用 `result-fade-out` 动画（220ms），同时 `pointer-events: none` 防止重复点击。

## 资源路径解析
- `resolveAssetUrl(relativePath)`：兼容 `file://` 与 `http://` 协议的资产路径解析，用于加载音效文件。
- 音效文件：`/sound/gacha_loading.wav`。

## 维护注意事项
- 任何新增交互需调用 `closeResult()`，确保状态机与计时器正确清理。
- token 由主进程下发，避免 reset 与 open 的竞态。
-->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const results = ref([])
const animationKey = ref(0)
const instructionText = ref('点击任意位置关闭')
const revealStarted = ref(false)
const canClose = ref(false)
const stagePhase = ref('idle')
const activeToken = ref(0)
const isClosing = computed(() => stagePhase.value === 'closing')

const resolveAssetUrl = (relativePath) => {
  const base = window.location.protocol === 'file:'
    ? new URL('.', window.location.href).toString()
    : `${window.location.origin}/`
  return new URL(relativePath.replace(/^\/+/, ''), base).toString()
}
const gachaSoundUrl = resolveAssetUrl('sound/gacha_loading.wav')
let gachaAudio = null
let revealTimer = null
let readyTimer = null
let closeFadeTimer = null
let sessionSeed = 0
let activeSessionId = 0

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

function clearTimers() {
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = null
  }
  if (closeFadeTimer) {
    clearTimeout(closeFadeTimer)
    closeFadeTimer = null
  }
}

function resetResultState({ stopSound = true, clearResults = true } = {}) {
  clearTimers()
  if (clearResults) {
    results.value = []
  }
  animationKey.value += 1
  revealStarted.value = false
  canClose.value = false
  stagePhase.value = 'idle'
  if (stopSound) {
    stopGachaLoadingSound()
  }
}

function startSession(payload) {
  sessionSeed += 1
  activeSessionId = sessionSeed
  resetResultState({ stopSound: true, clearResults: true })

  results.value = normalizeResults(payload)
  stagePhase.value = 'opening'

  const token = Number(payload?.token)
  if (Number.isFinite(token)) {
    activeToken.value = token
  } else {
    activeToken.value += 1
  }

  if (results.value.length === 0) {
    canClose.value = true
    stagePhase.value = 'ready'
    return
  }

  const sessionId = activeSessionId
  const totalDelayMs = (Math.max(results.value.length - 1, 0) * 120) + 600
  revealTimer = setTimeout(() => {
    if (sessionId !== activeSessionId) return
    revealStarted.value = true
    stagePhase.value = 'reveal'
  }, totalDelayMs)

  const totalDurationMs = totalDelayMs + 450
  readyTimer = setTimeout(() => {
    if (sessionId !== activeSessionId) return
    canClose.value = true
    stagePhase.value = 'ready'
  }, totalDurationMs)

  if (playGachaSound.value) {
    playGachaLoadingSound()
  }
}

function handleReset(payload) {
  const token = Number(payload?.token)
  if (Number.isFinite(token) && token < activeToken.value) {
    return
  }
  if (Number.isFinite(token)) {
    activeToken.value = token
  }
  resetResultState({ stopSound: true, clearResults: true })
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
  stagePhase.value = 'closing'
  canClose.value = false
  const sessionId = activeSessionId
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = null
  }

  closeFadeTimer = setTimeout(async () => {
    if (sessionId !== activeSessionId || stagePhase.value !== 'closing') {
      return
    }
    resetResultState({ stopSound: true, clearResults: true })
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
    startSession({ results: initial })
  }

  if (window.pickResultApi && typeof window.pickResultApi.onOpen === 'function') {
    removeOpenListener = window.pickResultApi.onOpen(async (payload) => {
      await loadSoundConfig()
      startSession(payload)
    })
  }

  if (window.pickResultApi && typeof window.pickResultApi.onReset === 'function') {
    removeResetListener = window.pickResultApi.onReset((payload) => {
      handleReset(payload)
    })
  }
})

onBeforeUnmount(() => {
  clearTimers()
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
  word-break: break-all;
  word-wrap: break-word;
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
