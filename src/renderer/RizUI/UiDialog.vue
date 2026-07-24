<!--
================================================================================
  组件：UiDialog.vue
  所属：RizUI（src/renderer/RizUI）
  类型：通用对话框组件

================================================================================
  一、功能
================================================================================
  居中弹出对话框，遮罩层点击关闭，支持 Teleport 指定挂载容器。
  内容区由 default slot 自定义，底部按钮区由 footer slot 自定义。

================================================================================
  二、Props
================================================================================
  show     — v-model:show 控制显隐
  title    — 标题文字
  color    — 主题色（关闭按钮 hover、确认按钮等，默认 #39c5bb）
  teleport — 挂载目标选择器，默认 "body"。设为 ".config-left" 则仅覆盖左面板
  width    — 对话框宽度（默认 "auto"，不设则内容自适应）

================================================================================
  三、Slots
================================================================================
  default  — 对话框主体内容
  footer   — 底部按钮区（可选，不传则不显示底部区域）

================================================================================
  四、Events
================================================================================
  update:show — v-model:show 双向绑定

================================================================================
  五、使用示例

    const showDialog = ref(false)

    <UiDialog v-model:show="showDialog" title="确认重置" color="#aa88dd" teleport=".config-left">
      <p>此操作不可撤销。</p>
      <template #footer>
        <button @click="showDialog = false">取消</button>
        <button @click="doReset">确认</button>
      </template>
    </UiDialog>
================================================================================
-->
<template>
  <Teleport :to="teleport">
    <Transition name="uid-pop">
      <div v-if="show" class="uid-overlay" :class="{ 'uid-anchored': isAnchored }" @click.self="$emit('update:show', false)">
        <div class="uid-box" :style="boxStyle">
          <!-- 标题栏 -->
          <div class="uid-header">
            <span class="uid-title">{{ title }}</span>
            <button class="uid-close" @click="$emit('update:show', false)">✕</button>
          </div>

          <!-- 内容区 -->
          <div class="uid-body">
            <slot />
          </div>

          <!-- 底部按钮区 -->
          <div v-if="$slots.footer" class="uid-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  show:     { type: Boolean, default: false },
  title:    { type: String, default: '' },
  color:    { type: String, default: '#39c5bb' },
  teleport: { type: String, default: 'body' },
  width:    { type: String, default: 'auto' }
})

defineEmits(['update:show'])

const isAnchored = computed(() => props.teleport !== 'body')

const boxStyle = computed(() => ({
  width: props.width,
  '--uid-color': props.color
}))
</script>

<style scoped>
/* ---- 遮罩 ---- */
.uid-overlay {
  position: fixed;
  inset: 0;
  z-index: 9990;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.uid-anchored {
  position: absolute;
}

/* ---- 动画 ---- */
.uid-pop-enter-active,
.uid-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.uid-pop-enter-from,
.uid-pop-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

/* ---- 对话框 ---- */
.uid-box {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  min-width: 280px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---- 标题栏 ---- */
.uid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
}

.uid-title {
  font-size: 15px;
  font-weight: 700;
  color: #334;
}

.uid-close {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: #f0f2f5;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.uid-close:hover {
  background: #e55;
  color: #fff;
}

/* ---- 内容区 ---- */
.uid-body {
  padding: 0 20px 8px;
  font-size: 13px;
  color: #667;
  line-height: 1.6;
  overflow-y: auto;
}

/* ---- 底部 ---- */
.uid-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px 16px;
}
</style>
