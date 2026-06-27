// ============================================================
//  useConfigPanel.js — ConfigPanel 全部 JS 逻辑
//  从 ConfigPanel.vue <script setup> 中提取，保持视图组件简洁
// ============================================================
import { ref, reactive, computed, onMounted, nextTick } from 'vue'

// ---- 1. Tab 定义 ----
export const tabs = [
  { id: 'roster', label: '名单管理', color: '#66ccff',
    icon: '<svg viewBox="0 0 24 24" class="tab-svg"><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/></svg>'
  },
  { id: 'floating', label: '悬浮按钮', color: '#39c5bb',
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

export function useConfigPanel() {
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
    const sliderW = 80
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
  //  3. 全局状态 — 配置草稿 + 应用信息
  // ============================================================
  const draft = reactive({
    studentList: [],
    allowRepeatDraw: true,
    floatingButton: { sizePercent: 100, alwaysOnTop: true, position: { x: null, y: null }, iconPath: '', iconSize: 48, borderColor: '#ffffff' },
    pickCountDialog: { defaultCount: 1 },
    pickResultDialog: { defaultPlayGachaSound: true, panelOpacity: 0.9, panelBgColor: '#ffffff', panelBorderColor: '#66ccff', playMusic: false, soundVolume: 80, musicVolume: 60 },
    webConfig: { port: 21219, adminTopmostEnabled: false, adminAutoStartEnabled: false, adminAutoStartPath: '', adminAutoStartTaskName: 'Blue Random (Admin)', adminAutoStartAdmin: true, uiAccessEnabled: false }
  })

  const appInfo = reactive({ isAdmin: false, isUiAccess: false, isWindows: false, uiAccessDllExists: false, configPath: '', configDir: '', exePath: '', version: '' })

  // ============================================================
  //  4. 芯片 tooltip（全局 fixed 定位）
  // ============================================================
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

  // ============================================================
  //  5. Tab 4 高级设置 — IPC 操作
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
      taskName: draft.webConfig.adminAutoStartTaskName,
      admin: draft.webConfig.adminAutoStartAdmin
    })
  }
  function resetConfig() {
    // 重置为默认值并通知渲染进程刷新
    if (window.configPanelApi) window.configPanelApi.resetConfig?.()
  }
  function showInExplorer() {
    if (window.configPanelApi) window.configPanelApi.openConfigDir?.()
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
  //  6. 关闭 & 应用
  // ============================================================
  const isClosing = ref(false)

  function closeWithAnimation(saved) {
    if (isClosing.value) return
    isClosing.value = true
    setTimeout(() => { if (window.configPanelApi) window.configPanelApi.close(saved) }, 200)
  }

  function handleCancel() { closeWithAnimation(false) }

  async function handleApply() {
    const payload = JSON.parse(JSON.stringify(draft))
    if (window.configPanelApi) {
      await window.configPanelApi.saveConfig(payload)
      closeWithAnimation(true)
    }
  }

  // ============================================================
  //  7. 主题色跟随
  // ============================================================
  const panelBorderStyle = computed(() => ({ borderColor: currentTab.value?.color || '#66ccff' }))
  const applyBtnStyle    = computed(() => ({ background: currentTab.value?.color || '#66ccff' }))
  const sliderStyle = computed(() => ({
    left: `${sliderLeft.value}px`, width: `${sliderWidth.value}px`,
    background: currentTab.value?.color || '#66ccff'
  }))
  const trackBorderStyle = computed(() => ({ borderColor: currentTab.value?.color || '#66ccff' }))
  function tabItemStyle(tab) { return { color: activeTab.value === tab.id ? '#fff' : tab.color } }

  // ============================================================
  //  8. 加载状态 & 生命周期
  // ============================================================
  const loading = ref(true)

  onMounted(async () => {
    // ① 立即播放滑块动画，不等待任何数据
    await nextTick()
    updateSlider()

    // ② 并行加载配置和应用信息
    const [cfg] = await Promise.all([
      window.configPanelApi ? window.configPanelApi.getConfig().catch(() => null) : null,
      fetchAppInfo()
    ])

    // ③ 数据就绪后一次性填充，触发 UI 更新
    if (cfg) Object.assign(draft, JSON.parse(JSON.stringify(cfg)))
    loading.value = false
  })

  // ============================================================
  //  返回所有供模板使用
  // ============================================================
  return {
    tabs, activeTab, tabBarRef, sliderLeft, sliderWidth, currentTab,
    updateSlider, switchTab,
    draft, appInfo,
    tooltip, showChipTooltip, hideChipTooltip,
    fetchAppInfo, openConfigFile, openConfigDir, adminElevate, appRestart, createStartupTask, resetConfig, showInExplorer,
    updateLoading, updateStatus, updateTitle, updateDetail, checkUpdate,
    isClosing, closeWithAnimation, handleCancel, handleApply,
    loading,
    panelBorderStyle, applyBtnStyle, sliderStyle, trackBorderStyle, tabItemStyle
  }
}
