/**
 * 工具函数
 */

const crypto = require('crypto');

// ==================== 统一时间处理 ====================
// 所有时间统一使用服务器本地时间 (中国时区 UTC+8)
// 存储格式: YYYY-MM-DD HH:mm:ss
// 避免时区转换问题

/**
 * 获取当前时间的本地格式字符串 (YYYY-MM-DD HH:mm:ss)
 * 用于存储到数据库，统一使用服务器本地时间
 */
const getCurrentTimestamp = () => {
    return formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');
};

/**
 * 获取当前日期时间字符串 (本地时间格式: YYYY-MM-DD HH:mm:ss)
 * 同 getCurrentTimestamp，用于需要直接显示的时间戳
 */
const getCurrentDateTime = () => {
    return formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');
};

/**
 * 将日期字符串统一转换为本地时间格式
 * 兼容 ISO 8601 格式和本地格式
 */
const toLocalISOString = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return formatDate(date, 'YYYY-MM-DD HH:mm:ss');
};

// 生成唯一ID
const generateId = () => {
    return crypto.randomBytes(16).toString('hex');
};

// 生成登记编号
const generateRegistrationNo = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TJDR${year}${month}${day}${random}`;
};

// 生成案件编号
const generateCaseNo = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `CASE${year}${month}${day}${random}`;
};

// 格式化日期
const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
};

// 数据类型映射
const categoryMap = {
    'financial': '金融数据',
    'medical': '医疗数据',
    'traffic': '交通数据',
    'education': '教育数据',
    'industrial': '工业数据',
    'other': '其他数据'
};

// 数据类型映射
const dataTypeMap = {
    'structured': '结构化数据',
    'unstructured': '非结构化数据',
    'semi-structured': '半结构化数据',
    'real-time': '实时数据流'
};

// 数据规模映射
const dataSizeMap = {
    'small': '小型 (< 1GB)',
    'medium': '中型 (1GB - 100GB)',
    'large': '大型 (100GB - 1TB)',
    'extra-large': '超大型 (> 1TB)'
};

// 状态映射
const statusMap = {
    'pending': { text: '待审核', class: 'pending' },
    'reviewing': { text: '审核中', class: 'reviewing' },
    'approved': { text: '已通过', class: 'approved' },
    'rejected': { text: '已拒绝', class: 'rejected' },
    'revoked': { text: '已撤销', class: 'revoked' }
};

// 角色映射
const roleMap = {
    'data_holder': '数据持有方',
    'data_user': '数据使用方',
    'regulator': '监管方',
    'admin': '管理员'
};

// 分页参数处理
const getPagination = (req) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    return { page, pageSize, offset };
};

// 统一响应格式
const successResponse = (data, message = '操作成功') => ({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
});

const errorResponse = (message, code = 500) => ({
    success: false,
    message,
    code,
    timestamp: new Date().toISOString()
});

module.exports = {
    generateId,
    generateRegistrationNo,
    generateCaseNo,
    formatDate,
    categoryMap,
    dataTypeMap,
    dataSizeMap,
    statusMap,
    roleMap,
    getPagination,
    successResponse,
    errorResponse,
    // 时间处理函数
    getCurrentTimestamp,
    getCurrentDateTime,
    toLocalISOString
};
