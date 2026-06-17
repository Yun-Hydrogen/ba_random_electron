<!--
# ConfigPanel.vue 维护说明

本文总结 [src/renderer/views/ConfigPanel.vue] 的结构与方法，便于后续 AI 维护。

## 模块概览
- 作用：新配置面板，替代旧 Web 配置页。窗口 720×640，面板填满窗口。
- 技术：Vue 3 `<script setup>`，通过 `window.configPanelApi` 与主进程 IPC 通信。

## 代码结构（<script setup> 内部顺序）
1.  Imports
2.  Tab 定义（tabs 数组）
3.  Tab 导航 & 滑块（activeTab, updateSlider, switchTab, currentTab）
4.  响应式状态（draft, appInfo）
5.  【Tab 1】名单管理 — 名单同步 / 文件导入 / 芯片 tooltip / 跳转 / 权重
6.  【Tab 2】悬浮按钮 — 无独立 JS，全部 v-model 绑定
7.  【Tab 3】结果显示 — resultOpacityPercent 计算属性
8.  【Tab 4】高级设置 — 管理员 / 开机启动 / 更新检查 / 关于
9.  【Tab 5】日志输出 — SSE 日志流 / 清空
10. 关闭 & 应用（handleCancel, handleApply, closeWithAnimation）
11. 生命周期（onMounted, onBeforeUnmount）
12. 主题色跟随（Theme-aware computed styles）

## Tab 胶囊滑块导航
- 导轨：28px 高，白色药丸形 + 2px 主题色边框 ← `borderColor` 随 currentTab.color
- 滑块：±3px 悬浮于导轨，`left` 0.45s / `width` 0.45s cubic-bezier(0.25,0,0.25,1)
- 滑块宽度固定 80px，无需动态测量
- **动画序列**：滑块先移动 + 图标立即变白 → 等滑块到位后文字缓慢展开变色
  - `.tab-item` color 0.2s 0s（图标立即跟随）
  - `.tab-text.show` max-width/opacity/color 0.5s 0.45s（文字延迟缓慢展开）
- 未选中 Tab：仅图标，文字 `max-width:0;opacity:0`
- 选中 Tab：文字 `max-width:64px;opacity:1`

## 名单管理（Tab 1）布局
- **抬头**：`import-capsule`（导入按钮 + 提示 + 人数 badge）
- **左右分栏**：`.roster-layout` flex
  - 左侧 34%：textarea（稿纸无横线，等宽字体）
  - 右侧 66%：学生芯片（flex-wrap 自适应宽度），点击跳转到权重列表对应行
- **芯片 tooltip**：全局 `position:fixed` + `z-index:99999`，悬停显示"名字 · 权重 X.X"
- **权重管理**：斑马条纹列表（`:nth-child(even)`），每行滑条 + ✕ 删除按钮

## 表单控件
- 滑条：6px 圆角轨道 + 18px 圆形主题色滑块，白色边框 + 投影
- Switch：主题色轨 + 白色圆球滑动
- 颜色选择器：`<input type="color">` 40×28px

## 底部按钮
- 取消（红色 ✕ SVG）/ 应用（主题色 ✓ SVG），悬浮胶囊

## IPC / API 依赖
- `configPanelApi.getConfig()` → 获取完整配置
- `configPanelApi.saveConfig(config)` → 保存配置
- `configPanelApi.close(saved)` → 关闭面板
- `configPanelApi.getAppInfo()` / `openConfigFile()` / `openConfigDir()` / `adminElevate()` / `restart()` / `createStartupTask()` / `checkUpdate()`
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
          <div class="card">
            <div class="card-title">名单导入</div>
            <div class="card-desc">导入 txt/csv 文件或粘贴名单于输入框中（每行一名同学）</div>
            <div class="import-capsule">
              <label class="upload-btn">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                导入文件
                <input type="file" accept=".txt,.csv" @change="handleFileUpload" style="display:none" />
              </label>
              <span class="import-hint">老师可以点击左侧按钮快捷导入txt/csv名单哦~</span>
              <span class="count-badge"> 人数:{{ draft.studentList.length }} </span>
            </div>
            <div class="roster-layout">
              <!-- 左侧：文本输入区 -->
              <div class="roster-left">
                <textarea
                  v-model="rawListText"
                  class="roster-textarea"
                  placeholder="每行一个姓名&#10;例如：&#10;早濑优香&#10;小鸟游星野&#10;空崎日奈"
                  @input="syncTextToList"
                ></textarea>
              </div>
              <!-- 右侧：学生芯片网格 -->
              <div class="roster-right">
                <div v-if="draft.studentList.length === 0" class="chip-empty-hint">左侧输入姓名后<br>这里会显示学生芯片</div>
                <div v-else class="name-chip-grid">
                  <span
                    v-for="(s, i) in draft.studentList"
                    :key="i"
                    class="name-chip"
                    @click="scrollToStudent(i)"
                    @mouseenter="showChipTooltip($event, s)"
                    @mouseleave="hideChipTooltip"
                  >{{ s.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">权重管理</div>
            <div class="card-desc">调整每位同学的抽取权重（越高越容易被抽到），或设置重复抽取规则</div>
            <div class="weight-head-row">
              <label class="inline-check">
                <input type="checkbox" v-model="draft.allowRepeatDraw" />
                单轮抽取中允许重复结果
              </label>
              <button class="roster-reset" @click="resetWeights">重置全部权重</button>
            </div>
            <div v-if="draft.studentList.length === 0" class="empty-tip">
              <img src="/image/Arona_Empty.png" alt="Arona Empty" class="empty-arona-img" />
              <p>暂无名单，请先导入</p>
            </div>
            <div v-else class="student-table-wrap">
              <div class="roster-list">
                <div
                  v-for="(s, i) in draft.studentList"
                  :key="i"
                  class="roster-item"
                  :ref="el => { if (el) studentRefs[i] = el }"
                >
                  <span class="roster-name">{{ s.name }}</span>
                  <div class="roster-weight">
                    <input type="range" min="0" max="5" step="0.1" v-model.number="s.weight" class="weight-slider" />
                    <span class="weight-val">{{ s.weight.toFixed(1) }}</span>
                  </div>
                  <button class="roster-del" @click="removeStudent(i)">✕</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: 悬浮按钮 -->
        <div v-show="activeTab === 'floating'" class="tab-page">
          <div class="card">
            <div class="card-title">悬浮按钮</div>
            <div class="card-desc">调整悬浮按钮的大小、置顶行为、位置与默认抽取人数</div>
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
        </div>

        <!-- Tab 3: 结果显示 -->
        <div v-show="activeTab === 'result'" class="tab-page">
          <div class="card">
            <div class="card-title">结果显示</div>
            <div class="card-desc">调整抽取结果面板的外观与音效</div>
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

        <!-- Tab 4: 高级设置 -->
        <div v-show="activeTab === 'advanced'" class="tab-page">
          <div class="card">
            <div class="card-title">服务配置</div>
            <div class="card-desc">Web 配置服务端口与配置文件管理</div>
            <div class="cfg-row">
              <label>配置端口</label>
              <input type="number" v-model.number="draft.webConfig.port" min="1" max="65535" class="cfg-input" />
            </div>
            <div class="cfg-row">
              <label>配置文件</label>
              <div class="cfg-btn-group">
                <button class="cfg-sm-btn" @click="openConfigFile">打开文件</button>
                <button class="cfg-sm-btn" @click="openConfigDir">打开目录</button>
              </div>
            </div>
          </div>

          <div v-if="appInfo.isWindows" class="card">
            <div class="card-title">Windows 系统</div>
            <div class="card-desc">管理员权限与 UIAccess 置顶增强</div>
            <div class="cfg-row">
              <label>管理员置顶</label>
              <label class="switch">
                <input type="checkbox" v-model="draft.webConfig.adminTopmostEnabled" />
                <span class="switch-track"></span>
              </label>
            </div>
            <div v-if="appInfo.isAdmin" class="cfg-row">
              <label>UIAccess 置顶</label>
              <label class="switch">
                <input type="checkbox" v-model="draft.webConfig.uiAccessEnabled" />
                <span class="switch-track"></span>
              </label>
            </div>
            <div v-if="!appInfo.uiAccessDllExists && draft.webConfig.uiAccessEnabled" class="cfg-hint warn">
              ⚠ 未检测到 uiaccess.dll
            </div>
            <div class="cfg-row">
              <label>管理员重启</label>
              <button class="cfg-sm-btn" @click="adminElevate">以管理员身份重启</button>
            </div>
            <div class="cfg-row">
              <label>重启应用</label>
              <button class="cfg-sm-btn" @click="appRestart">立即重启</button>
            </div>
          </div>

          <div v-if="appInfo.isWindows" class="card">
            <div class="card-title">开机启动</div>
            <div class="card-desc">创建 Windows 计划任务，登录时以管理员权限自动启动</div>
            <div class="cfg-row">
              <label>EXE 路径</label>
              <input type="text" v-model="draft.webConfig.adminAutoStartPath" class="cfg-input-wide" placeholder="程序路径" />
            </div>
            <div class="cfg-row">
              <label>任务名称</label>
              <input type="text" v-model="draft.webConfig.adminAutoStartTaskName" class="cfg-input-wide" />
            </div>
            <div class="cfg-row">
              <label></label>
              <button class="cfg-sm-btn" @click="createStartupTask">创建 / 更新计划任务</button>
            </div>
          </div>

          <div class="card">
            <div class="card-title">更新检查</div>
            <div class="card-desc">从 GitHub Releases 获取最新版本信息</div>
            <div class="cfg-row">
              <label>检查更新</label>
              <button class="cfg-sm-btn" :disabled="updateLoading" @click="checkUpdate">{{ updateLoading ? '检查中…' : '立即检查' }}</button>
            </div>
            <div v-if="updateStatus" class="cfg-hint" :class="updateStatus">{{ updateTitle }}</div>
            <div v-if="updateDetail" class="update-detail-text">{{ updateDetail }}</div>
          </div>

          <div class="card">
            <div class="card-title">关于</div>
            <div class="font-credit">
              界面字体：南西新圆体 | 
              <a href="https://opensource.org/license/IPA" target="_blank" rel="noopener">IPA Font License</a>
            </div>
          </div>
        </div>

        <!-- Tab 5: 日志输出 -->
        <div v-show="activeTab === 'logs'" class="tab-page">
          <div class="card">
            <div class="log-head">
              <span class="log-head-title">运行日志</span>
              <span class="log-badge" v-if="appInfo.isAdmin">管理员</span>
              <span class="log-badge" v-if="appInfo.isUiAccess">UIAccess</span>
              <span class="log-badge log-badge-ver">v{{ appInfo.version }}</span>
              <div class="log-head-spacer"></div>
              <button class="log-clear-btn" @click="clearLogs">清空</button>
            </div>
            <div class="log-list" ref="logListRef">
              <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
              <div v-for="item in logs" :key="item.id" class="log-row" :class="'log-' + item.level">
                <span class="log-time">{{ item.time }}</span>
                <span class="log-dot" :class="'dot-' + item.level"></span>
                <span class="log-msg">{{ item.text }}</span>
              </div>
            </div>
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
//  0. Imports
// ============================================================
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

// ============================================================
//  1. Tab 定义
// ============================================================
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

// ============================================================
//  2. Tab 导航 & 滑块
// ============================================================
const activeTab = ref('roster')
const tabBarRef = ref(null)
const sliderLeft = ref(0)
const sliderWidth = ref(0)
const currentTab = computed(() => tabs.find(t => t.id === activeTab.value))

function updateSlider() {
  if (!tabBarRef.value) return
  const activeEl = tabBarRef.value.querySelector('.tab-item.active')
  if (!activeEl) return
  const barRect = tabBarRef.value.getBoundingClientRect()
  const elRect = activeEl.getBoundingClientRect()
  const sliderW = 80 // 固定宽度（4字图标+文字）
  const elWidth = elRect.width
  const offset = elWidth > sliderW ? (elWidth - sliderW) / 2 : 0
  sliderLeft.value = elRect.left - barRect.left + offset
  sliderWidth.value = sliderW
}

async function switchTab(id) {
  activeTab.value = id
  await nextTick()
  updateSlider()
}

// ============================================================
//  3. 响应式状态（draft 配置草稿 + 应用信息）
// ============================================================
const draft = reactive({
  studentList: [],
  allowRepeatDraw: true,
  floatingButton: { sizePercent: 100, alwaysOnTop: true, position: { x: null, y: null } },
  pickCountDialog: { defaultCount: 1 },
  pickResultDialog: { defaultPlayGachaSound: true, panelOpacity: 0.9, panelBgColor: '#ffffff', panelBorderColor: '#66ccff' },
  webConfig: { port: 21219, adminTopmostEnabled: false, adminAutoStartEnabled: false, adminAutoStartPath: '', adminAutoStartTaskName: 'Blue Random (Admin)', uiAccessEnabled: false }
})

const appInfo = reactive({ isAdmin: false, isUiAccess: false, isWindows: false, uiAccessDllExists: false, configPath: '', configDir: '', exePath: '', version: '' })

// ============================================================
//  4.【Tab 1】名单管理 — 名单同步 / 文件导入 / 芯片 & tooltip / 跳转 / 权重
// ============================================================
const rawListText = ref('')

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

// ---- 芯片 tooltip（全局 fixed 定位，不受父容器裁切）----
const tooltip = reactive({ visible: false, text: '', x: 0, y: 0 })
function showChipTooltip(e, s) {
  const rect = e.target.getBoundingClientRect()
  tooltip.text = s.name + ' · 权重 ' + s.weight.toFixed(1)
  tooltip.visible = true
  tooltip.x = 0; tooltip.y = 0
  nextTick(() => {
    const el = document.querySelector('.chip-tooltip')
    const tw = el ? el.offsetWidth : 80
    tooltip.x = rect.left + rect.width / 2 - tw / 2
    tooltip.y = rect.bottom + 6
  })
}
function hideChipTooltip() { tooltip.visible = false }

// ---- 芯片点击跳转到权重列表对应行 ----
const studentRefs = {}
function scrollToStudent(i) {
  const el = studentRefs[i]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.style.background = '#66ccff'
    setTimeout(() => { el.style.background = '' }, 1200)
  }
}

function removeStudent(i) { draft.studentList.splice(i, 1); syncListToText() }
function resetWeights() { draft.studentList.forEach(s => s.weight = 1.0) }

// ============================================================
//  5.【Tab 2】悬浮按钮 — 无独立 JS，全部 v-model 双向绑定
// ============================================================

// ============================================================
//  6.【Tab 3】结果显示 — 透明度百分比计算
// ============================================================
const resultOpacityPercent = computed({
  get: () => Math.round((draft.pickResultDialog.panelOpacity || 0.9) * 100),
  set: (v) => { draft.pickResultDialog.panelOpacity = Math.round(v) / 100 }
})

// ============================================================
//  7.【Tab 4】高级设置 — 管理员 / 开机启动 / 更新 / 关于
// ============================================================
async function fetchAppInfo() {
  if (window.configPanelApi?.getAppInfo) Object.assign(appInfo, await window.configPanelApi.getAppInfo() || {})
}
async function openConfigFile()  { await window.configPanelApi?.openConfigFile() }
async function openConfigDir()   { await window.configPanelApi?.openConfigDir() }
async function adminElevate()    { await window.configPanelApi?.adminElevate() }
async function appRestart()      { await window.configPanelApi?.restart() }
async function createStartupTask() {
  await window.configPanelApi?.createStartupTask({
    exePath: draft.webConfig.adminAutoStartPath || appInfo.exePath,
    taskName: draft.webConfig.adminAutoStartTaskName
  })
}

const updateLoading = ref(false)
const updateStatus = ref('')
const updateTitle = ref('')
const updateDetail = ref('')
async function checkUpdate() {
  updateLoading.value = true; updateStatus.value = ''; updateTitle.value = ''; updateDetail.value = ''
  const r = await window.configPanelApi?.checkUpdate()
  updateLoading.value = false
  if (r) { updateStatus.value = r.status || ''; updateTitle.value = r.title || ''; updateDetail.value = r.detail || '' }
}

// ============================================================
//  8.【Tab 5】日志输出 — SSE 日志流 / 清空
// ============================================================
const logs = ref([])
let logSeed = 0
let logSource = null

function addLog(level, text, timeOverride) {
  const time = timeOverride || new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.unshift({ id: `${Date.now()}-${logSeed++}`, level, text, time })
  if (logs.value.length > 200) logs.value.length = 200
}

function startLogStream() {
  if (logSource) logSource.close()
  logSource = new EventSource('/api/logs')
  logSource.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data)
      addLog(d.level || 'info', d.text || '', d.time ? new Date(d.time).toLocaleTimeString('zh-CN', { hour12: false }) : undefined)
    } catch {}
  }
}

function clearLogs() { logs.value = []; addLog('info', '日志已清空') }

// ============================================================
//  9. 关闭 & 应用
// ============================================================
const isClosing = ref(false)

function closeWithAnimation(saved) {
  if (isClosing.value) return
  isClosing.value = true
  setTimeout(() => {
    if (window.configPanelApi) window.configPanelApi.close(saved)
  }, 200)
}

function handleCancel() { closeWithAnimation(false) }

async function handleApply() {
  syncTextToList()
  const payload = JSON.parse(JSON.stringify(draft))
  if (window.configPanelApi) {
    await window.configPanelApi.saveConfig(payload)
    closeWithAnimation(true)
  }
}

// ============================================================
//  10. 生命周期
// ============================================================
onMounted(async () => {
  startLogStream()
  fetchAppInfo()
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

onBeforeUnmount(() => {
  if (logSource) { logSource.close(); logSource = null }
})

// ============================================================
//  11. 主题色跟随（Theme-aware computed styles）
//    模板中通过 :style="xxxStyle" 绑定，切换 Tab 时自动随 currentTab.color 变化
// ============================================================
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
</script>

<style scoped>
@font-face {
  font-family: 'UI';
  src: url('/fonts/UI.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

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
  margin: 20px auto 0;
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
.tab-page {
  animation: slide-in 0.3s cubic-bezier(0.25, 0, 0.25, 1);
}

@keyframes slide-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}

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
  font-family: 'Consolas', 'SF Mono', 'Courier New', monospace;
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
.capsule-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
.capsule-btn:active { transform: translateY(0); }

.capsule-cancel { background: #ff6b6b; }
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
