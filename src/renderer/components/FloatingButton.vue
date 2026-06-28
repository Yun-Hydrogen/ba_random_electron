<!--
================================================================================
  组件：FloatingButton.vue
  所属：悬浮按钮窗口（Floating.vue）的核心子组件
  父组件：Floating.vue（位于 src/renderer/views/Floating.vue）

================================================================================
  一、功能概述
================================================================================
  本组件是悬浮按钮的视觉与交互核心，负责以下功能：

    功能              | 说明
    ──────────────────┼──────────────────────────────────────────────
    1. 按钮渲染       | 圆形按钮，支持自定义尺寸、透明度、图标、边框颜色
    2. 拖拽移动       | 通过 PointerEvent 实现拖拽，IPC 通知主进程移动窗口
    3. 鼠标穿透控制   | 空闲时穿透（不遮挡），hover/拖拽时捕获
    4. 点击音效       | 使用 Web Audio API 播放点击音效
    5. 窗口失焦保护   | 窗口 blur / 鼠标离开 / 页面隐藏时清理 hover 状态

================================================================================
  二、数据流架构
================================================================================

  ┌───────────────────────────────────────────────────────────────┐
  │  Floating.vue（父组件）                                       │
  │  - 从 floatingButtonApi.getConfig() 获取配置                  │
  │  - 通过 props 向下传递 sizePx / iconDataUrl / borderColor 等  │
  │  - 通过 @click 事件接收按钮点击                               │
  └────────────┬────────────────────────────────────┬─────────────┘
               │ Props（配置数据）                  │ Emit（事件上报）
               ▼                                    ▼
  ┌────────────────────────────────────────────────────────────────┐
  │  FloatingButton.vue（本组件）                                  │
  │                                                                │
  │  Props 接收：                                                  │
  │    sizePx             — 按钮像素尺寸（由 sizePercent 换算）    │
  │    transparencyPercent — 透明度百分比（0=不透明，100=全透明）  │
  │    iconDataUrl        — 自定义图标的 base64 data URL           │
  │    iconSize           — 图标显示尺寸（px）                     │
  │    borderColor        — 按钮圆形边框颜色（hex）                │
  │    dragDisabled       — 是否禁用拖拽（picker 打开时为 true）   │
  │                                                                │
  │  Emits 发送：                                                  │
  │    click — 用户点击按钮（非拖拽）时触发，父组件据此打开 picker │
  └────────────────────────────────────────────────────────────────┘

================================================================================
  三、拖拽机制
================================================================================
  拖拽使用 PointerEvent（统一鼠标+触摸）而非 MouseEvent/TouchEvent 分写。

  三阶段：
    1. pointerdown → handlePointerDown
       记录起点坐标，捕获指针（setPointerCapture），初始化拖拽状态
    2. pointermove → handlePointerMove
       移动超过 3px 阈值 → 标记 isDragging=true → 通过 IPC 通知主进程移动窗口
       移动量用 requestAnimationFrame 节流（scheduleMove / flushMove）
    3. pointerup   → handlePointerUp
       若拖拽过 → 提交最终位置 + endDrag
       若未拖拽 → 播放音效 + emit('click')

  为什么拖拽通过主进程移动窗口：
    渲染进程不能直接操作 BrowserWindow 的位置（Electron 安全模型），
    必须通过 IPC 把偏移量发给主进程，由主进程调用 win.setBounds()。

================================================================================
  四、鼠标穿透策略
================================================================================
  updateIgnoreMouse() 是鼠标穿透的唯一入口，策略如下：

    状态              | 穿透？ | 原因
    ──────────────────┼────────┼──────────────────────────────────
    dragDisabled=true  | 否     | picker 打开中，环绕控件需可点击
    isHovering=true    | 否     | 用户正在悬停，需要 hover 效果
    pointerDown=true   | 否     | 用户正在按下，需要捕获后续事件
    其他               | 是     | 空闲状态，不遮挡下层应用

================================================================================
  五、主题与样式
================================================================================
  默认边框色：#66ccff（天依蓝）
  hover 边框色：rgba(40, 130, 230, 0.9)（由 CSS 处理，inline borderColor 覆盖）
  按钮背景：#FFF 白色
  hover 阴影：多层 box-shadow 实现立体效果
  拖拽中：禁用 transition 动画避免拖拽抖动

================================================================================
  六、关键实现细节
================================================================================
  - 拖拽阈值 3px：小于 3px 的移动视为点击抖动，不触发拖拽
  - rAF 节流：移动量累积在 pendingDx/pendingDy，每帧只发一次 IPC
  - pointer capture：pointerdown 时 setPointerCapture，确保后续事件发到本元素
  - 点击后强制清 isHovering → 再根据鼠标位置恢复（防止残留高亮）
  - 全局事件（blur/mouseleave/visibilitychange）监听窗口失焦，清理 hover

================================================================================
  七、维护注意事项
================================================================================
  - updateIgnoreMouse() 是鼠标穿透的唯一入口，修改策略必须在此函数内
  - dragDisabled prop 由父组件在 picker 打开/关闭时切换，需配合 watch 响应
  - .floating-root 严禁 width/height: 100%，否则全屏遮挡 picker 控件
  - rAF 节流逻辑修改需同步 cancelScheduledMove（handlePointerUp 中要先取消再提交）
  - AudioContext 在用户手势下恢复（resume），Click 音效加载是异步的

  最后更新：2026-06-28
================================================================================
-->
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
      <img :src="iconSrc" alt="随机抽取" draggable="false" :style="iconStyle" />
    </button>
  </div>
</template>

<script setup>
// ============================================================
//  导入依赖
//  ref      — 创建响应式变量（值变化时自动更新界面）
//  computed — 创建计算属性（依赖其他 ref，自动缓存）
//  watch    — 监听数据变化并执行副作用
//  onMounted / onBeforeUnmount — 生命周期钩子
// ============================================================
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

// ============================================================
//  Props 定义（从父组件 Floating.vue 接收的数据）
//  注意：props 是只读的，不能直接修改！
// ============================================================
const props = defineProps({
  /*
   * sizePx — 按钮像素尺寸（必填）
   * 由 Floating.vue 根据 sizePercent 计算：50 × (sizePercent/100)
   */
  sizePx: { type: Number, required: true },

  /*
   * transparencyPercent — 透明度百分比（必填），范围 0-100
   * 0=完全不透明，100=完全透明
   */
  transparencyPercent: { type: Number, required: true },

  /*
   * iconDataUrl — 自定义图标的 base64 data URL
   * 空字符串 = 使用内置默认图标 /image/app.ico
   * 格式：data:image/png;base64,iVBORw0KGgo...
   * 来源：TabFloating.vue 通过 FileReader.readAsDataURL() 生成
   */
  iconDataUrl: { type: String, default: '' },

  /*
   * iconSize — 图标显示尺寸（px），默认 48，范围 16-128
   * 实际渲染时被限制为不超过按钮尺寸的 80%
   */
  iconSize: { type: Number, default: 48 },

  /*
   * borderColor — 按钮圆形边框颜色（hex 字符串，如 '#66ccff'）
   * 通过 buttonStyle 内联样式覆盖 CSS 硬编码值
   */
  borderColor: { type: String, default: '#66ccff' },

  /*
   * dragDisabled — 是否禁用拖拽
   * picker 打开时为 true（父组件设置），强制窗口捕获鼠标
   */
  dragDisabled: { type: Boolean, default: false }
})

// ============================================================
//  Emits 定义（向父组件发送事件）
// ============================================================
const emit = defineEmits([
  /* click — 用户点击按钮（非拖拽）时触发，父组件据此打开/关闭 picker */
  'click'
])

// ============================================================
//  1. 点击音效（Web Audio API）
// ============================================================

/* 音效增益（音量倍数），1.0 = 原始音量 */
const CLICK_SOUND_GAIN = 1

/*
 * 预加载点击音效文件。
 *
 * 流程：
 *   1. fetch('/sound/button_click.wav') → 下载音频文件
 *   2. response.arrayBuffer()         → 转为二进制数据
 *   3. audioContext.decodeAudioData()  → 解码为可播放的 AudioBuffer
 *
 * 结果存储在 clickBufferPromise 中（Promise<AudioBuffer>），
 * 每次点击时复用已解码的 buffer，无需重复下载/解码。
 */
const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const clickBufferPromise = fetch('/sound/button_click.wav')
  .then((response) => response.arrayBuffer())
  .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer.slice(0)))

/*
 * 播放点击音效。
 *
 * 每次调用创建新的 AudioBufferSourceNode（一次性的"播放器"），
 * 连接到 GainNode（音量控制）→ audioContext.destination（扬声器）。
 *
 * 如果 AudioContext 被浏览器挂起（自动播放策略），先调用 resume() 恢复。
 * .catch(() => {}) 静默忽略播放失败（如音频文件损坏）。
 */
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

// ============================================================
//  2. 样式计算（computed）
// ============================================================

/*
 * styleOpacity — 将 transparencyPercent (0-100) 转为 CSS opacity (0-1)。
 * 透明度百分比越大 → 按钮越透明。
 * 结果限制在 [0, 1] 范围内。
 */
const styleOpacity = computed(() => {
  return Math.max(0, Math.min(1, 1 - props.transparencyPercent / 100))
})

/*
 * buttonStyle — 按钮的 inline style 对象。
 * 控制尺寸（width/height）、透明度（opacity）、边框颜色（borderColor）。
 * borderColor 通过 inline style 覆盖 CSS 中硬编码的 #66ccff。
 */
const buttonStyle = computed(() => {
  return {
    width: `${props.sizePx}px`,
    height: `${props.sizePx}px`,
    opacity: String(styleOpacity.value),
    borderColor: props.borderColor || '#66ccff'
  }
})

/*
 * iconSrc — 图标图片的 src 属性值。
 * iconDataUrl 非空 → 直接用 base64 data URL
 * iconDataUrl 为空 → 使用内置默认图标 /image/app.ico
 */
const iconSrc = computed(() => {
  const dataUrl = (props.iconDataUrl || '').trim()
  return dataUrl || '/image/app.ico'
})

/*
 * iconStyle — 图标图片的 inline style 对象。
 * 尺寸限制为 max(16, min(iconSize, sizePx × 0.8))，防止图标溢出圆形按钮。
 */
const iconStyle = computed(() => {
  const maxPx = Math.max(16, Math.min(props.iconSize, Math.round(props.sizePx * 0.8)))
  return { width: `${maxPx}px`, height: `${maxPx}px` }
})

// ============================================================
//  3. 拖拽状态变量
// ============================================================

/* 是否处于按下状态（pointerdown 后、pointerup 前） */
const pointerDown = ref(false)

/* 当前活跃的指针 ID（PointerEvent.pointerId），用于多点触控识别 */
const activePointerId = ref(null)

/* 是否已进入拖拽模式（移动超过 3px 阈值后置 true） */
const isDragging = ref(false)

/* 鼠标是否悬停在按钮上（控制 hover 样式和穿透状态） */
const isHovering = ref(false)

/* 最近一次指针事件类型（'mouse' | 'touch' | 'pen'） */
const lastPointerType = ref('mouse')

/* 拖拽起点：按下时的屏幕坐标 */
const startGlobalX = ref(0)
const startGlobalY = ref(0)

/* 待提交的累积偏移量（通过 rAF 节流批量提交） */
const pendingDx = ref(0)
const pendingDy = ref(0)

/* rAF 句柄，用于取消待执行的移动更新 */
const rafId = ref(0)

/* 拖拽触发阈值（px）：小于此距离的移动视为点击抖动 */
const DRAG_THRESHOLD_PX = 3

// ============================================================
//  4. 坐标获取与拖拽节流
// ============================================================

/*
 * 获取指针事件的全局屏幕坐标。
 *
 * 优先使用 event.screenX/Y，如果不可用（部分触控设备），
 * 则用 window.screenX + event.clientX 计算 fallback 值。
 */
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

/* 提交累积的偏移量到主进程（通过 IPC），然后重置 rAF 句柄 */
function flushMove() {
  if (!isDragging.value || !window.floatingButtonApi) {
    rafId.value = 0
    return
  }
  window.floatingButtonApi.moveDrag(pendingDx.value, pendingDy.value)
  rafId.value = 0
}

/* 如果还没有待执行的 rAF，则调度一个（防止高频 IPC） */
function scheduleMove() {
  if (rafId.value !== 0) return
  rafId.value = window.requestAnimationFrame(flushMove)
}

/* 取消待执行的 rAF（拖拽结束或中断时调用） */
function cancelScheduledMove() {
  if (rafId.value !== 0) {
    window.cancelAnimationFrame(rafId.value)
    rafId.value = 0
  }
}

// ============================================================
//  5. 鼠标穿透控制
// ============================================================

/*
 * updateIgnoreMouse() —— 鼠标穿透的唯一入口。
 *
 * 策略：
 *   1. dragDisabled=true（picker 打开）→ 始终捕获鼠标
 *   2. dragDisabled=false → hover 或按下时捕获，否则穿透
 *
 * 调用时机：
 *   - hover 进入/离开
 *   - 鼠标按下/松开
 *   - dragDisabled prop 变化（watch 触发）
 */
function updateIgnoreMouse() {
  if (!window.floatingButtonApi) return
  if (props.dragDisabled) {
    window.floatingButtonApi.setIgnoreMouseEvents(false)
    return
  }
  const shouldIgnore = !isHovering.value && !pointerDown.value
  window.floatingButtonApi.setIgnoreMouseEvents(shouldIgnore)
}

/* 清除 hover 状态并更新穿透 */
function clearHoverState() {
  if (!isHovering.value) return
  isHovering.value = false
  updateIgnoreMouse()
}

/*
 * 监听 dragDisabled prop 变化。
 * picker 打开/关闭导致 prop 变化时，主动重新评估鼠标穿透状态。
 */
watch(() => props.dragDisabled, () => {
  updateIgnoreMouse()
})

// ============================================================
//  6. 指针事件处理器
// ============================================================

/* 判断指针是否在按钮元素内部 */
function isPointerInside(event) {
  if (!event || !event.currentTarget) return false
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom
}

/* 鼠标进入 → 设置 hover 状态，更新穿透 */
function handlePointerEnter(event) {
  if (event.pointerType === 'mouse') {
    isHovering.value = true
    updateIgnoreMouse()
  }
}

/* 鼠标离开 → 清除 hover 状态，更新穿透 */
function handlePointerLeave() {
  isHovering.value = false
  updateIgnoreMouse()
}

/*
 * 鼠标/手指按下 → 初始化拖拽状态。
 *
 * 步骤：
 *   1. 仅响应鼠标左键（button === 0）
 *   2. 记录指针 ID（多点触控识别）
 *   3. 记录起始全局坐标
 *   4. 捕获指针（setPointerCapture：后续事件都发到本元素）
 *   5. 重置拖拽标志和偏移量
 */
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

/*
 * 鼠标/手指移动 → 判断是否进入拖拽模式。
 *
 * 逻辑：
 *   1. 仅处理当前活跃指针 ID 的事件（忽略其他手指）
 *   2. 累积偏移量，超过 3px 阈值 → 标记 isDragging=true + 发送 startDrag
 *   3. 拖拽中 → 更新偏移量并通过 rAF 节流提交
 */
function handlePointerMove(event) {
  if (activePointerId.value !== event.pointerId) return
  if (!pointerDown.value || !window.floatingButtonApi) return
  if (props.dragDisabled) return

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

/*
 * 鼠标/手指松开 → 结束拖拽或触发点击。
 *
 * 两个分支：
 *   A. 拖拽过（isDragging=true）：
 *      取消待提交的 rAF → 提交最终位置 → IPC endDrag
 *   B. 未拖拽（isDragging=false）：
 *      播放音效 → 清除 hover 残留 → blur 元素 → emit('click')
 *
 * 收尾：
 *   - 重置所有拖拽状态变量
 *   - 如果鼠标仍在按钮内 → 恢复 isHovering（确保后续穿透正确）
 *   - 释放指针捕获
 */
function handlePointerUp(event) {
  if (activePointerId.value !== event.pointerId) return
  if (!pointerDown.value) return

  lastPointerType.value = event.pointerType || lastPointerType.value

  if (isDragging.value) {
    /* 分支 A：拖拽结束 */
    if (window.floatingButtonApi) {
      cancelScheduledMove()
      window.floatingButtonApi.moveDrag(pendingDx.value, pendingDy.value)
      window.floatingButtonApi.endDrag()
    }
  } else {
    /* 分支 B：普通点击 */
    playClickSound()
    isHovering.value = false
    if (event.currentTarget && event.currentTarget.blur) {
      event.currentTarget.blur()
    }
    emit('click')
  }

  /* 统一收尾 */
  pointerDown.value = false
  activePointerId.value = null
  isDragging.value = false

  /* 根据鼠标位置恢复或清除 hover */
  if (event.pointerType === 'mouse' && !isPointerInside(event)) {
    clearHoverState()
  } else if (event.pointerType === 'mouse' && isPointerInside(event)) {
    isHovering.value = true
  }

  updateIgnoreMouse()

  if (event.currentTarget && event.currentTarget.releasePointerCapture) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
}

/*
 * 拖拽被系统中断（如来电、通知中心弹出）→ 清理状态。
 */
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
  clearHoverState()
  updateIgnoreMouse()
}

// ============================================================
//  7. 窗口/页面失焦保护
// ============================================================

/*
 * 鼠标离开整个窗口 → 清除 hover（防止回到窗口时残留高亮）。
 * event.relatedTarget 为 null 表示鼠标离开了窗口内容区域。
 */
function handleWindowMouseLeave(event) {
  if (event && event.relatedTarget) return
  clearHoverState()
}

/*
 * 页面被隐藏（切换标签页、最小化窗口）→ 清除 hover。
 */
function handleVisibilityChange() {
  if (document.hidden) {
    clearHoverState()
  }
}

// ============================================================
//  8. 生命周期
// ============================================================

onMounted(() => {
  window.addEventListener('blur', clearHoverState)
  window.addEventListener('mouseleave', handleWindowMouseLeave)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', clearHoverState)
  window.removeEventListener('mouseleave', handleWindowMouseLeave)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
/* =================================================================
   主题色：天蓝 #66ccff
   hover 边框色：rgba(40, 130, 230, 0.9)
   本文件所有颜色均硬编码，不依赖外部 CSS 变量。
   ================================================================= */

/*
 *  根容器 —— 仅用于居中子元素。
 *  严禁设置 width/height: 100%，否则会形成全屏遮挡层，
 *  导致悬浮按钮上方的 picker 胶囊控件无法点击。
 */
.floating-root {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* =================================================================
   1. 按钮本体
   ================================================================= */

/*
 *  圆形按钮基础样式。
 *
 *  border: 硬编码 #66ccff 作为 fallback（实际颜色由 buttonStyle inline style 覆盖）。
 *  border-radius: 50% → 正圆形。
 *  touch-action: none → 禁止浏览器默认手势（如双指缩放、滑动返回）。
 *  padding: 10px → 给图标留呼吸空间。
 *  transition: 平滑过渡 transform / box-shadow / background / border-color。
 */
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
  transition:
    transform 260ms ease,
    box-shadow 260ms ease,
    background 260ms ease,
    border-color 260ms ease;
}

/* =================================================================
   2. 按钮状态
   ================================================================= */

/*
 *  Hover 状态（非拖拽中）。
 *  多层 box-shadow 实现立体浮起效果：
 *    - 外层大阴影：0 14px 28px rgba(8,32,72,0.28)
 *    - 内层亮边：inset 0 1px 3px rgba(255,255,255,0.85)
 */
.floating-button.is-hovering:not(.is-dragging) {
  background: #fff;
  border-color: rgba(40, 130, 230, 0.9);
  box-shadow:
    0 14px 28px rgba(8, 32, 72, 0.28),
    inset 0 1px 3px rgba(255, 255, 255, 0.85);
}

/*
 *  拖拽中：transition 仍在 CSS 中定义，但 .is-dragging class
 *  本身没有额外样式（仅用于 JS 判断状态）。
 */

/* =================================================================
   3. 图标图片
   ================================================================= */

/*
 *  按钮内的图标图片。
 *
 *  width/height: CSS 设置为 120%（超出 padding 区域以填充按钮），
 *  实际渲染尺寸由 iconStyle inline style 覆盖为固定 px 值。
 *  object-fit: contain → 保持宽高比，缩放至容器内。
 *  pointer-events: none → 图标不拦截鼠标事件（事件穿透到按钮）。
 */
.floating-button img {
  width: 120%;
  height: 120%;
  object-fit: contain;
  pointer-events: none;
}
</style>
