<template>
  <main class="page">
    <teleport to="body">
      <div class="toast-stack" role="status" aria-live="polite">
        <transition name="uiaccess-fly">
          <div v-if="uiAccessPromptOpen" class="uiaccess-toast">
            <div class="uiaccess-title">确认启用 UIAccess</div>
            <div class="uiaccess-desc">
              启用后将使用 RunUIAccess 的 uiaccess.dll 以 UIAccess 权限重启，可能触发安全软件提示。
            </div>
            <div class="uiaccess-actions">
              <button type="button" class="uiaccess-btn secondary" @click="cancelUiAccessEnable">取消</button>
              <button type="button" class="uiaccess-btn" @click="confirmUiAccessEnable">确认启用</button>
            </div>
          </div>
        </transition>
        <transition-group name="toast-stack" tag="div" class="toast-stack-list">
          <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast-${toast.type}`">
            <div class="toast-text">{{ toast.message }}</div>
            <div class="toast-bar" :style="{ animationDuration: `${toast.duration}ms` }"></div>
          </div>
        </transition-group>
      </div>
    </teleport>
    <div class="layout">
      <section class="panel panel-left">
        <div class="header">
          <h1>蔚蓝点名 Web配置页</h1>
          <p class="hint">老师可以在这里配置 蔚蓝点名 的各项功能哦！</p>
        </div>

      <div class="tabs">
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'list' }" @click="switchTab('list')">花名册导入</button>
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'students' }" @click="switchTab('students')">花名册管理</button>
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'floating' }" @click="switchTab('floating')">抽取悬浮按钮</button>
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'pickCount' }" @click="switchTab('pickCount')">抽取动画</button>
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'web' }" @click="switchTab('web')">系统服务</button>
      </div>

        <form id="config-form" @submit.prevent="saveConfig">
          <div class="tab-container">
            <transition :name="transitionName" mode="out-in">
              <div class="tab-content" v-if="activeTab === 'list'" key="list">
                <div class="list-manager">
                  <p class="desc">老师可以手动输入名单（每行一个），或者点击下方按钮导入CSV/TXT文件自动解析！</p>
                  <div class="list-actions">
                    <label class="upload-btn">
                      <span>📂 导入文件</span>
                      <input type="file" accept=".txt,.csv" @change="handleFileUpload" style="display: none;" />
                    </label>
                    <span class="count-badge">当前导入人数：{{ config.studentList.length }}</span>
                  </div>
                  <textarea 
                    v-model="rawListText" 
                    class="list-textarea" 
                    placeholder="请输入名单，每行一个。例如：
早濑优香
小鸟游星野
空崎日奈"
                    @input="syncTextToList"
                  ></textarea>
                </div>
              </div>

            <div class="tab-content" v-else-if="activeTab === 'students'" key="students">
              <div class="student-manager">
                <p class="desc">老师可以在这里管理当前名单中人员及抽取权重，默认权重为1.0。权重越高，被抽取到的概率越大!</p>
                <label class="inline">
                  <input type="checkbox" v-model="config.allowRepeatDraw" />
                  是否允许重复抽取（加权真随机）
                </label>
                <div class="student-list table-wrapper">
                  <div v-if="config.studentList.length === 0" class="empty-tips-text">暂时没有名单哦~请先在“名单导入”中输入。</div>
                  <div v-if="config.studentList.length === 0" class="empty-tips-arona">
                  <img v-if="config.studentList.length === 0" src="/image/Arona_Empty.png" alt="Arona Empty" class="empty-tips-arona-img" />
                  </div>
                  <table class="student-table" v-else>
                    <thead>
                      <tr>
                        <th class="col-name">学生姓名</th>
                        <th class="col-weight">权重 (0.0 - 2.0)</th>
                        <th class="col-action">删除</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(student, index) in config.studentList" :key="index">
                        <td class="col-name">{{ student.name }}</td>
                        <td class="col-weight">
                          <input 
                            type="range" 
                            class="weight-slider"
                            v-model.number="student.weight" 
                            min="0" max="2" step="0.1" 
                            @change="syncListToText" 
                          />
                          <span class="weight-val">{{ Number(student.weight).toFixed(1) }}</span>
                        </td>
                        <td class="col-action">
                          <button type="button" class="del-svg-btn" @click="removeStudent(index)" title="删除">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-if="config.studentList.length > 0" class="student-actions">
                  <button type="button" class="reset-btn" @click="resetWeights">重置所有学生的权重为1.0</button>
                </div>
              </div>
            </div>

            <div class="tab-content" v-else-if="activeTab === 'floating'" key="floating">
              <label>
                按钮大小，为百分数值，以50px*50px为100（范围:0-1000）
                <input type="number" v-model.number="config.floatingButton.sizePercent" min="0" max="1000" required />
              </label>
              <label>
                透明度，为百分数值（范围:0-100）
                <input type="number" v-model.number="config.floatingButton.transparencyPercent" min="0" max="100" required />
              </label>
              <label class="inline">
                <input type="checkbox" v-model="config.floatingButton.alwaysOnTop" />
                是否置顶
              </label>
              <div class="row">
                <label>
                  位置 X（以屏幕左上角为坐标原点，自动在退出时保存当前位置，留空恢复到默认位置）
                  <input type="number" v-model.number="config.floatingButton.position.x" />
                </label>
                <label>
                  位置 Y（以屏幕左上角为坐标原点，自动在退出时保存当前位置，留空恢复到默认位置）
                  <input type="number" v-model.number="config.floatingButton.position.y" />
                </label>
              </div>
            </div>

            <div class="tab-content" v-else-if="activeTab === 'pickCount'" key="pickCount">
              <label class="inline">
                <input type="checkbox" v-model="config.pickCountDialog.defaultPlayMusic" />
                是否默认播放抽取背景音乐（注意！教学环境下可能并不适宜）
              </label>
              <label class="inline">
                <input type="checkbox" v-model="config.pickResultDialog.defaultPlayGachaSound" />
                抽取动画默认播放抽取音效（注意！教学环境下可能并不适宜）
              </label>
              <label>
                抽取音效响度（0.0 - 1.0）
                <input type="number" v-model.number="config.pickResultDialog.gachaSoundVolume" min="0" max="1" step="0.05" required />
              </label>
              <label>
                背景变暗程度，百分数值（0-100）
                <input type="number" v-model.number="config.pickCountDialog.backgroundDarknessPercent" min="0" max="100" required />
              </label>
              <label>
                默认人数（1-10）
                <input type="number" v-model.number="config.pickCountDialog.defaultCount" min="1" max="10" required />
              </label>
            </div>

            <div class="tab-content" v-else-if="activeTab === 'web'" key="web">
              <p class="desc">老师注意！这些配置涉及程序基本运行,正常情况下，老师是不需要调整这里的配置的哦~</p>
              <label>
                Web配置界面的端口（1-65535）
                <input type="number" v-model.number="config.webConfig.port" min="1" max="65535" required />
              </label>

              <div class="admin-block config-block">
                <p class="admin-title">配置文件位置</p>
                <label>
                  配置文件路径(不可修改)
                  <input type="text" :value="configPath" readonly />
                </label>
                <div class="row">
                  <button type="button" class="admin-btn" @click="openConfigFile">打开配置文件</button>
                  <button type="button" class="admin-btn" @click="openConfigDir">打开配置目录</button>
                </div>
              </div>

              <div class="admin-block always-top-block">
                <p class="admin-title">管理员置顶增强（Windows）</p>
                <label class="inline">
                  <input type="checkbox" v-model="config.webConfig.adminTopmostEnabled" />
                  启用启动时申请管理员权限置顶
                </label>
                <p class="admin-hint">开启后程序启动会弹出 UAC 提示，以提升悬浮按钮的置顶能力。</p>
                <button type="button" class="admin-btn" @click="requestAdminElevation">管理员身份重启</button>
              </div>

              <div class="admin-block uiaccess-block">
                <p class="admin-title">UIAccess 置顶增强（Windows）</p>
                <div class="uiaccess-panel" :class="{ disabled: !isAdmin }">
                  <label class="inline">
                    <input
                      type="checkbox"
                      v-model="config.webConfig.uiAccessEnabled"
                      @change="onUiAccessToggle"
                      :disabled="!isAdmin"
                    />
                    管理员身份运行时自动使用 UIAccess 获得在几乎所有窗口上的置顶权限。
                  </label>
                  <p class="admin-hint">启用后仅在管理员身，yi份下自动尝试 UIAccess 重启。</p>
                  <p v-if="!uiAccessDllExists" class="admin-hint">未检测到 uiaccess.dll，请确认安装包完整。</p>
                  <div v-if="!isAdmin" class="uiaccess-mask">需要管理员权限才能修改该设置</div>
                </div>
                <button type="button" class="admin-btn" @click="requestAppRestart">立即重启</button>
              </div>

              <div class="admin-block auto-start-block">
                <p class="admin-title">开机计划任务（管理员运行）</p>
                <label>
                  可执行文件路径（exe）
                  <input type="text" v-model="config.webConfig.adminAutoStartPath" placeholder="例如：C:\\Program Files\\Blue Random\\Blue Random.exe" />
                </label>
                <label>
                  任务名称
                  <input type="text" v-model="config.webConfig.adminAutoStartTaskName" />
                </label>
                <p class="admin-hint">点击按钮后会创建/更新计划任务，登录时以管理员权限启动。</p>
                <button type="button" class="admin-btn" @click="createAdminStartupTask">创建/更新计划任务</button>
              </div>
              
              <div class="admin-block update-block">
                <p class="admin-title">检查更新</p>
                <div class="update-row">
                  <button type="button" class="update-btn" :disabled="updateState.loading" @click="checkUpdate">
                    {{ updateState.loading ? '检查中...' : '检查更新' }}
                  </button>
                  <span class="update-status" :class="`status-${updateState.status}`">{{ updateState.title }}</span>
                </div>
                <p v-if="updateState.detail" class="update-detail">{{ updateState.detail }}</p>
                <div v-if="updateState.commitUrl || updateState.releaseUrl" class="update-links">
                  <a v-if="updateState.commitUrl" :href="updateState.commitUrl" target="_blank" rel="noopener">查看提交</a>
                  <a v-if="updateState.releaseUrl" :href="updateState.releaseUrl" target="_blank" rel="noopener">查看发布页</a>
                </div>
              </div>
            </div>
            </transition>
          </div>

          <button type="submit" class="save-btn">保存配置</button>
        </form>
      </section>

      <aside class="panel panel-right">
        <div class="log-header">
          <div class="log-title-row">
            <h2>运行日志</h2>
            <span v-if="isDebugMode" class="debug-badge">Dev</span>
            <span v-if="isAdmin" class="admin-badge">管理员</span>
            <span v-if="isUiAccess" class="uiaccess-badge">UIAccess</span>
            <span class="version-badge">版本 {{ appVersion }}</span>
          </div>
        </div>
        <div class="log-list" role="log" aria-live="polite">
          <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
          <div v-for="item in logs" :key="item.id" class="log-item" :class="`log-${item.level}`">
            <span class="log-time">{{ item.time }}</span>
            <span class="log-text">{{ item.text }}</span>
          </div>
        </div>
      </aside>
    </div>
  </main>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const tabs = ['list', 'students', 'floating', 'pickCount', 'web']
const activeTab = ref('list')
const transitionName = ref('slide-left')

const switchTab = (tab) => {
  const currentIndex = tabs.indexOf(activeTab.value)
  const nextIndex = tabs.indexOf(tab)
  transitionName.value = nextIndex > currentIndex ? 'slide-left' : 'slide-right'
  activeTab.value = tab
}

const apiBase = '/api'
const releasePageUrl = 'https://github.com/Yun-Hydrogen/ba_random_electron/releases/latest'

const logs = ref([])
const isDebugMode = ref(false)
const isAdmin = ref(false)
const isUiAccess = ref(false)
const appVersion = ref('0.0.0')
const defaultExePath = ref('')
const uiAccessDllExists = ref(false)
const configPath = ref('')
const configDir = ref('')
const uiAccessPromptOpen = ref(false)
const uiAccessEnablePending = ref(false)
const toasts = ref([])
let toastSeed = 0
const toastTimers = new Map()
let uiAccessAutoFilled = false
const updateState = ref({
  loading: false,
  status: 'idle',
  title: '尚未检查更新',
  detail: '',
  commitUrl: '',
  releaseUrl: ''
})


const checkUpdate = async () => {
  addLog('info', '开始检查更新...')
  updateState.value = {
    loading: true,
    status: 'loading',
    title: '正在检查更新...',
    detail: '',
    commitUrl: '',
    releaseUrl: ''
  }

  try {
    const response = await axios.get(`${apiBase}/check-update`)
    const result = response.data
    if (result && Array.isArray(result.debug)) {
      result.debug.forEach((line) => addLog('info', `更新: ${line}`))
    }

    updateState.value = {
      loading: false,
      status: result.status || 'error',
      title: result.title || '检查更新失败',
      detail: result.detail || '请检查网络或稍后再试。',
      commitUrl: result.commitUrl || '',
      releaseUrl: result.releaseUrl || releasePageUrl
    }
    if (result.status === 'update') {
      addLog('success', '发现新版本')
    } else if (result.status === 'ok') {
      addLog('success', '已是最新版本')
    } else if (result.status === 'easter') {
      addLog('info', '本地版本高于远端版本')
    } else {
      addLog('error', result.detail || '检查更新失败')
    }
  } catch (error) {
    console.error('检查更新失败:', error)
    const status = error && error.response ? `${error.response.status} ${error.response.statusText}` : '未知错误'
    const url = error && error.config && error.config.url ? error.config.url : ''
    const code = error && error.code ? String(error.code) : ''
    const message = error && error.message ? String(error.message) : ''
    const axiosFlag = error && error.isAxiosError ? 'axios' : ''
    addLog(
      'error',
      `检查更新失败: ${status}${code ? ` | code=${code}` : ''}${message ? ` | ${message}` : ''}${axiosFlag ? ` | ${axiosFlag}` : ''}${url ? ` | ${url}` : ''}`
    )
    if (!error || !error.response) {
      addLog('warn', '没有拿到响应对象，可能是网络/跨域/被拦截')
    }
    updateState.value = {
      loading: false,
      status: 'error',
      title: '检查更新失败',
      detail: '请检查网络或稍后再试。',
      commitUrl: '',
      releaseUrl: releasePageUrl
    }
  }
}
let logSeed = 0
let logSource = null

const addLog = (level, text, timeOverride) => {
  const time = timeOverride || new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.unshift({ id: `${Date.now()}-${logSeed++}`, level, text, time })
  if (logs.value.length > 200) {
    logs.value.length = 200
  }
}

const startLogStream = () => {
  if (logSource) {
    logSource.close()
  }

  logSource = new EventSource(`${apiBase}/logs`)
  logSource.onmessage = (event) => {
    try {
      const entry = JSON.parse(event.data)
      const time = entry.time
        ? new Date(entry.time).toLocaleTimeString('zh-CN', { hour12: false })
        : undefined
      addLog(entry.level || 'info', entry.text || '', time)
    } catch (_error) {}
  }
  logSource.onerror = () => {}
}

const config = ref({
  studentList: [],
  allowRepeatDraw: true,
  floatingButton: {
    sizePercent: 100,
    transparencyPercent: 100,
    alwaysOnTop: true,
    position: {
      x: null,
      y: null
    }
  },
  pickCountDialog: {
    defaultPlayMusic: true,
    backgroundDarknessPercent: 50,
    defaultCount: 1
  },
  pickResultDialog: {
    defaultPlayGachaSound: true,
    gachaSoundVolume: 0.6
  },
  webConfig: {
    port: 21219,
    adminTopmostEnabled: false,
    adminAutoStartEnabled: false,
    adminAutoStartPath: '',
    adminAutoStartTaskName: 'Blue Random (Admin)',
    uiAccessEnabled: false
  }
})

const rawListText = ref('')

const syncTextToList = () => {
  const names = rawListText.value
    .split(/[\r\n]+/)
    .flatMap(line => line.split(','))
    .map(name => name.trim())
    .filter(name => name)

  const uniqueNames = Array.from(new Set(names))
  const existingMap = new Map(config.value.studentList.map(s => [s.name, s.weight]))
  
  config.value.studentList = uniqueNames.map(name => ({
    name,
    weight: existingMap.has(name) ? existingMap.get(name) : 1.0
  }))
}

const syncListToText = () => {
  rawListText.value = config.value.studentList.map(s => s.name).join('\n')
}

const removeStudent = (index) => {
  config.value.studentList.splice(index, 1)
  syncListToText()
}

const resetWeights = () => {
  config.value.studentList.forEach(s => { s.weight = 1.0 })
}

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.readAsText(file, 'utf-8')
  reader.onload = (e) => {
    const text = e.target.result
    const lines = text
      .split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line)
    
    rawListText.value = lines.join('\n')
    syncTextToList()
    event.target.value = ''
  }
}

const maybeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const fetchConfig = async () => {
  try {
    const response = await axios.get(`${apiBase}/config`)
    config.value = response.data
    rawListText.value = (config.value.studentList || []).map(s => s.name).join('\n')
    applyDefaultAutoStartPath()
    addLog('info', '配置已加载')
  } catch (error) {
    console.error('加载配置失败:', error)
    addLog('error', '加载配置失败，请检查服务是否启动')
    showToast('配置页面初始化失败。', 'error')
  }
}

const fetchAppInfo = async () => {
  try {
    const response = await axios.get(`${apiBase}/app-info`)
    isDebugMode.value = Boolean(response.data && response.data.isDebugMode)
    isAdmin.value = Boolean(response.data && response.data.isAdmin)
    isUiAccess.value = Boolean(response.data && response.data.isUiAccess)
    appVersion.value = response.data && response.data.version ? response.data.version : '0.0.0'
    defaultExePath.value = response.data && response.data.exePath ? response.data.exePath : ''
    uiAccessDllExists.value = Boolean(response.data && response.data.uiAccessDllExists)
    configPath.value = response.data && response.data.configPath ? response.data.configPath : ''
    configDir.value = response.data && response.data.configDir ? response.data.configDir : ''
    applyDefaultAutoStartPath()
  } catch (_error) {
    isDebugMode.value = false
    isAdmin.value = false
    isUiAccess.value = false
    appVersion.value = '0.0.0'
    defaultExePath.value = ''
    uiAccessDllExists.value = false
    configPath.value = ''
    configDir.value = ''
  }
}

const applyDefaultAutoStartPath = () => {
  if (!config.value || !config.value.webConfig) return
  if (!config.value.webConfig.adminAutoStartPath && defaultExePath.value) {
    config.value.webConfig.adminAutoStartPath = defaultExePath.value
  }
  if (!uiAccessAutoFilled && uiAccessDllExists.value) {
    uiAccessAutoFilled = true
    showToast('已检测到 uiaccess.dll，可启用 UIAccess。', 'success')
  }
}

const saveConfig = async () => {
  try {
    syncTextToList()
    const payload = {
      studentList: config.value.studentList,
      allowRepeatDraw: Boolean(config.value.allowRepeatDraw),
      floatingButton: {
        sizePercent: Number(config.value.floatingButton.sizePercent),
        transparencyPercent: Number(config.value.floatingButton.transparencyPercent),
        alwaysOnTop: Boolean(config.value.floatingButton.alwaysOnTop),
        position: {
          x: maybeNumber(config.value.floatingButton.position.x),
          y: maybeNumber(config.value.floatingButton.position.y)
        }
      },
      pickCountDialog: {
        defaultPlayMusic: Boolean(config.value.pickCountDialog.defaultPlayMusic),
        backgroundDarknessPercent: Number(config.value.pickCountDialog.backgroundDarknessPercent),
        defaultCount: Number(config.value.pickCountDialog.defaultCount)
      },
      pickResultDialog: {
        defaultPlayGachaSound: Boolean(config.value.pickResultDialog.defaultPlayGachaSound),
        gachaSoundVolume: Number(config.value.pickResultDialog.gachaSoundVolume)
      },
      webConfig: {
        port: Number(config.value.webConfig.port),
        adminTopmostEnabled: Boolean(config.value.webConfig.adminTopmostEnabled),
        adminAutoStartEnabled: Boolean(config.value.webConfig.adminAutoStartEnabled),
        adminAutoStartPath: String(config.value.webConfig.adminAutoStartPath || ''),
        adminAutoStartTaskName: String(config.value.webConfig.adminAutoStartTaskName || 'Blue Random (Admin)'),
        uiAccessEnabled: Boolean(config.value.webConfig.uiAccessEnabled)
      }
    }

    await axios.post(`${apiBase}/config`, payload)
    addLog('success', '配置已保存并生效')
    showToast('配置已保存并生效', 'success')
  } catch (error) {
    console.error('保存配置失败:', error)
    addLog('error', '保存失败，请检查输入内容')
    showToast('保存失败，请检查输入内容', 'error')
  }
}

const showToast = (message, type = 'info', duration = 2400) => {
  const id = `${Date.now()}-${toastSeed++}`
  toasts.value.unshift({ id, message, type, duration })
  if (toasts.value.length > 3) {
    const overflow = toasts.value.splice(3)
    overflow.forEach((toast) => {
      const timer = toastTimers.get(toast.id)
      if (timer) {
        clearTimeout(timer)
        toastTimers.delete(toast.id)
      }
    })
  }
  const timer = setTimeout(() => {
    toasts.value = toasts.value.filter(item => item.id !== id)
    toastTimers.delete(id)
  }, duration)
  toastTimers.set(id, timer)
}

const requestAdminElevation = async () => {
  try {
    const response = await axios.post(`${apiBase}/admin/elevate`)
    addLog('info', response.data?.message || '已发送管理员权限请求')
    showToast(response.data?.message || '已发送管理员权限请求', 'info')
  } catch (error) {
    console.error('申请管理员权限失败:', error)
    const message = error?.response?.data?.message || '申请管理员权限失败'
    addLog('error', message)
    showToast(`${message}，请查看日志。`, 'error')
  }
}

const onUiAccessToggle = () => {
  if (!config.value.webConfig.uiAccessEnabled) return
  uiAccessEnablePending.value = true
  uiAccessPromptOpen.value = true
}

const confirmUiAccessEnable = () => {
  uiAccessEnablePending.value = false
  uiAccessPromptOpen.value = false
  if (!uiAccessDllExists.value) {
    config.value.webConfig.uiAccessEnabled = false
    showToast('未检测到 uiaccess.dll，无法启用 UIAccess。', 'error')
  }
}

const cancelUiAccessEnable = () => {
  uiAccessEnablePending.value = false
  uiAccessPromptOpen.value = false
  config.value.webConfig.uiAccessEnabled = false
}

const createAdminStartupTask = async () => {
  try {
    const fallbackPath = defaultExePath.value || ''
    const payload = {
      exePath: String(config.value.webConfig.adminAutoStartPath || fallbackPath).trim(),
      taskName: String(config.value.webConfig.adminAutoStartTaskName || 'Blue Random (Admin)').trim()
    }
    if (!payload.exePath) {
      showToast('请先填写可执行文件路径。', 'error')
      return
    }
    const response = await axios.post(`${apiBase}/task/create-admin-startup`, payload)
    addLog('success', response.data?.message || '计划任务已创建或更新')
    showToast(response.data?.message || '计划任务已创建或更新', 'success')
  } catch (error) {
    console.error('创建计划任务失败:', error)
    addLog('error', '创建计划任务失败')
    showToast('创建计划任务失败，请查看日志。', 'error')
  }
}

const openConfigFile = async () => {
  try {
    const response = await axios.post(`${apiBase}/config/open-file`)
    addLog('success', response.data?.message || '已打开配置文件')
    showToast(response.data?.message || '已打开配置文件', 'success')
  } catch (error) {
    console.error('打开配置文件失败:', error)
    const message = error?.response?.data?.message || '打开配置文件失败'
    addLog('error', message)
    showToast(`${message}，请查看日志。`, 'error')
  }
}

const openConfigDir = async () => {
  try {
    const response = await axios.post(`${apiBase}/config/open-dir`)
    addLog('success', response.data?.message || '已打开配置目录')
    showToast(response.data?.message || '已打开配置目录', 'success')
  } catch (error) {
    console.error('打开配置目录失败:', error)
    const message = error?.response?.data?.message || '打开配置目录失败'
    addLog('error', message)
    showToast(`${message}，请查看日志。`, 'error')
  }
}

const requestAppRestart = async () => {
  try {
    await axios.post(`${apiBase}/restart`)
    addLog('info', '已触发重启')
    showToast('已触发重启', 'info')
  } catch (error) {
    console.error('触发重启失败:', error)
    const message = error?.response?.data?.message || '触发重启失败'
    addLog('error', message)
    showToast(`${message}，请查看日志。`, 'error')
  }
}

onMounted(() => {
  fetchConfig()
  startLogStream()
  fetchAppInfo()
})
</script>

<style scoped>
* {
  box-sizing: border-box;
}

/* 现代化滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(102, 204, 255, 0.283);
  border-radius: 12px;
  transition: background 0.3s ease;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(49, 193, 233, 0.135);
}

:global(html),
:global(body) {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.page {
  height: 100vh;
  padding: 28px;
  display: flex;
  align-items: stretch;
  justify-content: center;
  font-family: "Segoe UI Variable", "Microsoft YaHei UI", "PingFang SC", sans-serif;
  background:
    radial-gradient(1200px 800px at 20% 10%, rgba(148, 199, 255, 0.28), transparent 60%),
    radial-gradient(900px 600px at 80% 0%, rgba(167, 222, 255, 0.22), transparent 55%),
    #eef3fb;
  color: #0f1f3b;
  overflow: hidden;
}

.uiaccess-toast {
  position: relative;
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(120, 148, 185, 0.4);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(10, 24, 52, 0.18);
  padding: 16px 16px 14px;
  backdrop-filter: blur(16px);
  pointer-events: auto;
}

.uiaccess-title {
  font-size: 15px;
  font-weight: 700;
  color: #12223b;
  margin-bottom: 6px;
}

.uiaccess-desc {
  font-size: 13px;
  line-height: 1.5;
  color: #48658f;
}

.uiaccess-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.uiaccess-btn {
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: #1f6ef1;
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(24, 72, 156, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.uiaccess-btn:hover {
  background: #195fce;
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(24, 72, 156, 0.28);
}

.uiaccess-btn.secondary {
  background: rgba(227, 235, 248, 0.95);
  color: #2c4a72;
  box-shadow: none;
}

.uiaccess-btn.secondary:hover {
  background: rgba(210, 224, 242, 0.95);
  transform: translateY(-1px);
}

.uiaccess-fly-enter-active {
  animation: uiaccess-fly-in 0.28s ease-out;
}

.uiaccess-fly-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.uiaccess-fly-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

@keyframes uiaccess-fly-in {
  from {
    opacity: 0;
    transform: translateX(28px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.uiaccess-panel {
  position: relative;
  display: grid;
  gap: 6px;
}

.uiaccess-panel.disabled {
  opacity: 0.72;
}

.uiaccess-mask {
  position: absolute;
  inset: 0;
  background: rgba(142, 142, 142, 0.696);
  border: 1px dashed rgba(150, 170, 200, 0.6);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #ffffff;
  text-align: center;
  padding: 12px;
  pointer-events: auto;
}

.uiaccess-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #1c5a2d;
  background: rgba(210, 244, 222, 0.9);
  border: 1px solid rgba(140, 200, 160, 0.7);
}

.toast-stack {
  position: fixed;
  top: 22px;
  right: 22px;
  width: min(360px, calc(100% - 44px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 25;
  pointer-events: none;
}

.toast-stack-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  position: relative;
  padding: 20px 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 12px 26px rgba(10, 24, 52, 0.18);
  border: 1px solid rgba(120, 148, 185, 0.35);
  background: rgba(245, 249, 255, 0.96);
  color: #1f3b63;
  backdrop-filter: blur(12px);
  pointer-events: auto;
  overflow: hidden;
}

.toast-text {
  padding-right: 6px;
}

.toast.toast-success {
  background: rgba(230, 246, 235, 0.96);
  color: #1f6f3d;
  border-color: rgba(134, 192, 146, 0.45);
}

.toast.toast-error {
  background: rgba(255, 236, 236, 0.96);
  color: #b33939;
  border-color: rgba(220, 150, 150, 0.55);
}

.toast-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 100%;
  background: rgba(31, 110, 241, 0.6);
  animation-name: save-toast-progress;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

.toast.toast-success .toast-bar {
  background: rgba(45, 140, 83, 0.65);
}

.toast.toast-error .toast-bar {
  background: rgba(179, 57, 57, 0.7);
}

.toast-stack-enter-active {
  animation: save-toast-in 0.24s ease-out;
}

.toast-stack-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-stack-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes save-toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes save-toast-progress {
  from {
    transform: scaleX(1);
    transform-origin: left;
  }
  to {
    transform: scaleX(0);
    transform-origin: left;
  }
}

.layout {
  width: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  grid-template-rows: 1fr;
  gap: 20px;
  height: 100%;
}

.panel {
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.92), rgba(245, 248, 255, 0.88));
  border: 1px solid rgba(142, 175, 210, 0.4);
  border-radius: 16px;
  box-shadow: 0 18px 38px rgba(12, 28, 59, 0.12);
  padding: 22px 24px;
  backdrop-filter: blur(18px);
}

.panel-left {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.panel-right {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

h1 {
  margin: 0;
  font-size: 30px;
  letter-spacing: 1px;
  text-align: left;
}
.header {
  text-align: left;
}

.hint {
  margin-top: 8px;
  color: #355985;
  text-align: left;
}

.tabs {
  display: flex;
  margin: 20px 0 18px;
  border-bottom: 1px solid rgba(120, 148, 185, 0.4);
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 4px;
  gap: 6px;
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #3a4c6b;
  padding: 10px 0;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 10px;
}

.tab-btn:hover {
  background: rgba(220, 232, 249, 0.7);
}

.tab-btn.active {
  color: #ffffff;
  background: rgba(7, 105, 241, 0.92);
  box-shadow: 0 8px 18px rgba(16, 32, 59, 0.12);
}

#config-form {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 0;
  min-height: 0;
}

.tab-content {
  padding: 10px 0;
  height: 100%;
}

.tab-container {
  flex: 1 1 0;
  min-height: 0;
  height: 0;
  overflow-y: scroll; 
  padding-right: 6px;
  position: relative;
}

.list-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.desc {
  margin: 0;
  font-size: 14px;
  color: #4a6c94;
}

.list-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  background-color: #e5f1ff;
  color: #1a4d8c;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #aac2e0;
  transition: all 0.2s ease;
  margin: 0 !important;
}

.upload-btn:hover {
  background-color: #d0e6ff;
}

.count-badge {
  font-size: 14px;
  font-weight: bold;
  color: #2c69b2;
  background: #eef5fc;
  padding: 4px 10px;
  border-radius: 20px;
}

.list-textarea {
  width: 100%;
  height: 200px;
  min-height: 120px;
  border: 1px solid rgba(127, 157, 193, 0.55);
  border-radius: 12px;
  padding: 12px;
  font-size: 15px;
  resize: vertical;
  line-height: 1.6;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.9);
}

.list-textarea:focus {
  outline: none;
  border-color: #5a89c8;
  box-shadow: 0 0 0 3px rgba(90, 137, 200, 0.2);
}

label {
  display: block;
  margin: 10px 0;
  font-size: 14px;
  color: #2a4365;
}

.inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

input[type="number"],
input[type="text"],
textarea,
select {
  width: 100%;
  margin-top: 6px;
  border: 1px solid rgba(122, 151, 190, 0.55);
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 15px;
  background: rgba(255, 255, 255, 0.92);
  color: #102743;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background 160ms ease;
}

input[type="number"]:focus,
input[type="text"]:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: rgba(45, 110, 210, 0.8);
  box-shadow: 0 0 0 4px rgba(74, 130, 220, 0.18);
  background: #ffffff;
}

input[type="number"]:disabled,
input[type="text"]:disabled,
textarea:disabled,
select:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background: rgba(235, 241, 249, 0.7);
}

input::placeholder,
textarea::placeholder {
  color: rgba(90, 113, 145, 0.7);
}

input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background-color: rgba(160, 175, 195, 0.6);
  cursor: pointer;
  position: relative;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease;
  flex-shrink: 0;
  margin: 0;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
}

input[type="checkbox"]::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #ffffff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s ease, left 0.2s ease;
}

input[type="checkbox"]:hover {
  background-color: rgba(140, 160, 185, 0.8);
}

input[type="checkbox"]:checked {
  background-color: #66ccff;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1), 0 4px 10px rgba(42, 107, 255, 0.2);
}

input[type="checkbox"]:checked::after {
  transform: translateX(16px);
}

input[type="checkbox"]:checked:hover {
  background-color: #1bcc97;
}

input[type="checkbox"]:active {
  transform: scale(0.95);
}

input[type="checkbox"]:active::after {
  width: 24px;
}

input[type="checkbox"]:checked:active::after {
  transform: translateX(10px);
}

input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.save-btn {
  margin-top: 20px;
  width: 100%;
  border: 2px solid rgba(255, 174, 0, 0.989);
  border-radius: 12px;
  padding: 13px 14px;
  color: #0f1f3b;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  background: rgb(255, 230, 68);
  transition: all 0.3s ease;
  
}

.save-btn:hover {
  background: #bdd6ff;
  border: 2px solid #05d5ff;
}

.update-header {
  margin-bottom: 5px;
  font-size: 14px;
}
.update-card {
  margin-top: 0px;
  border: 1px solid rgba(134, 162, 200, 0.5);
  border-radius: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 10px 24px rgba(18, 36, 69, 0.08);
}

.update-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.update-btn {
  border: 0;
  margin-top: 3px;
  border-radius: 8px;
  padding: 4px 12px;
  font-weight: 700;
  cursor: pointer;
  background: linear-gradient(135deg, #5aa6ff, #2c6df5);
  color: #fff;
  box-shadow: 0 8px 16px rgba(23, 65, 134, 0.2);
}

.update-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.update-status {
  font-size: 13px;
  font-weight: 600;
  color: #3f5b7a;
}

.update-status.status-update {
  color: #1b5fd1;
}

.update-status.status-ok {
  color: #2f7d4b;
}

.update-status.status-easter {
  color: #a45b2c;
}

.update-status.status-error {
  color: #c24040;
}

.update-detail {
  border: 1px solid #75c5fe5c;
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(217, 239, 255, 0.15);
  font-size: 13px;
  color: #4a6c94;
  white-space: pre-wrap;
}

.update-links {
  margin-top: 8px;
  display: flex;
  gap: 12px;
}

.update-links a {
  color: #2f63c2;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

.update-links a:hover {
  text-decoration: underline;
}

.admin-block {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(120, 150, 190, 0.35);
  background: rgba(238, 244, 252, 0.7);
}

.admin-block.config-block {
  background: rgba(247, 255, 244, 0.8);
  border-color: rgba(200, 220, 255, 0.5);
}

.admin-block.always-top-block {
  background: rgba(255, 237, 199, 0.7);
  border-color: rgba(255, 188, 44, 0.4);
}

.admin-block.update-block {
  background: rgba(250, 234, 255, 0.354);
  border-color: rgba(255, 68, 249, 0.4);
}

.admin-block.uiaccess-block {
  background: rgba(255, 247, 247, 0.7);
  border-color: rgba(255, 138, 134, 0.5);
}
.admin-title {
  margin: 0 0 8px;
  font-weight: 700;
  color: #123564;
}

.admin-hint {
  margin: 6px 0 10px;
  font-size: 13px;
  color: rgba(20, 40, 70, 0.78);
}

.admin-btn {
  height: 40px;
  border-radius: 8px;
  padding: 0px 16px;
  border: 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  color: #2a4365;
  background: linear-gradient(135deg, #d2f0ff, #9bdeff);
  box-shadow: 0 10px 18px rgba(30, 52, 92, 0.18);
  transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
}

.admin-btn:hover {
  filter: brightness(1.05);
}

.admin-btn:active {
  transform: translateY(1px) scale(0.985);
}

.student-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.table-wrapper {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #aac2e0;
  border-radius: 8px;
  background: #fdfdfd;
}
.empty-tips-text {
  text-align: center;
  color: #92a4ba;
  padding-bottom: 0px;
  padding-top: 40px;
}

.empty-tips-arona {
  text-align: center;
  color: #92a4ba;
  padding-bottom: 40px;
  padding-top: 10px;
}


.empty-tips-arona-img {
  width: 20%;
  opacity: 0.8;
}
.student-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.student-table th, .student-table td {
  padding: 10px 14px;
  border-bottom: 1px solid #e1e9f2;
}
.student-table th {
  background: #eef5fc;
  color: #355985;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
}
.col-name {
  width: 40%;
  font-weight: 600;
  color: #133053;
}
.col-weight {
  width: 45%;
  white-space: nowrap;
}
.col-action {
  width: 15%;
  text-align: center;
}
.student-table th.col-action {
  text-align: center;
}
.weight-slider {
  vertical-align: middle;
  width: 120px;
}
.weight-val {
  display: inline-block;
  width: 30px;
  margin-left: 8px;
  font-size: 13px;
  color: #4a6c94;
  vertical-align: middle;
}
.del-svg-btn {
  background: none;
  border: none;
  color: #c92a2a;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.del-svg-btn:hover {
  background: #ffeaed;
}
.reset-btn {
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  padding: 6px 12px;
  background: #e5f1ff;
  color: #1a4d8c;
}
.reset-btn:hover { background: #d0e6ff; }
.student-actions {
  display: flex;
  justify-content: flex-end;
}

.log-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.log-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.log-header h2 {
  margin: 0;
  font-size: 20px;
}

.debug-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(135deg, #2a6bff, #61a0ff);
  box-shadow: 0 6px 14px rgba(36, 94, 190, 0.25);
}

.admin-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #3a2600;
  background: linear-gradient(135deg, #ffd36a, #ffb347);
  box-shadow: 0 6px 14px rgba(180, 120, 20, 0.25);
}

.version-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #1f2a44;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(120, 148, 185, 0.5);
}

.log-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 6px;
  overflow: auto;
}

.log-item {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(164, 186, 216, 0.4);
  box-shadow: 0 8px 18px rgba(18, 36, 69, 0.08);
  font-size: 13px;
}

.log-item.log-success {
  border-color: rgba(102, 175, 126, 0.6);
  background: rgba(227, 245, 233, 0.8);
}

.log-item.log-error {
  border-color: rgba(214, 110, 110, 0.55);
  background: rgba(255, 231, 231, 0.85);
}

.log-item.log-info {
  border-color: rgba(124, 160, 206, 0.55);
}

.log-time {
  font-variant-numeric: tabular-nums;
  color: #6b7d99;
}

.log-text {
  color: #1f2a44;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.log-empty {
  padding: 12px;
  color: #7b8da8;
  text-align: center;
  background: rgba(255, 255, 255, 0.6);
  border: 1px dashed rgba(151, 177, 210, 0.5);
  border-radius: 12px;
}

.slide-left-enter-active, .slide-left-leave-active,
.slide-right-enter-active, .slide-right-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>