<!--
================================================================================
  组件：TabAdvanced.vue
  所属：配置面板 — 高级设置 Tab
  父组件：ConfigPanel.vue （位于 src/renderer/views/ConfigPanel.vue）

================================================================================
  一、功能概述
================================================================================
  本组件是配置面板的"高级设置"选项卡，包含五大功能板块：

    板块           | 包含的配置项
    ───────────────┼────────────────────────────────────────────
    1. 开机自启    | 程序路径（含选取按钮）、计划任务名、管理员运行开关
    2. 置顶增强    | 管理员置顶开关、UIAccess 置顶开关（仅管理员可见）
    3. 渲染后端    | 图形后端选择（d3d9/vulkan/gl）、禁用直接合成、放弃 GPU 加速
    4. 配置管理    | 配置文件路径展示、打开目录、重置配置（二次确认）、重启
    5. 检查更新    | 从 GitHub Releases 拉取最新版本信息

================================================================================
  二、数据流架构
================================================================================

  ┌─────────────────────────────────────────────────────────────┐
  │  ConfigPanel.vue（父组件）                                    │
  │  - 持有全部状态（admin, appInfo, update*）                │
  │  - 通过 props 向下传递给 TabAdvanced                         │
  │  - 通过 emit 事件接收子组件的操作请求                          │
  └────────────┬────────────────────────────────────┬───────────┘
               │ Props（只读数据）                    │ Emit（事件上报）
               ▼                                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  TabAdvanced.vue（本组件）                                  │
  │                                                             │
  │  Props 接收：                                               │
  │    admin          — 高级设置对象（管理员权限、计划任务等）  │
  │    appInfo        — 主进程采集的系统信息（isAdmin、路径等   │
  │    updateLoading  — 是否正在检查更新                        │
  │    updateStatus   — 更新状态字符串（update / error / ''）   │
  │    updateTitle    — 更新结果标题                            │
  │    updateDetail   — 更新结果详情                            │
  │                                                             │
  │  Emits 发送：                                               │
  │    update:admin       — 修改高级设置（Vue v-model 协议）    │
  │    create-startup-task — 创建/更新 Windows 计划任务         │
  │    admin-elevate      — 请求管理员权限重启                  │
  │    restart            — 普通重启应用                        │
  │    check-update       — 触发更新检查                        │
  │    reset-config       — 确认重置所有配置（二次确认后触发）  │
  │    show-in-explorer   — 在资源管理器中打开配置文件所在目录  │
  └─────────────────────────────────────────────────────────────┘

================================================================================
  三、主题与样式
================================================================================
  主题色：紫 #aa88dd，通过 tabTheme 变量传给 UiSwitch。
  滚动条按组件独立着色（rgba(170,136,221,*) 系列）。

================================================================================
  四、关键实现细节
================================================================================
  - "重置所有配置"按钮为红色警告样式（.adv-btn-danger），点击后弹出确认 Dialog
  - Dialog 使用 Vue <Transition> 实现飞入飞出动画
  - 文件选取通过 window.configPanelApi.pickExeFile() 调用主进程文件对话框
  - 图形后端选择使用 UiDropdown 组件
  - v-click-outside 指令用于自定义下拉的点击外部关闭

================================================================================
  五、维护注意事项
================================================================================
  - 新增配置项时，需同时在父组件 ConfigPanel.vue 的 draft 中初始化对应字段
  - emit 事件名需与父组件的 @event-name 监听器保持一致
  - 不要在此组件中直接修改 props，始终通过 emit('update:admin', ...) 上报

  最后更新：2026-07-21
================================================================================
-->

<template>
  <div class="tab-page">
    <!--
      一、开机自启
      通过 Windows 任务计划程序（Task Scheduler）实现登录时自动启动
    -->
    <UiCard title="开机自启" desc="通过 Windows 计划任务实现自动启动">

      <!-- 程序路径：文本输入框 + 选取按钮 -->
      <UiConfigRow label="程序路径" hint="蔚蓝点名 可执行文件(.exe)的完整绝对路径" stack>
        <div class="adv-input-row">
          <input
            type="text"
            :value="admin.adminAutoStartPath"
            @input="$emit('update:admin', { ...admin, adminAutoStartPath: $event.target.value })"
            class="adv-input"
            placeholder="留空则自动检测"
          />
          <button class="adv-btn adv-btn-sm" @click="pickExePath"><i class="fa-regular fa-folder"></i> 选取</button>
        </div>
      </UiConfigRow>

      <!-- 计划任务名 -->
      <UiConfigRow label="计划任务名" hint="在 Windows 任务计划程序中的显示名称" stack>
        <input
          type="text"
          :value="admin.adminAutoStartTaskName"
          @input="$emit('update:admin', { ...admin, adminAutoStartTaskName: $event.target.value })"
          class="adv-input"
          placeholder="Blue Random (Admin)"
        />
      </UiConfigRow>

      <!-- 管理员运行开关 + 创建任务按钮 -->
      <UiConfigRow label="以管理员身份运行" hint="启动时自动获取管理员权限">
        <UiSwitch :modelValue="admin.adminAutoStartAdmin !== false" :color="tabTheme" @update:modelValue="$emit('update:admin', { ...admin, adminAutoStartAdmin: $event })" />
      </UiConfigRow>
      <div style="border-top: 1px solid var(--c-border); padding-top: 16px; display: flex; justify-content: flex-end;">
        <button class="adv-btn" @click="handleCreateTask"><i class="fa-solid fa-shield-halved"></i> 创建/更新计划任务(需要管理员权限)</button>
      </div>
    </UiCard>

    <!-- 二、置顶增强 -->
    <UiCard title="置顶增强" desc='级高级别的置顶功能，需管理员权限，并且需要先启动悬浮按钮置顶功能'>

      <!-- UIAccess 置顶：仅当进程已是管理员时显示 -->
      <UiConfigRow v-if="appInfo.isAdmin" label="UIAccess 置顶" hint="系统级置顶权限，可覆盖绝大部分应用">
        <UiSwitch :modelValue="admin.uiAccessEnabled" :color="tabTheme" @update:modelValue="$emit('update:admin', { ...admin, uiAccessEnabled: $event })" />
      </UiConfigRow>
      <div v-if="!appInfo.uiAccessDllExists && admin.uiAccessEnabled" class="cfg-hint warn">
      <i class="fa-regular fa-circle-xmark"></i> 未检测到 uiaccess.dll，UIAccess 功能将不可用，请检查程序完整性。
      </div>
      <div v-if="appInfo.uiAccessDllExists && admin.uiAccessEnabled" class="cfg-hint success">
      <i class="fa-regular fa-circle-check"></i> UIAccess 功能可用。
      </div>
    </UiCard>

    <!-- 三、渲染后端 -->
    <UiCard title="渲染后端" desc="切换 Chromium 图形后端，需重启生效。通常情况下，D3D9作为后端可以获得最佳的性能和兼容性。如果遇到渲染问题可尝试更改此处的选项。">

      <UiConfigRow label="图形后端" hint="通常情况下推荐选择D3D9作为渲染后端。Vulkan / OpenGL 可能存在性能问题。需要重启。">
        <UiDropdown v-model="renderingBackend" :options="backendOptions" :color="tabTheme" />
      </UiConfigRow>

      <UiConfigRow label="禁用直接合成" hint="禁用直接合成(启用开关)可能有助于解决某些渲染问题。重启生效。">
        <UiSwitch :modelValue="admin.disableDirectComposition !== false" :color="tabTheme" @update:modelValue="$emit('update:admin', { ...admin, disableDirectComposition: $event })" />
      </UiConfigRow>

      <UiConfigRow label="禁用 GPU 加速" hint="启用后完全回退到 CPU 软件渲染。仅用于排查兼容性问题，日常使用不建议开启。重启生效。">
        <UiSwitch :modelValue="admin.disableHardwareAcceleration === true" :color="tabTheme" @update:modelValue="$emit('update:admin', { ...admin, disableHardwareAcceleration: $event })" />
      </UiConfigRow>
    </UiCard>

    <!-- 四、配置管理 -->
    <UiCard title="配置管理" desc="管理配置文件和应用状态">

      <!-- 配置文件路径 + 打开目录按钮 -->
      <UiConfigRow label="配置文件" :hint="appInfo.configPath || '未获取'">
        <button class="adv-btn adv-btn-sm" @click="$emit('show-in-explorer')">打开 <i class="fa-solid fa-up-right-from-square"></i></button>
      </UiConfigRow>

      <!-- 操作按钮组 -->
      <div style="border-top: 1px solid var(--c-border); padding-top: 16px; display: flex; justify-content: flex-end;">
        <div class="adv-btn-group">
          <button class="adv-btn adv-btn-danger" @click="showResetDialog = true"><i class="fa-solid fa-eraser"></i> 重置所有配置</button>
          <button class="adv-btn" @click="$emit('restart')"><i class="fa-solid fa-rotate"> </i> 重启应用</button>
          <button class="adv-btn" @click="$emit('admin-elevate')"><i class="fa-solid fa-shield-halved"></i><i class="fa-solid fa-rotate"></i> 管理员重启（需要管理员权限）</button>
        </div>
      </div>
    </UiCard>

    <!-- 五、检查更新 -->
    <UiCard title="检查更新" desc="从 GitHub Releases 检查是否有新版本">
      <div style="padding: 8px 0;">
        <button
          class="adv-btn adv-btn-full"
          :disabled="updateLoading"
          @click="$emit('check-update')"
        >
          {{ updateLoading ? '检查中…' : '立即检查更新' }}
        </button>
      </div>
      <div v-if="updateStatus" class="cfg-hint" :class="updateStatus">{{ updateTitle }}</div>
      <div v-if="updateDetail" class="update-detail-text">{{ updateDetail }}</div>
    </UiCard>

    <!-- 重置确认 Dialog -->
    <UiDialog v-model:show="showResetDialog" title="确认重置" :color="tabTheme" teleport=".config-left">
      <p>此操作将清空所有配置并恢复为默认值，<br>包括名单、权重、自定义设置等。此操作不可撤销。</p>
      <template #footer>
        <button class="adv-btn adv-btn-outline" @click="showResetDialog = false">取消</button>
        <button class="adv-btn adv-btn-danger" @click="confirmReset">确认重置</button>
      </template>
    </UiDialog>

    <!-- 计划任务结果 Dialog -->
    <UiDialog v-model:show="showTaskDialog" :title="taskDialogTitle" :color="tabTheme" teleport=".config-left">
      <p>{{ taskDialogMsg }}</p>
      <template #footer>
        <button class="adv-btn" @click="showTaskDialog = false">确定</button>
      </template>
    </UiDialog>
  </div>
</template>

<script setup>
// ============================================================
//  导入依赖
//  ref      — 创建响应式变量（值变化时自动更新界面）
//  onMounted — 组件挂载完成后的生命周期钩子
// ============================================================
import { ref, computed, onMounted } from 'vue'
import { UiCard, UiConfigRow, UiSwitch, UiDialog, UiDropdown } from '../RizUI'

/* Tab 主题色 */
const tabTheme = '#aa88dd'

// ============================================================
//  Props 定义（从父组件 ConfigPanel.vue 接收的数据）
//  注意：props 是只读的，不能直接修改！
//  要修改配置，必须通过 emit('update:admin', 新对象) 上报
// ============================================================
const props = defineProps({
  /*
   * admin — 高级设置对象
   * 包含管理员权限、计划任务、UIAccess 等高级配置
   * 常用字段：adminAutoStartPath, adminAutoStartTaskName,
   *           adminAutoStartAdmin, uiAccessEnabled,
   *           renderingBackend, disableDirectComposition,
   *           disableHardwareAcceleration
   */
  admin: Object,

  /*
   * appInfo — 主进程采集的系统信息
   * 字段：isAdmin（是否管理员）, isUiAccess（是否 UIAccess 模式）,
   *       isWindows（是否 Windows）, uiAccessDllExists（DLL 是否存在）,
   *       configPath（配置文件路径）, configDir（配置目录）,
   *       exePath（程序自身路径）, version（应用版本号）
   */
  appInfo: Object,

  /* updateLoading — 是否正在向 GitHub 请求版本信息 */
  updateLoading: Boolean,

  /* updateStatus — 更新结果类型：'update'（有新版本）/ 'error'（出错）/ ''（无结果） */
  updateStatus: String,

  /* updateTitle — 更新结果的标题文字 */
  updateTitle: String,

  /* updateDetail — 更新结果的详细说明（支持换行） */
  updateDetail: String
})

// ============================================================
//  Emits 定义（向父组件发送事件）
//  Vue 3 中 emit 必须提前声明，否则会有运行时警告
// ============================================================
const emit = defineEmits([
  /*
   * update:admin — 修改高级设置（Vue v-model 协议）
   * payload: 新的完整 admin 对象
   * 用法：emit('update:admin', { ...props.admin, 字段: 新值 })
   * 注意：必须展开原对象再覆盖，否则会丢失其他字段
   */
  'update:admin',

  /* open-config-file — 用系统默认编辑器打开配置文件 */
  'open-config-file',

  /* open-config-dir — 打开配置目录（备用） */
  'open-config-dir',

  /* admin-elevate — 请求以管理员权限重新启动应用 */
  'admin-elevate',

  /* restart — 普通重启应用 */
  'restart',

  /* create-startup-task — 创建或更新 Windows 计划任务 */
  'create-startup-task',

  /* check-update — 触发 GitHub Releases 版本检查 */
  'check-update',

  /* reset-config — 确认重置所有配置（对话框确认后触发） */
  'reset-config',

  /* show-in-explorer — 在文件资源管理器中打开配置文件所在目录 */
  'show-in-explorer'
])

// ============================================================
//  状态与生命周期
// ============================================================

// ============================================================
//  自定义下拉框（替代原生 <select>）
//
//  使用 div + button 实现，配合 v-click-outside 指令。
//  下拉面板使用 Vue <Transition name="drop-pop"> 动画。
// ============================================================

/* 渲染后端下拉选项 */
const backendOptions = [
  { value: 'd3d9', label: 'D3D9 (默认)' },
  { value: 'vulkan', label: 'Vulkan' },
  { value: 'gl', label: 'OpenGL' }
]

/* v-model 桥接：props.admin.renderingBackend ↔ UiDropdown */
const renderingBackend = computed({
  get: () => props.admin.renderingBackend || 'd3d9',
  set: (val) => emit('update:admin', { ...props.admin, renderingBackend: val })
})

/*
 * v-click-outside 自定义指令
 * 点击/触摸元素外部时触发回调，用于关闭下拉面板。
 * 同时监听 mousedown 和 touchstart，捕获阶段确保不被 stopPropagation 阻止。

// ============================================================
//  函数：confirmReset — 确认重置配置
// ============================================================
/*
 * 功能：关闭确认对话框，并向父组件发送重置指令。
 *
 * 调用时机：用户在"确认重置"Dialog 中点击"确认重置"按钮时触发。
 *
 * 执行流程：
 *   1. 关闭 Dialog（showResetDialog.value = false）
 *   2. emit('reset-config') → 父组件收到后执行实际重置逻辑（TODO）
 *
 * 注意：
 *   - 当前父组件的重置逻辑尚未实现（标记 TODO），emit 后仅关闭对话框。
 *   - 不要在此函数中直接修改 props.admin，
 *     重置逻辑应由父组件统一处理。
 */

/* showResetDialog — 控制重置确认对话框的显示/隐藏 */
const showResetDialog = ref(false)

function confirmReset() {
  showResetDialog.value = false
  emit('reset-config')
}

/* ---- 计划任务创建结果 ---- */
const showTaskDialog = ref(false)
const taskDialogTitle = ref('')
const taskDialogMsg = ref('')

async function handleCreateTask() {
  try {
    const result = await window.configPanelApi?.createStartupTask({
      exePath: props.admin.adminAutoStartPath || props.appInfo.exePath,
      taskName: props.admin.adminAutoStartTaskName,
      admin: props.admin.adminAutoStartAdmin
    })
    if (!result) return
    taskDialogTitle.value = result.ok ? '创建成功' : '创建失败'
    taskDialogMsg.value = result.message || (result.ok ? '计划任务已创建/更新。' : '未知错误')
  } catch (e) {
    taskDialogTitle.value = '创建失败'
    taskDialogMsg.value = e?.message || String(e)
  }
  showTaskDialog.value = true
}

// ============================================================
//  函数：pickExePath — 选取可执行文件路径
// ============================================================
/*
 * 功能：打开系统原生文件选择对话框，让用户选取一个 .exe 文件，
 *       选中后将路径自动填入"程序路径"文本框。
 *
 * 调用时机：用户在"程序路径"行点击"选取"按钮时触发。
 *
 * 执行流程：
 *   1. 调用 window.configPanelApi.pickExeFile()
 *      → 通过 IPC 通知主进程打开文件对话框
 *      → 主进程调用 Electron dialog.showOpenDialog()，筛选 .exe 文件
 *      → 返回选中文件的完整路径（用户取消则返回 null）
 *   2. 如果选中了文件（filePath 不为 null/空）：
 *      emit('update:admin', { ...props.admin, adminAutoStartPath: filePath })
 *      → 将路径更新到 admin.adminAutoStartPath
 *
 * 注意：
 *   - 这是一个 async 函数，因为 IPC 调用是异步的（需要等待用户操作对话框）
 *   - 使用扩展运算符 ...props.admin 创建新对象，
 *     确保 Vue 能检测到数据变化（响应式要求）
 *   - 如果用户在对话框中点击"取消"，不做任何操作
 *   - window.configPanelApi 由 preload.js 通过 contextBridge 注入，
 *     如果 API 不可用（如非 Electron 环境），调用会报错
 */
async function pickExePath() {
  // 调用主进程文件对话框，等待用户选择
  const filePath = await window.configPanelApi.pickExeFile()
  // 用户取消选择时 filePath 为 null，跳过更新
  if (filePath) {
    emit('update:admin', { ...props.admin, adminAutoStartPath: filePath })
  }
}
</script>

<style scoped>
/* =================================================================
   主题色：紫 #aa88dd
   本文件所有颜色均硬编码，不依赖外部 CSS 变量。
   修改主题色时需同步替换所有 #aa88dd 及 rgba(170,136,221,*)。
   ================================================================= */

/* =================================================================
   1. 页面进入动画
   ================================================================= */
.tab-page {
  animation: slide-in 0.3s cubic-bezier(0.25, 0, 0.25, 1);
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* =================================================================
   2. 自定义滚动条（整个 Tab 页面）
   使用主题色半透明，与卡片风格协调。
   ================================================================= */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(170, 136, 221, 0.35);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(170, 136, 221, 0.55);
}

::-webkit-scrollbar-button {
  display: none;
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* 通用提示信息 */
.cfg-hint {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

/* 警告提示（橙色） */
.cfg-hint.warn {
  color: #e80;
}

/* 更新成功提示（绿色） */
.cfg-hint.update {
  color: #4a8;
}

/* 更新失败提示（红色） */
.cfg-hint.error {
  color: #d44;
}

/* 更新详情的多行文本 */
.update-detail-text {
  font-size: 12px;
  color: #888;
  white-space: pre-wrap;
  margin-top: 4px;
}

/* =================================================================
   5. 输入框
   ================================================================= */
.adv-input {
  width: 100%;
  padding: 6px 10px;
  border: 1.5px solid #d0d8e0;
  border-radius: 999px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}

.adv-input:focus {
  border-color: #aa88dd;
}

/* 输入框 + 选取按钮的水平布局 */
.adv-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.adv-input-row .adv-input {
  flex: 1;
}

.adv-input-row .adv-btn-sm {
  flex-shrink: 0;
}

/* =================================================================
   6. 按钮
   圆角胶囊按钮，主题色填充。
   变体：sm（小号）/ full（通栏）/ outline（线框）/ danger（危险）
   ================================================================= */

/* 基础按钮 */
.adv-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 999px;
  background: #aa88dd;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: filter 0.2s;
}

.adv-btn:hover {
  filter: brightness(1.08);
}

.adv-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: none;
}

/* 小号按钮（如"选取"、"打开 →"） */
.adv-btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

/* 通栏按钮（宽度撑满父容器，如"立即检查更新"） */
.adv-btn-full {
  width: 100%;
  padding: 8px 16px;
  font-size: 13px;
}

/* 线框按钮（白色背景 + 边框，用于取消等次要操作） */
.adv-btn-outline {
  background: #fff;
  color: #888;
  border: 1px solid #ddd;
}

.adv-btn-outline:hover {
  border-color: #aa88dd;
  color: #aa88dd;
  filter: none;
}

/* 危险按钮（红色背景，用于重置等破坏性操作） */
.adv-btn-danger {
  background: #e05555;
}

.adv-btn-danger:hover {
  background: #d04444;
  filter: none;
}

/* 按钮组（多个按钮水平排列） */
.adv-btn-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* =================================================================
   8. 关于板块
   ================================================================= */
.about-section {
  font-size: 12px;
  color: #667;
  line-height: 2;
}

.about-item {
  margin: 2px 0;
}

/* 标签列（如"界面字体"、"源码许可"等） */
.about-label {
  display: inline-block;
  min-width: 60px;
  color: #99a;
}

/* 关于板块中的链接 */
.about-section a {
  color: #aa88dd;
  text-decoration: none;
  transition: color 0.15s;
}

.about-section a:hover {
  color: #8866bb;
}

/* 版权声明文字（更小、更淡） */
.about-copyright {
  margin-top: 8px;
  color: #aaa;
  font-size: 11px;
}

</style>
