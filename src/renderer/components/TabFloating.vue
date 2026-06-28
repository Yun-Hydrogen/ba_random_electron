<!--
  组件：TabFloating.vue
  所属：配置面板 - 悬浮按钮 Tab
  父组件：ConfigPanel.vue（通过 props 传入数据，通过 emit 传出修改）

  功能概述：
    1. 按钮样式   —— 大小百分比 / 屏幕位置 X,Y / 持续置顶开关
    2. 中心图标   —— 文件选择器（FileReader → base64 data URL）+ 圆形预览 + 图标尺寸滑条
    3. 边框颜色   —— 自定义 HSL 调色盘（色相条 + 饱和度/明度面板 + hex 输入）
    4. 滑条填充   —— 所有滑条均有轨道填充效果（rangeFill 函数）

  数据流：
    父组件 ConfigPanel 持有 draft.floatingButton 对象
    本组件通过 props.fb 接收完整的 floatingButton 配置
    任何修改通过 emit('update:fb', newFb) 把整个新对象传回父组件

  主题色：初音绿 #39c5bb，所有控件颜色硬编码在 CSS 中

  图标存储方案（base64 data URL）：
    - 用户点击「选择图片」→ FileReader.readAsDataURL() 读取文件内容
    - 将 data:image/...;base64,... 格式的字符串存入 fb.iconDataUrl
    - 配置面板通过 iconPreviewSrc computed 直接使用 data URL 预览
    - 悬浮按钮通过 iconSrc computed 直接使用 data URL 显示
    - 优势：内嵌在 config.yml 中，不依赖文件路径或自定义协议，
      开发模式（http://localhost）和生产模式（file://）均可用
    - 注意：大图片的 base64 字符串较长，建议使用小尺寸图标

  注意事项：
    - 必须用扩展运算符 {...props.fb, key: newValue} 创建新对象触发响应式
    - 滑条默认值兜底：sizePercent||100, iconSize||48，防止首次渲染 NaN
    - 图标文本框为 readonly 模式，base64 字符串无手动编辑意义
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
        <span class="cfg-hint-text">按钮中央显示的图片，点击右侧按钮选择本地图片</span>
        <div class="icon-picker-row">
          <div class="icon-actions">
            <div class="icon-path-row">
              <input type="text" :value="fb.iconDataUrl" readonly class="capsule-input capsule-input-wide" :placeholder="iconPlaceholder" />
              <label class="btn">
                选择图片
                <input type="file" accept="image/*" @change="handleIconPick" style="display:none" />
              </label>
            </div>
            <div class="icon-path-row icon-path-sub">
              <span class="cfg-hint">图片将以 base64 编码存储到配置文件中</span>
              <button class="btn btn-outline" @click="resetIcon">恢复默认</button>
            </div>
          </div>
          <div class="icon-preview-box">
            <img :src="iconPreviewSrc" class="icon-preview-img" :style="{ width: effectivePreviewSize + 'px', height: effectivePreviewSize + 'px' }" />
          </div>
        </div>
      </div>

      <!-- 图标大小 -->
      <div class="cfg-row">
        <div class="cfg-label-col">
          <label>图标大小</label>
          <span class="cfg-hint-text">中心图标在按钮内的显示尺寸（实际不超过按钮的 80%）</span>
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
 *  3. 图标预览          —— 直接使用存储的 base64 data URL（iconPreviewSrc）
 *  4. 文件选择          —— FileReader.readAsDataURL() 将图片转 base64 存入 iconDataUrl
 *  5. 图标重置          —— 清空 iconDataUrl 恢复默认图标
 *  6. 滑条轨道填充      —— 计算滑条已滑动区域的渐变色
 *  7. 自定义调色盘      —— HSV 风格面板 + HSL 坐标转换 + 拖拽选取 + hex 输入
 */
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'

/*
 *  props：父组件传入的数据
 *  fb —— floatingButton 配置对象，包含以下字段：
 *    sizePercent   (number)  按钮缩放百分比，默认 100
 *    alwaysOnTop   (boolean) 是否持续置顶
 *    position.x    (number|null) 屏幕 X 坐标，null=自动
 *    position.y    (number|null) 屏幕 Y 坐标，null=自动
 *    iconDataUrl   (string)  自定义图标（base64 data URL），空字符串=使用默认图标
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
//  2. 图标预览：直接使用存储的 base64 data URL
// ================================================================

/* 默认图标路径（应用安装目录下的 app.ico） */
const defaultIcon = '/image/app.ico'

/*
 *  iconPlaceholder — 文本框占位提示
 *  未设置图标时显示提示文字，设置后显示 base64 前缀预览
 */
const iconPlaceholder = computed(() => {
  return (props.fb.iconDataUrl || '') ? '已设置自定义图标 (base64)' : '点击右侧按钮选择本地图片'
})

/*
 *  iconPreviewSrc — 图标预览的 <img src> 值。
 *
 *  逻辑极简：
 *    - iconDataUrl 非空 → 直接使用（本身就是 data:image/...;base64,... 格式）
 *    - iconDataUrl 为空 → 使用内置默认图标 /image/app.ico
 *
 *  优势：
 *    - data URL 内嵌在配置中，不依赖任何文件路径或自定义协议
 *    - 开发模式（http://localhost）和生产模式（file://）均可正常显示
 *    - 无需 local-file 协议、无需跨协议权限
 */
const iconPreviewSrc = computed(() => {
  return (props.fb.iconDataUrl || '') ? props.fb.iconDataUrl : defaultIcon
})

/*
 *  effectivePreviewSize — 匹配 FloatingButton 实际渲染的图标尺寸。
 *
 *  FloatingButton 的 iconStyle 将图标限制为按钮尺寸的 80%（最小 16px）：
 *    effective = max(16, min(iconSize, round(sizePx × 0.8)))
 *  其中 sizePx = 50 × (sizePercent / 100)
 *
 *  此处计算相同的值，确保配置面板预览与实际悬浮按钮显示一致。
 */
const effectivePreviewSize = computed(() => {
  const iconSize = props.fb.iconSize || 48
  const sizePx = Math.round(50 * ((props.fb.sizePercent || 100) / 100))
  const maxIcon = Math.round(sizePx * 0.8)
  return Math.max(16, Math.min(iconSize, maxIcon))
})

// ================================================================
//  3. 文件选择：用 FileReader 将图片文件读为 base64 data URL
// ================================================================

/*
 *  处理文件选择器的 change 事件。
 *
 *  参照 TabRoster 的 FileReader 模式：
 *    1. 从 e.target.files[0] 获取用户选择的文件
 *    2. 用 FileReader.readAsDataURL() 读取文件内容为 data URL
 *       （格式：data:image/png;base64,iVBORw0KGgo...）
 *    3. 将 data URL 保存到 fb.iconDataUrl
 *    4. 清空 input.value 以允许重复选择同一文件
 *
 *  注意：
 *    - readAsDataURL 是异步操作，emit 在 onload 回调中执行
 *    - 与之前 file.path 方案不同，这里直接读取文件数据，不再依赖文件路径
 *    - 大图片（>1MB）的 base64 会很长，建议用户使用小尺寸图标
 */
function handleIconPick(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    emit('update:fb', { ...props.fb, iconDataUrl: ev.target.result })
    e.target.value = ''
  }
  reader.onerror = () => {
    console.error('读取图片文件失败')
    e.target.value = ''
  }
  reader.readAsDataURL(file)
}

// ================================================================
//  4. 图标重置：恢复默认图标设置
// ================================================================

/*
 *  清空 iconDataUrl（使用默认图标），图标尺寸恢复为 48px
 */
function resetIcon() {
  emit('update:fb', { ...props.fb, iconDataUrl: '', iconSize: 48 })
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
//  6. 自定义调色盘（HSV 风格面板 + HSL 颜色空间转换）
// ================================================================

/*
 *  调色盘工作原理（HSV 风格面板）：
 *
 *  饱和度/明度面板（.cp-sat-val）：
 *    背景：linear-gradient(to right, #fff, pure-hue-at-S100-L50)
 *          → 横轴 = 饱和度（左 0% 灰 → 右 100% 纯色）
 *    ::after 叠加：linear-gradient(to top, #000, transparent)
 *          → 纵轴 = 明度（下 0% 黑 → 上 100% 亮）
 *    因此右上角 = 纯色 (S=100, L=50)，左上角 = 白色，底部 = 黑色
 *
 *  色相条（.cp-hue-bar）：
 *    彩虹渐变条 → 水平拖拽选择色相 (0°-360°)
 *
 *  坐标 → HSL 转换公式：
 *    L = (100 - S × 0.5) × (100 - svY) / 100
 *    （面板背景 white→L50 纯色 + 黑色叠加的几何推导）
 *
 *  颜色使用 hslToHex / hexToHsl 在 HSL 和 hex 之间转换
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
const svX = ref(100)  /* 面板横轴 0-100，对应饱和度 S（0=灰，100=纯色） */
const svY = ref(0)    /* 面板纵轴 0-100，对应明度分量（0=顶/亮，100=底/黑）
                          注意：svY 并非直接等于 L 或 100-L，转换见 updateFromHSL */

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

/*
 *  syncFromHex — 从 hex 颜色反向推到 HSL 分量和面板坐标。
 *
 *  反向公式（由 updateFromHSL 的公式求逆）：
 *    svX = S
 *    svY = 100 - L × 100 / (100 - S × 0.5)    （若分母为 0 即 S=0 L=100 白色，则 svY=0）
 *
 *  验证：
 *    白色(#fff, S=0 L=100): svX=0, svY=0 → 左上角 ✓
 *    纯红(#f00, S=100 L=50): svX=100, svY=0 → 右上角 ✓
 *    灰色(#808080, S=0 L=50): svX=0, svY=50 → 中左 ✓
 *    黑色(#000, S=0 L=0): svX=0, svY=100 → 底部 ✓
 */
function syncFromHex(hex) {
  const hsl = hexToHsl(hex)
  hue.value = hsl.h
  huePct.value = (hsl.h / 360) * 100
  svX.value = hsl.s
  const denom = 100 - hsl.s * 0.5
  // 面板色域限制：仅能表示 L ∈ [0, 100-S×0.5] 的颜色
  // 超出范围（如高饱和度亮色 L>50）clamp 到面板边界
  svY.value = denom > 0
    ? Math.max(0, Math.min(100, Math.round(100 - hsl.l * 100 / denom)))
    : 0
}

/*
 *  updateFromHSL — 从当前 HSL 分量更新预览颜色。
 *
 *  面板坐标 → HSL 的正确映射（HSV 风格面板）：
 *
 *  面板背景：linear-gradient(to right, #fff, pure-hue-at-L50)
 *  面板叠加：linear-gradient(to top, #000, transparent)（底部黑，顶部透）
 *
 *  因此面板上某点 (svX%, svY%) 对应的颜色为：
 *    基础色（顶部）：S = svX, L_base = 100 - svX×0.5
 *    叠加黑色后：L = L_base × (1 - svY/100) = (100 - svX×0.5) × (100 - svY) / 100
 *
 *  验证：
 *    左上(0,0): S=0, L=100 → 白色 ✓
 *    右上(100,0): S=100, L=50 → 纯色 ✓
 *    左下(0,100): S=0, L=0 → 黑色 ✓
 *    右下(100,100): S=100, L=0 → 黑色 ✓
 */
function updateFromHSL() {
  const s = svX.value
  const baseL = 100 - s * 0.5
  const l = Math.round(baseL * (100 - svY.value) / 100)
  pickerColor.value = hslToHex(hue.value, s, l)
}

/*
 *  togglePicker — 打开/关闭调色盘 Dialog。
 *  打开时：从 props.fb.borderColor 同步面板位置和预览颜色，
 *          确保调色盘始终反映当前已保存的配置值（而非上次调色盘的残留状态）。
 *  关闭时：丢弃未确认的修改，不写入 props。
 */
function togglePicker() {
  showPicker.value = !showPicker.value
  if (showPicker.value) {
    syncFromHex(props.fb.borderColor || '#ffffff')
    pickerColor.value = props.fb.borderColor || '#ffffff'
  }
}

/*
 *  applyColor — 确认选取，将预览颜色写入配置并关闭面板。
 *  使用扩展运算符创建新对象以触发 Vue 响应式更新。
 */
function applyColor() {
  emit('update:fb', { ...props.fb, borderColor: pickerColor.value })
  showPicker.value = false
}

/*
 *  hex 输入框实时输入处理。
 *  用户每键入一个字符就更新 pickerColor（所见即所得），
 *  当输入完整合法的 6 位 hex（如 #66ccff）时同步面板位置。
 *  格式校验：/^#[0-9a-fA-F]{6}$/
 */
function onHexInput(e) {
  const v = e.target.value.trim()
  pickerColor.value = v
  if (/^#[0-9a-fA-F]{6}$/.test(v)) syncFromHex(v)
}

/*
 *  hex 输入框失焦处理。
 *  允许用户粘贴 hex 值后点击其他地方（而非按 Enter）来触发同步。
 *  仅在值合法时同步，避免半截输入覆盖面板状态。
 */
function onHexBlur() {
  if (/^#[0-9a-fA-F]{6}$/.test(pickerColor.value)) {
    syncFromHex(pickerColor.value)
  }
}

/*
 *  色相条拖拽处理。
 *
 *  hueFromClientX：根据鼠标/触摸的水平 clientX 计算色相值。
 *    色相 = (相对条左侧的百分比) × 360°，clamp 在 [0,360]。
 *  startHueDrag：mousedown/touchstart 时激活拖拽并立即更新色相。
 *  onHueMove：全局 mousemove/touchmove 时持续更新。
 *  onHueUp：全局 mouseup/touchend 时结束拖拽。
 */
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

/*
 *  饱和度/明度面板拖拽处理。
 *
 *  svFromClient：根据鼠标/触摸的 clientX、clientY 计算面板百分比坐标。
 *    svX = 水平相对位置%（左=0，右=100）
 *    svY = 垂直相对位置%（上=0，下=100）
 *    坐标 clamp 在 [0,100] 范围内。
 *  startSatValDrag：mousedown/touchstart 时激活拖拽并立即更新位置。
 *  onSVMove：全局 mousemove/touchmove 时持续更新。
 *  onSVUp：全局 mouseup/touchend 时结束拖拽。
 */
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

/*
 *  全局事件代理 —— 统一处理鼠标和触摸的移动/松开。
 *
 *  为什么用全局事件而非组件内事件：
 *    拖拽过程中鼠标可能移出面板 DOM 元素（快速拖拽时），
 *    若只监听元素自身的 mousemove，移出后无法继续跟踪位置。
 *    使用 document 级别的全局事件可确保拖拽全程追踪。
 *
 *  onGlobalMove：根据当前激活的拖拽类型（色相/饱和度），转发到对应处理器。
 *  onGlobalUp：同时结束所有拖拽（容错：即使某种拖拽已结束也无害）。
 *
 *  事件注册/注销在 onMounted / onBeforeUnmount 中成对执行，防止内存泄漏。
 */
function onGlobalMove(e) {
  if (draggingHue) onHueMove(e)
  if (draggingSV) onSVMove(e)
}
function onGlobalUp() {
  if (draggingHue) onHueUp()
  if (draggingSV) onSVUp()
}

/*
 *  挂载时注册全局拖拽事件，卸载时注销。
 *  同时监听 mouse 和 touch 事件，兼容桌面与触屏设备。
 *
 *  事件注册在 document 而非组件 DOM 上，原因是：
 *    拖拽过程中鼠标/手指可能移出面板元素，若仅监听元素自身事件，
 *    移出后将丢失跟踪，导致拖拽"卡住"。全局事件保证全程追踪。
 *
 *  注销必须与注册成对，否则切换 Tab 或关闭面板后残留监听器导致内存泄漏。
 */
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

/*
 *  外部通过 props 修改颜色时同步到 pickerColor。
 *  注意：仅同步 pickerColor（color-swatch 预览圆点），不同步面板坐标。
 *  面板坐标在用户下次打开调色盘时由 togglePicker → syncFromHex 重新计算。
 */
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
.color-swatch-value { font-size: 12px; color: #556; font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif; }

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

/*
 *  饱和度/明度面板（HSV 风格）。
 *
 *  视觉构成：
 *    底层背景（inline style）：linear-gradient(to right, #fff, <hue-pure-color>)
 *      → 横轴 = 饱和度（左白 → 右纯色）
 *    ::after 叠加层：linear-gradient(to top, #000, transparent)
 *      → 纵轴 = 明度（下黑 → 上无叠加）
 *
 *  因此：
 *    左上角 = 白色（S=0, 无黑色叠加）
 *    右上角 = 纯色（S=100, L=50, 无黑色叠加）
 *    底部   = 黑色（全黑叠加）
 *
 *  注意：JS 中 updateFromHSL / syncFromHex 的坐标转换公式
 *        必须与此 CSS 视觉模型一致，否则选取颜色与实际显示不符。
 */
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
.cp-hex-input { flex: 1; text-align: center; font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif; }
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
