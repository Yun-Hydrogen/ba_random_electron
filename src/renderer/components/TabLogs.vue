<!--
  组件：TabLogs.vue
  所属：配置面板 - 日志输出 Tab
  父组件：ConfigPanel.vue（通过 props 传入应用信息）

  功能概述：
    1. 实时日志流 —— 通过 SSE（Server-Sent Events）连接到主进程的 /api/logs 端点
    2. 日志展示 —— 按时间倒序显示，最新日志在最上方
    3. 日志清空 —— 一键清除当前显示的所有日志

  数据流：
    父组件传入 appInfo（包含 isAdmin、isUiAccess、version 等只读信息）
    日志数据完全由本组件内部管理，不需要向父组件回传
    SSE 连接在组件挂载时建立，卸载时关闭，防止内存泄漏

  日志级别与颜色对照：
    info    → 时间青色 #99ccdd，消息深灰 #556
    warn    → 时间琥珀 #e8a840，消息棕色 #a07030
    error   → 时间红色 #e05555，消息红色 #c04040
    success → 时间绿色 #55b888，消息绿色 #3a8050

  注意事项：
    - 日志最多保留 200 条，超出时自动丢弃最旧的
    - SSE 连接断开后需要手动刷新页面重连（当前未实现自动重连）
    - 日志内容在接收到时解析 JSON，解析失败则静默丢弃
    - 组件卸载时必须关闭 SSE 连接，否则会泄漏
-->

<template>
  <div class="tab-page">
    <div class="card">
      <div class="log-head">
        <span class="log-head-title">运行日志</span>
        <span class="log-badge" v-if="appInfo.isAdmin">管理员</span>
        <span class="log-badge" v-if="appInfo.isUiAccess">UIAccess</span>
        <span class="log-badge log-badge-ver">v{{ appInfo.version }}</span>
        <div class="log-head-spacer"></div>
        <button class="log-clear-btn" @click="clearLogs">清空</button>
      </div>
      <div class="log-list">
        <div v-if="logs.length === 0" class="log-empty">暂无日志</div>
        <div v-for="item in logs" :key="item.id" class="log-row" :class="'log-' + item.level">
          <span class="log-time">{{ item.time }}</span>
          <span class="log-msg">{{ item.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/*
 *  组件逻辑概览（按代码顺序）：
 *  1. props       —— 接收父组件传入的应用信息
 *  2. 日志存储    —— 日志数组的管理（增/删/限长）
 *  3. SSE 连接    —— 建立与主进程的实时日志推送连接
 *  4. 清空日志    —— 清除所有日志并记录一条清空操作
 *  5. 生命周期    —— 挂载时连接 SSE，卸载时断开
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

/*
 *  props：父组件传入的数据（只读，本组件不修改）
 *  appInfo.isAdmin    —— 当前是否以管理员权限运行
 *  appInfo.isUiAccess —— 是否启用了 UIAccess 置顶增强
 *  appInfo.version    —— 应用版本号
 */
defineProps({ appInfo: Object })

// ================================================================
//  1. 日志存储与管理
// ================================================================

/*
 *  logs —— 日志数组（响应式），每条日志包含：
 *    id    : 唯一标识（时间戳 + 自增序号，用于 Vue 的 :key）
 *    level : 日志级别（'info' | 'warn' | 'error' | 'success'）
 *    text  : 日志正文
 *    time  : 格式化时间字符串（HH:mm:ss）
 */
const logs = ref([])

/*
 *  logSeed —— 自增计数器，与时间戳组合生成唯一 ID
 *  用 let 而非 ref，因为这是纯内部状态，不需要触发 UI 更新
 */
let logSeed = 0

/*
 *  logSource —— SSE 连接对象引用
 *  存储在模块作用域以便在组件卸载时关闭
 */
let logSource = null

/*
 *  向日志列表添加一条新日志
 *  参数 level —— 日志级别字符串
 *  参数 text —— 日志正文
 *  参数 timeOverride —— 可选的时间字符串，不传则自动生成当前时间
 *  新日志插入到数组最前面（unshift），保证最新的在上面
 *  超过 200 条时自动截断，防止内存无限增长
 *  注意：id 由时间戳 + 递增序号组成，确保同一毫秒内多条日志不重复
 */
function addLog(level, text, timeOverride) {
  const time = timeOverride || new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.unshift({ id: `${Date.now()}-${logSeed++}`, level, text, time })
  if (logs.value.length > 200) logs.value.length = 200
}

// ================================================================
//  2. SSE 实时日志流
// ================================================================

/*
 *  建立与主进程的 SSE 连接，接收实时日志推送
 *  连接地址：/api/logs（开发环境通过 Vite 代理转发到 localhost:21219）
 *  每次调用前先关闭已有连接（如果存在），避免重复连接
 *  主进程发送的每条数据都是 JSON 格式：{ level, text, time }
 *  解析失败时静默丢弃（catch 块为空），不影响其他功能
 */
function startLogStream() {
  if (logSource) logSource.close()
  logSource = new EventSource('/api/logs')
  logSource.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data)
      addLog(
        d.level || 'info',
        d.text || '',
        d.time ? new Date(d.time).toLocaleTimeString('zh-CN', { hour12: false }) : undefined
      )
    } catch {}
  }
}

// ================================================================
//  3. 清空日志
// ================================================================

/*
 *  清除所有日志，并添加一条"日志已清空"的记录
 *  注意：只清空前端显示的数组，不影响主进程的日志缓冲区
 */
function clearLogs() {
  logs.value = []
  addLog('info', '日志已清空')
}

// ================================================================
//  4. 生命周期钩子
// ================================================================

/*
 *  组件挂载时：立即建立 SSE 连接，开始接收日志
 *  组件卸载前：关闭 SSE 连接，释放资源
 *  如果不在卸载时关闭，连接会继续存活并尝试回调已销毁的组件，导致内存泄漏
 */
onMounted(() => startLogStream())
onBeforeUnmount(() => {
  if (logSource) {
    logSource.close()
    logSource = null
  }
})
</script>

<style scoped>
/*
 *  本组件完整样式表
 *  主题色：灰蓝 #99aabb
 *  所有颜色直接硬编码，不使用 CSS 变量以提升性能
 */

/* ===== 全局动画 ===== */
.tab-page {
  animation: slide-in 0.3s cubic-bezier(0.25, 0, 0.25, 1);
}
@keyframes slide-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ===== 滚动条（主题色 #99aabb） ===== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(153, 170, 187, 0.35);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(153, 170, 187, 0.55);
}
::-webkit-scrollbar-button {
  display: none;
}
::-webkit-scrollbar-corner {
  background: transparent;
}

/* ===== 卡片 ===== */
.card {
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e8ecf2;
}

/* ===== 日志头部（标题 + 状态徽章 + 清空按钮） ===== */
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
  background: #99aabb;
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

/* ===== 日志列表 ===== */
.log-list {
  overflow-y: auto;
  font-size: 12px;
  font-family: 'UI', 'Bahnschrift', 'Microsoft YaHei UI', sans-serif;
  user-select: text;
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

/*
 *  时间戳颜色按日志级别区分（取代彩色圆点）
 *  默认灰色 #b0b8c0，各级别覆盖为对应颜色
 */
.log-time {
  white-space: nowrap;
  flex-shrink: 0;
  font-size: 11px;
  color: #b0b8c0;
}
.log-info .log-time    { color: #99ccdd; }
.log-warn .log-time    { color: #e8a840; }
.log-error .log-time   { color: #e05555; }
.log-success .log-time { color: #55b888; }

/*
 *  消息正文颜色
 *  默认深灰 #556，warn/error/success 级别有对应颜色
 */
.log-msg {
  word-break: break-all;
  color: #556;
  line-height: 1.5;
}
.log-warn .log-msg    { color: #a07030; }
.log-error .log-msg   { color: #c04040; }
.log-success .log-msg { color: #3a8050; }
</style>
