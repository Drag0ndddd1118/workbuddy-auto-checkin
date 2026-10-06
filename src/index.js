#!/usr/bin/env node

/**
 * WorkBuddy Auto Check-in CLI Main Entry
 * Pure Node.js (>=18), zero external dependencies
 */

const { loadAccounts } = require('./account-loader');
const { processAccount } = require('./checkin');
const { notifyAll } = require('./notifier');

function printUsage() {
  console.log(`
腾讯 WorkBuddy 自动签到与积分查询工具 (v1.0.0)

用法:
  node src/index.js [选项]

选项:
  --check-only       仅查询账号签到状态与当前可用积分，不执行签到
  --config <path>    指定自定义 accounts.json 配置文件路径
  --help, -h         显示帮助信息

账号来源配置:
  1. 当前目录 accounts.json 配置文件 (多账号推荐)
  2. WORKBUDDY_ACCOUNTS 环境变量 (GitHub Actions / Docker 推荐)
  3. 官方 WorkBuddy 桌面端登录凭据 (自动识别 macOS / Windows / Linux)
`);
}

function getTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const checkOnly = args.includes('--check-only');
  const configIndex = args.indexOf('--config');
  const customConfigPath = configIndex !== -1 ? args[configIndex + 1] : null;

  console.log(`\n======================================================`);
  console.log(`[${getTimestamp()}] 启动 WorkBuddy ${checkOnly ? '状态与积分查询' : '每日自动签到'}`);
  console.log(`======================================================`);

  // 1. 加载账号
  const accounts = loadAccounts({ configPath: customConfigPath });
  if (accounts.length === 0) {
    console.error(`\n[提示] 未检测到可用账号配置！`);
    console.error(`请选择以下任一方式配置账号：`);
    console.error(`  【推荐】复制 accounts.example.json 为 accounts.json 并填入 Token 与 UID`);
    console.error(`  【云端】配置 WORKBUDDY_ACCOUNTS 环境变量 (支持 JSON 数组或 token#uid 格式)`);
    console.error(`详见 README.md 中的「获取 Token 与 UID 指南」。\n`);
    process.exit(1);
  }

  console.log(`共识别到 ${accounts.length} 个账号：`);
  accounts.forEach((acc, i) => {
    console.log(`  ${i + 1}. [${acc.source}] ${acc.name} (UID: ${acc.uid})`);
  });
  console.log(`------------------------------------------------------\n`);

  // 2. 依次执行签到与查询
  const results = [];
  let successCount = 0;
  let alreadyCheckedCount = 0;
  let failedCount = 0;

  for (const acc of accounts) {
    process.stdout.write(`[处理中] ${acc.name} ... `);
    try {
      const res = await processAccount(acc, { checkOnly });
      results.push(res);

      if (res.status === 'success') {
        successCount++;
        console.log(`✓ 签到成功! +${res.credit}积分 | 连签: ${res.streak}天 | 账户总积分: ${res.totalCredits.toLocaleString()}`);
      } else if (res.status === 'already_checked') {
        alreadyCheckedCount++;
        console.log(`ℹ 今日已签 | 连签: ${res.streak}天 | 账户总积分: ${res.totalCredits.toLocaleString()}`);
      } else {
        console.log(`ℹ 状态: ${res.message} | 连签: ${res.streak}天 | 账户总积分: ${res.totalCredits.toLocaleString()}`);
      }
    } catch (err) {
      failedCount++;
      console.log(`✗ 失败: ${err.message}`);
      results.push({
        name: acc.name,
        uid: acc.uid,
        status: 'failed',
        message: err.message,
        credit: 0,
        streak: 0,
        totalCredits: 0
      });
    }

    await new Promise(r => setTimeout(r, 1200));
  }

  // 3. 汇总报表
  let totalCombinedCredits = 0;
  console.log(`\n======================================================`);
  console.log(`各账号分别可用总积分汇总清单：`);
  console.log(`------------------------------------------------------`);
  results.forEach(r => {
    const cred = typeof r.totalCredits === 'number' ? r.totalCredits : 0;
    totalCombinedCredits += cred;
    const nameStr = String(r.name || '账号');
    const statusText = r.status === 'success' ? '✓ 今日已领+100' : (r.status === 'already_checked' ? '✓ 今日已签' : '✗ 异常');
    console.log(`• ${nameStr.padEnd(16)} | 连签: ${String(r.streak).padStart(2)} 天 | 可用总积分: ${cred.toLocaleString().padStart(6)} 分 | 状态: ${statusText}`);
  });
  console.log(`------------------------------------------------------`);
  console.log(`所有账号累计总可用积分: ${totalCombinedCredits.toLocaleString()} 分`);
  console.log(`执行结果统计: 成功 ${successCount} 个, 今日已签 ${alreadyCheckedCount} 个, 失败 ${failedCount} 个`);
  console.log(`======================================================\n`);

  // 4. 构建并发送跨平台通知
  const notifTitle = 'WorkBuddy 每日签到';
  const streakDays = results[0]?.streak || 0;
  const subtitle = checkOnly
    ? `积分查询完成 (均连签 ${streakDays} 天)`
    : `${successCount > 0 ? `成功签到 ${successCount} 个` : '今日已全签'} (均连签 ${streakDays} 天)`;

  const lines = [];
  for (let i = 0; i < results.length; i += 2) {
    const a1 = results[i];
    const a2 = results[i + 1];
    const s1 = `${a1.name}: ${(a1.totalCredits || 0).toLocaleString()}分`;
    if (a2) {
      const s2 = `${a2.name}: ${(a2.totalCredits || 0).toLocaleString()}分`;
      lines.push(`${s1}  |  ${s2}`);
    } else {
      lines.push(s1);
    }
  }
  lines.push(`(总计: ${totalCombinedCredits.toLocaleString()}分)`);
  const shortMessage = lines.join('\n');

  const detailsText = results.map(r => `• **${r.name}**：可用总积分 **${(r.totalCredits || 0).toLocaleString()}** 分 (连签 ${r.streak} 天)`).join('\n');

  await notifyAll({
    title: notifTitle,
    subtitle,
    shortMessage,
    detailsText
  });

  if (failedCount > 0 && successCount === 0 && alreadyCheckedCount === 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`[FATAL] 程序异常:`, err);
  process.exit(1);
});
