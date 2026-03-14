@echo off
chcp 65001 >nul

:: 天津数据产权登记服务平台启动脚本 (Windows)

echo 🚀 启动天津数据产权登记服务平台...

:: 检查Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Node.js 未安装
    exit /b 1
)

echo ✅ Node.js 已安装

:: 安装依赖
echo 📦 检查后端依赖...
cd backend
if not exist "node_modules" (
    npm install
)

:: 初始化数据库
echo 🗄️ 初始化数据库...
if not exist "data\tj_data_property.db" (
    node scripts\initDatabase.js
) else (
    echo    数据库已存在，跳过初始化
)

:: 启动前端服务器
cd ..
echo 🎨 启动前端服务器...
start /b python -m http.server 8888 >nul 2>&1

echo.
echo ═══════════════════════════════════════════════════════════
echo   服务启动成功！
echo ═══════════════════════════════════════════════════════════
echo.
echo   📱 前端访问: http://localhost:8888
echo   🔧 后端API:  http://localhost:3002/api
echo   🎛️  管理后台: http://localhost:3002/admin/
echo.
echo   管理员账号: admin / admin123
echo   测试账号:   13800138000 / 123456
echo.
echo ═══════════════════════════════════════════════════════════
echo.

:: 启动后端服务器
node backend/server.js

pause
