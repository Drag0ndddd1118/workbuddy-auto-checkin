# ⚡ WorkBuddy 每日多账号自动签到与积分查询工具

> **腾讯云代码助手 / WorkBuddy 多账号每日全自动签到工具**  
> 纯原生 Node.js 开发，**零第三方依赖开箱即用**。支持查询每个账号的**独立可用总积分**、连签天数，并通过 macOS / Windows 系统原生横幅及各大推送通道（飞书 / 钉钉 / 企微 / Server酱 / PushPlus）进行每日提醒。

---

## ✨ 核心特性

- 🚀 **零依赖，极简运行**：纯原生 Node.js (>=18) API，不需要执行繁重的 `npm install`，克隆后秒级运行。
- 👥 **多账号支持**：可同时配置多个账号，并发/串行安全处理，自动防风控延时。
- 📊 **独立总积分深度查询**：不仅能查活动当期签到分，还能深度穿透查询各账号底层所有云资源包的**全量可用总积分**。
- 💻 **全平台兼容**：
  - **macOS**：原生通知中心横幅提醒 + `launchd` 唤醒补跑定时服务。
  - **Windows**：原生 PowerShell 系统吐司通知 + 任务计划程序一键部署。
  - **Linux / VPS**：支持标准 crontab / systemd 定时任务。
- ☁️ **GitHub Actions 免开机云签到**：无需开启个人电脑，Fork 仓库后在 Secrets 中填入凭据，每日云端自动运行。
- 🔔 **全渠道消息推送**：支持 macOS / Windows 桌面弹窗，以及 Server酱、PushPlus、飞书机器人、钉钉机器人、企业微信机器人、Telegram Bot 等 Webhook 推送。

---

## 📖 目录

- [一、快速开始](#一快速开始)
- [二、如何获取 Token 与 UID](#二如何获取-token-与-uid)
- [三、账号配置方式](#三账号配置方式)
- [四、本地定时任务配置（免人工运行）](#四本地定时任务配置免人工运行)
  - [1. macOS 定时服务（LaunchAgent）](#1-macos-定时服务launchagent)
  - [2. Windows 计划任务](#2-windows-计划任务)
- [五、GitHub Actions 云端自动签到（无需电脑开机）](#五github-actions-云端自动签到无需电脑开机)
- [六、多渠道通知配置](#六多渠道通知配置)
- [免责声明](#免责声明)

---

## 一、快速开始

### 环境要求
- 安装 [Node.js](https://nodejs.org) (版本 >= 18.0.0)。

### 1. 克隆代码
```bash
git clone https://github.com/Drag0ndddd1118/workbuddy-auto-checkin.git
cd workbuddy-auto-checkin
```

### 2. 配置账号
复制配置模板文件：
```bash
cp accounts.example.json accounts.json
```
编辑 `accounts.json`，填入你的账号信息（详见[二、如何获取 Token 与 UID](#二如何获取-token-与-uid)）：
```json
[
  {
    "name": "我的主账号",
    "token": "你的_Bearer_Access_Token",
    "uid": "你的用户UID",
    "domain": "www.codebuddy.cn"
  }
]
```

### 3. 执行运行
```bash
# 执行签到并查询积分
node src/index.js

# 仅查询各账号当前积分与签到状态（不执行签到）
node src/index.js --check-only
```

运行输出效果预览：
```text
======================================================
[2026-10-06 08:30:05] 启动 WorkBuddy 每日自动签到
======================================================
共识别到 2 个账号：
  1. [accounts.json] 主账号 (UID: e133832a-...)
  2. [accounts.json] 小号2 (UID: 696b0871-...)
------------------------------------------------------

[处理中] 主账号 ... ✓ 签到成功! +100积分 | 连签: 7天 | 账户总积分: 3,100
[处理中] 小号2  ... ℹ 今日已签 | 连签: 7天 | 账户总积分: 3,200

======================================================
各账号分别可用总积分汇总清单：
------------------------------------------------------
• 主账号            | 连签:  7 天 | 可用总积分:   3,100 分 | 状态: ✓ 今日已领+100
• 小号2             | 连签:  7 天 | 可用总积分:   3,200 分 | 状态: ✓ 今日已签
------------------------------------------------------
所有账号累计总可用积分: 6,300 分
执行结果统计: 成功 1 个, 今日已签 1 个, 失败 0 个
======================================================
```

---

## 二、如何获取 Token 与 UID

你可以通过**浏览器开发者工具（F12）**轻松获取所需凭据：

1. 浏览器打开腾讯代码助手官网：[https://www.codebuddy.cn](https://www.codebuddy.cn) 或加油站活动页 [https://www.workbuddy.cn/profile/growth-center](https://www.workbuddy.cn/profile/growth-center)；
2. 登录你的账号；
3. 按 `F12`（Mac 上按 `Cmd + Option + I`）打开浏览器开发者工具，切换到 **网络（Network）** 标签页，勾选 `Fetch/XHR`；
4. 刷新一下页面，在网络请求列表中任意点击一个以 `/v2/` 开头的请求（例如 `checkin-activity-status` 或 `get-user-resource`）；
5. 查看该请求的 **标头（Headers）**：
   - **Token**：在「请求标头」中找到 `Authorization`，复制 `Bearer ` 后面的长字符串（以 `eyJ...` 开头）；
   - **UID**：在「请求标头」中找到 `X-User-Id`（形如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`），复制该值；
6. 将它们分别粘贴至 `accounts.json` 的 `token` 和 `uid` 字段中即可。

> 💡 **提示**：Access Token 通常有长达 30~60 天的有效有效期。如果账号提示过期，只需重新在此复制一次即可。

---

## 三、账号配置方式

本项目支持多种账号提供方式：

| 方式 | 适用场景 | 说明 |
| :--- | :--- | :--- |
| **`accounts.json` 文件** | 本地多账号运行 | 项目根目录创建 `accounts.json`，支持配置任意多个账号 |
| **环境变量 `WORKBUDDY_ACCOUNTS`** | GitHub Actions / Docker | 支持 JSON 字符串，或简写字符串：`token1#uid1,token2#uid2` |
| **自定义配置文件路径** | 脚本外部调用 | 命令行添加 `--config /path/to/my_accounts.json` |

---

## 四、本地定时任务配置（免人工运行）

### 1. macOS 定时服务（LaunchAgent）
项目中自带了一键安装脚本，每天早晨 **08:30** 自动静默运行；若当时电脑处于合盖休眠状态，macOS 会在**唤醒电脑时第一时间自动补签**。

在项目根目录下执行：
```bash
bash scripts/setup-macos.sh
```

- 查看运行日志：
  ```bash
  tail -f ~/Library/Logs/workbuddy-auto-checkin.log
  ```
- 如需卸载：
  ```bash
  launchctl unload ~/Library/LaunchAgents/com.workbuddy.auto-checkin.plist
  rm ~/Library/LaunchAgents/com.workbuddy.auto-checkin.plist
  ```

### 2. Windows 计划任务
Windows 提供了系统级「任务计划程序」，同样支持每天开机或定时静默执行。

1. 确保已在 `accounts.json` 中配置好账号；
2. 进入 `scripts` 目录，右键以**管理员身份运行** `setup-windows.bat`；
3. 任务将自动注册为每天早晨 `08:30` 静默运行。

---

## 五、GitHub Actions 云端自动签到（无需电脑开机）

即使你的电脑关机，也可以利用 GitHub Actions 免费服务器每天自动签到！

1. 点击本仓库右上角的 **Fork**，克隆一份到你的个人 GitHub 账号下；
2. 进入你 Fork 后的仓库，依次点击 **Settings** -> **Secrets and variables** -> **Actions**；
3. 点击 **New repository secret**，添加以下机密：
   - **Name**: `WORKBUDDY_ACCOUNTS`
   - **Secret**: 你的账号信息。可以填 JSON 格式，也可以填简易单行格式：
     ```text
     主账号#你的Token#你的UID,小号2#小号Token#小号UID
     ```
4. 进入仓库的 **Actions** 选项卡，点击左侧的 `WorkBuddy 每日自动签到`，点击 **Run workflow** 手动测试一次；
5. 测试成功后，GitHub 将在**每天北京时间 08:30** 自动定时为你签到并更新各账号积分。

---

## 六、多渠道通知配置

在本地环境变量或 GitHub Actions Secrets 中配置以下对应变量，签到完成后即可自动推送结果：

| 通道 | 环境变量名 | 说明 |
| :--- | :--- | :--- |
| **系统桌面横幅** | 无需配置 | macOS / Windows 本地运行时自动弹出包含各账号积分的横幅通知 |
| **Server酱 (微信)** | `SERVERCHAN_KEY` | 填入 `SCTxxxxxx` 密钥，推送至微信 |
| **PushPlus (微信)** | `PUSHPLUS_TOKEN` | 填入 PushPlus 用户 Token，推送至微信公众号 |
| **飞书机器人** | `FEISHU_WEBHOOK` | 填入飞书群自定义机器人的 Webhook 完整地址 |
| **钉钉机器人** | `DINGTALK_WEBHOOK` | 填入钉钉群自定义机器人的 Webhook 完整地址 |
| **企业微信机器人** | `WECOM_WEBHOOK` | 填入企微群机器人的 Webhook 完整地址 |
| **Telegram Bot** | `TELEGRAM_BOT_TOKEN`<br/>`TELEGRAM_CHAT_ID` | Telegram 机器人 Token 及接收通知的 Chat ID |

---

## 免责声明

1. 本项目仅供学习、交流与自动化技术研究使用，请勿用于非法用途或商业牟利。
2. 签到接口与活动规则归腾讯所有，使用本项目造成的任何封号、积分变动等问题均由使用者自行承担。

## 开源协议

本项目采用 [MIT License](LICENSE) 许可协议发布。
