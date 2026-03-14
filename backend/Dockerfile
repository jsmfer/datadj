# =============================================================================
# Dockerfile - 天津数据产权登记服务平台后端服务
# =============================================================================

FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖（用于SQLite等原生模块编译）
RUN apk add --no-cache python3 make g++ curl

# 先复制package文件，利用Docker缓存层
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制应用代码
COPY . .

# 创建必要目录
RUN mkdir -p data uploads/registrations logs

# 暴露端口
EXPOSE 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3002/api/health || exit 1

# 启动应用
CMD ["node", "server.js"]
