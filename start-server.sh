#!/bin/bash

# 天津数据产权登记服务平台启动脚本

echo "🚀 启动天津数据产权登记服务平台..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 安装依赖
echo "📦 安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi

# 初始化数据库
echo "🗄️ 初始化数据库..."
if [ ! -f "data/tj_data_property.db" ]; then
    node scripts/initDatabase.js
else
    echo "   数据库已存在，跳过初始化"
fi

# 启动服务器
echo "🌐 启动 API 服务器..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  服务启动成功！"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  📱 前端访问: http://localhost:8888"
echo "  🔧 后端API:  http://localhost:3002/api"
echo "  🎛️  管理后台: http://localhost:3002/admin/"
echo ""
echo "  管理员账号: admin / admin123"
echo "  测试账号:   13800138000 / 123456"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# 在后台启动前端服务器
cd ..
echo "🎨 启动前端服务器 (端口 8888)..."
nohup python3 -m http.server 8888 > /dev/null 2>&1 &
PYTHON_PID=$!

# 启动后端服务器
node backend/server.js &
NODE_PID=$!

# 捕获Ctrl+C
trap "echo ''; echo '🛑 正在停止服务...'; kill $PYTHON_PID $NODE_PID 2>/dev/null; exit 0" INT

wait
