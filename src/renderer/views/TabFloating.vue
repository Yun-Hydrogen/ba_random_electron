<!--
  组件：TabFloating.vue
  所属：配置面板 - 悬浮按钮 Tab
  父组件：ConfigPanel.vue（通过 props 传入数据，通过 emit 传出修改）

  功能概述：
    1. 按钮样式   —— 大小百分比 / 屏幕位置 X,Y / 持续置顶开关
    2. 中心图标   —— 文件选择器（FileReader → base64 data URL）+ 圆形预览 + 图标尺寸滑条
    3. 边框颜色   —— UiColorPicker 组件（HSL 调色盘 Dialog）
    4. 滑条填充   —— UiSlider 组件自动处理轨道渐变

  数据流：
    父组件 ConfigPanel 持有 draft.floatingButton 对象
    本组件通过 props.fb 接收完整的 floatingButton 配置
    任何修改通过 emit('update:fb', newFb) 把整个新对象传回父组件

  主题色：初音绿 #39c5bb，通过 tabTheme 变量传给 UiSwitch / UiColorPicker

  图标存储方案（base64 data URL）：
    - 用户点击「选择图片」→ FileReader.readAsDataURL() 读取文件内容
    - 将 data:image/...;base64,... 格式的字符串存入 fb.iconDataUrl
    - 配置面板通过 iconPreviewSrc computed 直接使用 data URL 预览
    - 悬浮按钮通过 iconSrc computed 直接使用 data URL 显示
    - 优势：内嵌在 config.yml 中，不依赖文件路径或自定义协议，
      开发模式（http://localhost）和生产模式（file://）均可用

  注意事项：
    - 必须用扩展运算符 {...props.fb, key: newValue} 创建新对象触发响应式
    - 滑条默认值兜底：sizePercent||100, iconSize||48，防止首次渲染 NaN
    - 图标文本框为 readonly 模式，base64 字符串无手动编辑意义
    - 颜色选择器由 UiColorPicker 统一管理（HSL 转换 / 拖拽 / Dialog 动画）
-->

<template>
  <div class="tab-page floating-tab">
    <!-- 一、按钮样式 -->
    <UiCard title="行为" desc="调整悬浮按钮的行为">

      <UiConfigRow label="位置 X / Y" hint="应用主动退出时会记忆当前位置并保存，通常情况下无需手动修改">
        <div class="cfg-xy-group">
          <input type="number" :value="fb.position.x" @input="$emit('update:fb',{...fb,position:{...fb.position,x:$event.target.value===''?null:parseInt($event.target.value)}})" class="capsule-input" placeholder="X" />
          <input type="number" :value="fb.position.y" @input="$emit('update:fb',{...fb,position:{...fb.position,y:$event.target.value===''?null:parseInt($event.target.value)}})" class="capsule-input" placeholder="Y" />
        </div>
      </UiConfigRow>

      <UiConfigRow label="持续置顶" hint="启用后开启悬浮按钮的置顶功能">
        <UiSwitch :modelValue="fb.alwaysOnTop" :color="tabTheme" @update:modelValue="$emit('update:fb',{...fb,alwaysOnTop:$event})" />
      </UiConfigRow>

      <UiConfigRow label="任务栏可见" hint="悬浮按钮是否显示在任务栏中，可能解决多桌面下桌面意外跳转的问题">
        <UiSwitch :modelValue="fb.showInTaskbar" :color="tabTheme" @update:modelValue="$emit('update:fb',{...fb,showInTaskbar:$event})" />
      </UiConfigRow>
    </UiCard>

    <!-- 二、自定义 -->
    <UiCard title="样式" desc="按钮中心图标、边框颜色等个性化设置">

      <!-- 中心图标 -->
      <UiConfigRow label="按钮大小" hint="缩放百分比，100% 为默认尺寸">
        <UiSlider :modelValue="fb.sizePercent || 100" :min="50" :max="200" :color="tabTheme" display="%" @update:modelValue="$emit('update:fb',{...fb,sizePercent:$event})" />
      </UiConfigRow>

      <UiConfigRow label="中心图标" hint="按钮中央显示的图片，点击右侧按钮选择本地图片" stack>
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
      </UiConfigRow>

      <!-- 图标大小 -->
      <UiConfigRow label="图标大小" hint="中心图标在按钮内的显示尺寸（实际不超过按钮的 80%）">
        <UiSlider :modelValue="fb.iconSize || 48" :min="16" :max="96" :color="tabTheme" display="px" @update:modelValue="$emit('update:fb',{...fb,iconSize:$event})" />
      </UiConfigRow>

      <!-- 边框颜色 -->
      <UiConfigRow label="按钮边框颜色" hint="悬浮圆形按钮的外圈描边颜色">
        <UiColorPicker v-model="fb.borderColor" :color="tabTheme" teleport=".config-left" />
      </UiConfigRow>
    </UiCard>
  </div>
</template>

<script setup>
/*
 *  组件逻辑概览（按代码顺序）：
 *  1. props / emit      —— 与父组件通信的接口
 *  2. 图标预览          —— 直接使用存储的 base64 data URL（iconPreviewSrc）
 *  3. 文件选择          —— FileReader.readAsDataURL() 将图片转 base64 存入 iconDataUrl
 *  4. 图标重置          —— 清空 iconDataUrl 恢复默认图标
 */
import { computed } from 'vue'
import { UiCard, UiConfigRow, UiSwitch, UiSlider, UiColorPicker } from '../RizUI'

/* Tab 主题色 */
const tabTheme = '#39c5bb'

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
//  1. 图标预览：直接使用存储的 base64 data URL
// ================================================================

/* 默认图标路径（应用安装目录下的 app.ico） */
const defaultIcon = './image/app.ico'

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
 *    - iconDataUrl 为空 → 使用内置默认图标 ./image/app.ico
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
//  2. 文件选择：用 FileReader 将图片文件读为 base64 data URL
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
//  3. 图标重置：恢复默认图标设置
// ================================================================

/*
 *  清空 iconDataUrl（使用默认图标），图标尺寸恢复为 48px
 */
function resetIcon() {
  emit('update:fb', { ...props.fb, iconDataUrl: '', iconSize: 48 })
}

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

.cfg-hint {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
.cfg-hint.warn {
  color: #e80;
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
