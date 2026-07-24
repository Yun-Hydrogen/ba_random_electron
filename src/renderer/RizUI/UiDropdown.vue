<!--
================================================================================
  组件：UiDropdown.vue
  所属：RizUI（src/renderer/RizUI）
  类型：下拉选择控件

================================================================================
  一、功能
================================================================================
  自定义下拉选择器，替代原生 <select>。支持 v-model 绑定、主题色、点击外部关闭。

================================================================================
  二、Props
================================================================================
  modelValue — v-model 绑定的选中值
  options    — 选项数组 [{ value, label }]
  color      — 主题色（选中项高亮，默认 #39c5bb）

================================================================================
  三、使用示例

    const backend = ref('d3d9')
    const opts = [{ value: 'd3d9', label: 'D3D9' }, { value: 'vulkan', label: 'Vulkan' }]

    <UiDropdown v-model="backend" :options="opts" :color="tabTheme" />
================================================================================
-->
<template>
  <div ref="rootRef" class="udd-root" :class="{ 'udd-open': isOpen }">
    <button class="udd-trigger" @click="toggle" type="button">
      <span>{{ selectedLabel }}</span>
      <svg class="udd-arrow" viewBox="0 0 12 7" width="10" height="6">
        <path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>
    </button>
    <Transition name="udd-pop">
      <div v-if="isOpen" class="udd-drop">
        <button
          v-for="opt in options"
          :key="opt.value"
          class="udd-opt"
          :class="{ 'udd-active': opt.value === modelValue }"
          :style="opt.value === modelValue ? activeStyle : {}"
          @click="select(opt.value)"
          type="button"
        >{{ opt.label }}</button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options:    { type: Array, default: () => [] },
  color:      { type: String, default: '#39c5bb' }
})

const emit = defineEmits(['update:modelValue'])

const rootRef = ref(null)
const isOpen = ref(false)

const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.value === props.modelValue)
  return opt ? opt.label : String(props.modelValue || '')
})

const activeStyle = computed(() => ({
  color: props.color,
  background: props.color + '14'
}))

function toggle() { isOpen.value = !isOpen.value }
function select(value) {
  emit('update:modelValue', value)
  isOpen.value = false
}

/* ---- 点击外部关闭 ---- */
function onClickOutside(e) {
  if (rootRef.value && !rootRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside, true)
  document.addEventListener('touchstart', onClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside, true)
  document.removeEventListener('touchstart', onClickOutside, true)
})
</script>

<style scoped>
.udd-root {
  position: relative;
  display: inline-block;
  user-select: none;
}

/* ---- 触发器 ---- */
.udd-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border: 1.5px solid #d0d8e0;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  font-family: inherit;
  color: #445;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  white-space: nowrap;
}

.udd-trigger:hover {
  border-color: #aab4c0;
}

.udd-open .udd-trigger {
  border-color: v-bind('props.color');
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
}

.udd-arrow {
  flex-shrink: 0;
  transition: transform 0.2s;
  color: #99a;
}

.udd-open .udd-arrow {
  transform: rotate(180deg);
}

/* ---- 下拉面板 ---- */
.udd-drop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 100%;
  background: #fff;
  border: 1px solid #e8ecf2;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  padding: 4px;
  z-index: 100;
}

.udd-opt {
  display: block;
  width: 100%;
  padding: 7px 14px;
  border: none;
  border-radius: 7px;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  color: #445;
  cursor: pointer;
  text-align: left;
  outline: none;
  transition: background 0.12s;
  white-space: nowrap;
}

.udd-opt:hover {
  background: #f5f5f8;
}

.udd-active {
  font-weight: 600;
}

/* ---- 动画 ---- */
.udd-pop-enter-active,
.udd-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.udd-pop-enter-from,
.udd-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
