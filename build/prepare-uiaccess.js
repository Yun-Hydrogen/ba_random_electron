/*
技术文档：build/prepare-uiaccess.js
职责：打包前准备 UIAccess 依赖。

核心功能：
- 在项目根目录/vendor/third_party 中查找 uiaccess.dll。
- 若 third_party 缺失则自动复制到 third_party 供打包阶段使用。
*/
const fs = require('fs');
const path = require('path');

// 将 uiaccess.dll 复制到 third_party 供打包使用
const root = path.resolve(__dirname, '..');
const thirdPartyDir = path.join(root, 'third_party');
const target = path.join(thirdPartyDir, 'uiaccess.dll');
const candidates = [
  path.join(root, 'uiaccess.dll'),
  path.join(root, 'vendor', 'uiaccess.dll')
];

if (fs.existsSync(target)) {
  console.log('[uiaccess] uiaccess.dll already present in third_party.');
  process.exit(0);
}

// 从候选路径中找到可用文件
const source = candidates.find((candidate) => fs.existsSync(candidate));
if (!source) {
  console.warn('[uiaccess] uiaccess.dll not found. Place it in third_party/, vendor/, or project root.');
  process.exit(0);
}

fs.mkdirSync(thirdPartyDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`[uiaccess] Copied uiaccess.dll to third_party from ${source}`);
