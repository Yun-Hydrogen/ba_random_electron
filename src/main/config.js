/*
技术文档：src/main/config.js
职责：配置读写与归一化。

核心功能：
- 定义默认配置结构（DEFAULT_CONFIG）。
- 读取/写入 config.yml，并对字段进行 normalize。
- 兼容旧配置路径迁移到 userData。
- 提供打开配置文件、配置目录、配置网页入口。

维护建议：
- 新增配置项需同步 DEFAULT_CONFIG、normalizeConfig、toConfigYamlWithComments。
*/
const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const admin = require('./admin');

// 默认配置结构
const DEFAULT_CONFIG = {
  studentList: [],
  allowRepeatDraw: true,
  floatingButton: {
    sizePercent: 100,
    transparencyPercent: 20,
    alwaysOnTop: true,
    position: {
      x: null,
      y: null
    }
  },
  pickCountDialog: {
    defaultPlayMusic: false,
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
    adminAutoStartTaskName: admin.ADMIN_TASK_DEFAULT_NAME,
    uiAccessEnabled: false
  }
};

let currentConfig = DEFAULT_CONFIG;

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

// 归一化配置，确保字段合法且有默认值
function normalizeConfig(input) {
  const source = input && typeof input === 'object' ? input : {};
  const rawStudents = Array.isArray(source.studentList) ? source.studentList : [];
  const students = rawStudents.map(s => {
    if (typeof s === 'string') return { name: s.trim(), weight: 1.0 };
    if (s && typeof s === 'object') return { name: String(s.name || '').trim(), weight: Number.isFinite(Number(s.weight)) ? Number(s.weight) : 1.0 };
    return null;
  }).filter(s => s && s.name);
  const fb = source.floatingButton && typeof source.floatingButton === 'object' ? source.floatingButton : {};
  const allowRepeatDraw =
    typeof source.allowRepeatDraw === 'boolean' ? source.allowRepeatDraw : DEFAULT_CONFIG.allowRepeatDraw;
  const position = fb.position && typeof fb.position === 'object' ? fb.position : {};
  const pick = source.pickCountDialog && typeof source.pickCountDialog === 'object' ? source.pickCountDialog : {};
  const pickResult = source.pickResultDialog && typeof source.pickResultDialog === 'object' ? source.pickResultDialog : {};
  const web = source.webConfig && typeof source.webConfig === 'object' ? source.webConfig : {};

  const alwaysOnTop =
    typeof fb.alwaysOnTop === 'boolean' ? fb.alwaysOnTop : DEFAULT_CONFIG.floatingButton.alwaysOnTop;

  return {
    studentList: students,
    allowRepeatDraw,
    floatingButton: {
      sizePercent: clampNumber(
        fb.sizePercent,
        0,
        1000,
        DEFAULT_CONFIG.floatingButton.sizePercent
      ),
      transparencyPercent: clampNumber(
        fb.transparencyPercent,
        0,
        100,
        DEFAULT_CONFIG.floatingButton.transparencyPercent
      ),
      alwaysOnTop,
      position: {
        x: Number.isFinite(Number(position.x)) ? Math.round(Number(position.x)) : null,
        y: Number.isFinite(Number(position.y)) ? Math.round(Number(position.y)) : null
      }
    },
    pickCountDialog: {
      defaultPlayMusic:
        typeof pick.defaultPlayMusic === 'boolean' ? pick.defaultPlayMusic : DEFAULT_CONFIG.pickCountDialog.defaultPlayMusic,
      backgroundDarknessPercent: clampNumber(
        pick.backgroundDarknessPercent,
        0,
        100,
        DEFAULT_CONFIG.pickCountDialog.backgroundDarknessPercent
      ),
      defaultCount: Math.round(
        clampNumber(
          pick.defaultCount,
          1,
          10,
          DEFAULT_CONFIG.pickCountDialog.defaultCount
        )
      )
    },
    pickResultDialog: {
      defaultPlayGachaSound:
        typeof pickResult.defaultPlayGachaSound === 'boolean'
          ? pickResult.defaultPlayGachaSound
          : DEFAULT_CONFIG.pickResultDialog.defaultPlayGachaSound,
      gachaSoundVolume: clampNumber(
        pickResult.gachaSoundVolume,
        0,
        1,
        DEFAULT_CONFIG.pickResultDialog.gachaSoundVolume
      )
    },
    webConfig: {
      port: Math.round(clampNumber(web.port, 1, 65535, DEFAULT_CONFIG.webConfig.port)),
      adminTopmostEnabled:
        typeof web.adminTopmostEnabled === 'boolean'
          ? web.adminTopmostEnabled
          : DEFAULT_CONFIG.webConfig.adminTopmostEnabled,
      adminAutoStartEnabled:
        typeof web.adminAutoStartEnabled === 'boolean'
          ? web.adminAutoStartEnabled
          : DEFAULT_CONFIG.webConfig.adminAutoStartEnabled,
      adminAutoStartPath:
        typeof web.adminAutoStartPath === 'string'
          ? web.adminAutoStartPath
          : DEFAULT_CONFIG.webConfig.adminAutoStartPath,
      adminAutoStartTaskName:
        typeof web.adminAutoStartTaskName === 'string' && web.adminAutoStartTaskName.trim()
          ? web.adminAutoStartTaskName.trim()
          : DEFAULT_CONFIG.webConfig.adminAutoStartTaskName,
      uiAccessEnabled:
        typeof web.uiAccessEnabled === 'boolean'
          ? web.uiAccessEnabled
          : DEFAULT_CONFIG.webConfig.uiAccessEnabled
    }
  };
}

// 当前配置文件路径
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.yml');
}

// 旧版配置文件搜索路径
function getLegacyConfigPaths() {
  const legacyPaths = [];
  const exeDir = path.dirname(app.getPath('exe'));
  legacyPaths.push(path.join(exeDir, 'config.yml'));

  if (!app.isPackaged) {
    legacyPaths.push(path.join(process.cwd(), 'config.yml'));
  }

  if (admin.IS_WINDOWS) {
    const appData = app.getPath('appData');
    const localRoot = path.resolve(appData, '..', 'Local');
    legacyPaths.push(path.join(localRoot, 'Blue Random', 'config.yml'));
  }

  const currentPath = getConfigPath();
  return Array.from(new Set(legacyPaths.filter(p => p && p !== currentPath)));
}

function getConfigDir() {
  return path.dirname(getConfigPath());
}

// 打开配置文件
async function openConfigFile() {
  const configPath = getConfigPath();
  writeDefaultConfigIfMissing(configPath);
  const result = await shell.openPath(configPath);
  if (result) {
    return { ok: false, message: `打开配置文件失败: ${result}` };
  }
  return { ok: true, message: '已打开配置文件。' };
}

// 打开配置所在目录
async function openConfigDir() {
  const configDir = getConfigDir();
  fs.mkdirSync(configDir, { recursive: true });
  const result = await shell.openPath(configDir);
  if (result) {
    return { ok: false, message: `打开配置目录失败: ${result}` };
  }
  return { ok: true, message: '已打开配置目录。' };
}

// 打开配置网页
function openConfigPageInBrowser() {
  const config = refreshConfig();
  const url = `http://localhost:${config.webConfig.port}/#/config`;
  shell.openExternal(url);
}

// 生成带中文注释的 YAML
function toConfigYamlWithComments(config) {
  const fb = config.floatingButton;
  const pick = config.pickCountDialog;
  const pickResult = config.pickResultDialog;
  const web = config.webConfig;
  const posX = Number.isFinite(Number(fb.position.x)) ? String(Math.round(Number(fb.position.x))) : 'null';
  const posY = Number.isFinite(Number(fb.position.y)) ? String(Math.round(Number(fb.position.y))) : 'null';
  const yamlSingleQuote = (value) => `'${String(value || '').replace(/'/g, "''")}'`;

  const studentLines = Array.isArray(config.studentList) && config.studentList.length > 0
    ? '\n' + config.studentList.map(s => `  - name: "${s.name}"\n    weight: ${s.weight}`).join('\n')
    : ' []';

  return [
    '# 抽取名单列表',
    `studentList:${studentLines}`,
    `allowRepeatDraw: ${config.allowRepeatDraw ? 'true' : 'false'}`,
    '',
    '# 悬浮按钮配置',
    'floatingButton:',
    '  # 按钮大小百分比（基准 50px*50px），范围 0-1000，默认 100',
    `  sizePercent: ${fb.sizePercent}`,
    '  # 透明度百分比，范围 0-100（0=完全不透明，100=完全透明），默认 20',
    `  transparencyPercent: ${fb.transparencyPercent}`,
    '  # 是否置顶（true/false），默认 true',
    `  alwaysOnTop: ${fb.alwaysOnTop ? 'true' : 'false'}`,
    '  # 悬浮按钮窗口位置（左上角屏幕坐标），退出时自动保存；null 表示使用系统默认位置',
    '  position:',
    `    x: ${posX}`,
    `    y: ${posY}`,
    '',
    '# 人数选择窗口配置',
    'pickCountDialog:',
    '  # 是否默认播放喜庆点名音乐（true/false），默认 false',
    `  defaultPlayMusic: ${pick.defaultPlayMusic ? 'true' : 'false'}`,
    '  # 背景变暗程度，范围 0-100（100 接近全黑），默认 50',
    `  backgroundDarknessPercent: ${pick.backgroundDarknessPercent}`,
    '  # 人数默认值，范围 1-10 的整数，默认 1',
    `  defaultCount: ${pick.defaultCount}`,
    '',
    '# 抽奖结果动画音效配置',
    'pickResultDialog:',
    '  # 是否默认播放抽奖音效（true/false），默认 true',
    `  defaultPlayGachaSound: ${pickResult.defaultPlayGachaSound ? 'true' : 'false'}`,
    '  # 抽奖音效音量（0.0-1.0），默认 0.6',
    `  gachaSoundVolume: ${pickResult.gachaSoundVolume}`,
    '',
    '# 网页配置服务',
    'webConfig:',
    '  # 配置网页端口（默认 21219）',
    `  port: ${web.port}`,
    '  # 启用管理员置顶增强（Windows 下会尝试管理员权限）',
    `  adminTopmostEnabled: ${web.adminTopmostEnabled ? 'true' : 'false'}`,
    '  # 是否创建开机计划任务（管理员权限运行）',
    `  adminAutoStartEnabled: ${web.adminAutoStartEnabled ? 'true' : 'false'}`,
    '  # 计划任务运行的可执行文件路径',
    `  adminAutoStartPath: ${yamlSingleQuote(web.adminAutoStartPath)}`,
    '  # 计划任务名称',
    `  adminAutoStartTaskName: ${yamlSingleQuote(web.adminAutoStartTaskName || admin.ADMIN_TASK_DEFAULT_NAME)}`,
    '  # 管理员身份运行时自动使用 UIAccess（需要 uiaccess.dll 随包分发）',
    `  uiAccessEnabled: ${web.uiAccessEnabled ? 'true' : 'false'}`,
    ''
  ].join('\n');
}

// 保存配置到磁盘
function saveConfig(config) {
  const configPath = getConfigPath();
  const yamlText = toConfigYamlWithComments(config);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, yamlText, 'utf8');
}

// 如果不存在配置则写入默认配置或迁移旧配置
function writeDefaultConfigIfMissing(configPath) {
  if (fs.existsSync(configPath)) {
    return;
  }
  for (const legacyPath of getLegacyConfigPaths()) {
    if (fs.existsSync(legacyPath)) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.copyFileSync(legacyPath, configPath);
      return;
    }
  }
  saveConfig(DEFAULT_CONFIG);
}

// 读取配置并进行归一化
function loadConfig() {
  const configPath = getConfigPath();
  writeDefaultConfigIfMissing(configPath);

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.load(raw);
    const normalized = normalizeConfig(parsed);
    saveConfig(normalized);
    return normalized;
  } catch (error) {
    console.error('Failed to load config.yml, using defaults.', error);
    const fallback = normalizeConfig(DEFAULT_CONFIG);
    saveConfig(fallback);
    return fallback;
  }
}

// 刷新内存配置并返回最新值
function refreshConfig() {
  currentConfig = loadConfig();
  return currentConfig;
}

module.exports = {
  DEFAULT_CONFIG,
  getConfigDir,
  getConfigPath,
  getLegacyConfigPaths,
  loadConfig,
  normalizeConfig,
  openConfigDir,
  openConfigFile,
  openConfigPageInBrowser,
  refreshConfig,
  saveConfig,
  writeDefaultConfigIfMissing
};
