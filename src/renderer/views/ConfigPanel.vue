<!--
# ConfigPanel.vue 维护说明

本文总结 [src/renderer/views/ConfigPanel.vue] 的结构与方法，便于后续 AI 维护。

## 模块概览
- 作用：新配置面板，替代旧 Web 配置页。窗口 800×680，面板填满窗口。
- 技术：Vue 3 `<script setup>`，通过 `window.configPanelApi` 与主进程 IPC 通信。

## 设置窗口
- 窗口 800×680 固定（`resizable: false`），面板 `width/height: 100%` 填满，无圆角边框（`border-radius: 0; border: none`）。
- 入场/退场动画（CSS）：`panel-fly-in` 0.3s `scale(0.92)→1` + 淡入 / `panel-fly-out` 0.2s `scale→0.95` + 淡出。

## Tab 胶囊滑块导航（等宽不贴边）
- 导轨：28px 高，白色药丸形 + 2px 主题色边框，`width: fit-content` 居中，`gap: 4px`。
- 滑块：主题色胶囊，±3px 悬浮，`left` 0.28s / `width` 0.12s 过渡。
- **未选中 Tab**：仅图标显示，文字 `max-width: 0; opacity: 0; overflow: hidden` 平滑收起（0.25s transition）。
- **选中 Tab**：文字展开，`max-width: 80px; opacity: 1`。
- 滑块宽度通过 `updateSlider()` 测量 `.tab-label` 实际文字宽度 + 20px padding。

## Tabs（5个，各有 SVG 图标和主题色）
1. 花名册（#66ccff，列表）- 导入 + 权重管理
2. 悬浮按钮（#44aadd，靶心）- 大小/置顶/位置/默认人数
3. 结果显示（#55cc99，星形）- 透明度/背景色/边框色/音效
4. 高级设置（#aa88dd，齿轮）- 暂无
5. 日志输出（#99aabb，文档）- 暂无

## 底部按钮
- 靠右两个悬浮胶囊：取消（红色 ✕ SVG + "取消"）/ 应用（主题色 ✓ SVG + "应用并关闭"）。

## IPC / API 依赖
- `configPanelApi.getConfig()` → 获取完整配置
- `configPanelApi.saveConfig(config)` → 保存配置
- `configPanelApi.close()` → 关闭面板
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
      <div class="config-body">
        <!-- Tab 1: 花名册 -->
        <div v-show="activeTab === 'roster'" class="tab-page">
          <div class="roster-section">
            <p class="section-desc">输入名单（每行一个），或导入 CSV/TXT 文件</p>
            <div class="roster-actions">
              <label class="upload-btn">
                📂 导入文件
                <input type="file" accept=".txt,.csv" @change="handleFileUpload" style="display:none" />
              </label>
              <span class="count-badge">当前 {{ draft.studentList.length }} 人</span>
            </div>
            <textarea
              v-model="rawListText"
              class="roster-textarea"
              placeholder="每行一个姓名&#10;例如：&#10;早濑优香&#10;小鸟游星野&#10;空崎日奈"
              @input="syncTextToList"
            ></textarea>
          </div>
          <div class="roster-section">
            <p class="section-desc">管理名单与抽取权重（权重越高概率越大）</p>
            <label class="inline-check">
              <input type="checkbox" v-model="draft.allowRepeatDraw" />
              允许同一轮多人抽取中重复抽到同一人
            </label>
            <div v-if="draft.studentList.length === 0" class="empty-tip">
              <img src="/image/Arona_Empty.png" alt="Arona Empty" class="empty-arona-img" />
              <p>暂无名单，请先导入</p>
            </div>
            <div v-else class="student-table-wrap">
              <table class="student-table">
                <thead><tr><th>姓名</th><th>权重</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="(s, i) in draft.studentList" :key="i">
                    <td>{{ s.name }}</td>
                    <td>
                      <input type="range" min="0" max="5" step="0.1" v-model.number="s.weight" class="weight-slider" />
                      <span class="weight-val">{{ s.weight.toFixed(1) }}</span>
                    </td>
                    <td><button class="del-btn" @click="removeStudent(i)">✕</button></td>
                  </tr>
                </tbody>
              </table>
              <button class="reset-btn" @click="resetWeights">重置全部权重为 1.0</button>
            </div>
          </div>
        </div>

        <!-- Tab 2: 悬浮按钮 -->
        <div v-show="activeTab === 'floating'" class="tab-page">
          <div class="cfg-row">
            <label>按钮大小</label>
            <div class="cfg-slider">
              <input type="range" min="50" max="200" v-model.number="draft.floatingButton.sizePercent" />
              <span>{{ draft.floatingButton.sizePercent }}%</span>
            </div>
          </div>
          <div class="cfg-row">
            <label>持续置顶</label>
            <label class="switch">
              <input type="checkbox" v-model="draft.floatingButton.alwaysOnTop" />
              <span class="switch-track"></span>
            </label>
          </div>
          <div class="cfg-row">
            <label>位置 X</label>
            <input type="number" v-model.number="draft.floatingButton.position.x" class="cfg-input" placeholder="自动" />
          </div>
          <div class="cfg-row">
            <label>位置 Y</label>
            <input type="number" v-model.number="draft.floatingButton.position.y" class="cfg-input" placeholder="自动" />
          </div>
          <div class="cfg-row">
            <label>默认抽取人数</label>
            <div class="cfg-slider">
              <input type="range" min="1" max="10" v-model.number="draft.pickCountDialog.defaultCount" />
              <span>{{ draft.pickCountDialog.defaultCount }}</span>
            </div>
          </div>
        </div>

        <!-- Tab 3: 结果显示 -->
        <div v-show="activeTab === 'result'" class="tab-page">
          <div class="cfg-row">
            <label>面板透明度</label>
            <div class="cfg-slider">
              <input type="range" min="10" max="100" v-model.number="resultOpacityPercent" />
              <span>{{ resultOpacityPercent }}%</span>
            </div>
          </div>
          <div class="cfg-row">
            <label>面板背景颜色</label>
            <input type="color" v-model="draft.pickResultDialog.panelBgColor" class="cfg-color" />
          </div>
          <div class="cfg-row">
            <label>面板边框颜色</label>
            <input type="color" v-model="draft.pickResultDialog.panelBorderColor" class="cfg-color" />
          </div>
          <div class="cfg-row">
            <label>抽取音效</label>
            <label class="switch">
              <input type="checkbox" v-model="draft.pickResultDialog.defaultPlayGachaSound" />
              <span class="switch-track"></span>
            </label>
          </div>
        </div>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'

const tabs = [
  { id: 'roster', label: '名单管理', color: '#66ccff',
    icon: '<svg viewBox="0 0 24 24" class="tab-svg"><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/></svg>'
  },
  { id: 'floating', label: '悬浮按钮', color: '#44aadd',
    icon: '<svg viewBox="0 0 24 24" class="tab-svg"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5"/></svg>'
  },
  { id: 'result', label: '结果显示', color: '#55cc99',
    icon: '<svg viewBox="0 0 24 24" class="tab-svg"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/></svg>'
  },
  { id: 'advanced', label: '高级设置', color: '#aa88dd',
    icon: '<svg viewBox="0 0 24 24" class="tab-svg"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  },
  { id: 'logs', label: '日志输出', color: '#99aabb',
    icon: '<svg viewBox="0 0 24 24" class="tab-svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
  }
]

const activeTab = ref('roster')
const rawListText = ref('')
const tabBarRef = ref(null)
const sliderLeft = ref(0)
const sliderWidth = ref(0)

function updateSlider() {
  if (!tabBarRef.value) return
  const activeEl = tabBarRef.value.querySelector('.tab-item.active')
  if (!activeEl) return
  const barRect = tabBarRef.value.getBoundingClientRect()
  const elRect = activeEl.getBoundingClientRect()
  // 固定滑块宽度 80px（4字图标+文字），无需等动画
  const sliderW = 80
  const elWidth = elRect.width
  const offset = elWidth > sliderW ? (elWidth - sliderW) / 2 : 0
  sliderLeft.value = elRect.left - barRect.left + offset
  sliderWidth.value = sliderW
}

const draft = reactive({
  studentList: [],
  allowRepeatDraw: true,
  floatingButton: { sizePercent: 100, alwaysOnTop: true, position: { x: null, y: null } },
  pickCountDialog: { defaultCount: 1 },
  pickResultDialog: { defaultPlayGachaSound: true, panelOpacity: 0.9, panelBgColor: '#ffffff', panelBorderColor: '#66ccff' }
})

const currentTab = computed(() => tabs.find(t => t.id === activeTab.value))
const panelBorderStyle = computed(() => ({ borderColor: currentTab.value?.color || '#66ccff' }))
const applyBtnStyle = computed(() => ({ background: currentTab.value?.color || '#66ccff' }))

const sliderStyle = computed(() => ({
  left: `${sliderLeft.value}px`,
  width: `${sliderWidth.value}px`,
  background: currentTab.value?.color || '#66ccff'
}))

const trackBorderStyle = computed(() => ({ borderColor: currentTab.value?.color || '#66ccff' }))

function tabItemStyle(tab) {
  return { color: activeTab.value === tab.id ? '#fff' : tab.color }
}

const resultOpacityPercent = computed({
  get: () => Math.round((draft.pickResultDialog.panelOpacity || 0.9) * 100),
  set: (v) => { draft.pickResultDialog.panelOpacity = Math.round(v) / 100 }
})

async function switchTab(id) {
  activeTab.value = id
  await nextTick()
  updateSlider()
}

function syncTextToList() {
  const names = rawListText.value.split(/[\r\n]+/).flatMap(l => l.split(',')).map(n => n.trim()).filter(Boolean)
  const unique = [...new Set(names)]
  const existing = new Map(draft.studentList.map(s => [s.name, s.weight]))
  draft.studentList = unique.map(name => ({ name, weight: existing.get(name) ?? 1.0 }))
}

function syncListToText() {
  rawListText.value = draft.studentList.map(s => s.name).join('\n')
}

function handleFileUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    rawListText.value = ev.target.result.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).join('\n')
    syncTextToList()
    e.target.value = ''
  }
  reader.readAsText(file, 'utf-8')
}

function removeStudent(i) { draft.studentList.splice(i, 1); syncListToText() }
function resetWeights() { draft.studentList.forEach(s => s.weight = 1.0) }

const isClosing = ref(false)

function closeWithAnimation(saved) {
  if (isClosing.value) return
  isClosing.value = true
  setTimeout(() => {
    if (window.configPanelApi) window.configPanelApi.close(saved)
  }, 200)
}

function handleCancel() {
  closeWithAnimation(false)
}

async function handleApply() {
  syncTextToList()
  const payload = JSON.parse(JSON.stringify(draft))
  if (window.configPanelApi) {
    await window.configPanelApi.saveConfig(payload)
    closeWithAnimation(true)
  }
}

onMounted(async () => {
  if (window.configPanelApi) {
    const cfg = await window.configPanelApi.getConfig()
    if (cfg) {
      Object.assign(draft, JSON.parse(JSON.stringify(cfg)))
      syncListToText()
    }
  }
  await nextTick()
  updateSlider()
})
</script>

<style scoped>
.config-overlay {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}

.config-panel {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  border-radius: 8px;
  border: 1.5px solid #66CCFF;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.3s;
}

/* Tab 悬浮胶囊滑块导航 */
.tab-bar {
  position: relative;
  display: flex;
  align-items: center;
  margin: 20px auto 0;
  padding: 0 6px;
  gap: 4px;
  width: min(520px, calc(100% - 40px));
  box-sizing: border-box;
  height: 28px;
  border-radius: 999px;
  background: #ffffff;
  border: 2px solid #66ccff;
  transition: border-color 0.3s;
}

/* 滑块：略高于导轨，微悬浮效果 */
.tab-slider {
  position: absolute;
  top: -3px;
  bottom: -3px;
  border-radius: 999px;
  transition: left 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.3s;
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
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  transition: color 0.2s;
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

/* 未选中：文字隐藏；选中：平滑展开 */
.tab-text {
  display: inline-block;
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  transition: max-width 0.2s ease, opacity 0.2s ease;
}
.tab-text.show {
  max-width: 64px;
  opacity: 1;
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
  flex: 1; overflow-y: auto; padding: 16px 20px;
}
.tab-page { animation: fadein 0.2s ease; }
@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }

.section-desc { font-size: 13px; color: #888; margin: 0 0 8px; }
.roster-section { margin-bottom: 16px; }
.roster-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.upload-btn {
  display: inline-block; padding: 6px 14px; border-radius: 8px;
  background: #66ccff; color: #fff; font-size: 13px; cursor: pointer;
}
.count-badge { font-size: 13px; color: #888; }
.roster-textarea {
  width: 100%; height: 100px; resize: vertical;
  border: 1px solid #ddd; border-radius: 8px; padding: 8px;
  font-size: 13px; font-family: inherit;
}
.inline-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #555; margin: 8px 0; }
.empty-tip { color: #ccc; font-size: 14px; text-align: center; padding: 16px 0; }
.empty-arona-img { width: 30%; opacity: 0.8; display: block; margin: 0 auto 8px; }
.student-table-wrap { max-height: 200px; overflow-y: auto; }
.student-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.student-table th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #eee; color: #888; font-weight: 600; }
.student-table td { padding: 4px 8px; border-bottom: 1px solid #f5f5f5; }
.weight-slider { width: 80px; vertical-align: middle; }
.weight-val { display: inline-block; width: 32px; text-align: right; font-size: 12px; color: #888; }
.del-btn { border: none; background: none; color: #f66; cursor: pointer; font-size: 14px; padding: 2px 6px; }
.reset-btn { margin-top: 8px; padding: 4px 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 12px; color: #888; }

/* 配置行 */
.cfg-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.cfg-row label:first-child { font-size: 14px; color: #444; }
.cfg-slider { display: flex; align-items: center; gap: 8px; }
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
  width: 18px; height: 18px; border-radius: 50%;
  background: #66ccff; border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: pointer;
}
.cfg-slider span { font-size: 13px; color: #888; min-width: 36px; }
.cfg-input { width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; text-align: center; }
.cfg-color { width: 40px; height: 28px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; padding: 2px; }

/* Switch — 主题色跟随 */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch-track {
  position: absolute; inset: 0; border-radius: 12px; background: #ccc; transition: 0.2s;
}
.switch-track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: 0.2s;
}
.switch input:checked + .switch-track { background: #66ccff; }
.switch input:checked + .switch-track::after { transform: translateX(20px); }

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
.capsule-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
.capsule-btn:active { transform: translateY(0); }

.capsule-cancel { background: #ff6b6b; }
.capsule-apply { background: #66ccff; }
</style>
