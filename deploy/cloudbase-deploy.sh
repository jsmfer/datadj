#!/bin/bash

# =============================================================================
# CloudBase 云托管一键部署脚本
# 天津数据产权登记服务平台
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js 16+"
        exit 1
    fi
    
    if ! command -v tcb &> /dev/null; then
        print_warning "CloudBase CLI 未安装，正在安装..."
        npm install -g @cloudbase/cli
    fi
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker 未安装，本地构建容器可能需要 Docker"
    fi
    
    print_success "依赖检查完成"
}

# 检查登录状态
check_login() {
    print_info "检查 CloudBase 登录状态..."
    
    if ! tcb whoami &> /dev/null; then
        print_warning "未登录 CloudBase，请先登录"
        tcb login
    else
        print_success "已登录 CloudBase"
        tcb whoami
    fi
}

# 配置环境ID
configure_env() {
    print_info "配置环境..."
    
    # 读取当前配置
    CURRENT_ENV=$(grep '"envId"' cloudbaserc.json | cut -d'"' -f4)
    
    if [ "$CURRENT_ENV" != "your-env-id-here" ]; then
        print_info "当前环境ID: $CURRENT_ENV"
        read -p "是否更换环境ID? (y/N): " change_env
        if [ "$change_env" != "y" ] && [ "$change_env" != "Y" ]; then
            return
        fi
    fi
    
    # 列出可用环境
    print_info "获取环境列表..."
    tcb env:list
    
    echo ""
    read -p "请输入 CloudBase 环境ID: " env_id
    
    if [ -z "$env_id" ]; then
        print_error "环境ID不能为空"
        exit 1
    fi
    
    # 更新配置文件
    sed -i.bak "s/\"envId\": \"your-env-id-here\"/\"envId\": \"$env_id\"/" cloudbaserc.json
    rm -f cloudbaserc.json.bak
    
    print_success "环境ID已配置: $env_id"
}

# 配置 JWT 密钥
configure_jwt() {
    print_info "配置 JWT 密钥..."
    
    CURRENT_JWT=$(grep '"JWT_SECRET"' cloudbaserc.json | cut -d'"' -f4)
    
    if [ "$CURRENT_JWT" != "your-jwt-secret-change-this" ]; then
        print_info "JWT 密钥已配置"
        return
    fi
    
    read -p "请输入 JWT 密钥 (留空自动生成): " jwt_secret
    
    if [ -z "$jwt_secret" ]; then
        jwt_secret=$(openssl rand -base64 32 2>/dev/null || date +%s | sha256sum | base64 | head -c 32)
        print_info "已自动生成 JWT 密钥"
    fi
    
    # 更新配置文件
    sed -i.bak "s/\"JWT_SECRET\": \"your-jwt-secret-change-this\"/\"JWT_SECRET\": \"$jwt_secret\"/" cloudbaserc.json
    rm -f cloudbaserc.json.bak
    
    print_success "JWT 密钥已配置"
}

# 本地测试构建
test_build() {
    print_info "本地测试构建..."
    
    cd backend
    
    if [ ! -f "Dockerfile" ]; then
        print_error "Dockerfile 不存在"
        exit 1
    fi
    
    print_info "构建 Docker 镜像..."
    docker build -t datadj-api:test .
    
    print_success "本地构建成功"
    print_info "可以通过以下命令测试:"
    echo "  docker run -p 3002:3002 datadj-api:test"
    
    cd ..
}

# 部署前端
deploy_frontend() {
    print_info "部署前端到静态网站托管..."
    
    tcb framework:deploy client
    
    print_success "前端部署完成"
}

# 部署后端
deploy_backend() {
    print_info "部署后端到云托管..."
    
    tcb framework:deploy server
    
    print_success "后端部署完成"
}

# 一键部署全部
deploy_all() {
    print_info "开始一键部署..."
    
    deploy_frontend
    deploy_backend
    
    print_success "全部部署完成！"
    show_access_info
}

# 显示访问信息
show_access_info() {
    print_info "获取访问信息..."
    
    ENV_ID=$(grep '"envId"' cloudbaserc.json | cut -d'"' -f4)
    
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "                   部署成功！"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "  🌐 默认访问地址:"
    echo "     前端: https://$ENV_ID.tcloudbaseapp.com"
    echo "     后端: https://$ENV_ID.service.tcloudbaseapp.com/api"
    echo ""
    echo "  🔧 管理后台:"
    echo "     https://$ENV_ID.tcloudbaseapp.com/admin/"
    echo ""
    echo "  👤 默认账号:"
    echo "     管理员: admin / admin123"
    echo ""
    echo "  📖 查看日志:"
    echo "     tcb service:logs datadj-api"
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    
    # 保存访问信息到文件
    cat > DEPLOY_INFO.txt << EOF
部署时间: $(date)
环境ID: $ENV_ID
前端地址: https://$ENV_ID.tcloudbaseapp.com
后端地址: https://$ENV_ID.service.tcloudbaseapp.com/api
管理后台: https://$ENV_ID.tcloudbaseapp.com/admin/
管理员账号: admin / admin123
EOF
    
    print_info "访问信息已保存到 DEPLOY_INFO.txt"
}

# 查看服务状态
show_status() {
    print_info "查看服务状态..."
    
    tcb service:list
}

# 查看日志
show_logs() {
    print_info "查看后端服务日志..."
    
    tcb service:logs datadj-api --tail
}

# 主菜单
show_menu() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "        CloudBase 云托管部署工具"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "  1) 完整初始化配置"
    echo "  2) 部署前端（静态网站托管）"
    echo "  3) 部署后端（云托管容器）"
    echo "  4) 一键部署全部"
    echo "  5) 查看服务状态"
    echo "  6) 查看服务日志"
    echo "  7) 本地测试构建"
    echo "  0) 退出"
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo ""
}

# 主函数
main() {
    # 检查是否在项目根目录
    if [ ! -f "cloudbaserc.json" ]; then
        print_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    check_dependencies
    
    while true; do
        show_menu
        read -p "请选择操作 [0-7]: " choice
        
        case $choice in
            1)
                check_login
                configure_env
                configure_jwt
                print_success "初始化配置完成"
                ;;
            2)
                deploy_frontend
                ;;
            3)
                deploy_backend
                ;;
            4)
                deploy_all
                ;;
            5)
                show_status
                ;;
            6)
                show_logs
                ;;
            7)
                test_build
                ;;
            0)
                print_info "退出"
                exit 0
                ;;
            *)
                print_error "无效选项"
                ;;
        esac
        
        echo ""
        read -p "按回车键继续..."
    done
}

# 如果直接传参数，执行对应功能
if [ $# -gt 0 ]; then
    case $1 in
        "init")
            check_dependencies
            check_login
            configure_env
            configure_jwt
            ;;
        "frontend")
            deploy_frontend
            ;;
        "backend")
            deploy_backend
            ;;
        "deploy")
            deploy_all
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "build")
            test_build
            ;;
        *)
            echo "用法: $0 [init|frontend|backend|deploy|status|logs|build]"
            exit 1
            ;;
    esac
else
    # 交互式菜单
    main
fi
