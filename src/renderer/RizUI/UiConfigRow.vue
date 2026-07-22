<!--
================================================================================
  组件：UiConfigRow.vue
  所属：RizUI（src/renderer/RizUI）
  类型：表单行组件

================================================================================
  一、功能
================================================================================
  配置面板中的标准控件行：左侧标签+提示，右侧插槽放控件。
  notReady 模式下自动附加遮罩。

================================================================================
  二、Props
================================================================================
  label    — 左侧标签文字
  hint     — 标签下方提示小字（可选）
  stack    — 控件放在 hint 下方（竖向布局），默认 false（横向，控件在右）
  notReady — 是否显示"未就绪"遮罩（默认 false）
  notReadyText — 遮罩文字（默认 "等待实现"）

================================================================================
  三、Slot
================================================================================
  default — 控件区。横向模式在标签右侧，stack 模式在 hint 下方

================================================================================
  四、使用示例

    // 普通行（横向）
    // &lt;UiConfigRow label="持续置顶" hint="..."&gt;
    //   &lt;label class="switch"&gt;...&lt;/label&gt;
    // &lt;/UiConfigRow&gt;

    // 堆叠行（竖向，适合长输入框）
    // &lt;UiConfigRow label="程序路径" hint="..." stack&gt;
    //   &lt;input class="adv-input" /&gt;
    // &lt;/UiConfigRow&gt;

    // 未就绪行（遮罩自动吸附）
    // &lt;UiConfigRow label="联动播报" hint="..." notReady&gt;

  最后更新：2026-07-21
================================================================================
-->

<template>
  <div class="ucr-row" :class="{ 'ucr-not-ready': notReady, 'ucr-stack': stack }">
    <div class="ucr-label-col">
      <label>{{ label }}</label>
      <span v-if="hint" class="ucr-hint">{{ hint }}</span>
      <div v-if="stack" class="ucr-slot-wrap">
        <slot />
      </div>
    </div>
    <slot v-if="!stack" />
    <NotReadyOverlay v-if="notReady" :text="notReadyText" />
  </div>
</template>

<script setup>
import NotReadyOverlay from './NotReadyOverlay.vue'

defineProps({
  label:       { type: String, required: true },
  hint:        { type: String, default: '' },
  stack:       { type: Boolean, default: false },
  notReady:    { type: Boolean, default: false },
  notReadyText:{ type: String, default: '等待实现' }
})
</script>

<style scoped>
.ucr-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}

/* stack 模式：标签在上，控件在下 */
.ucr-stack {
  flex-direction: column;
  gap: 0;
}

.ucr-not-ready {
  position: relative;
  overflow: hidden;
}

.ucr-label-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 120px;
  padding-top: 2px;
}

/* stack 模式下标签列不再需要 flex 约束 */
.ucr-stack .ucr-label-col {
  flex: none;
  min-width: 0;
  width: 100%;
}

.ucr-label-col > label {
  font-size: 14px;
  color: #444;
  line-height: 1.4;
}

.ucr-hint {
  font-size: 11px;
  color: #99a;
  overflow-wrap: break-word;
  line-height: 1.4;
}

/* stack 模式下控件包裹层，提供与上方 hint 的间距 */
.ucr-slot-wrap {
  margin-top: 8px;
}
</style>