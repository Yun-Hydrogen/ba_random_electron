/*
================================================================================
技术文档：src/main/logging.js
职责：应用日志的统一收集与分发。

================================================================================
架构概述
================================================================================
  日志来源有两个：
    1. 主进程：通过劫持 console.log/info/warn/error 自动捕获
    2. 渲染进程：通过 IPC 通道 renderer:log 主动上报

  所有日志统一写入内存环形缓冲区（logBuffer，最多 600 条），供调试使用。

  历史说明：
    旧版通过 SSE（Server-Sent Events over HTTP）向 Web 配置页推送日志。
    随着 config-server.js 被原生 IPC 配置面板取代，SSE 通道已于 2026-06-28 移除。
    如需在配置面板中查看日志，可通过 IPC 实现按需拉取。

================================================================================
核心函数一览
================================================================================
  函数                       | 作用
  ───────────────────────────┼──────────────────────────────────────────────
  pushLog(level, text)       | 将一条日志写入内存缓冲区
  attachConsoleLogger()      | 劫持 console，使所有主进程 console 调用自动入日志
  registerRendererLogIpc()   | 注册 IPC 通道，接收渲染进程上报的日志
================================================================================
*/
const LOG_BUFFER_LIMIT = 600;

/*
 * logBuffer —— 内存中的环形日志缓冲区。
 *
 * 每条日志格式：
 *   {
 *     id:    "1719552000000-a3f2c1",  // 时间戳 + 随机 hex（唯一标识）
 *     level: "info" | "warn" | "error", // 日志级别
 *     text:  "这里写日志正文",           // 日志内容
 *     time:  "2026-06-28T12:00:00.000Z" // ISO 8601 时间戳
 *   }
 *
 * 容量：最多 600 条。超出后从头部丢弃最旧的，保持最新 600 条。
 * 内存估算：600 × ~200 字节 ≈ 120KB。
 */
const logBuffer = [];

/*
 * pushLog(level, text) —— 写入一条日志到内存缓冲区。
 *
 * 参数：
 *   level — 日志级别字符串（'info' | 'warn' | 'error'）
 *   text  — 日志正文（任意类型，会转为字符串）
 *
 * 行为：
 *   1. 生成唯一 ID（时间戳 + 4 位随机 hex）
 *   2. 生成 ISO 8601 时间戳
 *   3. 追加到 logBuffer 尾部
 *   4. 若超出 600 条上限，丢弃最旧的
 *
 * 注意：
 *   - 此函数是同步的，不要在高频循环中调用（如每帧 60 次）
 *   - ID 中的 Math.random() 非加密安全，仅用于日志去重
 *
 * 历史：
 *   旧版在此函数中向 SSE 客户端广播日志。SSE 已于 2026-06-28 随
 *   config-server.js 移除而废弃。广播代码已删除，现仅写缓冲区。
 */
function pushLog(level, text) {
  const time = new Date().toISOString();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    text: String(text),
    time
  };
  logBuffer.push(entry);

  /* 环形缓冲区：超出上限时丢弃最旧的条目 */
  if (logBuffer.length > LOG_BUFFER_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_BUFFER_LIMIT);
  }
}

/*
 * attachConsoleLogger() —— 劫持全局 console 对象，捕获所有主进程日志。
 *
 * 这是整个日志系统工作的关键。它替换了 console.log / info / warn / error，
 * 使开发者正常使用 console 的同时，所有输出自动进入 logBuffer。
 *
 * 工作原理：
 *   1. 保存原始的 console[method] 引用
 *   2. 用新函数替换它：
 *      a. 将参数转为字符串
 *      b. 调用 pushLog 写入缓冲区
 *      c. 调用原始 console 方法，保持终端输出
 *
 * 参数序列化：
 *   字符串 → 直接拼接
 *   对象   → JSON.stringify() 序列化
 *   其他   → String() 强制转换
 *
 * 特殊处理：
 *   console.log 的日志级别映射为 'info'（因为 'log' 不是标准级别名）
 *
 * 调用位置：main.js 启动阶段，在 app.whenReady() 之前调用。
 *
 * 警告：
 *   - 不要在 pushLog 或原始 console 调用中再次触发 console 调用，
 *     会导致无限递归（虽然当前代码不会，但修改时需注意）
 *   - JSON.stringify 可能对循环引用对象抛出 TypeError，已被 try/catch 包裹
 */
function attachConsoleLogger() {
  /* 四种标准 console 方法 */
  ['log', 'info', 'warn', 'error'].forEach((method) => {
    /* 保存原始方法引用 —— .bind(console) 确保 this 指向正确 */
    const original = console[method].bind(console);

    /* 替换为新函数：...args 收集所有参数为数组 */
    console[method] = (...args) => {
      /* 将所有参数转为单个字符串，用空格连接 */
      const text = args.map(arg => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch (_error) {
          return String(arg);
        }
      }).join(' ');

      /* 写入日志缓冲（'log' 级别统一记为 'info'） */
      pushLog(method === 'log' ? 'info' : method, text);

      /* 调用原始的 console 方法，保持正常的终端输出 */
      original(...args);
    };
  });
}

/*
 * registerRendererLogIpc(ipcMain) —— 注册渲染进程日志上报通道。
 *
 * 渲染进程通过 window.logApi.send(level, text) 上报日志，
 * 经 preload.js → contextBridge → IPC → 本函数处理。
 *
 * IPC 通道：renderer:log（单向通知，由渲染进程 send，主进程 on 接收）
 *
 * 参数校验：
 *   - payload 必须是非空对象
 *   - payload.text 必须是字符串（忽略非字符串日志）
 *   - payload.level 默认 'info'
 *
 * 用途：
 *   渲染进程（Vue 组件）中的错误、警告可通过此通道统一收集到主进程日志缓冲。
 *   例如：axios 请求失败、Vue 组件异常、用户操作记录等。
 *
 * 调用位置：main.js 启动阶段，在注册 IPC 通道时调用。
 */
function registerRendererLogIpc(ipcMain) {
  ipcMain.on('renderer:log', (_event, payload) => {
    /* 防御性校验：忽略格式不正确的日志消息 */
    if (!payload || typeof payload.text !== 'string') return;
    const level = typeof payload.level === 'string' ? payload.level : 'info';
    pushLog(level, payload.text);
  });
}

// ============================================================================
//  导出 —— 供 main.js 使用
// ============================================================================
module.exports = {
  attachConsoleLogger,
  pushLog,
  registerRendererLogIpc
};
