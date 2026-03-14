/**
 * 数据产权登记路由
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbAsync } = require('../database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { 
    successResponse, 
    errorResponse, 
    getPagination, 
    generateRegistrationNo,
    getCurrentTimestamp,
    categoryMap,
    dataTypeMap,
    dataSizeMap,
    statusMap
} = require('../utils/helpers');

const router = express.Router();

// 获取登记列表（公开）
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { 
            keyword, 
            category, 
            status = 'approved', 
            dataType, 
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            whereClause += ' AND r.status = ?';
            params.push(status);
        }

        if (category) {
            whereClause += ' AND r.category = ?';
            params.push(category);
        }

        if (dataType) {
            whereClause += ' AND r.data_type = ?';
            params.push(dataType);
        }

        if (keyword) {
            whereClause += ' AND (r.title LIKE ? OR r.description LIKE ? OR r.holder_name LIKE ?)';
            const likeKeyword = `%${keyword}%`;
            params.push(likeKeyword, likeKeyword, likeKeyword);
        }

        // 获取总数
        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM registrations r ${whereClause}`,
            params
        );

        // 获取列表
        const allowedSortFields = ['created_at', 'title', 'view_count', 'bookmark_count'];
        const orderBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const rows = await dbAsync.all(
            `SELECT r.*, u.phone as holder_phone, u.organization as holder_organization
             FROM registrations r
             LEFT JOIN users u ON r.holder_id = u.id
             ${whereClause}
             ORDER BY r.${orderBy} ${order}
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        // 格式化数据，使用所属机构替代用户名作为数据持有者
        const list = rows.map(item => ({
            ...item,
            holder_name: item.holder_organization || item.holder_name,
            categoryText: categoryMap[item.category],
            dataTypeText: dataTypeMap[item.data_type],
            dataSizeText: dataSizeMap[item.data_size],
            statusText: statusMap[item.status]?.text,
            statusClass: statusMap[item.status]?.class
        }));

        res.json(successResponse({
            list,
            pagination: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        }));

    } catch (error) {
        console.error('获取登记列表错误:', error);
        res.status(500).json(errorResponse('获取列表失败'));
    }
});

// 获取登记详情
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const item = await dbAsync.get(
            `SELECT r.*, u.phone as holder_phone, u.email as holder_email, u.organization as holder_organization
             FROM registrations r
             LEFT JOIN users u ON r.holder_id = u.id
             WHERE r.id = ? OR r.registration_no = ?`,
            [id, id]
        );

        if (!item) {
            return res.status(404).json(errorResponse('登记信息不存在', 404));
        }

        // 增加浏览量
        await dbAsync.run(
            'UPDATE registrations SET view_count = view_count + 1 WHERE id = ?',
            [item.id]
        );

        // 获取相关文件
        const files = await dbAsync.all(
            'SELECT * FROM registration_files WHERE registration_id = ?',
            [item.id]
        );

        // 检查是否已收藏
        let isBookmarked = false;
        if (req.user) {
            const bookmark = await dbAsync.get(
                'SELECT id FROM bookmarks WHERE user_id = ? AND registration_id = ?',
                [req.user.id, item.id]
            );
            isBookmarked = !!bookmark;
        }

        res.json(successResponse({
            ...item,
            holder_name: item.holder_organization || item.holder_name,
            categoryText: categoryMap[item.category],
            dataTypeText: dataTypeMap[item.data_type],
            dataSizeText: dataSizeMap[item.data_size],
            statusText: statusMap[item.status]?.text,
            statusClass: statusMap[item.status]?.class,
            files,
            isBookmarked
        }));

    } catch (error) {
        console.error('获取登记详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

// 提交登记申请（需要登录且已完成认证）
router.post('/', authMiddleware, [
    body('title').notEmpty().withMessage('数据资产名称不能为空'),
    body('category').isIn(['financial', 'medical', 'traffic', 'education', 'industrial', 'other']).withMessage('无效的数据分类'),
    body('dataType').isIn(['structured', 'unstructured', 'semi-structured', 'real-time']).withMessage('无效的数据类型'),
    body('dataSource').notEmpty().withMessage('数据来源不能为空'),
    body('applicationScene').notEmpty().withMessage('应用场景不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        // 验证用户是否已完成认证
        const user = await dbAsync.get(
            'SELECT verified, real_name, organization FROM users WHERE id = ?',
            [req.user.id]
        );

        console.log('登记提交 - 用户认证状态:', {
            userId: req.user.id,
            verified: user?.verified,
            verifiedType: typeof user?.verified,
            real_name: user?.real_name,
            organization: user?.organization
        });

        // 支持多种认证状态格式：1, true, '1'
        const isVerified = user?.verified === 1 || user?.verified === true || user?.verified === '1';
        
        if (!user || !isVerified) {
            return res.status(403).json(errorResponse('您尚未完成实名认证，请先完成认证后再提交登记申请', 403));
        }

        if (!user.real_name || !user.organization) {
            return res.status(403).json(errorResponse('您的认证信息不完整（缺少姓名或所属机构），请完善个人信息后再提交', 403));
        }

        const {
            title,
            category,
            dataType,
            dataSize,
            dataSource,
            applicationScene,
            updateFrequency,
            dataFormat,
            expectedValue,
            description
        } = req.body;

        const registrationNo = generateRegistrationNo();

        const now = getCurrentTimestamp();
        const result = await dbAsync.run(
            `INSERT INTO registrations (
                registration_no, title, category, data_type, data_size,
                data_source, application_scene, update_frequency, data_format,
                expected_value, description, holder_id, holder_name, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [
                registrationNo, title, category, dataType, dataSize,
                dataSource, applicationScene, updateFrequency, dataFormat,
                expectedValue, description, req.user.id, req.user.username,
                now, now
            ]
        );

        // 记录操作日志
        await dbAsync.run(
            `INSERT INTO operation_logs (user_id, username, action, module, description)
             VALUES (?, ?, '提交登记', 'registration', ?)`,
            [req.user.id, req.user.username, `提交了新的数据产权登记申请：${title}`]
        );

        res.status(201).json(successResponse({
            id: result.id,
            registrationNo
        }, '登记申请提交成功'));

    } catch (error) {
        console.error('提交登记申请错误:', error);
        
        // 处理特定的数据库约束错误
        if (error.message && error.message.includes('CHECK constraint')) {
            return res.status(400).json(errorResponse('数据格式错误，请检查数据分类、类型或规模的选项是否正确', 400));
        }
        if (error.message && error.message.includes('NOT NULL')) {
            return res.status(400).json(errorResponse('必填字段不能为空', 400));
        }
        
        res.status(500).json(errorResponse('提交申请失败: ' + (error.message || '服务器内部错误')));
    }
});

// 获取我的登记列表
router.get('/user/my', authMiddleware, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { status } = req.query;

        let whereClause = 'WHERE holder_id = ?';
        const params = [req.user.id];

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM registrations ${whereClause}`,
            params
        );

        const rows = await dbAsync.all(
            `SELECT * FROM registrations 
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        const list = rows.map(item => ({
            ...item,
            categoryText: categoryMap[item.category],
            statusText: statusMap[item.status]?.text,
            statusClass: statusMap[item.status]?.class
        }));

        res.json(successResponse({
            list,
            pagination: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        }));

    } catch (error) {
        console.error('获取我的登记错误:', error);
        res.status(500).json(errorResponse('获取列表失败'));
    }
});

// 统计数据
router.get('/stats/overview', async (req, res) => {
    try {
        // 登记统计
        const stats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_count,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN date(created_at, 'localtime') = date('now', 'localtime') THEN 1 END) as today_count
             FROM registrations`
        );

        // 用户统计
        const userStats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN date(created_at, 'localtime') = date('now', 'localtime') THEN 1 END) as today_users
             FROM users
             WHERE status = 1`
        );

        // 维权案件统计
        const caseStats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_cases,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_count,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count
             FROM protection_cases`
        );

        // 按类型统计
        const categoryStats = await dbAsync.all(
            `SELECT category, COUNT(*) as count 
             FROM registrations 
             WHERE status = 'approved'
             GROUP BY category`
        );

        // 日趋势（最近30天）
        const dailyTrend = await dbAsync.all(
            `SELECT 
                strftime('%Y-%m-%d', created_at) as date,
                COUNT(*) as count
             FROM registrations
             WHERE created_at >= date('now', '-30 days')
             GROUP BY date
             ORDER BY date`
        );

        // 填充没有数据的日期
        const filledDailyTrend = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const existing = dailyTrend.find(item => item.date === dateStr);
            filledDailyTrend.push({
                date: dateStr,
                count: existing ? existing.count : 0
            });
        }

        res.json(successResponse({
            ...stats,
            userStats,
            caseStats,
            categoryStats,
            dailyTrend: filledDailyTrend
        }));

    } catch (error) {
        console.error('获取统计数据错误:', error);
        res.status(500).json(errorResponse('获取统计数据失败'));
    }
});

module.exports = router;
