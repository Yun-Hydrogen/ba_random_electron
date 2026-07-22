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
  - 图形后端选择使用自定义下拉组件（cfg-dropdown），替代原生 <select>
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
    <UiCard title="开机自启" desc="通过 Windows 计划任务实现登录时自动启动">

      <!-- 程序路径：文本输入框 + 选取按钮 -->
      <UiConfigRow label="程序路径" hint="可执行文件(.exe)的完整路径" stack>
        <div class="adv-input-row">
          <input
            type="text"
            :value="admin.adminAutoStartPath"
            @input="$emit('update:admin', { ...admin, adminAutoStartPath: $event.target.value })"
            class="adv-input"
            placeholder="留空则自动检测"
          />
          <button class="adv-btn adv-btn-sm" @click="pickExePath">选取</button>
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
      <UiConfigRow label="以管理员身份运行" hint="计划任务触发时自动获取管理员权限">
        <UiSwitch :modelValue="admin.adminAutoStartAdmin !== false" :color="tabTheme" @update:modelValue="$emit('update:admin', { ...admin, adminAutoStartAdmin: $event })" />
      </UiConfigRow>
      <div style="border-top: 1px solid var(--c-border); padding-top: 16px; display: flex; justify-content: flex-end;">
        <button class="adv-btn" @click="$emit('create-startup-task')">创建 / 更新计划任务</button>
      </div>
    </UiCard>

    <!-- 二、置顶增强 -->
    <UiCard title="置顶增强" desc='系统级置顶权限（基本置顶请在"悬浮按钮"标签页设置）'>

      <!-- UIAccess 置顶：仅当进程已是管理员时显示 -->
      <UiConfigRow v-if="appInfo.isAdmin" label="UIAccess 置顶" hint="系统级置顶权限，可覆盖锁屏/UAC/独占全屏，需要 UIAccess DLL 支持">
        <UiSwitch :modelValue="admin.uiAccessEnabled" :color="tabTheme" @update:modelValue="$emit('update:admin', { ...admin, uiAccessEnabled: $event })" />
      </UiConfigRow>
      <div v-if="!appInfo.uiAccessDllExists && admin.uiAccessEnabled" class="cfg-hint warn">
        ⚠ 未检测到 uiaccess.dll，UIAccess 功能将不可用
      </div>
    </UiCard>

    <!-- 三、渲染后端 -->
    <UiCard title="渲染后端" desc="切换 Chromium 图形后端，需重启生效。通常情况下，D3D9作为后端可以获得最佳的性能和兼容性。如果遇到渲染问题可尝试更改此处的选项。">

      <UiConfigRow label="图形后端" hint="通常情况下推荐选择D3D9作为渲染后端。Vulkan / OpenGL 可能存在性能问题。需要重启。">
        <!-- 自定义下拉框 -->
        <div class="cfg-dropdown" :class="{ 'is-open': backendOpen }" v-click-outside="() => backendOpen = false">
          <button class="cfg-dropdown-trigger" @click="backendOpen = !backendOpen" type="button">
            <span>{{ backendLabel }}</span>
            <svg class="cfg-dropdown-arrow" viewBox="0 0 12 7" width="10" height="6"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
          </button>
          <transition name="drop-pop">
            <div v-if="backendOpen" class="cfg-dropdown-drop">
              <button
                v-for="opt in backendOptions"
                :key="opt.value"
                class="cfg-dropdown-opt"
                :class="{ active: (admin.renderingBackend || 'd3d9') === opt.value }"
                @click="selectBackend(opt.value)"
                type="button"
              >{{ opt.label }}</button>
            </div>
          </transition>
        </div>
      </UiConfigRow>

      <UiConfigRow label="禁用直接合成" hint="对于D3D9后端，禁用直接合成(启用开关)可能有助于解决某些渲染问题。重启生效。">
        <UiSwitch :modelValue="admin.disableDirectComposition !== false" :color="tabTheme" @update:modelValue="$emit('update:admin', { ...admin, disableDirectComposition: $event })" />
      </UiConfigRow>

      <UiConfigRow label="放弃 GPU 加速" hint="启用后完全回退到 CPU 软件渲染（包括动画、WebGL 等全部由 CPU 计算）。仅用于排查兼容性问题，日常使用不建议开启。重启生效。">
        <UiSwitch :modelValue="admin.disableHardwareAcceleration === true" :color="tabTheme" @update:modelValue="$emit('update:admin', { ...admin, disableHardwareAcceleration: $event })" />
      </UiConfigRow>
    </UiCard>

    <!-- 四、配置管理 -->
    <UiCard title="配置管理" desc="管理配置文件和应用状态">

      <!-- 配置文件路径 + 打开目录按钮 -->
      <UiConfigRow label="配置文件" :hint="appInfo.configPath || '未获取'">
        <button class="adv-btn adv-btn-sm" @click="$emit('show-in-explorer')">打开 →</button>
      </UiConfigRow>

      <!-- 操作按钮组 -->
      <div style="border-top: 1px solid var(--c-border); padding-top: 16px; display: flex; justify-content: flex-end;">
        <div class="adv-btn-group">
          <button class="adv-btn adv-btn-danger" @click="showResetDialog = true">重置所有配置</button>
          <button class="adv-btn" @click="$emit('restart')">重启应用</button>
          <button class="adv-btn" @click="$emit('admin-elevate')">管理员重启</button>
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

    <!--
      重置确认 Dialog
      使用 Vue <Transition> 包裹，实现飞入飞出动画
      点击遮罩层或关闭按钮可取消，点击"确认重置"触发 emit('reset-config')
    -->
    <Transition name="dialog">
      <div v-if="showResetDialog" class="dialog-overlay" @click.self="showResetDialog = false">
        <div class="dialog-box">
          <div class="dialog-header">
            <span>⚠ 确认重置</span>
            <button class="dialog-close" @click="showResetDialog = false">✕</button>
          </div>
          <p class="dialog-body">
            此操作将清空所有配置并恢复为默认值，包括名单、权重、自定义设置等。此操作不可撤销。
          </p>
          <div class="dialog-footer">
            <button class="adv-btn adv-btn-outline" @click="showResetDialog = false">取消</button>
            <button class="adv-btn adv-btn-danger" @click="confirmReset">确认重置</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
// ============================================================
//  导入依赖
//  ref      — 创建响应式变量（值变化时自动更新界面）
//  onMounted — 组件挂载完成后的生命周期钩子
// ============================================================
import { ref, computed, onMounted } from 'vue'
import { UiCard, UiConfigRow, UiSwitch } from '../RizUI'

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

/* 下拉框展开/关闭状态 */
const backendOpen = ref(false)

/* 可选的渲染后端列表 */
const backendOptions = [
  { value: 'd3d9', label: 'D3D9 (默认)' },
  { value: 'vulkan', label: 'Vulkan' },
  { value: 'gl', label: 'OpenGL' }
]

/* 当前选中后端的显示文本 */
const backendLabel = computed(() => {
  const val = props.admin.renderingBackend || 'd3d9'
  const opt = backendOptions.find(o => o.value === val)
  return opt ? opt.label : val
})

/* 选择后端：emit 更新 + 关闭下拉 */
function selectBackend(value) {
  emit('update:admin', { ...props.admin, renderingBackend: value })
  backendOpen.value = false
}

/*
 * v-click-outside 自定义指令
 * 点击/触摸元素外部时触发回调，用于关闭下拉面板。
 * 同时监听 mousedown 和 touchstart，捕获阶段确保不被 stopPropagation 阻止。
 */
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value()
      }
    }
    document.addEventListener('mousedown', el._clickOutside, true)
    document.addEventListener('touchstart', el._clickOutside, true)
  },
  unmounted(el) {
    document.removeEventListener('mousedown', el._clickOutside, true)
    document.removeEventListener('touchstart', el._clickOutside, true)
  }
}

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
  // 关闭 Dialog
  showResetDialog.value = false
  // 通知父组件执行重置（具体逻辑在父组件中实现）
  emit('reset-config')
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

/* 自定义下拉选择器 */
.cfg-dropdown {
  position: relative;
  min-width: 170px;
  user-select: none;
}
.cfg-dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: 1.5px solid #ccd;
  border-radius: 999px;
  background: #fff;
  color: #445;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.cfg-dropdown.is-open .cfg-dropdown-trigger,
.cfg-dropdown-trigger:hover {
  border-color: #aa88dd;
}

.cfg-dropdown-arrow {
  flex-shrink: 0;
  color: #99a;
  transition: transform 0.2s;
}
.cfg-dropdown.is-open .cfg-dropdown-arrow {
  transform: rotate(180deg);
  color: #aa88dd;
}
.cfg-dropdown-drop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  border: 1.5px solid #e8e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(80,60,120,0.12);
  overflow: hidden;
  padding: 4px;
}
.cfg-dropdown-opt {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #445;
  font-size: 13px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.14s, color 0.14s;
}
.cfg-dropdown-opt:hover {
  background: rgba(170,136,221,0.1);
  color: #aa88dd;
}
.cfg-dropdown-opt.active {
  background: rgba(170,136,221,0.15);
  color: #aa88dd;
  font-weight: 600;
}

/* 下拉动画 */
.drop-pop-enter-active { animation: drop-in 0.18s ease-out; }
.drop-pop-leave-active { animation: drop-in 0.12s ease-in reverse; }
@keyframes drop-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
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

/* =================================================================
   9. 确认 Dialog
   固定定位的模态对话框，带飞入飞出动画。
   ================================================================= */

/* 遮罩层：覆盖全屏，点击关闭 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 对话框本体 */
.dialog-box {
  background: #fff;
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  width: 340px;
}

/* 标题栏（标题 + 关闭按钮） */
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #444;
}

/* 关闭按钮（右上角 ✕） */
.dialog-close {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: #f0f2f5;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.dialog-close:hover {
  background: #e55;
  color: #fff;
}

/* 对话框正文 */
.dialog-body {
  font-size: 13px;
  color: #667;
  line-height: 1.6;
  margin: 0 0 16px;
}

/* 底部按钮区（右对齐） */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* =================================================================
   10. Dialog 飞入飞出动画（Vue <Transition>）
   进入：从下方 40px 弹入 + 淡入（0.25s）
   离开：向下方 20px 滑出 + 淡出（0.18s）
   ================================================================= */
.dialog-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.dialog-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.dialog-enter-from {
  opacity: 0;
  transform: translateY(40px);
}

.dialog-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
