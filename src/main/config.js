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
// 与 Vue 配置面板 draft 结构保持严格一致，新增字段需两边同步
const DEFAULT_CONFIG = {
  studentList: [],
  allowRepeatDraw: true,
  agreedEula: false,
  floatingButton: {
    sizePercent: 100,
    alwaysOnTop: true,
    position: {
      x: null,
      y: null
    },
    iconPath: '',
    iconSize: 48,
    borderColor: '#ffffff'
  },
  pickCountDialog: {
    defaultCount: 1
  },
  pickResultDialog: {
    defaultPlayGachaSound: true,
    soundVolume: 80,
    playMusic: false,
    musicVolume: 60,
    panelOpacity: 0.9,
    panelBgColor: '#ffffff',
    panelBorderColor: '#66ccff'
  },
  webConfig: {
    adminTopmostEnabled: false,
    adminAutoStartAdmin: true,
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
// 前端 Vue 面板通过 IPC 传入的 JSON 对象由此函数清洗后落盘
function normalizeConfig(input) {
  const source = input && typeof input === 'object' ? input : {};

  // ---- studentList ----
  const rawStudents = Array.isArray(source.studentList) ? source.studentList : [];
  const students = rawStudents.map(s => {
    if (typeof s === 'string') return { name: s.trim(), weight: 1.0 };
    if (s && typeof s === 'object') return { name: String(s.name || '').trim(), weight: Number.isFinite(Number(s.weight)) ? Number(s.weight) : 1.0 };
    return null;
  }).filter(s => s && s.name);

  // ---- allowRepeatDraw / agreedEula ----
  const allowRepeatDraw =
    typeof source.allowRepeatDraw === 'boolean' ? source.allowRepeatDraw : DEFAULT_CONFIG.allowRepeatDraw;
  const agreedEula = typeof source.agreedEula === 'boolean' ? source.agreedEula : DEFAULT_CONFIG.agreedEula;

  // ---- floatingButton ----
  const fb = source.floatingButton && typeof source.floatingButton === 'object' ? source.floatingButton : {};
  const fbPos = fb.position && typeof fb.position === 'object' ? fb.position : {};
  const alwaysOnTop =
    typeof fb.alwaysOnTop === 'boolean' ? fb.alwaysOnTop : DEFAULT_CONFIG.floatingButton.alwaysOnTop;

  const floatingButton = {
    sizePercent: clampNumber(fb.sizePercent, 50, 200, DEFAULT_CONFIG.floatingButton.sizePercent),
    alwaysOnTop,
    position: {
      x: Number.isFinite(Number(fbPos.x)) ? Math.round(Number(fbPos.x)) : null,
      y: Number.isFinite(Number(fbPos.y)) ? Math.round(Number(fbPos.y)) : null
    },
    /* 图标文件路径（本地绝对路径），默认为空表示使用内置图标 */
    iconPath: typeof fb.iconPath === 'string' ? fb.iconPath : DEFAULT_CONFIG.floatingButton.iconPath,
    /* 图标尺寸（px），范围 16-128 */
    iconSize: clampNumber(fb.iconSize, 16, 128, DEFAULT_CONFIG.floatingButton.iconSize),
    /* 按钮边框颜色（hex 字符串），默认白色 */
    borderColor: typeof fb.borderColor === 'string' && fb.borderColor
      ? fb.borderColor
      : DEFAULT_CONFIG.floatingButton.borderColor
  };

  // ---- pickCountDialog ----
  const pick = source.pickCountDialog && typeof source.pickCountDialog === 'object' ? source.pickCountDialog : {};
  const pickCountDialog = {
    defaultCount: Math.round(clampNumber(pick.defaultCount, 1, 10, DEFAULT_CONFIG.pickCountDialog.defaultCount))
  };

  // ---- pickResultDialog ----
  const pickResult = source.pickResultDialog && typeof source.pickResultDialog === 'object' ? source.pickResultDialog : {};
  const pickResultDialog = {
    defaultPlayGachaSound:
      typeof pickResult.defaultPlayGachaSound === 'boolean'
        ? pickResult.defaultPlayGachaSound
        : DEFAULT_CONFIG.pickResultDialog.defaultPlayGachaSound,
    /* 音效音量（0-100），前端滑条百分比 */
    soundVolume: clampNumber(pickResult.soundVolume, 0, 100, DEFAULT_CONFIG.pickResultDialog.soundVolume),
    /* 是否播放抽卡背景音乐 */
    playMusic:
      typeof pickResult.playMusic === 'boolean'
        ? pickResult.playMusic
        : DEFAULT_CONFIG.pickResultDialog.playMusic,
    /* 音乐音量（0-100），前端滑条百分比 */
    musicVolume: clampNumber(pickResult.musicVolume, 0, 100, DEFAULT_CONFIG.pickResultDialog.musicVolume),
    /* 面板不透明度（0.1-1.0） */
    panelOpacity: clampNumber(pickResult.panelOpacity, 0.1, 1, DEFAULT_CONFIG.pickResultDialog.panelOpacity),
    panelBgColor:
      typeof pickResult.panelBgColor === 'string' && pickResult.panelBgColor
        ? pickResult.panelBgColor
        : DEFAULT_CONFIG.pickResultDialog.panelBgColor,
    panelBorderColor:
      typeof pickResult.panelBorderColor === 'string' && pickResult.panelBorderColor
        ? pickResult.panelBorderColor
        : DEFAULT_CONFIG.pickResultDialog.panelBorderColor
  };

  // ---- webConfig ----
  const web = source.webConfig && typeof source.webConfig === 'object' ? source.webConfig : {};
  const webConfig = {
    adminTopmostEnabled:
      typeof web.adminTopmostEnabled === 'boolean'
        ? web.adminTopmostEnabled
        : DEFAULT_CONFIG.webConfig.adminTopmostEnabled,
    /* 开机自启时是否以管理员身份运行计划任务 */
    adminAutoStartAdmin:
      typeof web.adminAutoStartAdmin === 'boolean'
        ? web.adminAutoStartAdmin
        : DEFAULT_CONFIG.webConfig.adminAutoStartAdmin,
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
  };

  return {
    studentList: students,
    allowRepeatDraw,
    agreedEula,
    floatingButton,
    pickCountDialog,
    pickResultDialog,
    webConfig
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
    '# ============================================================',
    '#  蔚蓝点名 配置文件',
    '#  通过配置面板（托盘 → 配置）修改后自动保存',
    '#  也可手动编辑此文件，保存后重启应用生效',
    '# ============================================================',
    '',
    '# ---- 抽取名单 ----',
    `studentList:${studentLines}`,
    `allowRepeatDraw: ${config.allowRepeatDraw ? 'true' : 'false'}`,
    `agreedEula: ${config.agreedEula ? 'true' : 'false'}`,
    '',
    '# ---- 悬浮按钮 ----',
    'floatingButton:',
    '  # 按钮大小百分比（50-200），默认 100',
    `  sizePercent: ${fb.sizePercent}`,
    '  # 是否始终置顶（true/false），默认 true',
    `  alwaysOnTop: ${fb.alwaysOnTop ? 'true' : 'false'}`,
    '  # 窗口位置（屏幕坐标），退出时自动保存；null 为系统默认',
    '  position:',
    `    x: ${posX}`,
    `    y: ${posY}`,
    '  # 自定义图标路径（本地绝对路径），空字符串为内置默认图标',
    `  iconPath: ${yamlSingleQuote(fb.iconPath || '')}`,
    '  # 图标尺寸（px），范围 16-128，默认 48',
    `  iconSize: ${fb.iconSize}`,
    '  # 按钮边框颜色（hex），默认 #ffffff',
    `  borderColor: ${yamlSingleQuote(fb.borderColor || '#ffffff')}`,
    '',
    '# ---- 人数选择 ----',
    'pickCountDialog:',
    '  # 默认抽取人数（1-10），默认 1',
    `  defaultCount: ${pick.defaultCount}`,
    '',
    '# ---- 抽奖结果弹窗 ----',
    'pickResultDialog:',
    '  # 是否播放抽卡音效（true/false），默认 true',
    `  defaultPlayGachaSound: ${pickResult.defaultPlayGachaSound ? 'true' : 'false'}`,
    '  # 音效音量（0-100），默认 80',
    `  soundVolume: ${pickResult.soundVolume}`,
    '  # 是否播放抽卡背景音乐（true/false），默认 false',
    `  playMusic: ${pickResult.playMusic ? 'true' : 'false'}`,
    '  # 音乐音量（0-100），默认 60',
    `  musicVolume: ${pickResult.musicVolume}`,
    '  # 面板不透明度（0.1-1.0），默认 0.9',
    `  panelOpacity: ${pickResult.panelOpacity}`,
    '  # 面板背景颜色（hex），默认 #ffffff',
    `  panelBgColor: ${yamlSingleQuote(pickResult.panelBgColor || '#ffffff')}`,
    '  # 面板边框颜色（hex），默认 #66ccff',
    `  panelBorderColor: ${yamlSingleQuote(pickResult.panelBorderColor || '#66ccff')}`,
    '',
    '# ---- 高级设置 ----',
    'webConfig:',
    '  # 启用管理员置顶增强（Windows 下会尝试管理员权限）',
    `  adminTopmostEnabled: ${web.adminTopmostEnabled ? 'true' : 'false'}`,
    '  # 开机计划任务是否以管理员身份运行',
    `  adminAutoStartAdmin: ${web.adminAutoStartAdmin ? 'true' : 'false'}`,
    '  # 计划任务的可执行文件路径（留空则自动检测）',
    `  adminAutoStartPath: ${yamlSingleQuote(web.adminAutoStartPath)}`,
    '  # 计划任务在任务计划程序中的显示名称',
    `  adminAutoStartTaskName: ${yamlSingleQuote(web.adminAutoStartTaskName || admin.ADMIN_TASK_DEFAULT_NAME)}`,
    '  # 管理员运行时启用 UIAccess（需要 uiaccess.dll 随包分发）',
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
  refreshConfig,
  saveConfig,
  writeDefaultConfigIfMissing
};






