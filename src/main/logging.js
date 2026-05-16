/*
技术文档：src/main/logging.js
职责：主进程日志聚合与分发。

核心功能：
- 重写 console 输出并写入内存日志缓冲。
- 提供渲染进程日志上报入口（renderer:log）。
- 通过 SSE（/api/logs）向配置页实时推送日志。

维护建议：
- 调整日志格式时保持 pushLog 与 SSE 结构一致。
*/

// 内存日志缓冲，用于配置页实时查看
const LOG_BUFFER_LIMIT = 600;
const logBuffer = [];
const logClients = new Set();

// 写入日志并广播到 SSE 客户端
function pushLog(level, text) {
  const time = new Date().toISOString();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    text: String(text),
    time
  };
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_BUFFER_LIMIT);
  }

  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of logClients) {
    res.write(payload);
  }
}

// 重写 console 输出，统一进入日志缓冲
function attachConsoleLogger() {
  ['log', 'info', 'warn', 'error'].forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      const text = args.map(arg => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch (_error) {
          return String(arg);
        }
      }).join(' ');
      pushLog(method === 'log' ? 'info' : method, text);
      original(...args);
    };
  });
}

// 接收渲染进程日志
function registerRendererLogIpc(ipcMain) {
  ipcMain.on('renderer:log', (_event, payload) => {
    if (!payload || typeof payload.text !== 'string') return;
    const level = typeof payload.level === 'string' ? payload.level : 'info';
    pushLog(level, payload.text);
  });
}

// SSE 日志流（/api/logs）
function handleLogStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('\n');

  logClients.add(res);
  logBuffer.forEach((entry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  });

  req.on('close', () => {
    logClients.delete(res);
  });
}

module.exports = {
  attachConsoleLogger,
  handleLogStream,
  pushLog,
  registerRendererLogIpc
};
