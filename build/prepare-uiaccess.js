const fs = require('fs');
const path = require('path');

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

const source = candidates.find((candidate) => fs.existsSync(candidate));
if (!source) {
  console.warn('[uiaccess] uiaccess.dll not found. Place it in third_party/, vendor/, or project root.');
  process.exit(0);
}

fs.mkdirSync(thirdPartyDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`[uiaccess] Copied uiaccess.dll to third_party from ${source}`);
