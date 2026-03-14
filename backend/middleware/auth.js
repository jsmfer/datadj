/**
 * 认证中间件
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/helpers');

// 确保JWT_SECRET有有效值
const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== '' 
    ? process.env.JWT_SECRET 
    : 'tianjin-data-property-default-secret-key-2024';

console.log('JWT_SECRET loaded:', JWT_SECRET ? 'Yes (length: ' + JWT_SECRET.length + ')' : 'No');

// 认证中间件 - 需要登录
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(errorResponse('未提供认证令牌', 401));
    }
    
    const token = authHeader.substring(7);
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json(errorResponse('认证令牌无效或已过期', 401));
    }
};

// 可选认证 - 不强制要求登录，但如果有token会解析
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // 可选认证失败不阻止请求
        }
    }
    
    next();
};

// 需要管理员权限
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json(errorResponse('未登录', 401));
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'regulator') {
        return res.status(403).json(errorResponse('需要管理员权限', 403));
    }
    
    next();
};

// 需要特定角色
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json(errorResponse('未登录', 401));
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json(errorResponse('权限不足', 403));
        }
        
        next();
    };
};

module.exports = {
    authMiddleware,
    optionalAuth,
    requireAdmin,
    requireRole
};
