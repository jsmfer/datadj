# 天津数据产权登记服务平台

一个完整的政府级别数据产权登记服务平台，包含用户管理、数据产权登记、查询公示、维权服务等核心功能模块。

## 项目概述

天津数据产权登记服务平台是基于区块链、大数据、人工智能等前沿技术构建的权威数据产权登记体系，为数据资产赋予清晰、可追溯的产权标识，实现数据产权的全生命周期管理。

## 功能特性

### 核心功能模块

1. **用户管理系统**
   - 多角色注册系统（数据持有方/使用方/监管方/管理员）
   - 手机号验证码登录
   - 数字证书登录（预留）
   - 实名认证流程
   - 权限分级管控

2. **数据产权登记模块**
   - 在线登记申请
   - 智能表单系统
   - 材料上传预览
   - AI辅助审核
   - 进度跟踪查询
   - 证书生成下载

3. **查询公示模块**
   - 多维度搜索引擎
   - 高级筛选功能
   - 数据可视化展示
   - 详情查看页面
   - 异议处理系统
   - 收藏关注功能

4. **维权服务模块**
   - 侵权监测预警
   - 维权申请提交
   - 证据材料上传
   - 法律咨询平台
   - 案例展示学习
   - 维权进度跟踪

5. **管理后台模块**
   - 仪表盘统计
   - 用户管理
   - 登记审核
   - 维权案件处理
   - 系统配置

## 技术架构

### 前端技术栈
- HTML5 + CSS3 + JavaScript
- Tailwind CSS 框架
- ECharts.js - 数据可视化
- Anime.js - 页面动画
- p5.js - 创意背景效果
- Splide.js - 轮播组件

### 后端技术栈
- Node.js + Express
- SQLite3 数据库
- JWT 认证
- bcryptjs 密码加密
- multer 文件上传
- express-validator 参数校验

### 系统要求
- Node.js >= 14.0.0
- npm >= 6.0.0
- Python 3.x（用于静态文件服务）

## 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd datadj
```

### 2. 安装依赖
```bash
cd backend
npm install
```

### 3. 初始化数据库
```bash
npm run init-db
```

### 4. 启动服务

**macOS/Linux:**
```bash
./start-server.sh
```

**Windows:**
```bash
start-server.bat
```

**手动启动:**
```bash
# 终端1 - 启动前端（端口 8888）
python3 -m http.server 8888

# 终端2 - 启动后端（端口 3002）
cd backend
npm start
```

### 5. 访问系统

- 前端访问: http://localhost:8888
- 后端API: http://localhost:3002/api
- 管理后台: http://localhost:3002/admin/

## 默认账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 管理员 |
| 13800138000 | 123456 | 数据持有方 |
| 13900139000 | 123456 | 数据使用方 |
| 13700137000 | 123456 | 监管方 |

## 项目结构

```
datadj/
├── index.html          # 首页
├── user.html           # 用户中心
├── register.html       # 数据产权登记
├── search.html         # 查询公示
├── protect.html        # 维权服务
├── main.js             # 主要JavaScript功能
├── js/
│   ├── api.js          # API服务层
│   └── auth-check.js   # 登录状态检查
├── backend/
│   ├── server.js       # Express服务器
│   ├── database.js     # 数据库连接
│   ├── routes/         # API路由
│   │   ├── auth.js
│   │   ├── registrations.js
│   │   ├── protection.js
│   │   ├── news.js
│   │   ├── admin.js
│   │   └── upload.js
│   ├── middleware/
│   │   └── auth.js     # 认证中间件
│   ├── utils/
│   │   └── helpers.js  # 工具函数
│   ├── scripts/
│   │   └── initDatabase.js  # 数据库初始化
│   └── data/           # SQLite数据库文件
├── resources/          # 图片资源
└── start-server.sh     # 启动脚本
```

## API 文档

详细的API文档请参考 [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

### 主要API端点

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户信息
- `GET /api/registrations` - 获取登记列表
- `POST /api/registrations` - 提交登记申请
- `GET /api/protection` - 获取维权案件列表
- `POST /api/protection` - 提交维权申请
- `GET /api/news` - 获取新闻列表
- `GET /api/admin/dashboard` - 管理员仪表盘

## 测试

运行API测试脚本：
```bash
bash test-api.sh
```

## 部署

### 生产环境部署

1. 设置环境变量
```bash
export NODE_ENV=production
export JWT_SECRET=your-secret-key
export PORT=3002
```

2. 使用PM2启动服务
```bash
npm install -g pm2
pm2 start backend/server.js --name "tj-data-property"
```

3. 配置Nginx反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /path/to/datadj;
        index index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 更新日志

### v1.0.0 (2024-11)
- 初始版本发布
- 实现用户管理、数据产权登记、查询公示、维权服务等核心功能
- 完成管理后台开发
- 添加数据可视化功能

## 许可证

本项目为政府项目，仅供学习和参考使用。

## 联系方式

- 技术支持：天津大数据管理中心
- 联系邮箱：service@tjdata.gov.cn
- 联系电话：400-123-4567

## 致谢

感谢所有参与项目开发和测试的团队成员。
