#!/bin/bash
# =============================================================================
# 本地部署脚本 - 将代码上传到腾讯云服务器并部署
# 使用方法: ./upload-and-deploy.sh <服务器IP> [SSH端口] [用户名]
# 示例: ./upload-and-deploy.sh 123.456.789.012 22 root
# =============================================================================

set -e

SERVER_IP=$1
SSH_PORT=${2:-22}
SSH_USER=${3:-root}

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$SERVER_IP" ]; then
    echo -e "${RED}错误: 请提供服务器的公网IP${NC}"
    echo "用法: $0 <服务器IP> [SSH端口] [用户名]"
    echo "示例: $0 123.456.789.012"
    exit 1
fi

echo "=========================================="
echo "天津数据产权登记服务平台 - 部署工具"
echo "=========================================="
echo "目标服务器: $SERVER_IP"
echo "SSH端口: $SSH_PORT"
echo "用户名: $SSH_USER"
echo "=========================================="

# 获取项目根目录
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
echo "项目目录: $PROJECT_ROOT"

# 检查SSH连接
echo ""
echo "[1/4] 检查SSH连接..."
if ! ssh -o ConnectTimeout=5 -p $SSH_PORT $SSH_USER@$SERVER_IP "echo 'SSH连接成功'" 2>/dev/null; then
    echo -e "${RED}错误: 无法连接到服务器，请检查IP、端口和密钥配置${NC}"
    exit 1
fi
echo -e "${GREEN}SSH连接成功${NC}"

# 上传代码
echo ""
echo "[2/4] 上传代码到服务器..."
echo "正在压缩并上传文件（排除node_modules和.git）..."

# 创建临时目录
TEMP_DIR=$(mktemp -d)
tar czf "$TEMP_DIR/datadj.tar.gz" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.DS_Store' \
    --exclude='uploads' \
    --exclude='data/*.db' \
    --exclude='logs' \
    -C "$PROJECT_ROOT" .

# 上传到服务器
scp -P $SSH_PORT "$TEMP_DIR/datadj.tar.gz" $SSH_USER@$SERVER_IP:/tmp/
rm -rf "$TEMP_DIR"

# 解压到目标目录
echo "解压代码..."
ssh -p $SSH_PORT $SSH_USER@$SERVER_IP "
    mkdir -p /home/datadj/apps/datadj
    cd /home/datadj/apps/datadj
    tar xzf /tmp/datadj.tar.gz
    rm /tmp/datadj.tar.gz
    chown -R datadj:datadj /home/datadj
"

echo -e "${GREEN}代码上传完成${NC}"

# 上传并执行部署脚本
echo ""
echo "[3/4] 执行远程部署..."
scp -P $SSH_PORT "$PROJECT_ROOT/deploy/tencent-cloud-deploy.sh" $SSH_USER@$SERVER_IP:/tmp/
ssh -p $SSH_PORT $SSH_USER@$SERVER_IP "bash /tmp/tencent-cloud-deploy.sh"

echo -e "${GREEN}远程部署完成${NC}"

# 部署后验证
echo ""
echo "[4/4] 验证部署..."
sleep 2

# 测试API
if curl -s "http://$SERVER_IP/api/health" > /dev/null 2>&1 || curl -s "http://$SERVER_IP/api/auth/login" -X POST > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API服务运行正常${NC}"
else
    echo -e "${YELLOW}⚠ API服务可能未完全启动，请稍后手动检查${NC}"
fi

# 测试前端
if curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP/" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓ 前端页面可访问${NC}"
else
    echo -e "${YELLOW}⚠ 前端页面可能未完全部署${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}部署流程执行完毕！${NC}"
echo "=========================================="
echo ""
echo "访问地址:"
echo "  首页:     http://$SERVER_IP/"
echo "  管理后台: http://$SERVER_IP/admin/"
echo ""
echo "如需配置域名和HTTPS，请参考 TENCENT_CLOUD_DEPLOYMENT_GUIDE.md"
echo ""
