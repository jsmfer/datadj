# 天津数据产权登记服务平台 - API 文档

## 基础信息

- **API 地址**: `http://localhost:3002/api`
- **管理后台**: `http://localhost:3002/admin/`
- **数据格式**: JSON

## 认证方式

使用 JWT Token 进行认证，在请求头中添加：
```
Authorization: Bearer <token>
```

---

## 接口列表

### 1. 认证接口

#### 用户登录
- **URL**: `/auth/login`
- **方法**: POST
- **请求体**:
```json
{
  "phone": "13800138000",
  "password": "123456"
}
```

#### 用户注册
- **URL**: `/auth/register`
- **方法**: POST
- **请求体**:
```json
{
  "username": "张三",
  "phone": "13800138000",
  "password": "123456",
  "role": "data_holder",
  "organization": "公司名称"
}
```

#### 获取当前用户信息
- **URL**: `/auth/me`
- **方法**: GET
- **认证**: 需要

---

### 2. 数据产权登记接口

#### 获取登记列表
- **URL**: `/registrations`
- **方法**: GET
- **参数**:
  - `page`: 页码 (默认: 1)
  - `pageSize`: 每页数量 (默认: 10)
  - `status`: 状态筛选 (pending/approved/rejected)
  - `category`: 类型筛选 (financial/medical/traffic/education/industrial/other)
  - `keyword`: 关键词搜索

#### 获取登记详情
- **URL**: `/registrations/:id`
- **方法**: GET

#### 提交登记申请
- **URL**: `/registrations`
- **方法**: POST
- **认证**: 需要
- **请求体**:
```json
{
  "title": "数据资产名称",
  "category": "financial",
  "dataType": "structured",
  "dataSize": "large",
  "dataSource": "数据来源",
  "applicationScene": "应用场景描述"
}
```

#### 获取我的登记
- **URL**: `/registrations/user/my`
- **方法**: GET
- **认证**: 需要

#### 获取统计数据
- **URL**: `/registrations/stats/overview`
- **方法**: GET

---

### 3. 维权服务接口

#### 获取维权案件列表
- **URL**: `/protection`
- **方法**: GET
- **认证**: 需要

#### 获取案件详情
- **URL**: `/protection/:id`
- **方法**: GET
- **认证**: 需要

#### 提交维权申请
- **URL**: `/protection`
- **方法**: POST
- **认证**: 需要

---

### 4. 新闻公告接口

#### 获取新闻列表
- **URL**: `/news`
- **方法**: GET
- **参数**:
  - `page`: 页码
  - `category`: 分类筛选

#### 获取新闻详情
- **URL**: `/news/:id`
- **方法**: GET

---

### 5. 管理后台接口 (需管理员权限)

#### 仪表盘统计
- **URL**: `/admin/dashboard`
- **方法**: GET
- **认证**: 需要管理员权限

#### 用户管理
- **获取用户列表**: GET `/admin/users`
- **更新用户状态**: PUT `/admin/users/:id/status`

#### 登记管理
- **获取登记列表**: GET `/admin/registrations`
- **审核登记**: PUT `/admin/registrations/:id/review`

#### 系统配置
- **获取配置**: GET `/admin/config`
  - 返回所有系统配置项
  - 响应: `{ "success": true, "data": { "site_name": "...", "site_description": "...", ... } }`
  
- **更新配置**: PUT `/admin/config/:key`
  - 请求体: `{ "value": "配置值" }`
  - 支持动态创建新配置项
  
- **公开配置接口**: GET `/news/config`
  - 无需登录即可访问
  - 用于前端页面获取网站基本信息

**系统配置项说明**:

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `site_name` | 网站名称 | 天津数据产权登记服务平台 |
| `site_description` | 网站描述 | 构建权威、高效、可信的数据产权登记体系 |
| `site_keywords` | 网站关键词(SEO) | 数据产权,登记服务,天津数据,数据资产 |
| `site_logo` | 网站Logo URL | - |
| `site_icp` | 网站备案号 | 津ICP备12345678号 |
| `contact_phone` | 联系电话 | 400-123-4567 |
| `contact_email` | 联系邮箱 | service@tjdata.gov.cn |
| `contact_address` | 联系地址 | 天津市滨海新区... |
| `contact_hours` | 工作时间 | 周一至周五 9:00-18:00 |
| `review_days` | 审核周期(天) | 7 |
| `publicity_days` | 公示周期(天) | 15 |
| `max_daily_applications` | 单日最大申请数 | 10 |
| `max_file_size` | 文件大小限制(MB) | 50 |
| `copyright_text` | 版权信息 | © 2024 天津市数据产权登记中心 |
| `tech_support` | 技术支持单位 | 天津大数据管理中心 |

---

## 默认账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 管理员 |
| 13800138000 | 123456 | 数据持有方 |
| 13900139000 | 123456 | 数据使用方 |
| 13700137000 | 123456 | 监管方 |

---

## 数据库结构

### 主要数据表

1. **users** - 用户表
2. **registrations** - 数据产权登记表
3. **registration_files** - 登记文件表
4. **protection_cases** - 维权案件表
5. **bookmarks** - 收藏表
6. **news** - 新闻公告表
7. **operation_logs** - 操作日志表
8. **system_config** - 系统配置表

---

## 启动服务

### macOS/Linux
```bash
./start-server.sh
```

### Windows
```bash
start-server.bat
```

### 手动启动
```bash
# 1. 启动前端 (端口 8888)
python3 -m http.server 8888

# 2. 启动后端 (端口 3002)
cd backend
npm install
node scripts/initDatabase.js  # 初始化数据库
node server.js               # 启动API服务
```
