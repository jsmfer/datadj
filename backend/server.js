/**
 * 天津数据产权登记服务平台 - 后端API服务器
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// 加载环境变量
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务 - 上传文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    lastModified: true
}));

// 管理后台静态文件
app.use('/admin', express.static(path.join(__dirname, 'admin'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    etag: true
}));

// API路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/protection', require('./routes/protection'));
app.use('/api/news', require('./routes/news'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/verification', require('./routes/admin-verification'));
app.use('/api/site-config', require('./routes/site-config'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/consultation', require('./routes/consultation'));

// 健康检查
app.get('/api/health', (req, res) => {
    const now = new Date();
    res.json({
        status: 'ok',
        timestamp: now.toISOString(),
        localTime: now.toLocaleString('zh-CN', { hour12: false }),
        service: '天津数据产权登记服务平台API'
    });
});

// 根路径
app.get('/api', (req, res) => {
    res.json({
        name: '天津数据产权登记服务平台API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            registrations: '/api/registrations',
            protection: '/api/protection',
            news: '/api/news',
            admin: '/api/admin',
            health: '/api/health'
        }
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在',
        path: req.path
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('[' + new Date().toISOString() + '] 服务器错误:', err);
    
    // 处理特定的错误类型
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            message: '未授权访问',
            code: 401
        });
    }
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: err.message || '参数验证失败',
            code: 400
        });
    }
    
    // 默认错误响应
    res.status(err.status || 500).json({
        success: false,
        message: err.message || '服务器内部错误',
        code: err.status || 500,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     天津数据产权登记服务平台 - 后端API服务                  ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                         ║
║  API文档:  http://localhost:${PORT}/api                     ║
║  健康检查: http://localhost:${PORT}/api/health              ║
╚════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
