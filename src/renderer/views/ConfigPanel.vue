<!--
# ConfigPanel.vue + 子组件 维护说明

## 文件架构
```
src/renderer/
├── views/ConfigPanel.vue          ← 编排组件（~300 行）
├── styles/config-shared.css       ← 非 scoped 全局共享样式
└── components/
    ├── TabRoster.vue              ← 名单导入 + 权重管理
    ├── TabFloating.vue            ← 悬浮按钮配置
    ├── TabResult.vue              ← 结果显示配置
    ├── TabAdvanced.vue            ← 高级设置
    └── TabLogs.vue                ← 日志输出（独立 SSE 流）
```

## ConfigPanel.vue（编排组件）
- 作用：Tab 导航 + 全局状态（draft/appInfo）+ tooltip + IPC 操作 + 主题色跟随
- 技术：Vue 3 `<script setup>`，各 Tab 通过 props/emits 与子组件通信
- 样式：scoped 部分仅外壳（overlay/tab-bar/footer/tooltip），共享样式由 config-shared.css 提供

### 代码结构（<script setup> 顺序）
1.  Imports（Vue + 5 个子组件）
2.  Tab 定义（tabs 数组，含 SVG 图标和主题色）
3.  Tab 导航 & 滑块（activeTab, updateSlider, switchTab, currentTab）
4.  全局状态 — draft（配置草稿）+ appInfo（应用信息）
5.  芯片 tooltip（全局 fixed 定位，z-index:99999）
6.  Tab 4 高级设置 IPC 操作（fetchAppInfo, openConfigFile, adminElevate 等）
7.  关闭 & 应用（handleCancel, handleApply, closeWithAnimation）
8.  生命周期（onMounted：加载配置 + 初始化滑块）
9.  主题色跟随（panelBorderStyle, applyBtnStyle, sliderStyle 等）

## 子组件 Props/Emits 约定

| 组件 | Props | Emits |
|------|-------|-------|
| TabRoster | studentList, allowRepeatDraw | update:studentList, update:allowRepeatDraw, chip-hover, chip-leave |
| TabFloating | fb | update:fb |
| TabResult | pickResult | update:pickResult |
| TabAdvanced | webConfig, appInfo, updateLoading/Status/Title/Detail | update:webConfig + 6 个操作事件 |
| TabLogs | appInfo | 无需（内部独立 SSE 管理） |

## Tab 胶囊滑块导航
- 导轨：28px 高，白色药丸形 + 2px 主题色边框 ← `borderColor` 随 currentTab.color
- 滑块：±3px 悬浮于导轨，`left` 0.45s / `width` 0.45s cubic-bezier(0.25,0,0.25,1)
- 滑块宽度固定 80px
- **动画序列**：滑块先移动 + 图标立即变白 → 等滑块到位后文字缓慢展开变色
  - `.tab-item` color 0.2s 0s（图标跟随滑块）
  - `.tab-text.show` max-width/opacity/color 0.5s 0.45s（文字延迟展开）

## 共享样式（config-shared.css，非 scoped）
- `.card` / `.card-title` / `.card-desc`
- `.cfg-row` / `.cfg-slider` / `.cfg-input` / `.cfg-color` / `.cfg-input-wide`
- `.cfg-btn-group` / `.cfg-sm-btn` / `.cfg-hint`
- `.switch` / `.switch-track`
- `.log-*` 日志系列
- `.tab-page` 滑入动画
- 全局滑条 `input[type=range]` 样式

## TabRoster（名单管理）特有样式
- `.import-capsule` / `.upload-btn` / `.count-badge`
- `.roster-layout` / `.roster-left` / `.roster-right`
- `.roster-textarea`（稿纸风格）
- `.name-chip-grid` / `.name-chip`（自适应宽度 + hover/active）
- `.roster-item`（斑马条纹）/ `.weight-slider` / `.weight-prob`（蓝色概率%）

## 芯片 tooltip 机制
- 全局 `<div class="chip-tooltip">` 放在 ConfigPanel 模板最外层
- `position: fixed` + `z-index: 99999`，不受任何父容器裁切
- TabRoster 通过 `@chip-hover` / `@chip-leave` 事件通知父组件
- 父组件的 `showChipTooltip(e, student)` 计算位置并显示

## IPC / API 依赖
- `configPanelApi.getConfig()` → 获取完整配置
- `configPanelApi.saveConfig(config)` → 保存配置
- `configPanelApi.close(saved)` → 关闭面板
- `configPanelApi.getAppInfo()` / `openConfigFile()` / `openConfigDir()`
- `configPanelApi.adminElevate()` / `restart()` / `createStartupTask()` / `checkUpdate()`
-->

<template>
  <div class="config-overlay" :class="{ 'is-closing': isClosing }" @click.self="isClosing ? null : handleCancel()">
    <div class="config-panel" :class="{ 'panel-enter': true }">
      <!-- Tab 悬浮胶囊滑块导航 -->
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

      <!-- 内容区 -->
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
          :webConfig="draft.webConfig"
          :appInfo="appInfo"
          :updateLoading="updateLoading"
          :updateStatus="updateStatus"
          :updateTitle="updateTitle"
          :updateDetail="updateDetail"
          @update:webConfig="draft.webConfig = $event"
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

      <!-- 加载骨架：窗口打开但数据未就绪时显示 -->
      <div v-else class="loading-skeleton">
        <div class="loading-spinner"></div>
        <p>正在加载配置…</p>
      </div>

      <!-- 底部悬浮胶囊按钮 -->
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

    <!-- 全局 tooltip（最高图层） -->
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
// ============================================================
//  ConfigPanel.vue — 编排组件，JS 逻辑全部在 useConfigPanel 中
// ============================================================
import TabRoster   from '../components/TabRoster.vue'
import TabFloating from '../components/TabFloating.vue'
import TabResult   from '../components/TabResult.vue'
import TabAdvanced from '../components/TabAdvanced.vue'
import TabLogs     from '../components/TabLogs.vue'
import { useConfigPanel } from '../composables/useConfigPanel.js'

const {
  tabs, activeTab, tabBarRef, sliderLeft, sliderWidth, currentTab,
  updateSlider, switchTab,
  draft, appInfo,
  tooltip, showChipTooltip, hideChipTooltip,
  openConfigFile, openConfigDir, adminElevate, appRestart, createStartupTask, resetConfig, showInExplorer,
  updateLoading, updateStatus, updateTitle, updateDetail, checkUpdate,
  isClosing, closeWithAnimation, handleCancel, handleApply,
  loading,
  panelBorderStyle, applyBtnStyle, sliderStyle, trackBorderStyle, tabItemStyle
} = useConfigPanel()
</script>

<style scoped>
/* ---- 全局滚动条：蔚蓝档案主题蓝色椭圆滑块 ---- */
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

.config-overlay {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif;
}

.config-panel {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  border-radius: 12px;
  border: 1.5px solid #000000;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.3s;
}

/* Tab 悬浮胶囊滑块导航 */
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

/* 滑块：略高于导轨，微悬浮效果 */
.tab-slider {
  position: absolute;
  top: -3px;
  bottom: -3px;
  border-radius: 999px;
  transition: left 0.45s cubic-bezier(0.25, 0, 0.25, 1),
              width 0.45s cubic-bezier(0.25, 0, 0.25, 1),
              background 0.35s;
  z-index: 1;
  box-shadow: 0 2px 10px rgba(0,0,0,0.12);
}

/* Tab 文字：覆盖在滑块上方 */
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
  font-family: inherit;
  font-family: 'Bahnschrift', 'Segoe UI Variable', 'Microsoft YaHei UI', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  transition: color 0.2s 0s;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  color: inherit;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: inherit;
}

/* 未选中：文字隐藏 + 颜色跟随图标 */
.tab-text {
  display: inline-block;
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  color: inherit;
  transition: max-width 0.15s ease 0s, opacity 0.15s ease 0s, color 0.15s 0s;
}
/* 选中：滑块到位后文字缓慢展开 */
.tab-text.show {
  max-width: 64px;
  opacity: 1;
  transition: max-width 0.5s ease 0.45s, opacity 0.5s ease 0.45s, color 0.5s 0.45s;
}

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

/* 内容区 */
.config-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px 16px 32px;
}

/* ---- 加载骨架 ---- */
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
.loading-spinner {
  width: 28px; height: 28px;
  border: 3px solid #e8ecf2;
  border-top-color: #66ccff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

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
  padding: 7px 8px 5px;
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
  background: #66CCFF;
  border-radius: 999px;
  font-weight: 600;
  align-items: center;
  display: inline-flex;
}

/* ---- 名单左右布局 ---- */
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

/* ----  textarea ---- */
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
  transition: border-color 0.2s, box-shadow 0.2s;
  background-color: #fdfcf8;
  color: #334;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.04);
  white-space: nowrap;
}
.roster-textarea:hover {
  border-color: #a0b8cc;
}
.roster-textarea:focus {
  border-color: #66ccff;
  box-shadow: 0 0 0 3px rgba(102, 204, 255, 0.12), inset 0 1px 3px rgba(0,0,0,0.04);
  background-color: #fffef9;
}

/* ---- 名单标签芯片 ---- */
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
  transition: transform 0.15s, filter 0.15s;
  user-select: none;
  white-space: nowrap;
}
.name-chip:hover {
  filter: brightness(1.1);
}
.name-chip:active {
  transform: scale(0.96);
  filter: brightness(0.85);
}

/* 全局 tooltip（fixed 定位，不受父容器裁切） */
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
  transition: opacity 0.18s, transform 0.18s;
  z-index: 99999;
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

/* ---- 通用卡片 ---- */
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
  padding:0px 0px 10px;
  border-bottom: 1.5px solid #eee;
}

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

.student-table-wrap {
  max-height: 240px;
  overflow-y: auto;
}

.roster-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

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
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}

.weight-val {
  display: inline-block;
  width: 28px;
  text-align: right;
  font-size: 11px;
  font-weight: 600;
  color: #88a;
}

.weight-prob {
  display: inline-block;
  min-width: 48px;
  text-align: right;
  font-size: 11px;
  font-weight: 500;
  color: #66ccff;
}

/* 配置行 */
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
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  cursor: pointer;
  transition: background 0.3s;
}
.cfg-row input[type=range]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #66ccff;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
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

/* Switch — 主题色跟随 */
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

/* 底部按钮 */
/* 底部悬浮胶囊按钮 */
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
  transition: filter 0.2s, transform 0.15s;
  white-space: nowrap;
}
.capsule-btn:hover { filter: brightness(1.1)}
.capsule-btn:active { transform: translateY(0); }

.capsule-cancel { background: #ff8c8c; }
.capsule-apply { background: #66ccff; }

/* ---- 日志 Tab ---- */
.log-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.log-head-title { font-size: 14px; font-weight: 600; color: #444; }
.log-head-spacer { flex: 1; }

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

.log-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.dot-info  { background: #99ccdd; }
.dot-warn  { background: #e8a840; }
.dot-error { background: #e05555; }
.dot-success { background: #55b888; }

.log-msg {
  word-break: break-all;
  color: #556;
  line-height: 1.5;
}
.log-warn .log-msg  { color: #a07030; }
.log-error .log-msg { color: #c04040; }
.log-success .log-msg { color: #3a8050; }

/* ---- 高级设置 ---- */
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
.cfg-badge-ver { background: #aaa; }
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
  max-width: 260px;
  padding: 5px 10px;
  border: 1px solid #d0d6dc;
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}
.cfg-input-wide:focus {
  border-color: #66ccff;
}
.cfg-hint {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
.cfg-hint.warn { color: #e80; }
.cfg-hint.update { color: #4a8; }
.cfg-hint.ok { color: #888; }
.cfg-hint.error { color: #d44; }
.update-detail-text {
  font-size: 12px;
  color: #888;
  white-space: pre-wrap;
  margin-top: 4px;
}
.font-credit {
  font-size: 12px;
  color: #99a;
}
.font-credit a { color: #99aabb; }
</style>

<!-- 非 scoped 全局样式（滚动条） -->
<style>
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(102, 204, 255, 0.35); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(102, 204, 255, 0.55); }
::-webkit-scrollbar-button { display: none; }
::-webkit-scrollbar-corner { background: transparent; }
</style>
