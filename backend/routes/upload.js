/**
 * 文件上传路由
 * 处理登记申请中的文件上传
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbAsync } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/helpers');

const router = express.Router();

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads', 'registrations');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置multer存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const destDir = path.join(uploadsDir, dateDir);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        cb(null, destDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// 文件过滤
const fileFilter = (req, file, cb) => {
    // 允许的文件类型
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'application/json',
        'image/jpeg',
        'image/png',
        'image/gif'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型: ' + file.mimetype), false);
    }
};

// 配置multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB限制
        files: 10 // 最多10个文件
    }
});

// 上传文件接口
router.post('/:registrationId', authMiddleware, (req, res, next) => {
    const registrationId = req.params.registrationId;
    
    // 检查登记是否存在且属于当前用户
    dbAsync.get(
        'SELECT id, holder_id FROM registrations WHERE id = ?',
        [registrationId]
    ).then(registration => {
        if (!registration) {
            return res.status(404).json(errorResponse('登记信息不存在', 404));
        }
        
        // 检查权限（只有持有者或管理员可以上传）
        if (registration.holder_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json(errorResponse('无权上传文件', 403));
        }
        
        // 处理文件上传
        upload.fields([
            { name: 'sample', maxCount: 1 },
            { name: 'ownership', maxCount: 1 },
            { name: 'additional', maxCount: 5 }
        ])(req, res, (err) => {
            if (err) {
                console.error('文件上传错误:', err);
                return res.status(400).json(errorResponse(err.message, 400));
            }
            
            next();
        });
    }).catch(error => {
        console.error('查询登记信息错误:', error);
        res.status(500).json(errorResponse('服务器错误'));
    });
}, async (req, res) => {
    try {
        const registrationId = req.params.registrationId;
        const files = req.files;
        
        if (!files || Object.keys(files).length === 0) {
            return res.status(400).json(errorResponse('没有上传文件', 400));
        }
        
        const savedFiles = [];
        
        // 保存文件信息到数据库
        for (const [fieldName, fileList] of Object.entries(files)) {
            for (const file of fileList) {
                const fileType = fieldName === 'sample' ? 'sample' : 
                                fieldName === 'ownership' ? 'ownership' : 'additional';
                
                const result = await dbAsync.run(
                    `INSERT INTO registration_files 
                     (registration_id, file_type, file_name, original_name, file_path, file_size, mime_type) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        registrationId,
                        fileType,
                        file.originalname,
                        file.originalname,
                        file.path,
                        file.size,
                        file.mimetype
                    ]
                );
                
                savedFiles.push({
                    id: result.id,
                    fileType: fileType,
                    fileName: file.originalname,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    url: `/uploads/registrations/${path.basename(path.dirname(file.path))}/${path.basename(file.path)}`
                });
            }
        }
        
        res.json(successResponse({
            registrationId: registrationId,
            files: savedFiles
        }, '文件上传成功'));
        
    } catch (error) {
        console.error('保存文件信息错误:', error);
        res.status(500).json(errorResponse('保存文件信息失败'));
    }
});

// 获取登记的文件列表
router.get('/:registrationId', authMiddleware, async (req, res) => {
    try {
        const registrationId = req.params.registrationId;
        
        // 检查权限
        const registration = await dbAsync.get(
            'SELECT holder_id FROM registrations WHERE id = ?',
            [registrationId]
        );
        
        if (!registration) {
            return res.status(404).json(errorResponse('登记信息不存在', 404));
        }
        
        // 只有持有者或管理员可以查看
        if (registration.holder_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json(errorResponse('无权查看文件', 403));
        }
        
        const files = await dbAsync.all(
            `SELECT id, file_type, file_name, file_size, mime_type, created_at,
                    CASE 
                        WHEN file_path LIKE '%uploads%' 
                        THEN SUBSTR(file_path, INSTR(file_path, 'uploads'))
                        ELSE 'uploads/registrations/' || file_path
                    END as url
             FROM registration_files 
             WHERE registration_id = ?
             ORDER BY file_type, created_at`,
            [registrationId]
        );
        
        // 格式化URL
        const formattedFiles = files.map(f => ({
            ...f,
            url: f.url.startsWith('uploads/') ? `/${f.url}` : f.url
        }));
        
        res.json(successResponse(formattedFiles));
        
    } catch (error) {
        console.error('获取文件列表错误:', error);
        res.status(500).json(errorResponse('获取文件列表失败'));
    }
});

// 删除文件
router.delete('/:fileId', authMiddleware, async (req, res) => {
    try {
        const fileId = req.params.fileId;
        
        // 获取文件信息
        const file = await dbAsync.get(
            `SELECT f.*, r.holder_id 
             FROM registration_files f
             JOIN registrations r ON f.registration_id = r.id
             WHERE f.id = ?`,
            [fileId]
        );
        
        if (!file) {
            return res.status(404).json(errorResponse('文件不存在', 404));
        }
        
        // 检查权限
        if (file.holder_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json(errorResponse('无权删除文件', 403));
        }
        
        // 删除物理文件
        if (fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
        }
        
        // 删除数据库记录
        await dbAsync.run('DELETE FROM registration_files WHERE id = ?', [fileId]);
        
        res.json(successResponse(null, '文件删除成功'));
        
    } catch (error) {
        console.error('删除文件错误:', error);
        res.status(500).json(errorResponse('删除文件失败'));
    }
});

module.exports = router;
