<!--
================================================================================
  组件：TabResult.vue
  所属：配置面板 - 抽取结果设置 Tab
  路由：由 ConfigPanel.vue 直接引用，不是独立路由页面

================================================================================
  一、功能概述
================================================================================
  配置抽取结果浮窗的外观、音效及联动功能。包含三张卡片：

    卡片         | 功能
    ─────────────┼──────────────────────────────────────────
    浮窗外观     | 背景/边框颜色、透明度、装饰角色显示开关
    音效控制     | 抽取音效/音乐开关与音量、BGM 起止位置与淡入淡出
    联动         | ClassIsland 播报（暂未实现，notReady 遮罩）

  数据流：父组件 ConfigPanel 通过 :pickResult 传入配置对象，
          本组件通过 $emit('update:pickResult', ...) 上报修改。

================================================================================
  二、Props / Emits
================================================================================
  pickResult  — 抽取结果配置对象（来自父组件 draft.pickResult）
  emit('update:pickResult') — 通知父组件更新配置

  注意：必须传递完整新对象（展开原对象 + 覆盖修改字段），
        不可直接修改 props 的属性。

================================================================================
  三、依赖
================================================================================
  RizUI 组件：UiCard, UiConfigRow, UiSwitch, UiColorPicker
  Vue API：computed

  最后更新：2026-07-21
================================================================================
-->
<template>
  <div class="tab-page">
    <!--
      一、浮窗外观
      控制抽取结果弹窗的视觉呈现
    -->
    <UiCard title="浮窗外观" desc="调整抽取结果浮窗的视觉样式">
      <!-- 背景色 -->
      <UiConfigRow label="浮窗背景颜色" hint="浮窗弹窗的整体底色">
        <UiColorPicker v-model="pickResult.panelBgColor" :color="tabTheme" teleport=".config-left" />
      </UiConfigRow>
      <!-- 边框色 -->
      <UiConfigRow label="浮窗边框颜色" hint="结果浮窗的外框描边">
        <UiColorPicker v-model="pickResult.panelBorderColor" :color="tabTheme" teleport=".config-left" />
      </UiConfigRow>
      <!-- 透明度滑块：内部存储 0-1，UI 显示 10-100% -->
      <UiConfigRow label="浮窗不透明度" hint="数值越低越透明，100% 为完全不透明">
        <UiSlider :modelValue="opacityPercent" :min="10" :max="100" :color="tabTheme" display="%" @update:modelValue="$emit('update:pickResult',{...pickResult,panelOpacity:$event/100})" />
      </UiConfigRow>
      <!-- 装饰角色开关 -->
      <UiConfigRow label="显示阿罗娜和普拉娜" hint="结果浮窗顶部是否显示阿罗娜 &amp; 普拉娜两小只">
        <UiSwitch :modelValue="pickResult.showDeco !== false" :color="tabTheme" @update:modelValue="$emit('update:pickResult',{...pickResult,showDeco:$event})" />
      </UiConfigRow>
    </UiCard>

    <!--
      二、音效控制
      抽取音效 / BGM 的开关、音量、时间参数
    -->
    <UiCard title="音效控制" desc="抽取时的音频反馈设置">
      <!-- 抽取音效开关 -->
      <UiConfigRow label="播放抽取音效" hint="抽取时播放短促的提示音">
        <UiSwitch :modelValue="pickResult.defaultPlayGachaSound" :color="tabTheme" @update:modelValue="$emit('update:pickResult',{...pickResult,defaultPlayGachaSound:$event})" />
      </UiConfigRow>
      <!-- 音效音量 -->
      <UiConfigRow label="抽取音效音量" hint="提示音的响度百分比">
        <UiSlider :modelValue="pickResult.soundVolume || 80" :min="0" :max="100" :color="tabTheme" display="%" @update:modelValue="$emit('update:pickResult',{...pickResult,soundVolume:$event})" />
      </UiConfigRow>
      <!-- BGM 开关 -->
      <UiConfigRow label="播放抽取音乐" hint="抽取时播放完整的背景音乐">
        <UiSwitch :modelValue="pickResult.playMusic" :color="tabTheme" @update:modelValue="$emit('update:pickResult',{...pickResult,playMusic:$event})" />
      </UiConfigRow>
      <!-- BGM 音量 -->
      <UiConfigRow label="抽取音乐音量" hint="背景音乐的响度百分比">
        <UiSlider :modelValue="pickResult.musicVolume || 60" :min="0" :max="100" :color="tabTheme" display="%" @update:modelValue="$emit('update:pickResult',{...pickResult,musicVolume:$event})" />
      </UiConfigRow>
      <!-- BGM 起始秒数，hint 动态显示格式化时间 -->
      <UiConfigRow label="播放起始位置" :hint="'BGM 从指定秒数开始播放（' + formatTime(pickResult.bgmStartTime || 0) + '）'">
        <UiSlider :modelValue="pickResult.bgmStartTime || 0" :min="0" :max="120" :step="1" :color="tabTheme" display="s" @update:modelValue="$emit('update:pickResult',{...pickResult,bgmStartTime:$event})" />
      </UiConfigRow>
      <!-- BGM 淡入淡出渐变秒数 -->
      <UiConfigRow label="淡入淡出时长" hint="BGM 开始和结束时的渐变过渡秒数">
        <UiSlider :modelValue="pickResult.bgmFadeDuration || 1.5" :min="0.5" :max="5" :step="0.5" :color="tabTheme" :displayValue="(pickResult.bgmFadeDuration || 1.5).toFixed(1) + 's'" @update:modelValue="$emit('update:pickResult',{...pickResult,bgmFadeDuration:$event})" />
      </UiConfigRow>
    </UiCard>

    <!--
      三、联动
      与其他桌面软件的集成功能
    -->
    <UiCard title="联动" desc="与其他软件的联动功能">
      <!-- notReady：功能未实现，遮罩自动覆盖 -->
      <UiConfigRow label="ClassIsland 联动播报" hint="将抽取结果播报到 ClassIsland" notReady>
        <UiSwitch :modelValue="false" :color="tabTheme" disabled />
      </UiConfigRow>
    </UiCard>
  </div>
</template>

<script setup>
/*
 *  组件逻辑概览
 *  1. props / emit      — 与父组件 ConfigPanel 通信
 *  2. tabTheme          — 当前 Tab 主题色（#55cc99 初音绿）
 *  3. opacityPercent    — 透明度 computed：内部 0-1 ↔ UI 10-100%
 *  4. formatTime        — 秒数 → MM:SS 格式化
 */
import { computed } from 'vue'
import { UiCard, UiConfigRow, UiSwitch, UiSlider, UiColorPicker } from '../RizUI'

const props = defineProps({ pickResult: Object })
const emit = defineEmits(['update:pickResult'])

/* Tab 主题色 */
const tabTheme = '#55cc99'

/*
 * 透明度转换：config 中存储为 0-1 小数（panelOpacity），UI 滑条使用 10-100 整数。
 * UiSlider 的 @update:modelValue 中直接 $event/100 转回小数并 emit。
 */
const opacityPercent = computed(() => Math.round((props.pickResult.panelOpacity || 0.9) * 100))

/*
 *  秒数 → MM:SS 格式化
 *  用于 BGM 起始位置 hint 的动态显示
 */
function formatTime(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${m}:${String(rs).padStart(2, '0')}`
}
</script>

<style scoped>
/* ===== 主题色 #55cc99 ===== */
.tab-page {
  animation: slide-in 0.3s cubic-bezier(0.25, 0, 0.25, 1);
}
@keyframes slide-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ===== 滚动条 ===== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(85, 204, 153, 0.35);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(85, 204, 153, 0.55);
}
::-webkit-scrollbar-button {
  display: none;
}
::-webkit-scrollbar-corner {
  background: transparent;
}

</style>
