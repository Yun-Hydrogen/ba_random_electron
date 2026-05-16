/*
技术文档：src/main/admin.js
职责：Windows 权限能力封装。

核心功能：
- 统一 userData 目录到 Local 路径（configureUserDataPath）。
- 判断管理员权限（isProcessElevated）。
- 触发管理员重启与 UIAccess 重启（requestAdminRelaunch / requestUiAccessRelaunch）。
- 创建管理员开机启动计划任务（createAdminStartupTask）。

维护建议：
- 此文件仅处理权限/计划任务，不要混入窗口与业务逻辑。
*/
const { app } = require('electron');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Windows 权限与 UIAccess 相关工具
const IS_WINDOWS = process.platform === 'win32';
const ADMIN_TASK_DEFAULT_NAME = 'Blue Random (Admin)';
const USERDATA_DIR_NAME = 'BlueRandom';
const UIACCESS_ARG = '--uiaccess';
const IS_UIACCESS_PROCESS = process.argv.includes(UIACCESS_ARG);

// Windows 下统一 userData 到 Local 目录
function configureUserDataPath() {
  if (!IS_WINDOWS) {
    return;
  }
  const appData = app.getPath('appData');
  const localRoot = path.resolve(appData, '..', 'Local');
  const targetPath = path.join(localRoot, USERDATA_DIR_NAME);
  app.setPath('userData', targetPath);
}

function quoteForPowerShell(text) {
  return String(text).replace(/'/g, "''");
}

function getPowerShellPath() {
  if (!IS_WINDOWS) return 'powershell';
  const root = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const psPath = path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return fs.existsSync(psPath) ? psPath : 'powershell';
}

function getRundll32Path() {
  if (!IS_WINDOWS) return 'rundll32.exe';
  const root = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const dllPath = path.join(root, 'System32', 'rundll32.exe');
  return fs.existsSync(dllPath) ? dllPath : 'rundll32.exe';
}

// 判断当前进程是否为管理员权限
function isProcessElevated() {
  if (!IS_WINDOWS) return false;
  try {
    const output = execFileSync(getPowerShellPath(), [
      '-NoProfile',
      '-Command',
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
    ], { encoding: 'utf8' });
    return String(output).trim().toLowerCase() === 'true';
  } catch (_error) {
    return false;
  }
}

// 以管理员权限重新启动应用
function requestAdminRelaunch() {
  if (!IS_WINDOWS) {
    return { ok: false, message: '当前系统不支持管理员提升。' };
  }

  const exePath = process.execPath;
  const args = process.argv.slice(1);
  const argList = args.length > 0
    ? args.map(arg => `'${quoteForPowerShell(arg)}'`).join(', ')
    : '';
  const script = [
    `$exe = '${quoteForPowerShell(exePath)}'`,
    args.length > 0
      ? `$args = @(${argList}); Start-Process -FilePath $exe -ArgumentList $args -Verb RunAs`
      : 'Start-Process -FilePath $exe -Verb RunAs'
  ].join('; ');
  const result = spawnSync(getPowerShellPath(), ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    const detail = [result.error ? String(result.error) : '', result.stderr || '', result.stdout || '']
      .join('\n')
      .trim();
    console.error('Admin relaunch failed:', detail || 'command failed');
    return { ok: false, message: '管理员权限请求失败或被取消。', detail: detail || 'command failed' };
  }

  return { ok: true, message: '已请求管理员权限，即将重新启动。' };
}

// 获取当前可执行文件路径
function getDefaultExePath() {
  return app.getPath('exe');
}

// 默认 uiaccess.dll 位置（与 exe 同目录）
function getDefaultUiAccessDllPath() {
  const exeDir = path.dirname(getDefaultExePath());
  return path.join(exeDir, 'uiaccess.dll');
}

function buildUiAccessCommandLine(exePath, args) {
  const quote = (value) => `"${String(value).replace(/"/g, '\\"')}"`;
  const safeArgs = Array.isArray(args) ? args : [];
  return [quote(exePath), ...safeArgs.map(arg => quote(arg))].join(' ');
}

// 使用 uiaccess.dll 以 UIAccess 模式重启
function requestUiAccessRelaunch(uiAccessDllPath) {
  if (!IS_WINDOWS) {
    return { ok: false, message: '当前系统不支持 UIAccess。' };
  }
  if (!app.isPackaged) {
    return { ok: false, message: 'UIAccess 仅支持正式版运行。' };
  }
  if (!uiAccessDllPath || !fs.existsSync(uiAccessDllPath)) {
    return { ok: false, message: '未找到 uiaccess.dll，请检查路径。' };
  }

  const exePath = getDefaultExePath();
  const exeDir = path.dirname(exePath);
  const baseArgs = process.argv.slice(1);
  const args = baseArgs.includes(UIACCESS_ARG) ? baseArgs : [...baseArgs, UIACCESS_ARG];
  const cmdLine = buildUiAccessCommandLine(exePath, args);
  const entry = `${uiAccessDllPath},run`;
  const rundll32Path = getRundll32Path();
  const psPath = getPowerShellPath();
  const script = [
    `$entry = '${quoteForPowerShell(entry)}'`,
    `$cmdLine = '${quoteForPowerShell(cmdLine)}'`,
    `Start-Process -FilePath '${quoteForPowerShell(rundll32Path)}' -ArgumentList @($entry, $cmdLine) -WorkingDirectory '${quoteForPowerShell(exeDir)}'`
  ].join('; ');
  const result = spawnSync(psPath, ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    const detailParts = [
      result.error ? `error=${String(result.error)}` : '',
      typeof result.status === 'number' ? `status=${result.status}` : '',
      result.stderr ? `stderr=${result.stderr}` : '',
      result.stdout ? `stdout=${result.stdout}` : ''
    ].filter(Boolean);
    detailParts.push(`rundll32=${rundll32Path}`);
    detailParts.push(`entry=${entry}`);
    detailParts.push(`cmdLine=${cmdLine}`);
    detailParts.push(`cwd=${exeDir}`);
    detailParts.push(`ps=${psPath}`);
    const detail = detailParts.join('\n').trim();
    console.error('UIAccess relaunch failed:', detail || 'command failed');
    return { ok: false, message: 'UIAccess 请求失败或被取消。', detail: detail || 'command failed' };
  }

  return { ok: true, message: '已请求 UIAccess 权限，即将重新启动。' };
}

// 创建管理员开机启动任务（计划任务）
function createAdminStartupTask({ taskName, exePath, runAsUser }) {
  if (!IS_WINDOWS) {
    return { ok: false, message: '仅支持 Windows 计划任务。' };
  }

  if (!exePath || !fs.existsSync(exePath)) {
    return { ok: false, message: '可执行文件路径无效或不存在。' };
  }

  const safeTaskName = taskName || ADMIN_TASK_DEFAULT_NAME;
  const userName = runAsUser || process.env.USERNAME || '';
  const taskArgs = [
    '/Create',
    '/F',
    '/RL',
    'HIGHEST',
    '/SC',
    'ONLOGON',
    '/TN',
    safeTaskName,
    '/TR',
    `"${exePath}"`
  ];

  if (userName) {
    taskArgs.push('/RU', userName);
  }

  try {
    if (isProcessElevated()) {
      execFileSync('schtasks', taskArgs, { stdio: 'ignore' });
    } else {
      const psArgs = taskArgs.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
      const command = `Start-Process -FilePath 'schtasks.exe' -ArgumentList '${quoteForPowerShell(psArgs)}' -Verb RunAs -Wait`;
      execFileSync('powershell', ['-NoProfile', '-Command', command], { stdio: 'ignore' });
    }
    return { ok: true, message: '计划任务已创建或更新。' };
  } catch (error) {
    return { ok: false, message: '计划任务创建失败或被取消。', detail: String(error) };
  }
}

module.exports = {
  ADMIN_TASK_DEFAULT_NAME,
  IS_UIACCESS_PROCESS,
  IS_WINDOWS,
  UIACCESS_ARG,
  configureUserDataPath,
  createAdminStartupTask,
  getDefaultExePath,
  getDefaultUiAccessDllPath,
  isProcessElevated,
  requestAdminRelaunch,
  requestUiAccessRelaunch
};
