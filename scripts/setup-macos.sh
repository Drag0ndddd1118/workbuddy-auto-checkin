#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_PATH="$(which node)"
PLIST_NAME="com.workbuddy.auto-checkin.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "=== 配置 macOS 每日自动签到定时任务 ==="

if [ -z "$NODE_PATH" ]; then
  echo "错误: 未找到 node 命令，请先安装 Node.js"
  exit 1
fi

echo "项目路径: $PROJECT_DIR"
echo "Node路径: $NODE_PATH"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs"

cat << PLIST > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.workbuddy.auto-checkin</string>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$PROJECT_DIR/src/index.js</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>30</integer>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/workbuddy-auto-checkin.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/workbuddy-auto-checkin.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "✓ 成功配置并加载 LaunchAgent: $PLIST_PATH"
echo "✓ 每日 08:30 自动静默执行 (电脑休眠唤醒后会自动补签)"
echo "✓ 日志查看: tail -f $HOME/Library/Logs/workbuddy-auto-checkin.log"
