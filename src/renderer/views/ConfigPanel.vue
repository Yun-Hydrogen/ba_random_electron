<!--
================================================================================
  组件：ConfigPanel.vue
  所属：配置面板窗口的根组件
  路由：/config-panel（由 main.js 通过 BrowserWindow 直接加载，不经过 vue-router）

================================================================================
  一、功能概述
================================================================================
  本组件是配置面板（从托盘右键 → 配置 打开）的编排组件，负责：

    功能              | 说明
    ──────────────────┼──────────────────────────────────────────────
    1. Tab 导航       | 5 个选项卡的胶囊滑块导航，主题色随 Tab 切换
    2. 全局状态管理   | draft（配置草稿）+ appInfo（系统信息），委托给 useConfigPanel.js
    3. 子组件编排     | TabRoster / TabFloating / TabResult / TabAdvanced / TabLogs
    4. IPC 操作       | 保存/重置配置、管理员重启、更新检查等，通过 configPanelApi 桥接
    5. 芯片 tooltip  | 全局 fixed 定位的 tooltip，由 TabRoster 的 chip-hover 事件触发
    6. 主题色跟随     | 滑块/按钮/开关等控件颜色随当前 Tab 的主题色动态变化

================================================================================
  二、数据流架构
================================================================================

  +-------------------------------------------------------------+
  |  main.js / ipc.js（主进程）                                   |
  |  - configPanelApi 提供 15 个 IPC 通道                        |
  |  - 读取/写入 config.yml                                      |
  +--------------------------+----------------------------------+
                             | IPC (contextBridge)
                             v
  +-------------------------------------------------------------+
  |  useConfigPanel.js（逻辑层）                                  |
  |  - draft（响应式配置草稿）                                    |
  |  - 所有 IPC 操作方法（openConfigFile, adminElevate 等）       |
  |  - Tab 导航状态（activeTab, sliderLeft 等）                   |
  |  - tooltip 状态                                             |
  +--------------------------+----------------------------------+
                             | 解构导出
                             v
  +-------------------------------------------------------------+
  |  ConfigPanel.vue（本组件 - 视图层）                            |
  |  - 模板：overlay + tab-bar + config-body + footer + tooltip  |
  |  - 仅负责渲染和事件绑定，不包含业务逻辑                        |
  +--------------------------+----------------------------------+
                             | props / emits
              +--------------+-------+-------+-------+----------+
              v              v       v       v       v
        TabRoster    TabFloating TabResult TabAdvanced TabLogs

================================================================================
  三、子组件 Props/Emits 约定
================================================================================

  组件         | Props                                    | Emits
  -------------|------------------------------------------|------------------------------
  TabRoster    | studentList, allowRepeatDraw             | update:studentList, update:allowRepeatDraw, chip-hover, chip-leave
  TabFloating  | fb (floatingButton 配置对象)              | update:fb
  TabResult    | pickResult (pickResultDialog 配置对象)    | update:pickResult
  TabAdvanced  | admin, appInfo, updateLoading/Status/Title/Detail | update:admin + 6 个操作事件
  TabLogs      | appInfo                                  | 无需（内部独立 SSE 管理）

================================================================================
  四、Tab 胶囊滑块导航
================================================================================
  导轨：28px 高，白色药丸形，border 颜色随 currentTab.color 动态变化
  滑块：±3px 悬浮于导轨，left 0.45s / width 0.45s cubic-bezier，固定宽度 80px

  动画序列：
    1. 滑块先移动到目标 Tab 位置（0.45s）
    2. 图标立即变白（color 0.2s 0s）
    3. 等滑块到位后，文字缓慢展开变色（max-width/opacity/color 0.5s 0.45s）

================================================================================
  五、CSS 组织
================================================================================
  本文件 CSS 为 scoped，按功能分组：
    1. 全局滚动条        — 蔚蓝主题蓝色椭圆滑块
    2. 面板外壳          — .config-overlay + .config-panel
    3. Tab 导航栏        — .tab-bar / .tab-slider / .tab-item / .tab-text
    4. 内容区            — .config-body
    5. 加载骨架          — .loading-skeleton
    6. 导入胶囊          — .import-capsule / .upload-btn / .count-badge
    7. 名单布局          — .roster-layout / .roster-textarea / .name-chip
    8. 全局 tooltip      — .chip-tooltip
    9. 通用卡片          — .card / .card-title / .card-desc
    10. 权重管理         — .roster-item / .weight-slider / .weight-val
    11. 配置行           — .cfg-row / .cfg-slider / .cfg-input
    12. Switch 开关      — .switch / .switch-track
    13. 底部按钮         — .config-footer / .capsule-btn
    14. 日志 Tab         — .log-head / .log-row / .log-msg
    15. 高级设置         — .section-title / .cfg-badge / .cfg-sm-btn

================================================================================
  六、维护注意事项
================================================================================
  - 业务逻辑全在 useConfigPanel.js 中，本文件只做渲染和事件转发
  - 新增 Tab 时：在模板中按相同模式添加子组件 + 在 useConfigPanel tabs 数组中注册
  - CSS 虽然是 scoped，但滚动条伪元素（::-webkit-scrollbar）会影响全局
  - 底部按钮（取消）的样式不跟随 Tab 主题色，但应用按钮跟随。

  最后更新：2026-06-28
================================================================================
-->
<template>
  <div class="config-overlay" :class="{ 'is-closing': isClosing }" @click.self="isClosing ? null : handleCancel()">
    <div class="config-panel" :class="{ 'panel-enter': true }">

      <!-- ====== Tab 胶囊滑块导航 ====== -->
      <div class="tab-bar" ref="tabBarRef" :style="trackBorderStyle">
        <div class="tab-slider" :style="sliderStyle"></div>
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: activeTab === tab.id }"
          :style="tabItemStyle(tab)"
          @click="switchTab(tab.id)"
        >
          <span class="tab-label">
            <span class="tab-icon-svg" v-html="tab.icon"></span>
            <span class="tab-text" :class="{ show: activeTab === tab.id }">{{ tab.label }}</span>
          </span>
        </button>
      </div>

      <!-- ====== 内容区（5 个 Tab 通过 v-show 切换，保持 DOM 状态） ====== -->
      <div class="config-body" v-if="!loading">
        <TabRoster
          v-show="activeTab === 'roster'"
          :studentList="draft.studentList"
          :allowRepeatDraw="draft.allowRepeatDraw"
          @update:studentList="draft.studentList = $event"
          @update:allowRepeatDraw="draft.allowRepeatDraw = $event"
          @chip-hover="showChipTooltip"
          @chip-leave="hideChipTooltip"
        />
        <TabFloating
          v-show="activeTab === 'floating'"
          :fb="draft.floatingButton"
          @update:fb="draft.floatingButton = $event"
        />
        <TabResult
          v-show="activeTab === 'result'"
          :pickResult="draft.pickResultDialog"
          @update:pickResult="draft.pickResultDialog = $event"
        />
        <TabAdvanced
          v-show="activeTab === 'advanced'"
          :admin="draft.admin"
          :appInfo="appInfo"
          :updateLoading="updateLoading"
          :updateStatus="updateStatus"
          :updateTitle="updateTitle"
          :updateDetail="updateDetail"
          @update:admin="draft.admin = $event"
          @open-config-file="openConfigFile"
          @open-config-dir="openConfigDir"
          @admin-elevate="adminElevate"
          @restart="appRestart"
          @create-startup-task="createStartupTask"
          @check-update="checkUpdate"
          @reset-config="resetConfig"
          @show-in-explorer="showInExplorer"
        />
        <TabLogs
          v-show="activeTab === 'logs'"
          :appInfo="appInfo"
        />
      </div>

      <!-- ====== 加载骨架（窗口打开但数据未就绪时显示） ====== -->
      <div v-else class="loading-skeleton">
        <div class="loading-spinner"></div>
        <p>正在加载配置...</p>
      </div>

      <!-- ====== 底部悬浮胶囊按钮（取消 / 应用并关闭） ====== -->
      <div class="config-footer">
        <button class="capsule-btn capsule-cancel" @click="handleCancel">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
          <span>取消</span>
        </button>
        <button class="capsule-btn capsule-apply" :style="applyBtnStyle" @click="handleApply">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M20 6L9 17l-5-5"/></svg>
          <span>应用并关闭</span>
        </button>
      </div>
    </div>

    <!-- ====== 全局 tooltip（fixed 定位，z-index: 99999，不受任何父容器裁切） ====== -->
    <div
      class="chip-tooltip"
      :class="{ show: tooltip.visible }"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      {{ tooltip.text }}
      <span class="chip-tooltip-arrow"></span>
    </div>
  </div>
</template>

<script setup>
/*
 *  ConfigPanel.vue — 纯编排组件（视图层）。
 *
 *  所有 JS 逻辑（状态管理、IPC 操作、Tab 导航）均在 useConfigPanel.js 中实现。
 *  本文件仅负责：
 *    1. 导入子组件和逻辑层
 *    2. 解构 useConfigPanel 返回的状态和方法
 *    3. 在模板中绑定 props / emits / 事件
 *
 *  如需修改业务逻辑，请编辑 src/renderer/composables/useConfigPanel.js。
 */
import TabRoster   from '../components/TabRoster.vue'
import TabFloating from '../components/TabFloating.vue'
import TabResult   from '../components/TabResult.vue'
import TabAdvanced from '../components/TabAdvanced.vue'
import TabLogs     from '../components/TabLogs.vue'
import { useConfigPanel } from '../composables/useConfigPanel.js'

const {
  /* Tab 导航 */
  tabs, activeTab, tabBarRef, sliderLeft, sliderWidth, currentTab,
  updateSlider, switchTab,

  /* 全局状态 */
  draft, appInfo,

  /* 芯片 tooltip */
  tooltip, showChipTooltip, hideChipTooltip,

  /* IPC 操作 */
  openConfigFile, openConfigDir, adminElevate, appRestart,
  createStartupTask, resetConfig, showInExplorer,

  /* 更新检查 */
  updateLoading, updateStatus, updateTitle, updateDetail, checkUpdate,

  /* 关闭与动画 */
  isClosing, closeWithAnimation, handleCancel, handleApply,
  loading,

  /* 主题色跟随样式 */
  panelBorderStyle, applyBtnStyle, sliderStyle, trackBorderStyle, tabItemStyle
} = useConfigPanel()
</script>

<style scoped>
/*
 *  本文件 CSS 为 scoped（Vue 自动添加 data-v-xxx 属性隔离），
 *  但 ::-webkit-scrollbar 等伪元素不受 scoped 影响（浏览器全局生效）。
 *  按功能分为 15 个分组，每组以分隔注释标识。
 */

/* =================================================================
   1. 全局滚动条 —— 蔚蓝档案主题蓝色椭圆滑块
   注意：::-webkit 伪元素不受 Vue scoped 限制，会影响整个窗口
   ================================================================= */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(102, 204, 255, 0.35);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 204, 255, 0.55);
}
::-webkit-scrollbar-button {
  display: none;
}
::-webkit-scrollbar-corner {
  background: transparent;
}

/* =================================================================
   2. 面板外壳
   ================================================================= */

/*
 *  全屏半透明遮罩层。
 *  @click.self：点击遮罩空白处 → handleCancel()（等于点击取消按钮）
 */
.config-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif;
}

/*
 *  配置面板本体（白色圆角卡片）。
 *  border-color 由 panelBorderStyle 跟随当前 Tab 主题色动态变化。
 */
.config-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1.5px solid #000000;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.3s;
}

/* =================================================================
   3. Tab 胶囊滑块导航
   ================================================================= */

/*
 *  导轨：白色药丸形，28px 高。
 *  border-color 由 trackBorderStyle 跟随当前 Tab 主题色。
 */
.tab-bar {
  position: relative;
  display: flex;
  align-items: center;
  margin: 20px auto 20px;
  padding: 0 6px;
  gap: 0;
  width: min(480px, calc(100% - 40px));
  box-sizing: border-box;
  height: 28px;
  border-radius: 999px;
  background: #ffffff;
  border: 1.5px solid #000000;
  transition: border-color 0.3s;
}

/*
 *  滑块：比导轨略大（±3px），微悬浮效果。
 *  left/width 由 JS 动态计算，0.45s cubic-bezier 平滑过渡。
 */
.tab-slider {
  position: absolute;
  top: -3px;
  bottom: -3px;
  border-radius: 999px;
  transition:
    left 0.45s cubic-bezier(0.25, 0, 0.25, 1),
    width 0.45s cubic-bezier(0.25, 0, 0.25, 1),
    background 0.35s;
  z-index: 1;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

/*
 *  Tab 按钮：覆盖在滑块上方（z-index: 2）。
 *  color 由 JS 动态设置（未选中=主题色, 选中=白色）。
 */
.tab-item {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  white-space: nowrap;
  border: none;
  background: transparent;
  cursor: pointer;
  position: relative;
  z-index: 2;
  font-family: 'Bahnschrift', 'Segoe UI Variable', 'Microsoft YaHei UI', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: inherit;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.2s 0s;
}

/* 图标 + 文字的水平排列 */
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: inherit;
}

/*
 *  未选中状态：文字隐藏（max-width: 0 + overflow: hidden）。
 *  选中状态（.show）：文字展开（max-width: 64px），延迟 0.45s 等滑块到位。
 */
.tab-text {
  display: inline-block;
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  color: inherit;
  transition:
    max-width 0.15s ease 0s,
    opacity 0.15s ease 0s,
    color 0.15s 0s;
}

.tab-text.show {
  max-width: 64px;
  opacity: 1;
  transition:
    max-width 0.5s ease 0.45s,
    opacity 0.5s ease 0.45s,
    color 0.5s 0.45s;
}

/* SVG 图标尺寸和线条样式 */
.tab-icon-svg :deep(svg) {
  display: block;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* =================================================================
   4. 内容区
   ================================================================= */
.config-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px 16px 32px;
}

/* =================================================================
   5. 加载骨架
   ================================================================= */
.loading-skeleton {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #99a;
  font-size: 13px;
}

/* 旋转动画的圆形 spinner */
.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e8ecf2;
  border-top-color: #66ccff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* =================================================================
   6. 导入胶囊（名单导入的横向胶囊控件）
   ================================================================= */
.import-capsule {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: 999px;
  border: 1.5px solid #898989;
  background: #fff;
}

.import-hint {
  flex: 1;
  font-size: 12px;
  color: #888;
  line-height: 1.4;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 11px 5px;
  border-radius: 999px;
  background: #66ccff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.upload-btn:hover {
  filter: brightness(1.06);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  padding: 7px 8px 5px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
  background: #66ccff;
  border-radius: 999px;
}

/* =================================================================
   7. 名单左右布局（textarea + 芯片预览）
   ================================================================= */
.roster-layout {
  display: flex;
  gap: 13px;
  align-items: flex-start;
}

.roster-left {
  flex: 0 0 34%;
  display: flex;
  flex-direction: column;
}

.roster-right {
  overflow-y: auto;
  height: 220px;
  width: 280px;
  padding: 2px;
  border: 1.5px solid #c8d4e0;
  border-radius: 10px;
  background: #fdfcf8;
}

/* 右侧空状态提示 */
.chip-empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 140px;
  color: #aab4c0;
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
  user-select: none;
}

/*
 *  稿纸风格 textarea。
 *  白色带淡黄底色 + 内阴影，2 倍行距模拟稿纸横线。
 */
.roster-textarea {
  width: 100%;
  height: 220px;
  resize: none;
  border: 1.5px solid #c8d4e0;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif;
  line-height: 2;
  letter-spacing: 0.5px;
  outline: none;
  background-color: #fdfcf8;
  color: #334;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.04);
  white-space: nowrap;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.roster-textarea:hover {
  border-color: #a0b8cc;
}

.roster-textarea:focus {
  border-color: #66ccff;
  box-shadow:
    0 0 0 3px rgba(102, 204, 255, 0.12),
    inset 0 1px 3px rgba(0, 0, 0, 0.04);
  background-color: #fffef9;
}

/* =================================================================
   8. 名单标签芯片
   ================================================================= */
.name-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.name-chip {
  text-align: center;
  padding: 5px 8px;
  border-radius: 999px;
  background: #66ccff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition:
    transform 0.15s,
    filter 0.15s;
}

.name-chip:hover {
  filter: brightness(1.1);
}

.name-chip:active {
  transform: scale(0.96);
  filter: brightness(0.85);
}

/* =================================================================
   9. 全局 tooltip
   ================================================================= */

/*
 *  fixed 定位，z-index: 99999，不受任何父容器裁切。
 *  默认透明（opacity: 0），.show 时淡入。
 *  箭头（.chip-tooltip-arrow）指向触发元素。
 */
.chip-tooltip {
  position: fixed;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(30, 36, 48, 0.9);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translateY(3px);
  z-index: 99999;
  transition:
    opacity 0.18s,
    transform 0.18s;
}

.chip-tooltip.show {
  opacity: 1;
  transform: translateY(0);
}

.chip-tooltip-arrow {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom-color: rgba(30, 36, 48, 0.9);
}

/* =================================================================
   10. 通用卡片
   ================================================================= */
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

/* =================================================================
   11. 权重管理
   ================================================================= */
.inline-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #667;
  margin: 0;
}

.weight-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0px 3px;
  padding: 0px 0px 10px;
  border-bottom: 1.5px solid #eee;
}

/* 空白名单占位图 */
.empty-tip {
  color: #ccc;
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}

.empty-arona-img {
  width: 30%;
  opacity: 0.8;
  display: block;
  margin: 0 auto 8px;
}

/* 权重列表容器（固定高度 + 滚动） */
.student-table-wrap {
  max-height: 240px;
  overflow-y: auto;
}

.roster-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 斑马条纹：偶数行浅蓝灰背景 */
.roster-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #f7f9fb;
  transition: background 0.3s;
}

.roster-item:nth-child(even) {
  background: #eef2f7;
}

.roster-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #334;
}

.roster-weight {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 删除按钮（红色 X） */
.roster-del {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: #fee;
  color: #e55;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.roster-del:hover {
  background: #fcc;
  color: #d33;
}

/* 重置权重按钮 */
.roster-reset {
  padding: 4px 12px;
  border: 1px solid #dde;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  font-size: 11px;
  color: #88a;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.2s;
}

.roster-reset:hover {
  border-color: #aab;
  color: #667;
}

/* 权重滑条（窄条 + 圆滑块） */
.weight-slider {
  width: 70px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 2px;
  background: #e0e5ea;
  outline: none;
  cursor: pointer;
  vertical-align: middle;
}

.weight-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #66ccff;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

/* 权重数值（右对齐） */
.weight-val {
  display: inline-block;
  width: 28px;
  text-align: right;
  font-size: 11px;
  font-weight: 600;
  color: #88a;
}

/* 概率百分比（蓝色） */
.weight-prob {
  display: inline-block;
  min-width: 48px;
  text-align: right;
  font-size: 11px;
  font-weight: 500;
  color: #66ccff;
}

/* =================================================================
   12. 通用配置行（标签 + 控件横向排列）
   ================================================================= */
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

.cfg-slider {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 全局 range 滑条样式（WebKit + Firefox） */
.cfg-row input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 6px;
  border-radius: 3px;
  background: #e0e5ea;
  outline: none;
  cursor: pointer;
}

.cfg-row input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #66ccff;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: background 0.3s;
}

.cfg-row input[type=range]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #66ccff;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}

.cfg-slider span {
  font-size: 13px;
  color: #888;
  min-width: 36px;
}

.cfg-input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
}

.cfg-color {
  width: 40px;
  height: 28px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
}

/* =================================================================
   13. Switch 开关
   ================================================================= */

/*
 *  CSS 纯手工 Switch。
 *  隐藏原生 checkbox，用 .switch-track + ::after 伪元素绘制轨道和滑块。
 *  选中态背景由 JS 动态覆盖（跟随 Tab 主题色）。
 */
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
  background: #66ccff;
}

.switch input:checked + .switch-track::after {
  transform: translateX(20px);
}

/* =================================================================
   14. 底部按钮（取消 / 应用并关闭）
   ================================================================= */
.config-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 8px 16px 12px;
}

.capsule-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  border: none;
  border-radius: 999px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition:
    filter 0.2s,
    transform 0.15s;
}

.capsule-btn:hover {
  filter: brightness(1.1);
}

.capsule-btn:active {
  transform: translateY(0);
}

/* 取消 = 红色，应用 = 蓝色（可由 JS 覆盖为主题色） */
.capsule-cancel {
  background: #ff8c8c;
}

.capsule-apply {
  background: #66ccff;
}

/* =================================================================
   15. 日志 Tab（TabLogs 子组件样式覆盖，因 scoped 需要在此定义）
   ================================================================= */
.log-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.log-head-title {
  font-size: 14px;
  font-weight: 600;
  color: #444;
}

.log-head-spacer {
  flex: 1;
}

.log-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: #66ccff;
  line-height: 1.4;
}

.log-badge-ver {
  background: #c0c8d0;
}

.log-clear-btn {
  padding: 3px 12px;
  border: 1px solid #d0d6dc;
  border-radius: 999px;
  background: #fff;
  font-size: 11px;
  color: #888;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.log-clear-btn:hover {
  border-color: #aaa;
  color: #555;
}

.log-list {
  overflow-y: auto;
  font-size: 12px;
  font-family: 'SF Mono', 'Consolas', 'Courier New', monospace;
}

.log-empty {
  color: #ccc;
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

.log-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 2px 0;
  border-bottom: 1px solid #fafbfc;
}

.log-time {
  color: #b0b8c0;
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 11px;
}

/* 日志级别圆点 */
.log-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}

.dot-info {
  background: #99ccdd;
}

.dot-warn {
  background: #e8a840;
}

.dot-error {
  background: #e05555;
}

.dot-success {
  background: #55b888;
}

.log-msg {
  word-break: break-all;
  color: #556;
  line-height: 1.5;
}

.log-warn .log-msg {
  color: #a07030;
}

.log-error .log-msg {
  color: #c04040;
}

.log-success .log-msg {
  color: #3a8050;
}

/* =================================================================
   16. 高级设置（TabAdvanced 子组件样式覆盖）
   ================================================================= */
.section-title {
  font-size: 13px;
  font-weight: 700;
  color: #556;
  margin: 16px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e8ecf0;
}

.cfg-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #fff;
  background: #66ccff;
  margin-left: 4px;
}

.cfg-badge-ver {
  background: #aaa;
}

.cfg-btn-group {
  display: flex;
  gap: 6px;
}

.cfg-sm-btn {
  padding: 5px 14px;
  border: 1px solid #d0d6dc;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  color: #556;
  transition: all 0.2s;
}

.cfg-sm-btn:hover {
  border-color: #aab;
  background: #f5f7fa;
  color: #334;
}

.cfg-sm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cfg-input-wide {
  flex: 1;
}
</style>
