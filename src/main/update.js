/*
技术文档：src/main/update.js
职责：更新检查核心逻辑。

核心功能：
- 使用 electron.net 请求 GitHub Releases 与 version.yml。
- 解析版本与 commit 信息并执行版本比较。
- 输出统一状态：update / ok / easter / error。

维护建议：
- 网络请求统一走 fetchUrl，便于代理与错误处理收敛。
*/
const { app, net } = require('electron');

// 解析 version.yml 的简单键值
function parseVersionYaml(text) {
  const lines = String(text || '').split(/\r?\n/);
  const data = {};
  lines.forEach((line) => {
    const match = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:\s*"?([^\"]*)"?\s*$/);
    if (match) {
      data[match[1]] = match[2];
    }
  });
  return data;
}

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

// 语义化版本比较
function compareVersion(a, b) {
  const pa = normalizeVersion(a).split('.').map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));
  const pb = normalizeVersion(b).split('.').map(n => parseInt(n, 10)).filter(n => Number.isFinite(n));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

// 使用 Electron net 发送请求（支持系统代理）
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url,
      headers: {
        'User-Agent': 'Blue-Random',
        'Accept': 'application/vnd.github+json',
        ...(options.headers || {})
      }
    });
    const chunks = [];
    request.on('response', (response) => {
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          statusCode: response.statusCode || 0,
          headers: response.headers || {},
          body
        });
      });
    });
    request.on('error', reject);
    request.end();
  });
}

// 主进程更新检查：GitHub Release + version.yml
async function checkUpdateFromMain() {
  const repoOwner = 'Yun-Hydrogen';
  const repoName = 'ba_random_electron';
  const debug = [];
  const localVersion = app.getVersion();
  const releaseApi = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
  debug.push(`GET ${releaseApi}`);

  const releaseResp = await fetchUrl(releaseApi);
  if (releaseResp.statusCode < 200 || releaseResp.statusCode >= 300) {
    return {
      ok: false,
      status: 'error',
      title: '检查更新失败',
      detail: `Release 请求失败 (${releaseResp.statusCode})`,
      localVersion,
      debug
    };
  }

  const release = JSON.parse(releaseResp.body.toString('utf8'));
  const assets = Array.isArray(release.assets) ? release.assets : [];
  debug.push(`assets=${assets.length}`);
  const versionAsset = assets.find(asset => asset.name === 'version.yml')
    || assets.find(asset => String(asset.name || '').toLowerCase().endsWith('version.yml'));

  if (!versionAsset || !versionAsset.browser_download_url) {
    return {
      ok: false,
      status: 'error',
      title: '未找到版本描述文件',
      detail: '发布中缺少 version.yml，请稍后再试。',
      releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
      localVersion,
      debug
    };
  }

  debug.push(`GET ${versionAsset.browser_download_url}`);
  const versionResp = await fetchUrl(versionAsset.browser_download_url, {
    headers: { Accept: 'text/plain' }
  });
  if (versionResp.statusCode < 200 || versionResp.statusCode >= 300) {
    return {
      ok: false,
      status: 'error',
      title: '检查更新失败',
      detail: `version.yml 下载失败 (${versionResp.statusCode})`,
      releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
      localVersion,
      debug
    };
  }

  const remoteMeta = parseVersionYaml(versionResp.body.toString('utf8'));
  const remoteVersion = remoteMeta.version || '0.0.0';
  const remoteCommit = remoteMeta.commit || '';
  debug.push(`remoteVersion=${remoteVersion}`);

  let commitMessage = '';
  let commitUrl = '';
  if (remoteCommit) {
    commitUrl = `https://github.com/${repoOwner}/${repoName}/commit/${remoteCommit}`;
    const commitApi = `https://api.github.com/repos/${repoOwner}/${repoName}/commits/${remoteCommit}`;
    debug.push(`GET ${commitApi}`);
    const commitResp = await fetchUrl(commitApi);
    if (commitResp.statusCode >= 200 && commitResp.statusCode < 300) {
      const commitJson = JSON.parse(commitResp.body.toString('utf8'));
      if (commitJson && commitJson.commit && commitJson.commit.message) {
        commitMessage = String(commitJson.commit.message).trim();
      }
    }
  }

  const compare = compareVersion(localVersion, remoteVersion);
  if (compare < 0) {
    return {
      ok: true,
      status: 'update',
      title: `发现新版本：${remoteVersion}`,
      detail: commitMessage ? `更新内容：\n${commitMessage}` : '有新版本可用。',
      commitUrl,
      releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
      localVersion,
      remoteVersion,
      debug
    };
  }

  if (compare === 0) {
    return {
      ok: true,
      status: 'ok',
      title: `已是最新版本：${localVersion}`,
      detail: commitMessage ? `当前提交：\n${commitMessage}` : '无需更新。',
      commitUrl,
      releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
      localVersion,
      remoteVersion,
      debug
    };
  }

  return {
    ok: true,
    status: 'easter',
    title: `这是为什么呢？${localVersion}`,
    detail: '看起来你正在使用来自未来的版本...',
    commitUrl,
    releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
    localVersion,
    remoteVersion,
    debug
  };
}

module.exports = {
  checkUpdateFromMain
};
