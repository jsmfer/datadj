# 天津数据产权登记服务平台 - 数据库数据字典

> 数据库类型：SQLite3  
> 数据库文件：`tj_data_property.db`  
> 最后更新：2026-03-07

---

## 📋 目录

1. [用户表 (users)](#1-用户表-users)
2. [数据产权登记表 (registrations)](#2-数据产权登记表-registrations)
3. [登记文件表 (registration_files)](#3-登记文件表-registration_files)
4. [维权申请表 (protection_cases)](#4-维权申请表-protection_cases)
5. [维权案件证据文件表 (protection_evidence)](#5-维权案件证据文件表-protection_evidence)
6. [异议申请表 (objections)](#6-异议申请表-objections)
7. [收藏表 (bookmarks)](#7-收藏表-bookmarks)
8. [新闻公告表 (news)](#8-新闻公告表-news)
9. [操作日志表 (operation_logs)](#9-操作日志表-operation_logs)
10. [认证申请表 (verification_applications)](#10-认证申请表-verification_applications)
11. [系统配置表 (system_config)](#11-系统配置表-system_config)
12. [数据库索引](#12-数据库索引)

---

## 1. 用户表 (users)

存储平台用户信息，支持多角色（数据持有方、数据使用方、监管方、管理员）

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 用户ID，主键 |
| username | VARCHAR(50) | NOT NULL | - | 用户名 |
| phone | VARCHAR(20) | UNIQUE NOT NULL | - | 手机号，登录账号 |
| email | VARCHAR(100) | UNIQUE | NULL | 邮箱地址 |
| password | VARCHAR(255) | NOT NULL | - | 加密后的密码 |
| role | VARCHAR(20) | CHECK | 'data_holder' | 用户角色：data_holder(数据持有方), data_user(数据使用方), regulator(监管方), admin(管理员) |
| avatar | VARCHAR(255) | - | NULL | 头像URL |
| real_name | VARCHAR(50) | - | NULL | 真实姓名 |
| id_card | VARCHAR(18) | - | NULL | 身份证号 |
| organization | VARCHAR(100) | - | NULL | 所属机构或单位 |
| org_code | VARCHAR(50) | - | NULL | 机构代码 |
| verified | INTEGER | - | 0 | 实名认证状态：0-未认证, 1-已认证 |
| verified_at | DATETIME | - | NULL | 认证时间 |
| status | INTEGER | CHECK | 1 | 账号状态：0-禁用, 1-正常 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**索引**：
- `idx_users_phone` (phone) - 手机号索引
- `idx_users_status` (status) - 状态索引

---

## 2. 数据产权登记表 (registrations)

存储数据产权登记申请信息

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 登记ID，主键 |
| registration_no | VARCHAR(50) | UNIQUE NOT NULL | - | 登记编号，如 TJDR202411150001 |
| title | VARCHAR(200) | NOT NULL | - | 数据资产名称 |
| category | VARCHAR(50) | NOT NULL CHECK | - | 数据分类：financial(金融), medical(医疗), traffic(交通), education(教育), industrial(工业), other(其他) |
| data_type | VARCHAR(50) | NOT NULL CHECK | - | 数据类型：structured(结构化), unstructured(非结构化), semi-structured(半结构化), real-time(实时) |
| data_size | VARCHAR(20) | CHECK | NULL | 数据规模：small(<1GB), medium(1-100GB), large(100GB-1TB), extra-large(>1TB) |
| data_source | TEXT | - | NULL | 数据来源描述 |
| application_scene | TEXT | - | NULL | 应用场景描述 |
| update_frequency | VARCHAR(20) | CHECK | NULL | 更新频率：real-time(实时), daily(每日), weekly(每周), monthly(每月), quarterly(每季), yearly(每年), static(静态) |
| data_format | VARCHAR(50) | - | NULL | 数据格式，如 JSON, CSV, XML |
| expected_value | TEXT | - | NULL | 预期价值描述 |
| description | TEXT | - | NULL | 详细描述 |
| holder_id | INTEGER | NOT NULL | - | 持有者用户ID，外键关联 users.id |
| holder_name | VARCHAR(100) | NOT NULL | - | 持有者名称（冗余存储） |
| status | VARCHAR(20) | CHECK | 'pending' | 登记状态：pending(待审核), reviewing(审核中), approved(已通过), rejected(已驳回), revoked(已撤销) |
| review_comment | TEXT | - | NULL | 审核意见 |
| reviewed_by | INTEGER | - | NULL | 审核人ID，外键关联 users.id |
| reviewed_at | DATETIME | - | NULL | 审核时间 |
| published_at | DATETIME | - | NULL | 公示时间 |
| expires_at | DATETIME | - | NULL | 有效期至 |
| view_count | INTEGER | - | 0 | 浏览次数 |
| bookmark_count | INTEGER | - | 0 | 收藏次数 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**索引**：
- `idx_registrations_status` (status) - 状态索引
- `idx_registrations_category` (category) - 分类索引
- `idx_registrations_holder` (holder_id) - 持有者索引
- `idx_registrations_created` (created_at) - 创建时间索引

**外键**：
- `holder_id` → `users(id)`
- `reviewed_by` → `users(id)`

---

## 3. 登记文件表 (registration_files)

存储数据产权登记相关的附件文件

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 文件ID，主键 |
| registration_id | INTEGER | NOT NULL | - | 关联登记ID，外键 |
| file_type | VARCHAR(20) | NOT NULL CHECK | - | 文件类型：sample(样本数据), ownership(权属证明), additional(补充材料), other(其他) |
| file_name | VARCHAR(255) | NOT NULL | - | 存储的文件名 |
| original_name | VARCHAR(255) | NOT NULL | - | 原始文件名 |
| file_path | VARCHAR(500) | NOT NULL | - | 文件存储路径 |
| file_url | VARCHAR(500) | NOT NULL | - | 文件访问URL |
| file_size | INTEGER | - | NULL | 文件大小（字节） |
| mime_type | VARCHAR(100) | - | NULL | MIME类型 |
| uploaded_by | INTEGER | - | NULL | 上传人ID，外键 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 上传时间 |

**外键**：
- `registration_id` → `registrations(id)` ON DELETE CASCADE
- `uploaded_by` → `users(id)`

---

## 4. 维权申请表 (protection_cases)

存储数据产权维权案件信息

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 案件ID，主键 |
| case_no | VARCHAR(50) | UNIQUE NOT NULL | - | 案件编号，如 CASE202411150001 |
| title | VARCHAR(200) | - | NULL | 案件标题 |
| applicant_id | INTEGER | NOT NULL | - | 申请人ID，外键 |
| applicant_name | VARCHAR(100) | NOT NULL | - | 申请人姓名 |
| applicant_phone | VARCHAR(20) | NOT NULL | - | 申请人电话 |
| registration_id | INTEGER | - | NULL | 关联登记ID，外键 |
| registration_title | VARCHAR(200) | - | NULL | 关联登记标题 |
| infringement_type | VARCHAR(50) | NOT NULL CHECK | - | 侵权类型：unauthorized-use(未授权使用), data-theft(数据窃取), copyright-infringement(版权侵权), breach-contract(合同违约), patent(专利侵权), other(其他) |
| description | TEXT | NOT NULL | - | 侵权描述 |
| infringer_info | TEXT | - | NULL | 侵权人信息 |
| expected_solution | TEXT | - | NULL | 期望解决方案 |
| status | VARCHAR(20) | CHECK | 'pending' | 案件状态：pending(待处理), processing(处理中), investigating(调查中), resolved(已解决), closed(已关闭), rejected(已驳回) |
| handler_id | INTEGER | - | NULL | 处理人ID，外键 |
| handler_name | VARCHAR(100) | - | NULL | 处理人姓名 |
| handle_comment | TEXT | - | NULL | 处理意见 |
| progress | INTEGER | CHECK | 0 | 处理进度 0-100 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |
| resolved_at | DATETIME | - | NULL | 解决时间 |

**索引**：
- `idx_protection_cases_status` (status) - 状态索引
- `idx_protection_cases_applicant` (applicant_id) - 申请人索引

**外键**：
- `applicant_id` → `users(id)`
- `registration_id` → `registrations(id)`
- `handler_id` → `users(id)`

---

## 5. 维权案件证据文件表 (protection_evidence)

存储维权案件的证据材料

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 证据ID，主键 |
| case_id | INTEGER | NOT NULL | - | 关联案件ID，外键 |
| file_name | VARCHAR(255) | NOT NULL | - | 文件名 |
| file_path | VARCHAR(500) | NOT NULL | - | 文件存储路径 |
| file_size | INTEGER | - | NULL | 文件大小（字节） |
| description | TEXT | - | NULL | 证据描述 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 上传时间 |

**外键**：
- `case_id` → `protection_cases(id)` ON DELETE CASCADE

---

## 6. 异议申请表 (objections)

存储对公示数据产权的异议申请

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 异议ID，主键 |
| registration_id | INTEGER | NOT NULL | - | 关联登记ID，外键 |
| objector_name | VARCHAR(100) | NOT NULL | - | 异议人姓名 |
| objector_contact | VARCHAR(100) | NOT NULL | - | 异议人联系方式 |
| objection_type | VARCHAR(50) | NOT NULL CHECK | - | 异议类型：ownership(权属争议), accuracy(信息不准确), duplicate(重复登记), other(其他) |
| reason | TEXT | NOT NULL | - | 异议理由 |
| status | VARCHAR(20) | CHECK | 'pending' | 处理状态：pending(待处理), processing(处理中), resolved(已解决), rejected(已驳回) |
| handler_comment | TEXT | - | NULL | 处理意见 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| resolved_at | DATETIME | - | NULL | 解决时间 |

**外键**：
- `registration_id` → `registrations(id)`

---

## 7. 收藏表 (bookmarks)

存储用户收藏的数据产权登记

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 收藏ID，主键 |
| user_id | INTEGER | NOT NULL | - | 用户ID，外键 |
| registration_id | INTEGER | NOT NULL | - | 登记ID，外键 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 收藏时间 |

**索引**：
- `idx_bookmarks_user` (user_id) - 用户索引

**外键**：
- `user_id` → `users(id)` ON DELETE CASCADE
- `registration_id` → `registrations(id)` ON DELETE CASCADE

**唯一约束**：
- (user_id, registration_id) - 同一用户不能重复收藏同一登记

---

## 8. 新闻公告表 (news)

存储平台新闻公告信息

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 新闻ID，主键 |
| title | VARCHAR(200) | NOT NULL | - | 新闻标题 |
| content | TEXT | NOT NULL | - | 新闻内容 |
| summary | TEXT | - | NULL | 内容摘要 |
| cover_image | VARCHAR(255) | - | NULL | 封面图片URL |
| author_id | INTEGER | - | NULL | 作者ID，外键 |
| author_name | VARCHAR(100) | - | NULL | 作者姓名 |
| category | VARCHAR(50) | - | NULL | 新闻分类 |
| is_published | INTEGER | - | 0 | 发布状态：0-草稿, 1-已发布 |
| published_at | DATETIME | - | NULL | 发布时间 |
| view_count | INTEGER | - | 0 | 浏览次数 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**外键**：
- `author_id` → `users(id)`

---

## 9. 操作日志表 (operation_logs)

存储用户操作日志，用于审计

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 日志ID，主键 |
| user_id | INTEGER | - | NULL | 用户ID，外键 |
| username | VARCHAR(100) | - | NULL | 用户名 |
| action | VARCHAR(100) | NOT NULL | - | 操作动作 |
| module | VARCHAR(50) | - | NULL | 操作模块 |
| description | TEXT | - | NULL | 操作描述 |
| ip_address | VARCHAR(50) | - | NULL | IP地址 |
| user_agent | TEXT | - | NULL | 用户代理信息 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 操作时间 |

**外键**：
- `user_id` → `users(id)`

---

## 10. 认证申请表 (verification_applications)

存储用户实名认证申请信息

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 申请ID，主键 |
| user_id | INTEGER | NOT NULL | - | 用户ID，外键 |
| type | VARCHAR(20) | NOT NULL CHECK | - | 认证类型：personal(个人), enterprise(企业) |
| status | VARCHAR(20) | CHECK | 'pending' | 审核状态：pending(待审核), approved(已通过), rejected(已驳回) |
| real_name | VARCHAR(50) | - | NULL | 真实姓名（个人认证） |
| id_card | VARCHAR(18) | - | NULL | 身份证号（个人认证） |
| id_card_front | VARCHAR(255) | - | NULL | 身份证正面照片URL |
| id_card_back | VARCHAR(255) | - | NULL | 身份证反面照片URL |
| enterprise_name | VARCHAR(100) | - | NULL | 企业名称（企业认证） |
| credit_code | VARCHAR(50) | - | NULL | 统一社会信用代码（企业认证） |
| business_license | VARCHAR(255) | - | NULL | 营业执照URL（企业认证） |
| authorization_letter | VARCHAR(255) | - | NULL | 授权函URL（企业认证） |
| legal_person_name | VARCHAR(50) | - | NULL | 法人姓名（企业认证） |
| legal_person_id_card | VARCHAR(18) | - | NULL | 法人身份证（企业认证） |
| review_comment | TEXT | - | NULL | 审核意见 |
| reviewed_by | INTEGER | - | NULL | 审核人ID |
| reviewed_at | DATETIME | - | NULL | 审核时间 |
| created_at | DATETIME | - | CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**外键**：
- `user_id` → `users(id)`
- `reviewed_by` → `users(id)`

---

## 11. 系统配置表 (system_config)

存储平台系统配置参数

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|----------|------|--------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | - | 配置ID，主键 |
| config_key | VARCHAR(100) | UNIQUE NOT NULL | - | 配置键名 |
| config_value | TEXT | - | NULL | 配置值 |
| description | TEXT | - | NULL | 配置说明 |
| updated_at | DATETIME | - | CURRENT_TIMESTAMP | 更新时间 |

**预设配置项**：

| config_key | config_value | 说明 |
|------------|--------------|------|
| site_name | 天津数据产权登记服务平台 | 网站名称 |
| site_description | 构建权威、高效、可信的数据产权登记体系... | 网站描述 |
| site_keywords | 数据产权,登记服务,天津数据,数据资产... | 网站关键词 |
| site_logo | - | 网站Logo URL |
| site_icp | 津ICP备12345678号 | 网站备案号 |
| contact_phone | 400-123-4567 | 联系电话 |
| contact_email | service@tjdata.gov.cn | 联系邮箱 |
| contact_address | 天津市滨海新区... | 联系地址 |
| contact_hours | 周一至周五 9:00-18:00 | 工作时间 |
| review_days | 7 | 审核周期（天） |
| publicity_days | 15 | 公示周期（天） |
| max_daily_applications | 10 | 单日最大申请数 |
| max_file_size | 50 | 文件大小限制（MB） |
| copyright_text | © 2024 天津市数据产权登记中心 版权所有 | 版权信息 |
| tech_support | 天津大数据管理中心 | 技术支持单位 |

---

## 12. 数据库索引

| 索引名 | 表名 | 字段 | 说明 |
|--------|------|------|------|
| idx_users_phone | users | phone | 手机号登录索引 |
| idx_users_status | users | status | 用户状态筛选 |
| idx_registrations_status | registrations | status | 登记状态筛选 |
| idx_registrations_category | registrations | category | 数据分类筛选 |
| idx_registrations_holder | registrations | holder_id | 持有者查询 |
| idx_registrations_created | registrations | created_at | 创建时间排序 |
| idx_protection_cases_status | protection_cases | status | 案件状态筛选 |
| idx_protection_cases_applicant | protection_cases | applicant_id | 申请人查询 |
| idx_bookmarks_user | bookmarks | user_id | 用户收藏查询 |

---

## 📊 数据库 E-R 关系图

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│     users       │     │    registrations    │     │ bookmarks        │
├─────────────────┤     ├─────────────────────┤     ├──────────────────┤
│ PK id           │◄────┤ FK holder_id        │◄────┤ FK registration_id│
│    username     │     │    holder_name      │     │ FK user_id ──────┼──► users
│    phone        │     │    title            │     │    created_at    │
│    organization │     │    category         │     └──────────────────┘
└─────────────────┘     │    status           │
         │              └─────────────────────┘
         │                        │
         │              ┌─────────┴──────────┐
         │              │                    │
         ▼              ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│ operation_logs  │  │ registration_   │  │ protection_cases    │
├─────────────────┤  │ _files          │  ├─────────────────────┤
│ FK user_id      │  ├─────────────────┤  │ FK registration_id  │
│    action       │  │ FK registration_id│  │ FK applicant_id ────┼──► users
│    created_at   │  │    file_name    │  │    case_no          │
└─────────────────┘  │    file_path    │  │    status           │
                     └─────────────────┘  └─────────────────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │ protection_     │
                                          │ _evidence       │
                                          ├─────────────────┤
                                          │ FK case_id      │
                                          │    file_name    │
                                          │    file_path    │
                                          └─────────────────┘
```

---

## 🔑 字段值枚举说明

### users.role (用户角色)
- `data_holder` - 数据持有方
- `data_user` - 数据使用方
- `regulator` - 监管方
- `admin` - 管理员

### registrations.category (数据分类)
- `financial` - 金融数据
- `medical` - 医疗数据
- `traffic` - 交通数据
- `education` - 教育数据
- `industrial` - 工业数据
- `other` - 其他数据

### registrations.status (登记状态)
- `pending` - 待审核
- `reviewing` - 审核中
- `approved` - 已通过
- `rejected` - 已驳回
- `revoked` - 已撤销

### protection_cases.infringement_type (侵权类型)
- `unauthorized-use` - 未授权使用
- `data-theft` - 数据窃取
- `copyright-infringement` - 版权侵权
- `breach-contract` - 合同违约
- `patent` - 专利侵权
- `other` - 其他

### protection_cases.status (案件状态)
- `pending` - 待处理
- `processing` - 处理中
- `investigating` - 调查中
- `resolved` - 已解决
- `closed` - 已关闭
- `rejected` - 已驳回

---

**文档版本**: 1.0  
**生成日期**: 2026-03-07  
**数据库文件**: `backend/data/tj_data_property.db`
