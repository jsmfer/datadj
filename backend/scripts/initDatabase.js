/**
 * 数据库初始化脚本
 * 创建所有必要的表结构和初始数据
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// 统一时间处理函数 - 生成本地时间格式字符串 (YYYY-MM-DD HH:mm:ss)
const getCurrentTimestamp = () => {
    const now = new Date();
    return now.getFullYear() + '-' + 
        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' + 
        String(now.getMinutes()).padStart(2, '0') + ':' + 
        String(now.getSeconds()).padStart(2, '0');
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'tj_data_property.db');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 删除旧数据库（如果存在）
if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('🗑️  已删除旧数据库');
}

const db = new sqlite3.Database(DB_PATH);

// 创建表的SQL语句
const createTablesSQL = `
-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'data_holder' CHECK (role IN ('data_holder', 'data_user', 'regulator', 'admin')),
    avatar VARCHAR(255),
    real_name VARCHAR(50),
    id_card VARCHAR(18),
    organization VARCHAR(100),
    org_code VARCHAR(50),
    verified INTEGER DEFAULT 0,
    verified_at DATETIME,
    status INTEGER DEFAULT 1 CHECK (status IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 数据产权登记表
CREATE TABLE registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_no VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('financial', 'medical', 'traffic', 'education', 'industrial', 'other')),
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('structured', 'unstructured', 'semi-structured', 'real-time')),
    data_size VARCHAR(20) CHECK (data_size IN ('small', 'medium', 'large', 'extra-large')),
    data_source TEXT,
    application_scene TEXT,
    update_frequency VARCHAR(20) CHECK (update_frequency IN ('real-time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'static')),
    data_format VARCHAR(50),
    expected_value TEXT,
    description TEXT,
    holder_id INTEGER NOT NULL,
    holder_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'revoked')),
    review_comment TEXT,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    published_at DATETIME,
    expires_at DATETIME,
    view_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (holder_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- 登记文件表
CREATE TABLE registration_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('sample', 'ownership', 'additional', 'other')),
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 维权申请表
CREATE TABLE protection_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_no VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200),
    applicant_id INTEGER NOT NULL,
    applicant_name VARCHAR(100) NOT NULL,
    applicant_phone VARCHAR(20) NOT NULL,
    registration_id INTEGER,
    registration_title VARCHAR(200),
    infringement_type VARCHAR(50) NOT NULL CHECK (infringement_type IN ('unauthorized-use', 'data-theft', 'copyright-infringement', 'breach-contract', 'other', 'copyright', 'trademark', 'trade_secret', 'trade-secret', 'data_breach', 'data-breach', 'unauthorized_use', 'unauthorized-use', 'patent')),
    description TEXT NOT NULL,
    infringer_info TEXT,
    expected_solution TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'investigating', 'resolved', 'closed', 'rejected')),
    handler_id INTEGER,
    handler_name VARCHAR(100),
    handle_comment TEXT,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (applicant_id) REFERENCES users(id),
    FOREIGN KEY (registration_id) REFERENCES registrations(id),
    FOREIGN KEY (handler_id) REFERENCES users(id)
);

-- 维权案件证据文件表
CREATE TABLE protection_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES protection_cases(id) ON DELETE CASCADE
);

-- 异议申请表
CREATE TABLE objections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER NOT NULL,
    objector_name VARCHAR(100) NOT NULL,
    objector_contact VARCHAR(100) NOT NULL,
    objection_type VARCHAR(50) NOT NULL CHECK (objection_type IN ('ownership', 'accuracy', 'duplicate', 'other')),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved', 'rejected')),
    handler_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (registration_id) REFERENCES registrations(id)
);

-- 收藏表
CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    registration_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    UNIQUE(user_id, registration_id)
);

-- 新闻公告表
CREATE TABLE news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    cover_image VARCHAR(255),
    author_id INTEGER,
    author_name VARCHAR(100),
    category VARCHAR(50),
    is_published INTEGER DEFAULT 0,
    published_at DATETIME,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 操作日志表
CREATE TABLE operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50),
    description TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 认证申请表
CREATE TABLE verification_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('personal', 'enterprise')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    
    -- 个人认证信息
    real_name VARCHAR(50),
    id_card VARCHAR(18),
    id_card_front VARCHAR(255),      -- 身份证正面
    id_card_back VARCHAR(255),       -- 身份证反面
    
    -- 企业认证信息
    enterprise_name VARCHAR(100),
    credit_code VARCHAR(50),         -- 统一社会信用代码
    business_license VARCHAR(255),   -- 营业执照
    authorization_letter VARCHAR(255), -- 授权函
    legal_person_name VARCHAR(50),   -- 法人姓名
    legal_person_id_card VARCHAR(18), -- 法人身份证
    
    -- 审核信息
    review_comment TEXT,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- 系统配置表
CREATE TABLE system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_registrations_status ON registrations(status);
CREATE INDEX idx_registrations_category ON registrations(category);
CREATE INDEX idx_registrations_holder ON registrations(holder_id);
CREATE INDEX idx_registrations_created ON registrations(created_at);
CREATE INDEX idx_protection_cases_status ON protection_cases(status);
CREATE INDEX idx_protection_cases_applicant ON protection_cases(applicant_id);
CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
`;

// 初始化数据
async function initData() {
    const saltRounds = 10;
    const defaultPassword = await bcrypt.hash('123456', saltRounds);
    const adminPassword = await bcrypt.hash('admin123', saltRounds);

    // 插入用户数据
    const users = [
        { username: '张三', phone: '13800138000', email: 'zhangsan@example.com', password: defaultPassword, role: 'data_holder', real_name: '张三', organization: '天津市大数据管理中心', verified: 1 },
        { username: '李四', phone: '13900139000', email: 'lisi@example.com', password: defaultPassword, role: 'data_user', real_name: '李四', organization: '天津科技有限公司', verified: 1 },
        { username: '王五', phone: '13700137000', email: 'wangwu@example.com', password: defaultPassword, role: 'regulator', real_name: '王五', organization: '天津市数据管理局', verified: 1 },
        { username: '管理员', phone: 'admin', email: 'admin@tjdata.gov.cn', password: adminPassword, role: 'admin', real_name: '系统管理员', organization: '天津市数据产权登记中心', verified: 1 }
    ];

    const now = getCurrentTimestamp();
    for (const user of users) {
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO users (username, phone, email, password, role, real_name, organization, verified, verified_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [user.username, user.phone, user.email, user.password, user.role, user.real_name, user.organization, user.verified, now, now, now], 
            function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    console.log('✅ 用户数据初始化完成');

    // 插入登记数据
    const registrations = [
        { no: 'TJDR202411150001', title: '天津市交通流量数据集', category: 'traffic', type: 'structured', size: 'large', holder_id: 1, holder_name: '张三', status: 'approved', source: '天津市交通监控系统', scene: '城市交通规划、拥堵分析', frequency: 'real-time', format: 'JSON, CSV' },
        { no: 'TJDR202411100002', title: '医疗健康大数据平台', category: 'medical', type: 'structured', size: 'extra-large', holder_id: 1, holder_name: '张三', status: 'pending', source: '全市医疗机构', scene: '医疗质量评估、疾病预测', frequency: 'daily', format: 'HL7, DICOM' },
        { no: 'TJDR202411080003', title: '金融风控数据服务', category: 'financial', type: 'structured', size: 'medium', holder_id: 2, holder_name: '李四', status: 'approved', source: '企业信用信息系统', scene: '信贷审批、风险评估', frequency: 'weekly', format: 'XML, JSON' },
        { no: 'TJDR202411050004', title: '教育资源共享平台', category: 'education', type: 'unstructured', size: 'large', holder_id: 2, holder_name: '李四', status: 'approved', source: '全市中小学', scene: '在线教育、教学资源共享', frequency: 'monthly', format: 'MP4, PPT, PDF' },
        { no: 'TJDR202411030005', title: '工业物联网数据集', category: 'industrial', type: 'real-time', size: 'extra-large', holder_id: 1, holder_name: '张三', status: 'approved', source: '生产传感器', scene: '生产优化、设备维护', frequency: 'real-time', format: 'JSON, CSV' }
    ];

    for (const reg of registrations) {
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO registrations (registration_no, title, category, data_type, data_size, holder_id, holder_name, status, data_source, application_scene, update_frequency, data_format)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [reg.no, reg.title, reg.category, reg.type, reg.size, reg.holder_id, reg.holder_name, reg.status, reg.source, reg.scene, reg.frequency, reg.format],
            function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    console.log('✅ 登记数据初始化完成');

    // 插入维权案件数据
    const cases = [
        { no: 'CASE202411150001', applicant_id: 1, applicant_name: '张三', applicant_phone: '13800138000', reg_id: 1, reg_title: '天津市交通流量数据集', type: 'unauthorized-use', description: '发现某科技公司未经授权使用我司交通数据进行商业分析', status: 'processing', progress: 65 },
        { no: 'CASE202411100002', applicant_id: 1, applicant_name: '张三', applicant_phone: '13800138000', reg_id: 2, reg_title: '医疗健康大数据平台', type: 'data-theft', description: '医疗机构数据安全漏洞导致患者信息泄露', status: 'resolved', progress: 100 },
        { no: 'CASE202411050003', applicant_id: 2, applicant_name: '李四', applicant_phone: '13900139000', reg_id: 3, reg_title: '金融风控数据服务', type: 'copyright-infringement', description: '竞争对手盗用我司金融风控模型数据进行不正当竞争', status: 'closed', progress: 100 }
    ];

    for (const c of cases) {
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO protection_cases (case_no, applicant_id, applicant_name, applicant_phone, registration_id, registration_title, infringement_type, description, status, progress)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [c.no, c.applicant_id, c.applicant_name, c.applicant_phone, c.reg_id, c.reg_title, c.type, c.description, c.status, c.progress],
            function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    console.log('✅ 维权案件数据初始化完成');

    // 插入新闻公告
    const news = [
        { title: '《数据产权登记管理办法》正式发布', content: '为进一步规范数据产权登记行为，保护数据产权人合法权益，促进数据要素市场化流通，天津市数据产权登记中心正式发布《数据产权登记管理办法》。', summary: '规范数据产权登记行为，保护合法权益', category: '政策法规', is_published: 1 },
        { title: '平台注册用户突破3000大关', content: '截至今日，天津数据产权登记服务平台注册用户已达到3240人，登记数据项超过15000个，平台影响力持续扩大。', summary: '用户增长里程碑', category: '平台动态', is_published: 1 },
        { title: '区块链技术在数据存证中的应用', content: '平台正式引入区块链技术，确保数据产权信息的真实性和不可篡改性，提升平台可信度，为用户提供更安全的服务。', summary: '技术创新升级', category: '技术动态', is_published: 1 }
    ];

    const newsTime = getCurrentTimestamp();
    for (const n of news) {
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO news (title, content, summary, author_id, author_name, category, is_published, published_at, created_at, updated_at)
                VALUES (?, ?, ?, 4, '管理员', ?, ?, ?, ?, ?)
            `, [n.title, n.content, n.summary, n.category, n.is_published, n.is_published ? newsTime : null, newsTime, newsTime],
            function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    console.log('✅ 新闻公告数据初始化完成');

    // 插入系统配置
    const configs = [
        { key: 'site_name', value: '天津数据产权登记服务平台', desc: '网站名称' },
        { key: 'site_description', value: '构建权威、高效、可信的数据产权登记体系，为数据资产赋予清晰、可追溯的产权标识', desc: '网站描述' },
        { key: 'site_keywords', value: '数据产权,登记服务,天津数据,数据资产,区块链存证', desc: '网站关键词' },
        { key: 'site_logo', value: '', desc: '网站Logo URL' },
        { key: 'site_icp', value: '津ICP备12345678号', desc: '网站备案号' },
        { key: 'contact_phone', value: '400-123-4567', desc: '联系电话' },
        { key: 'contact_email', value: 'service@tjdata.gov.cn', desc: '联系邮箱' },
        { key: 'contact_address', value: '天津市滨海新区天津港保税区空港经济区西四道168号', desc: '联系地址' },
        { key: 'contact_hours', value: '周一至周五 9:00-18:00', desc: '工作时间' },
        { key: 'review_days', value: '7', desc: '审核周期（天）' },
        { key: 'publicity_days', value: '15', desc: '公示周期（天）' },
        { key: 'max_daily_applications', value: '10', desc: '单日最大申请数' },
        { key: 'max_file_size', value: '50', desc: '文件大小限制（MB）' },
        { key: 'copyright_text', value: '© 2024 天津市数据产权登记中心 版权所有', desc: '版权信息' },
        { key: 'tech_support', value: '天津大数据管理中心', desc: '技术支持单位' }
    ];

    for (const cfg of configs) {
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO system_config (config_key, config_value, description)
                VALUES (?, ?, ?)
            `, [cfg.key, cfg.value, cfg.desc],
            function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    console.log('✅ 系统配置初始化完成');
}

// 执行初始化
console.log('🚀 开始初始化数据库...');
db.exec(createTablesSQL, async (err) => {
    if (err) {
        console.error('❌ 创建表失败:', err.message);
        process.exit(1);
    }
    console.log('✅ 数据表创建成功');
    
    try {
        await initData();
        console.log('\n🎉 数据库初始化完成！');
        console.log('\n默认账号：');
        console.log('  管理员: admin / admin123');
        console.log('  测试用户: 13800138000 / 123456');
        db.close();
    } catch (error) {
        console.error('❌ 初始化数据失败:', error.message);
        db.close();
        process.exit(1);
    }
});
