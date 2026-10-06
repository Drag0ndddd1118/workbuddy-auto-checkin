/**
 * Cross-platform Account Loader Module
 * Loads WorkBuddy accounts from:
 * 1. accounts.json (local file)
 * 2. WORKBUDDY_ACCOUNTS (environment variable)
 * 3. Official WorkBuddy desktop client (macOS / Windows / Linux auto-detection, if unencrypted)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function formatName(rawName, fallback) {
  if (typeof rawName === 'string' && rawName.trim()) {
    return rawName.trim();
  }
  return fallback;
}

/**
 * 从本地配置文件读取账号
 */
function loadFromConfigFile(customPath) {
  const configPath = customPath || path.resolve(process.cwd(), 'accounts.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, index) => {
          const rawToken = item.token || item.accessToken || item.access_token;
          const tokenStr = typeof rawToken === 'string' ? rawToken.trim() : '';
          const rawUid = item.uid || item.userId || item.id;
          const uidStr = typeof rawUid === 'string' ? rawUid.trim() : (rawUid ? String(rawUid) : '');
          return {
            name: formatName(item.name, `账号_${index + 1}`),
            token: tokenStr,
            uid: uidStr,
            domain: item.domain || 'www.codebuddy.cn',
            source: 'accounts.json'
          };
        }).filter(acc => acc.token && acc.uid);
      }
    } catch (err) {
      console.warn(`[WARN] 解析 accounts.json 失败: ${err.message}`);
    }
  }
  return [];
}

/**
 * 从环境变量读取账号 (支持 GitHub Actions / Docker / 云函数)
 */
function loadFromEnv() {
  const envRaw = process.env.WORKBUDDY_ACCOUNTS;
  if (!envRaw) return [];

  const trimmed = envRaw.trim();
  // 1. JSON 格式支持
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map((item, index) => {
        const rawToken = item.token || item.accessToken || item.access_token;
        const tokenStr = typeof rawToken === 'string' ? rawToken.trim() : '';
        const rawUid = item.uid || item.userId || item.id;
        const uidStr = typeof rawUid === 'string' ? rawUid.trim() : (rawUid ? String(rawUid) : '');
        return {
          name: formatName(item.name, `环境变量账号_${index + 1}`),
          token: tokenStr,
          uid: uidStr,
          domain: item.domain || 'www.codebuddy.cn',
          source: 'env-json'
        };
      }).filter(acc => acc.token && acc.uid);
    } catch (err) {
      console.warn(`[WARN] 解析 WORKBUDDY_ACCOUNTS (JSON) 失败: ${err.message}`);
    }
  }

  // 2. 简易格式支持: "token#uid" 或 "name#token#uid"，多账号换行或英文逗号隔开
  const lines = trimmed.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
  const accounts = [];
  lines.forEach((line, index) => {
    const parts = line.split('#').map(p => p.trim());
    if (parts.length >= 2) {
      if (parts.length === 2) {
        accounts.push({
          name: `环境变量账号_${index + 1}`,
          token: parts[0],
          uid: parts[1],
          domain: 'www.codebuddy.cn',
          source: 'env-string'
        });
      } else {
        accounts.push({
          name: parts[0],
          token: parts[1],
          uid: parts[2],
          domain: 'www.codebuddy.cn',
          source: 'env-string'
        });
      }
    }
  });

  return accounts;
}

/**
 * 自动检测官方 WorkBuddy 桌面客户端已登录凭证
 * macOS / Windows / Linux 全平台支持
 */
function loadFromOfficialClient() {
  const platform = os.platform();
  const home = os.homedir();
  let clientAuthPath = null;

  if (platform === 'darwin') {
    clientAuthPath = path.join(
      home,
      'Library',
      'Application Support',
      'CodeBuddyExtension',
      'Data',
      'Public',
      'auth',
      'workbuddy-desktop.info'
    );
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    clientAuthPath = path.join(
      appData,
      'CodeBuddyExtension',
      'Data',
      'Public',
      'auth',
      'workbuddy-desktop.info'
    );
  } else if (platform === 'linux') {
    clientAuthPath = path.join(
      home,
      '.config',
      'CodeBuddyExtension',
      'Data',
      'Public',
      'auth',
      'workbuddy-desktop.info'
    );
  }

  if (clientAuthPath && fs.existsSync(clientAuthPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(clientAuthPath, 'utf8'));
      const rawToken = data.auth?.accessToken;
      const rawUid = data.account?.uid;

      // 如果官方客户端启用了 $wbEncrypted 加密包装
      if (rawToken && typeof rawToken === 'object' && rawToken.$wbEncrypted) {
        // 加密凭据无法直接读取明文，跳过并提示
        return [];
      }

      const token = typeof rawToken === 'string' ? rawToken.trim() : '';
      const uid = typeof rawUid === 'string' ? rawUid.trim() : (rawUid ? String(rawUid) : '');
      const nickname = formatName(data.account?.nickname, '官方客户端账号');

      if (token && uid) {
        return [{
          name: nickname,
          token,
          uid,
          domain: data.auth?.domain || 'www.codebuddy.cn',
          source: 'official-client'
        }];
      }
    } catch (_) {}
  }

  return [];
}

/**
 * 综合加载账号，按优先级合并去重
 */
function loadAccounts(options = {}) {
  const configAccounts = loadFromConfigFile(options.configPath);
  const envAccounts = loadFromEnv();
  const clientAccounts = loadFromOfficialClient();

  const all = [...configAccounts, ...envAccounts, ...clientAccounts];
  
  const seenUids = new Set();
  const uniqueAccounts = [];
  for (const acc of all) {
    if (!seenUids.has(acc.uid)) {
      seenUids.add(acc.uid);
      uniqueAccounts.push(acc);
    }
  }

  return uniqueAccounts;
}

module.exports = {
  loadAccounts,
  loadFromConfigFile,
  loadFromEnv,
  loadFromOfficialClient
};
