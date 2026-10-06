/**
 * Cross-Platform Notification Dispatcher Module
 * Supports:
 * - macOS Native Notification (osascript)
 * - Windows Native Toast / Balloon (PowerShell)
 * - Webhook channels: Server酱, PushPlus, 飞书, 钉钉, 企业微信, Telegram
 */

const os = require('os');
const { execFileSync } = require('child_process');

/**
 * macOS 原生系统横幅通知
 */
function notifyMacOS(title, subtitle, message) {
  try {
    const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}" subtitle "${subtitle.replace(/"/g, '\\"')}"`;
    execFileSync('osascript', ['-e', script]);
  } catch (err) {
    // 静默忽略通知失败
  }
}

/**
 * Windows 原生通知 (PowerShell)
 */
function notifyWindows(title, subtitle, message) {
  try {
    const fullText = `${subtitle ? subtitle + '\n' : ''}${message}`.replace(/"/g, '`"');
    const psScript = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
      $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
      $textNodes = $template.GetElementsByTagName("text")
      $textNodes.Item(0).AppendChild($template.CreateTextNode("${title}")) > $null
      $textNodes.Item(1).AppendChild($template.CreateTextNode("${fullText}")) > $null
      $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("WorkBuddy Checkin").Show($toast)
    `;
    execFileSync('powershell', ['-NoProfile', '-Command', psScript]);
  } catch (_) {
    // Fallback: 普通 PowerShell 气泡提示
    try {
      const fallbackScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $global:balloon = New-Object System.Windows.Forms.NotifyIcon
        $balloon.Icon = [System.Drawing.SystemIcons]::Information
        $balloon.BalloonTipTitle = "${title}"
        $balloon.BalloonTipText = "${subtitle}: ${message}"
        $balloon.Visible = $True
        $balloon.ShowBalloonTip(5000)
      `;
      execFileSync('powershell', ['-NoProfile', '-Command', fallbackScript]);
    } catch (_) {}
  }
}

/**
 * 发送系统级原生桌面通知
 */
function notifyDesktop(title, subtitle, message) {
  const platform = os.platform();
  if (platform === 'darwin') {
    notifyMacOS(title, subtitle, message);
  } else if (platform === 'win32') {
    notifyWindows(title, subtitle, message);
  }
}

/**
 * 常见 Webhook 渠道推送 (Server酱, PushPlus, 飞书, 钉钉, 企业微信, Telegram)
 */
async function sendWebhooks(title, content) {
  const tasks = [];

  // 1. Server酱 (Turbo)
  const scKey = process.env.SERVERCHAN_KEY || process.env.SCKEY;
  if (scKey) {
    tasks.push(
      fetch(`https://sctapi.ftqq.com/${scKey}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ title, desp: content })
      }).catch(e => console.warn(`[WARN] Server酱推送失败: ${e.message}`))
    );
  }

  // 2. PushPlus (推送加)
  const ppToken = process.env.PUSHPLUS_TOKEN;
  if (ppToken) {
    tasks.push(
      fetch('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ppToken, title, content: content.replace(/\n/g, '<br/>'), template: 'html' })
      }).catch(e => console.warn(`[WARN] PushPlus推送失败: ${e.message}`))
    );
  }

  // 3. 飞书自定义机器人 Webhook
  const feishuUrl = process.env.FEISHU_WEBHOOK;
  if (feishuUrl) {
    tasks.push(
      fetch(feishuUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'text',
          content: { text: `【${title}】\n${content}` }
        })
      }).catch(e => console.warn(`[WARN] 飞书推送失败: ${e.message}`))
    );
  }

  // 4. 钉钉自定义机器人 Webhook
  const dingUrl = process.env.DINGTALK_WEBHOOK;
  if (dingUrl) {
    tasks.push(
      fetch(dingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: `【${title}】\n${content}` }
        })
      }).catch(e => console.warn(`[WARN] 钉钉推送失败: ${e.message}`))
    );
  }

  // 5. 企业微信群机器人 Webhook
  const wecomUrl = process.env.WECOM_WEBHOOK;
  if (wecomUrl) {
    tasks.push(
      fetch(wecomUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: `【${title}】\n${content}` }
        })
      }).catch(e => console.warn(`[WARN] 企业微信推送失败: ${e.message}`))
    );
  }

  // 6. Telegram Bot
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChatId) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: `*${title}*\n\n${content}`,
          parse_mode: 'Markdown'
        })
      }).catch(e => console.warn(`[WARN] Telegram推送失败: ${e.message}`))
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

/**
 * 汇总发送所有可用通知
 */
async function notifyAll(summary) {
  const { title, subtitle, detailsText, shortMessage } = summary;
  
  // 1. 发送桌面系统通知
  notifyDesktop(title, subtitle, shortMessage);

  // 2. 发送网络 Webhook 通知
  const fullText = `${subtitle}\n\n${detailsText}`;
  await sendWebhooks(title, fullText);
}

module.exports = {
  notifyDesktop,
  notifyMacOS,
  notifyWindows,
  sendWebhooks,
  notifyAll
};
