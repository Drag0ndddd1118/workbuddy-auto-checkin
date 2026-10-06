@echo off
chcp 65001 >nul
echo ====================================================
echo   WorkBuddy 每日自动签到 - Windows 任务计划程序配置
echo ====================================================

set PROJECT_DIR=%~dp0..
cd /d "%PROJECT_DIR%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (https://nodejs.org)
    pause
    exit /b 1
)

for /f "delims=" %%i in ('where node') do set NODE_PATH=%%i & goto :found_node
:found_node

echo 项目路径: %PROJECT_DIR%
echo Node 路径: %NODE_PATH%

echo.
echo 正在创建 Windows 计划任务 (每天早晨 08:30 自动执行)...
schtasks /Create /SC DAILY /TN "WorkBuddyAutoCheckin" /TR "\"%NODE_PATH%\" \"%PROJECT_DIR%\src\index.js\"" /ST 08:30 /F

if %errorlevel% equ 0 (
    echo.
    echo [成功] 任务已成功添加到 Windows 任务计划程序！
    echo 每天早晨 08:30 将在后台自动执行签到。
    echo 如需手动测试运行，可双击执行项目根目录下的 run.bat。
) else (
    echo.
    echo [提示] 如果创建失败，请尝试「右键以管理员身份运行」本脚本。
)

echo.
pause
