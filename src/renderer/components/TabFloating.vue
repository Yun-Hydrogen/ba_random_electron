<!--
  组件：TabFloating.vue
  所属：配置面板 - 悬浮按钮 Tab
  父组件：ConfigPanel.vue（通过 props 传入数据，通过 emit 传出修改）

  功能概述：
    1. 按钮样式   —— 大小百分比 / 屏幕位置 X,Y / 持续置顶开关
    2. 中心图标   —— 自定义图片路径 + 文件选择器 + 圆形预览 + 图标尺寸滑条
    3. 边框颜色   —— 自定义 HSL 调色盘（色相条 + 饱和度/明度面板 + hex 输入）
    4. 滑条填充   —— 所有滑条均有轨道填充效果（rangeFill 函数）

  数据流：
    父组件 ConfigPanel 持有 draft.floatingButton 对象
    本组件通过 props.fb 接收完整的 floatingButton 配置
    任何修改通过 emit('update:fb', newFb) 把整个新对象传回父组件

  主题色：初音绿 #39c5bb，所有控件颜色硬编码在 CSS 中

  注意事项：
    - 必须用扩展运算符 {...props.fb, key: newValue} 创建新对象触发响应式
    - 滑条默认值兜底：sizePercent||100, iconSize||48，防止首次渲染 NaN
    - 图标预览使用 file:// 协议加载本地图片（反斜杠需替换为正斜杠）
    - 调色盘基于 HSL 颜色空间，色相 0-360，饱和度/明度 0-100
    - 颜色拖拽：全局 mousemove/mouseup + touchmove/touchend 事件
    - Dialog 动画：Vue Transition，从下至上飞入 0.25s，飞出 0.18s

-->

<template>
  <div class="tab-page floating-tab">
    <!-- 一、按钮样式 -->
    <div class="card">
      <div class="card-title">按钮样式</div>
      <div v-if="showDesc" class="card-desc">调整悬浮按钮的基础外观与行为</div>
      <div v-else class="card-desc-skeleton"></div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>按钮大小</label>
          <span class="cfg-hint-text">缩放百分比，100% 为默认尺寸</span>
        </div>
        <div class="cfg-slider">
          <input type="range" min="50" max="200" :value="fb.sizePercent || 100" @input="$emit('update:fb',{...fb,sizePercent:parseInt($event.target.value)})" :style="rangeFill(fb.sizePercent || 100, 50, 200)" />
          <span>{{ fb.sizePercent }}%</span>
        </div>
      </div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>位置 X / Y</label>
          <span class="cfg-hint-text">应用退出时会记忆当前位置并保存</span>
        </div>
        <div class="cfg-xy-group">
          <input type="number" :value="fb.position.x" @input="$emit('update:fb',{...fb,position:{...fb.position,x:$event.target.value===''?null:parseInt($event.target.value)}})" class="capsule-input" placeholder="X" />
          <input type="number" :value="fb.position.y" @input="$emit('update:fb',{...fb,position:{...fb.position,y:$event.target.value===''?null:parseInt($event.target.value)}})" class="capsule-input" placeholder="Y" />
        </div>
      </div>

      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>持续置顶</label>
          <span class="cfg-hint-text">启用后按钮始终悬浮于其他窗口之上</span>
        </div>
        <label class="switch">
          <input type="checkbox" :checked="fb.alwaysOnTop" @change="$emit('update:fb',{...fb,alwaysOnTop:$event.target.checked})" />
          <span class="switch-track"></span>
        </label>
      </div>
    </div>

    <!-- 二、自定义 -->
    <div class="card">
      <div class="card-title">自定义</div>
      <div v-if="showDesc" class="card-desc">按钮中心图标、边框颜色等个性化设置</div>
      <div v-else class="card-desc-skeleton"></div>

      <!-- 中心图标 -->
      <div class="cfg-row cfg-row-col">
        <label>中心图标</label>
        <span class="cfg-hint-text">按钮中央显示的图片，默认使用应用图标</span>
        <div class="icon-picker-row">
          <div class="icon-actions">
            <div class="icon-path-row">
              <input type="text" :value="fb.iconPath" @input="$emit('update:fb',{...fb,iconPath:$event.target.value})" class="capsule-input capsule-input-wide" placeholder="输入图片路径，或点击右侧按钮选择" />
              <label class="btn">
                选择图片
                <input type="file" accept="image/*" @change="handleIconPick" style="display:none" />
              </label>
            </div>
            <div class="icon-path-row icon-path-sub">
              <span class="cfg-hint warn icon-warn">⚠ 请确保应用对该图片可读，否则可能引发未知bug!</span>
              <button class="btn btn-outline" @click="resetIcon">恢复默认</button>
            </div>
          </div>
          <div class="icon-preview-box">
            <img :src="iconPreviewSrc" class="icon-preview-img" :style="{ width: (fb.iconSize || 48) + 'px', height: (fb.iconSize || 48) + 'px' }" />
          </div>
        </div>
      </div>

      <!-- 图标大小 -->
      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>图标大小</label>
          <span class="cfg-hint-text">中心图标在按钮内的显示尺寸</span>
        </div>
        <div class="cfg-slider">
          <input type="range" min="16" max="96" :value="fb.iconSize || 48" @input="$emit('update:fb',{...fb,iconSize:parseInt($event.target.value)})" :style="rangeFill(fb.iconSize || 48, 16, 96)" />
          <span>{{ fb.iconSize || 48 }}px</span>
        </div>
      </div>

      <!-- 边框颜色 -->
      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>按钮边框颜色</label>
          <span class="cfg-hint-text">悬浮圆形按钮的外圈描边颜色</span>
        </div>
        <div class="color-swatch" @click="togglePicker">
          <span class="color-swatch-preview" :style="{ background: pickerColor }"></span>
          <span class="color-swatch-value">{{ pickerColor }}</span>
        </div>
      </div>
    </div>

    <!-- 调色盘 Dialog -->
    <Transition name="dialog">
      <div v-if="showPicker" class="color-dialog-overlay" @click.self="showPicker = false">
        <div class="color-dialog">
          <div class="color-dialog-header">
            <span>选取颜色</span>
            <button class="color-dialog-close" @click="showPicker = false">✕</button>
          </div>
          <div class="cp-sat-val" ref="satValRef" :style="satValBg" @mousedown="startSatValDrag" @touchstart.prevent="startSatValDrag">
            <div class="cp-sat-val-thumb" :style="{ left: svX + '%', top: svY + '%' }"></div>
          </div>
          <div class="cp-hue-bar" ref="hueRef" @mousedown="startHueDrag" @touchstart.prevent="startHueDrag">
            <div class="cp-hue-thumb" :style="{ left: huePct + '%' }"></div>
          </div>
          <div class="cp-footer">
            <span class="cp-preview-dot" :style="{ background: pickerColor }"></span>
            <input type="text" class="capsule-input cp-hex-input" :value="pickerColor" @input="onHexInput" @blur="onHexBlur" placeholder="#ffffff" />
            <button class="btn btn-sm" @click="applyColor">确定</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
/*
 *  组件逻辑概览（按代码顺序）：
 *  1. props / emit      —— 与父组件通信的接口
 *  2. LCP 优化          —— 延迟渲染描述文字
 *  3. 图标预览          —— 根据路径生成预览用的图片 URL
 *  4. 文件选择          —— 处理用户点击"选择图片"按钮
 *  5. 图标重置          —— 恢复默认图标设置
 *  6. 滑条轨道填充      —— 计算滑条已滑动区域的渐变色
 */
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'

/*
 *  props：父组件传入的数据
 *  fb —— floatingButton 配置对象，包含以下字段：
 *    sizePercent   (number)  按钮缩放百分比，默认 100
 *    alwaysOnTop   (boolean) 是否持续置顶
 *    position.x    (number|null) 屏幕 X 坐标，null=自动
 *    position.y    (number|null) 屏幕 Y 坐标，null=自动
 *    iconPath      (string)  自定义图标路径，空字符串=使用默认图标
 *    iconSize      (number)  图标显示尺寸(px)，默认 48
 *    borderColor   (string)  边框颜色，默认 '#ffffff'
 */
const props = defineProps({ fb: Object })

/*
 *  emit：向父组件发送数据变更事件
 *  update:fb —— 悬浮按钮配置发生变化
 *  注意：必须传递完整的新对象（用扩展运算符创建），不能直接修改 props.fb 的属性
 */
const emit = defineEmits(['update:fb'])

// ================================================================
//  1. LCP 优化：延迟渲染描述文字
// ================================================================

/*
 *  showDesc 控制 card-desc 的显示时机
 *  初始 false → 显示骨架占位 → requestAnimationFrame 后变 true → 显示真实文字
 */
const showDesc = ref(false)
onMounted(() => requestAnimationFrame(() => { showDesc.value = true }))

// ================================================================
//  2. 图标预览：根据路径生成可显示的图片 URL
// ================================================================

/* 默认图标路径（应用安装目录下的 app.ico） */
const defaultIcon = '/image/app.ico'

/*
 *  根据用户设置的图标路径生成预览用的图片 URL
 *  如果用户设置了自定义路径（fb.iconPath 非空），使用 file:// 协议加载本地文件
 *  否则使用项目自带的默认图标 /image/app.ico
 *  注意：路径中的反斜杠要替换为正斜杠，否则 file:// URL 可能无法识别
 */
const iconPreviewSrc = computed(() => {
  const p = props.fb.iconPath
  return p && p.trim() ? 'file:///' + p.trim().replace(/\\/g, '/') : defaultIcon
})

// ================================================================
//  3. 文件选择：处理用户点击"选择图片"按钮
// ================================================================

/*
 *  处理文件选择器的 change 事件
 *  在 Electron 环境下，file.path 返回用户选择的文件的完整路径
 *  将路径保存到 fb.iconPath，父组件会持久化到配置文件
 *  注意：读取完成后要把 input.value 清空，否则再次选择同一文件不会触发 change
 */
function handleIconPick(e) {
  const file = e.target.files[0]
  if (!file) return
  const path = file.path || file.name
  emit('update:fb', { ...props.fb, iconPath: path })
  e.target.value = ''
}

// ================================================================
//  4. 图标重置：恢复默认图标设置
// ================================================================

/*
 *  将图标路径清空（使用默认图标），图标尺寸恢复为 48px
 */
function resetIcon() {
  emit('update:fb', { ...props.fb, iconPath: '', iconSize: 48 })
}

// ================================================================
//  5. 滑条轨道填充：计算已滑动区域的渐变背景
// ================================================================

/*
 *  计算 range 滑条已填充部分的 CSS 渐变样式
 *  参数 val: 滑条当前值
 *  参数 min: 滑条最小值
 *  参数 max: 滑条最大值
 *  返回：{ background: 'linear-gradient(...)' } 可直接绑定到 :style
 *  效果：已滑动区域显示主题色 #39c5bb，未滑动区域灰色 #e0e5ea
 *  注意：返回值是一个对象，模板中用 :style="rangeFill(...)" 绑定
 */
function rangeFill(val, min, max) {
  const pct = ((val - min) / (max - min)) * 100
  return { background: `linear-gradient(to right, #39c5bb 0%, #39c5bb ${pct}%, #e0e5ea ${pct}%, #e0e5ea 100%)` }
}

// ================================================================
//  6. 自定义调色盘（HSL 颜色空间）
// ================================================================

/*
 *  调色盘工作原理：
 *  颜色用 HSL（色相 Hue / 饱和度 Saturation / 明度 Lightness）表示
 *  色相条：0°=红, 120°=绿, 240°=蓝, 360°=红（循环），用户水平拖拽选色相
 *  饱和度/明度面板：横轴 = 饱和度（左灰右纯），纵轴 = 明度（上亮下暗）
 *  两个面板共用 hslToHex 转换为十六进制颜色供 CSS 使用
 *  鼠标/触摸拖拽通过全局事件监听实现，松开时停止
 */

/* 面板显示开关 */
const showPicker = ref(false)

/* DOM 引用 */
const satValRef = ref(null)  /* 饱和度/明度面板 */
const hueRef = ref(null)     /* 色相条 */

/* 当前预览颜色（调色盘中实时变化，点确定后才写入 props） */
const pickerColor = ref(props.fb.borderColor || '#ffffff')

/* HSL 分量 */
const hue = ref(0)    /* 色相 0-360 */
const huePct = ref(0) /* 色相条百分比位置 */
const svX = ref(100)  /* 饱和度面板横轴 0-100（对应饱和度） */
const svY = ref(0)    /* 饱和度面板纵轴 0-100（对应 100-明度） */

/* 拖拽状态标志 */
let draggingHue = false
let draggingSV = false

/*
 *  饱和度/明度面板的背景色（响应式计算）
 *  根据当前选中的色相值，动态生成"白色 → 该色相纯色"的水平渐变
 *  垂直方向的黑色渐变通过 CSS ::after 伪元素叠加
 */
const satValBg = computed(() => {
  const base = hslToHex(hue.value, 100, 50)
  return { background: `linear-gradient(to right, #fff, ${base})` }
})

/*
 *  HSL → Hex 转换
 *  参考算法：https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB
 *  参数 h: 色相 0-360, s: 饱和度 0-100, l: 明度 0-100
 *  返回：六位十六进制颜色字符串，如 "#39c5bb"
 */
function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/*
 *  Hex → HSL 转换
 *  参数 hex: 六位十六进制颜色字符串，如 "#39c5bb"
 *  返回：{ h: 色相, s: 饱和度%, l: 明度% }
 *  边界处理：支持三位缩写 hex（如 #abc），负数色相自动 +360 修正
 */
function hexToHsl(hex) {
  let r = 0, g = 0, b = 0
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) / 255
    g = parseInt(hex[1] + hex[1], 16) / 255
    b = parseInt(hex[2] + hex[2], 16) / 255
  } else if (hex.length >= 6) {
    r = parseInt(hex.slice(0, 2), 16) / 255
    g = parseInt(hex.slice(2, 4), 16) / 255
    b = parseInt(hex.slice(4, 6), 16) / 255
  }
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h2 = 0, s2 = 0
  if (max !== min) {
    const d = max - min
    s2 = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r)      h2 = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h2 = ((b - r) / d + 2) / 6
    else                h2 = ((r - g) / d + 4) / 6
  }
  h2 = Math.round(h2 * 360)
  if (h2 < 0) h2 += 360
  return { h: h2, s: Math.round(s2 * 100), l: Math.round(l * 100) }
}

/* 从 hex 颜色同步到 HSL 分量和面板位置 */
function syncFromHex(hex) {
  const hsl = hexToHsl(hex)
  hue.value = hsl.h
  huePct.value = (hsl.h / 360) * 100
  svX.value = hsl.s
  svY.value = 100 - hsl.l
}

/* 从当前 HSL 分量更新预览颜色 */
function updateFromHSL() {
  const lightness = 100 - svY.value
  pickerColor.value = hslToHex(hue.value, svX.value, lightness)
}

/* 打开/关闭调色盘，打开时从 props 同步当前颜色 */
function togglePicker() {
  showPicker.value = !showPicker.value
  if (showPicker.value) {
    syncFromHex(props.fb.borderColor || '#ffffff')
    pickerColor.value = props.fb.borderColor || '#ffffff'
  }
}

/* 确定：将预览颜色写入 props 并关闭面板 */
function applyColor() {
  emit('update:fb', { ...props.fb, borderColor: pickerColor.value })
  showPicker.value = false
}

/* hex 输入框实时输入，格式正确时同步面板 */
function onHexInput(e) {
  const v = e.target.value.trim()
  pickerColor.value = v
  if (/^#[0-9a-fA-F]{6}$/.test(v)) syncFromHex(v)
}

/* hex 输入框失焦时尝试同步（允许用户粘贴后点击其他地方） */
function onHexBlur() {
  if (/^#[0-9a-fA-F]{6}$/.test(pickerColor.value)) {
    syncFromHex(pickerColor.value)
  }
}

/* 色相条拖拽：根据鼠标/触摸 X 坐标计算色相值 */
function hueFromClientX(cx) {
  const r = hueRef.value.getBoundingClientRect()
  const p = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100))
  huePct.value = p
  hue.value = Math.round((p / 100) * 360)
  updateFromHSL()
}

function startHueDrag(e) {
  draggingHue = true
  hueFromClientX(e.clientX || e.touches[0].clientX)
}
function onHueMove(e) {
  if (draggingHue) hueFromClientX(e.clientX || e.touches[0].clientX)
}
function onHueUp() { draggingHue = false }

/* 饱和度/明度面板拖拽：根据鼠标/触摸坐标计算饱和度和明度 */
function svFromClient(cx, cy) {
  const r = satValRef.value.getBoundingClientRect()
  svX.value = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100))
  svY.value = Math.max(0, Math.min(100, ((cy - r.top) / r.height) * 100))
  updateFromHSL()
}

function startSatValDrag(e) {
  draggingSV = true
  svFromClient(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY)
}
function onSVMove(e) {
  if (draggingSV) svFromClient(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY)
}
function onSVUp() { draggingSV = false }

/* 全局事件：统一处理鼠标和触摸的移动/松开 */
function onGlobalMove(e) {
  if (draggingHue) onHueMove(e)
  if (draggingSV) onSVMove(e)
}
function onGlobalUp() {
  if (draggingHue) onHueUp()
  if (draggingSV) onSVUp()
}

/* 挂载时注册全局事件，卸载时移除（防止内存泄漏） */
onMounted(() => {
  document.addEventListener('mousemove', onGlobalMove)
  document.addEventListener('mouseup', onGlobalUp)
  document.addEventListener('touchmove', onGlobalMove)
  document.addEventListener('touchend', onGlobalUp)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onGlobalMove)
  document.removeEventListener('mouseup', onGlobalUp)
  document.removeEventListener('touchmove', onGlobalMove)
  document.removeEventListener('touchend', onGlobalUp)
})

/* 外部通过 props 修改颜色时同步到预览 */
watch(() => props.fb.borderColor, (c) => {
  if (c) pickerColor.value = c
})
</script>

<style scoped>
/*
 *  本组件完整样式表
 *  主题色：初音绿 #39c5bb（所有控件颜色直接硬编码，不使用 CSS 变量以提升性能）
 */

/* ===== 主题色 & 全局 ===== */
.tab-page {
  animation: slide-in 0.3s cubic-bezier(0.25, 0, 0.25, 1);
}
@keyframes slide-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ===== 滚动条（主题色） ===== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(57, 197, 187, 0.35);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(57, 197, 187, 0.55);
}
::-webkit-scrollbar-button {
  display: none;
}
::-webkit-scrollbar-corner {
  background: transparent;
}

/* ===== 卡片（通用容器） ===== */
.card {
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e8ecf2;
}
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #334;
  margin-bottom: 4px;
}
.card-desc {
  font-size: 12px;
  color: #99a;
  margin-bottom: 12px;
  line-height: 1.5;
}
.card-desc-skeleton {
  height: 36px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e8ecf2 25%, #f0f2f5 50%, #e8ecf2 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== 配置行（通用布局） ===== */
.cfg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}
.cfg-row label:first-child {
  font-size: 14px;
  color: #444;
}
.cfg-label-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cfg-row-col {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.cfg-hint-text {
  font-size: 11px;
  color: #99a;
}
.cfg-slider {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cfg-slider span {
  font-size: 13px;
  color: #888;
  min-width: 36px;
}
/* ===== 颜色选择器 ===== */
.color-swatch {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 10px 4px 4px; border: 1.5px solid #d0d8e0;
  border-radius: 999px; background: #fff; cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s; user-select: none;
}
.color-swatch:hover { border-color: #39c5bb; box-shadow: 0 0 0 3px rgba(57,197,187,0.12); }
.color-swatch-preview { width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(0,0,0,0.08); flex-shrink: 0; }
.color-swatch-value { font-size: 12px; color: #556; font-family: 'SF Mono','Consolas',monospace; }

/* 调色盘 Dialog 遮罩 */
.color-dialog-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: transparent; display: flex;
  align-items: center; justify-content: center;
}
/* 淡入淡出 + 从下至上飞入 */
.dialog-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.dialog-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.dialog-enter-from { opacity: 0; transform: translateY(40px); }
.dialog-leave-to   { opacity: 0; transform: translateY(20px); }
.color-dialog {
  background: #fff; border-radius: 16px; padding: 16px 18px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.2); width: 280px;
}
.color-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; font-size: 13px; font-weight: 600; color: #444;
}
.color-dialog-close {
  width: 24px; height: 24px; border: none; border-radius: 50%;
  background: #f0f2f5; color: #888; font-size: 12px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.color-dialog-close:hover { background: #e55; color: #fff; }

/* 饱和度/明度面板 */
.cp-sat-val {
  position: relative; width: 100%; height: 160px; border-radius: 8px;
  margin-bottom: 10px; cursor: crosshair; overflow: hidden;
}
.cp-sat-val::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to top, #000, transparent);
}
.cp-sat-val-thumb {
  position: absolute; width: 16px; height: 16px;
  border: 2px solid #fff; border-radius: 50%;
  box-shadow: 0 1px 6px rgba(0,0,0,0.3); transform: translate(-50%, -50%);
  pointer-events: none; z-index: 1;
}

/* 色相条 */
.cp-hue-bar {
  position: relative; width: 100%; height: 16px; border-radius: 8px;
  margin-bottom: 12px; cursor: pointer;
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
}
.cp-hue-thumb {
  position: absolute; top: -2px; width: 16px; height: 20px;
  border: 2px solid #fff; border-radius: 4px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.3); transform: translateX(-50%);
  pointer-events: none;
}

/* 底部 */
.cp-footer { display: flex; align-items: center; gap: 10px; }
.cp-preview-dot { width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(0,0,0,0.08); flex-shrink: 0; }
.cp-hex-input { flex: 1; text-align: center; }
.btn-sm { padding: 5px 14px; font-size: 11px; }
.cfg-hint {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
.cfg-hint.warn {
  color: #e80;
}

/* ===== Switch 开关 ===== */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch-track {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: #ccc;
  transition: 0.2s;
}
.switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: 0.2s;
}
.switch input:checked + .switch-track {
  background: #39c5bb;
}
.switch input:checked + .switch-track::after {
  transform: translateX(20px);
}

/* ===== 通用滑条 ===== */
input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  /* 不设 accent-color，轨道填充由 JS rangeFill() inline style 控制 */
  background: #e0e5ea;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #39c5bb;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* ===== 数字输入框（隐藏浏览器默认的上下箭头） ===== */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type=number] {
  -moz-appearance: textfield;
  appearance: none;
}

/* ===== 胶囊输入框（主题色圆角输入框） ===== */
.cfg-xy-group {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.capsule-input {
  width: 80px;
  padding: 5px 12px;
  border: 1.5px solid #d0d8e0;
  border-radius: 999px;
  font-size: 12px;
  text-align: center;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}
.capsule-input:focus {
  border-color: #39c5bb;
}
.capsule-input-wide {
  flex: 1;
  width: auto;
}

/* ===== 主题色按钮 ===== */
.btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: #39c5bb;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: filter 0.2s;
}
.btn:hover {
  filter: brightness(1.08);
}
.btn-outline {
  background: #fff;
  color: #888;
  border: 1px solid #ddd;
}
.btn-outline:hover {
  border-color: #39c5bb;
  color: #39c5bb;
  transition: all 0.2s;
}

/* ===== 图标选择区域 ===== */
.icon-picker-row {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-top: 6px;
  width: 100%;
}
.icon-actions {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.icon-path-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.icon-path-sub {
  justify-content: space-between;
}
.icon-warn {
  margin: 0;
  white-space: nowrap;
}
.icon-preview-box {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border: 2px solid #e0e4ea;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f2f4f7;
  overflow: hidden;
}
.icon-preview-img {
  object-fit: contain;
}
</style>
