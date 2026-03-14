#!/bin/bash
# =============================================================================
# 天津数据产权登记服务平台 - 腾讯云一键部署脚本
# 适用环境: CentOS 8 / Ubuntu 20.04
# =============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    log_error "请使用root用户运行此脚本"
    exit 1
fi

# 获取系统信息
OS=$(cat /etc/os-release | grep ^ID= | cut -d= -f2 | tr -d '"')
VERSION=$(cat /etc/os-release | grep ^VERSION_ID= | cut -d= -f2 | tr -d '"')

log_info "检测到操作系统: $OS $VERSION"

# 配置参数（可根据需要修改）
APP_USER="datadj"
APP_DIR="/home/datadj/apps/datadj"
NODE_VERSION="20"
APP_PORT="3002"

# =============================================================================
# 步骤1: 系统更新和基础依赖
# =============================================================================
log_info "步骤1/10: 更新系统和安装基础依赖..."

if [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    yum update -y
    yum install -y epel-release
    yum install -y curl wget git vim nginx firewalld
elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get update
    apt-get upgrade -y
    apt-get install -y curl wget git vim nginx ufw
else
    log_error "不支持的操作系统: $OS"
    exit 1
fi

log_success "基础依赖安装完成"

# =============================================================================
# 步骤2: 创建应用用户
# =============================================================================
log_info "步骤2/10: 创建应用用户..."

if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    log_info "用户 $APP_USER 创建成功"
else
    log_warn "用户 $APP_USER 已存在"
fi

# =============================================================================
# 步骤3: 安装Node.js
# =============================================================================
log_info "步骤3/10: 安装Node.js v$NODE_VERSION..."

if ! command -v nvm &> /dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

source ~/.bashrc 2>/dev/null || true
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install $NODE_VERSION
nvm use $NODE_VERSION
nvm alias default $NODE_VERSION

NODE_PATH=$(which node)
NPM_PATH=$(which npm)

log_info "Node.js 版本: $($NODE_PATH -v)"
log_info "npm 版本: $($NPM_PATH -v)"

# 全局安装PM2
$NPM_PATH install -g pm2

log_success "Node.js 和 PM2 安装完成"

# =============================================================================
# 步骤4: 配置防火墙
# =============================================================================
log_info "步骤4/10: 配置防火墙..."

if [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    systemctl enable firewalld
    systemctl start firewalld
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-port=$APP_PORT/tcp
    firewall-cmd --reload
elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    ufw allow 'Nginx Full'
    ufw allow $APP_PORT/tcp
    ufw --force enable
fi

log_success "防火墙配置完成"

# =============================================================================
# 步骤5: 检查应用代码
# =============================================================================
log_info "步骤5/10: 检查应用代码..."

if [ ! -d "$APP_DIR" ]; then
    log_warn "应用目录不存在: $APP_DIR"
    log_info "请将应用代码上传到 $APP_DIR 目录后再次运行此脚本"
    mkdir -p "$APP_DIR"
    chown -R $APP_USER:$APP_USER /home/datadj
    exit 0
fi

# =============================================================================
# 步骤6: 安装应用依赖
# =============================================================================
log_info "步骤6/10: 安装应用依赖..."

cd "$APP_DIR/backend"

# 检查是否存在package.json
if [ ! -f "package.json" ]; then
    log_error "未找到package.json，请确认代码已正确上传"
    exit 1
fi

# 安装依赖
$NPM_PATH install --production

log_success "应用依赖安装完成"

# =============================================================================
# 步骤7: 初始化环境配置
# =============================================================================
log_info "步骤7/10: 初始化环境配置..."

# 创建.env文件（如果不存在）
if [ ! -f ".env" ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | head -c 64)
    cat > .env << ENVFILE
PORT=3002
NODE_ENV=production
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
DB_PATH=./data/tj_data_property.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
LOG_LEVEL=info
ENVFILE
    log_info "已创建默认.env配置文件"
    log_warn "请记录JWT_SECRET: $JWT_SECRET"
else
    log_info ".env文件已存在，跳过创建"
fi

# 创建必要目录
mkdir -p data uploads/registrations logs
chown -R $APP_USER:$APP_USER "$APP_DIR"

log_success "环境配置完成"

# =============================================================================
# 步骤8: 初始化数据库
# =============================================================================
log_info "步骤8/10: 初始化数据库..."

if [ -f "scripts/initDatabase.js" ]; then
    $NODE_PATH scripts/initDatabase.js
    log_success "数据库初始化完成"
else
    log_warn "未找到数据库初始化脚本，跳过"
fi

# =============================================================================
# 步骤9: 配置PM2
# =============================================================================
log_info "步骤9/10: 配置PM2进程管理..."

cat > ecosystem.config.js << 'PM2CONFIG'
module.exports = {
  apps: [{
    name: 'tj-data-property-api',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M',
    restart_delay: 3000,
    max_restarts: 5,
    min_uptime: '10s',
    autorestart: true,
    exp_backoff_restart_delay: 100,
    watch: false
  }]
};
PM2CONFIG

# 启动应用
pm2 start ecosystem.config.js 2>/dev/null || pm2 restart ecosystem.config.js
pm2 save

# 设置开机自启
pm2 startup systemd -u $APP_USER --hp /home/$APP_USER 2>/dev/null || true

log_success "PM2配置完成，应用已启动"

# =============================================================================
# 步骤10: 配置Nginx
# =============================================================================
log_info "步骤10/10: 配置Nginx反向代理..."

# 获取服务器公网IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")

cat > /etc/nginx/conf.d/datadj.conf << NGINXCONF
server {
    listen 80;
    server_name _;

    access_log /var/log/nginx/datadj-access.log;
    error_log /var/log/nginx/datadj-error.log;

    # 前端静态文件
    location / {
        root $APP_DIR;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)\$ {
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }

    # 后端API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 管理后台
    location /admin {
        alias $APP_DIR/backend/admin;
        index index.html;
        try_files \$uri \$uri/ =404;
    }

    # 上传文件访问
    location /uploads/ {
        alias $APP_DIR/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
NGINXCONF

# 测试Nginx配置
nginx -t

# 启动Nginx
systemctl enable nginx
systemctl restart nginx

log_success "Nginx配置完成"

# =============================================================================
# 部署完成
# =============================================================================
echo ""
echo "========================================"
echo -e "${GREEN}部署完成！${NC}"
echo "========================================"
echo ""
echo "应用信息:"
echo "  - 访问地址: http://$SERVER_IP/"
echo "  - 管理后台: http://$SERVER_IP/admin/"
echo "  - 后端API:  http://$SERVER_IP/api/"
echo ""
echo "默认账号:"
echo "  - 管理员: admin / admin123"
echo "  - 数据持有者: 13800138000 / 123456"
echo "  - 数据使用者: 13900139000 / 123456"
echo ""
echo "常用命令:"
echo "  - 查看应用状态: pm2 status"
echo "  - 查看日志: pm2 logs"
echo "  - 重启应用: pm2 restart tj-data-property-api"
echo "  - 查看Nginx日志: tail -f /var/log/nginx/datadj-error.log"
echo ""
echo "========================================"
