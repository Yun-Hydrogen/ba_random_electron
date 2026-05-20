/*
技术文档：src/main/config-server.js
职责：本地配置 HTTP 服务。

核心功能：
- 提供 /api/config、/api/app-info、/api/check-update、/api/logs 等接口。
- 支持保存配置后刷新端口服务与窗口状态。
- 提供重启、管理员提升、计划任务创建等系统能力入口。
- 生产环境下托管 dist 静态资源，开发环境重定向到 Vite。

维护建议：
- 新增接口时保持统一 JSON 返回结构，避免分散在主入口文件。
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

// 本地配置服务实例
let configServer = null;
let configServerPort = null;
let serverDeps = null;
const configEventClients = new Set();

function broadcastConfigRefresh(reason = 'refresh') {
  const payload = {
    type: 'config-refresh',
    reason,
    time: new Date().toISOString()
  };
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of configEventClients) {
    res.write(message);
  }
}

function handleConfigEventStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('\n');

  configEventClients.add(res);
  broadcastConfigRefresh('connect');

  req.on('close', () => {
    configEventClients.delete(res);
  });
}

// 简单的静态文件 MIME 映射
function getMimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
}

// 解析 JSON 请求体
function parseRequestJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

// 创建 HTTP 请求处理器，提供 /api 与静态页面
function createConfigServerRequestHandler() {
  const { app, isDebugMode, config, update, logging, windows, admin } = serverDeps;
  return async (req, res) => {
    const requestUrl = req.url || '/';

    // 读取配置
    if (req.method === 'GET' && requestUrl === '/api/config') {
      return sendJson(res, 200, config.refreshConfig());
    }

    // 应用信息与权限状态
    if (req.method === 'GET' && requestUrl === '/api/app-info') {
      const uiAccessDefaultPath = admin.getDefaultUiAccessDllPath();
      return sendJson(res, 200, {
        version: app.getVersion(),
        isDebugMode,
        isAdmin: admin.isProcessElevated(),
        exePath: admin.getDefaultExePath(),
        uiAccessDllExists: fs.existsSync(uiAccessDefaultPath),
        isUiAccess: process.argv.includes(admin.UIACCESS_ARG),
        configPath: config.getConfigPath(),
        configDir: config.getConfigDir()
      });
    }

    if (req.method === 'POST' && requestUrl === '/api/config/open-file') {
      try {
        const result = await config.openConfigFile();
        if (!result.ok) {
          return sendJson(res, 400, result);
        }
        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 500, { ok: false, message: String(error) });
      }
    }

    if (req.method === 'POST' && requestUrl === '/api/config/open-dir') {
      try {
        const result = await config.openConfigDir();
        if (!result.ok) {
          return sendJson(res, 400, result);
        }
        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 500, { ok: false, message: String(error) });
      }
    }

    // 更新检查（主进程执行，支持系统代理）
    if (req.method === 'GET' && requestUrl === '/api/check-update') {
      try {
        const result = await update.checkUpdateFromMain();
        return sendJson(res, 200, result);
      } catch (error) {
        console.error('Update check failed:', error);
        return sendJson(res, 500, {
          ok: false,
          status: 'error',
          title: '检查更新失败',
          detail: '请检查网络或稍后再试。'
        });
      }
    }

    // SSE 日志流
    if (req.method === 'GET' && requestUrl === '/api/logs') {
      logging.handleLogStream(req, res);
      return;
    }

    // SSE 配置刷新通知
    if (req.method === 'GET' && requestUrl === '/api/config-events') {
      handleConfigEventStream(req, res);
      return;
    }

    // 写入配置并刷新悬浮窗
    if (req.method === 'POST' && requestUrl === '/api/config') {
      try {
        const payload = await parseRequestJsonBody(req);
        const normalized = config.normalizeConfig(payload);
        config.saveConfig(normalized);

        startConfigServer();
        windows.refreshFloatingButtonWindow();
        broadcastConfigRefresh('save');

        return sendJson(res, 200, {
          ok: true,
          message: '配置保存成功，悬浮窗已自动刷新配置',
          restartRequired: false
        });
      } catch (error) {
        return sendJson(res, 400, {
          ok: false,
          message: '配置保存失败，请检查输入格式'
        });
      }
    }

    // 触发应用重启
    if (req.method === 'POST' && requestUrl === '/api/restart') {
      sendJson(res, 200, { ok: true });
      setTimeout(() => {
        windows.setQuitting(true);
        app.relaunch();
        app.exit(0);
      }, 80);
      return;
    }

    // 管理员权限提升
    if (req.method === 'POST' && requestUrl === '/api/admin/elevate') {
      if (!admin.IS_WINDOWS) {
        return sendJson(res, 400, { ok: false, message: '当前系统不支持管理员提升。' });
      }
      if (admin.isProcessElevated()) {
        return sendJson(res, 200, { ok: true, message: '已在管理员权限下运行。' });
      }

      const result = admin.requestAdminRelaunch();
      if (!result.ok) {
        return sendJson(res, 400, result);
      }

      sendJson(res, 200, result);
      setTimeout(() => {
        windows.setQuitting(true);
        app.exit(0);
      }, 150);
      return;
    }

    // 创建管理员开机启动任务
    if (req.method === 'POST' && requestUrl === '/api/task/create-admin-startup') {
      try {
        const payload = await parseRequestJsonBody(req);
        const exePath = payload && typeof payload.exePath === 'string' ? payload.exePath.trim() : '';
        const taskName = payload && typeof payload.taskName === 'string' ? payload.taskName.trim() : admin.ADMIN_TASK_DEFAULT_NAME;
        const result = admin.createAdminStartupTask({ taskName, exePath });

        if (!result.ok) {
          return sendJson(res, 400, result);
        }

        const baseConfig = config.refreshConfig();
        const updated = config.normalizeConfig({
          ...baseConfig,
          webConfig: {
            ...baseConfig.webConfig,
            adminAutoStartEnabled: true,
            adminAutoStartPath: exePath,
            adminAutoStartTaskName: taskName
          }
        });
        config.saveConfig(updated);

        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 400, { ok: false, message: '创建计划任务失败。' });
      }
    }

    const urlPath = requestUrl.split('?')[0].split('#')[0];

    // 非 API 请求：dev 直跳配置页，prod 提供静态文件
    if (!urlPath.startsWith('/api')) {
      if (process.env.VITE_DEV_SERVER_URL) {
        res.writeHead(302, { Location: process.env.VITE_DEV_SERVER_URL + '#/config' });
        res.end();
        return;
      }

      const distDir = path.join(__dirname, '../dist');
      const targetPath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);

      if (!targetPath.startsWith(distDir)) {
        return sendJson(res, 403, { ok: false, message: 'Forbidden' });
      }

      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        const fileContent = fs.readFileSync(targetPath);
        res.writeHead(200, { 'Content-Type': getMimeType(targetPath) });
        res.end(fileContent);
        return;
      }
    }

    sendJson(res, 404, { ok: false, message: 'Not Found' });
  };
}

// 启动或重启配置服务
function startConfigServer(deps) {
  if (deps) {
    serverDeps = deps;
  }

  const { config } = serverDeps;
  const cfg = config.refreshConfig();
  const desiredPort = cfg.webConfig.port;

  if (configServer && configServerPort === desiredPort) {
    return;
  }

  if (configServer) {
    configServer.close();
    configServer = null;
    configServerPort = null;
  }

  const server = http.createServer(createConfigServerRequestHandler());
  server.listen(desiredPort, '127.0.0.1', () => {
    configServerPort = desiredPort;
    console.log(`Config web server running at http://localhost:${desiredPort}`);
    broadcastConfigRefresh('startup');
  });

  server.on('error', (error) => {
    console.error('Failed to start config web server:', error);
  });

  configServer = server;
}

module.exports = {
  startConfigServer
};
