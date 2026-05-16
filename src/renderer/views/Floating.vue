<!--
# Floating.vue 维护说明

本文总结 [src/renderer/views/Floating.vue](src/renderer/views/Floating.vue) 的结构与方法，便于后续 AI 维护。

## 模块概览
- 作用：悬浮按钮窗口的入口页，仅负责读取配置并渲染 `FloatingButton`。
- 技术：Vue 3 `<script setup>`，通过 `window.floatingButtonApi` 获取配置。

## 页面结构（Template）
- 单组件渲染：`<FloatingButton />`
  - `size-px`：按钮像素尺寸。
  - `transparency-percent`：透明度百分比。
  - `@click`：触发抽取逻辑。

## 关键状态（Refs）
- `sizePx`：按钮尺寸（像素，基于 50px 乘以百分比）。
- `transparencyPercent`：透明度百分比（0-100）。

## 主要方法与职责
- `initConfig()`：
  - 读取 `floatingButtonApi.getConfig()`。
  - 将 `sizePercent` 转为像素大小。
  - 设置 `transparencyPercent`。
- `handleFloatingButtonClick()`：
  - 调用 `floatingButtonApi.onClick()` 通知主进程打开人数选择。

## 生命周期
- `onMounted()`：加载配置。

## IPC / API 依赖
来自 `window.floatingButtonApi`：
- `getConfig()`：读取悬浮按钮配置。
- `onClick()`：通知主进程触发抽取流程。

## 维护注意事项
- 若修改按钮尺寸算法，需要同步更新主进程与配置说明。
- 本组件无样式，仅作为配置与事件桥接层。
-->
<template>
  <FloatingButton
    :size-px="sizePx"
    :transparency-percent="transparencyPercent"
    @click="handleFloatingButtonClick"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import FloatingButton from '../components/FloatingButton.vue'

const sizePx = ref(50)
const transparencyPercent = ref(20)

async function initConfig() {
  if (!window.floatingButtonApi) return
  const cfg = await window.floatingButtonApi.getConfig()
  sizePx.value = Math.round(50 * (cfg.sizePercent / 100))
  transparencyPercent.value = cfg.transparencyPercent
}

function handleFloatingButtonClick() {
  if (window.floatingButtonApi) {
    window.floatingButtonApi.onClick()
  }
}

onMounted(() => {
  initConfig()
})
</script>
