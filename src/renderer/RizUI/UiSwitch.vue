<!--
================================================================================
  组件：UiSwitch.vue
  所属：RizUI（src/renderer/RizUI）
  类型：开关组件

================================================================================
  一、功能
================================================================================
  纯 CSS 开关，替代原生 checkbox 外观。通过 color prop 控制选中态颜色。

================================================================================
  二、Props
================================================================================
  modelValue — v-model 绑定的布尔值
  color      — 选中态轨道颜色（默认 #39c5bb）
  disabled   — 是否禁用

================================================================================
  三、使用示例

    // 在 Tab 中定义主题色：
    // const tabTheme = '#55cc99'

    // <UiSwitch v-model="someBoolean" :color="tabTheme" />
    // <UiSwitch v-model="someBoolean" :color="tabTheme" disabled />

================================================================================
-->
<template>
  <label class="uis-root" :class="{ 'uis-disabled': disabled }">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span class="uis-track" :style="trackStyle"></span>
  </label>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  color:      { type: String, default: '#39c5bb' },
  disabled:   { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])

const trackStyle = computed(() => ({
  background: props.modelValue ? props.color : undefined
}))
</script>

<style scoped>
.uis-root {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
}

.uis-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.uis-root input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.uis-track {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: #ccc;
  transition: background 0.2s, transform 0.2s;
}

.uis-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.uis-root input:checked ~ .uis-track::after {
  transform: translateX(20px);
}
</style>
