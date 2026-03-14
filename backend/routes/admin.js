/**
 * 管理后台路由
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbAsync } = require('../database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { successResponse, errorResponse, getPagination, getCurrentTimestamp } = require('../utils/helpers');

const router = express.Router();

// 获取仪表盘统计数据
router.get('/dashboard', authMiddleware, requireAdmin, async (req, res) => {
    try {
        // 用户统计
        const userStats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN date(created_at, 'localtime') = date('now', 'localtime') THEN 1 END) as today_users,
                COUNT(CASE WHEN verified = 1 THEN 1 END) as verified_users
             FROM users
             WHERE status = 1`
        );

        // 登记统计
        const registrationStats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_registrations,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
                COUNT(CASE WHEN date(created_at, 'localtime') = date('now', 'localtime') THEN 1 END) as today_count
             FROM registrations`
        );

        // 维权案件统计
        const caseStats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_cases,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_count,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count
             FROM protection_cases`
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

        // 最近待审核
        const pendingList = await dbAsync.all(
            `SELECT r.id, r.registration_no, r.title, r.category, r.created_at, u.username as holder_name
             FROM registrations r
             JOIN users u ON r.holder_id = u.id
             WHERE r.status = 'pending'
             ORDER BY r.created_at DESC
             LIMIT 5`
        );

        res.json(successResponse({
            userStats,
            registrationStats,
            caseStats,
            dailyTrend: filledDailyTrend,
            pendingList
        }));

    } catch (error) {
        console.error('获取仪表盘数据错误:', error);
        res.status(500).json(errorResponse('获取数据失败'));
    }
});

// 获取用户列表
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { keyword, role, status } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (keyword) {
            whereClause += ' AND (username LIKE ? OR phone LIKE ? OR email LIKE ?)';
            const likeKeyword = `%${keyword}%`;
            params.push(likeKeyword, likeKeyword, likeKeyword);
        }

        if (role) {
            whereClause += ' AND role = ?';
            params.push(role);
        }

        if (status !== undefined) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM users ${whereClause}`,
            params
        );

        const rows = await dbAsync.all(
            `SELECT id, username, phone, email, role, real_name, organization, 
                    verified, status, created_at
             FROM users 
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        res.json(successResponse({
            list: rows,
            pagination: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        }));

    } catch (error) {
        console.error('获取用户列表错误:', error);
        res.status(500).json(errorResponse('获取列表失败'));
    }
});

// 更新用户状态
router.put('/users/:id/status', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await dbAsync.run(
            'UPDATE users SET status = ?, updated_at = datetime("now") WHERE id = ?',
            [status, id]
        );

        res.json(successResponse(null, '用户状态更新成功'));

    } catch (error) {
        console.error('更新用户状态错误:', error);
        res.status(500).json(errorResponse('更新失败'));
    }
});

// 创建用户
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { username, phone, password, role, email, realName, organization, verified } = req.body;

        // 验证必填字段
        if (!organization || organization.trim() === '') {
            return res.status(400).json(errorResponse('所属机构/单位不能为空', 400));
        }

        // 检查手机号是否已存在
        const existingUser = await dbAsync.get('SELECT id FROM users WHERE phone = ?', [phone]);
        if (existingUser) {
            return res.status(400).json(errorResponse('该手机号已被注册', 400));
        }

        // 加密密码
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = getCurrentTimestamp();

        const result = await dbAsync.run(
            `INSERT INTO users (username, phone, password, role, email, real_name, organization, verified, verified_at, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, phone, hashedPassword, role, email, realName, organization, verified ? 1 : 0, now, now]
        );

        res.status(201).json(successResponse({ id: result.id }, '用户创建成功'));

    } catch (error) {
        console.error('创建用户错误:', error);
        res.status(500).json(errorResponse('创建失败'));
    }
});

// 获取用户详情
router.get('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await dbAsync.get(
            `SELECT id, username, phone, email, role, real_name, organization, 
                    verified, status, avatar, created_at, updated_at
             FROM users WHERE id = ?`,
            [id]
        );

        if (!user) {
            return res.status(404).json(errorResponse('用户不存在', 404));
        }

        // 获取用户权限标签
        const permissions = getRolePermissions(user.role);

        res.json(successResponse({ ...user, permissions }));

    } catch (error) {
        console.error('获取用户详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

// 更新用户信息
router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, phone, email, role, realName, organization, verified } = req.body;

        // 验证必填字段
        if (organization !== undefined && organization.trim() === '') {
            return res.status(400).json(errorResponse('所属机构/单位不能为空', 400));
        }

        // 如果要更新手机号，检查是否已被其他用户使用
        if (phone) {
            const existingUser = await dbAsync.get(
                'SELECT id FROM users WHERE phone = ? AND id != ?',
                [phone, id]
            );
            if (existingUser) {
                return res.status(400).json(errorResponse('该手机号已被其他用户使用', 400));
            }
        }

        // 如果要更新邮箱，检查是否已被其他用户使用
        if (email) {
            const existingEmail = await dbAsync.get(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );
            if (existingEmail) {
                return res.status(400).json(errorResponse('该邮箱已被其他用户使用', 400));
            }
        }

        await dbAsync.run(
            `UPDATE users SET
                username = COALESCE(?, username),
                phone = COALESCE(?, phone),
                email = COALESCE(?, email),
                role = COALESCE(?, role),
                real_name = COALESCE(?, real_name),
                organization = COALESCE(?, organization),
                verified = COALESCE(?, verified),
                updated_at = ?
             WHERE id = ?`,
            [username, phone, email, role, realName, organization, verified !== undefined ? (verified ? 1 : 0) : null, getCurrentTimestamp(), id]
        );

        res.json(successResponse(null, '用户信息更新成功'));

    } catch (error) {
        console.error('更新用户错误:', error);
        res.status(500).json(errorResponse('更新失败: ' + error.message));
    }
});

// 重置用户密码
router.put('/users/:id/password', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        await dbAsync.run(
            'UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?',
            [hashedPassword, id]
        );

        res.json(successResponse(null, '密码重置成功'));

    } catch (error) {
        console.error('重置密码错误:', error);
        res.status(500).json(errorResponse('重置失败'));
    }
});

// 删除用户
router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 检查是否为当前登录用户
        if (parseInt(id) === req.user.id) {
            return res.status(400).json(errorResponse('不能删除当前登录用户', 400));
        }

        await dbAsync.run('DELETE FROM users WHERE id = ?', [id]);

        res.json(successResponse(null, '用户删除成功'));

    } catch (error) {
        console.error('删除用户错误:', error);
        res.status(500).json(errorResponse('删除失败'));
    }
});

// 辅助函数：获取角色权限
function getRolePermissions(role) {
    const permissions = {
        admin: ['all', 'user_manage', 'registration_manage', 'protection_manage', 'news_manage', 'system_config'],
        regulator: ['registration_view', 'registration_review', 'protection_view', 'protection_handle', 'statistics_view'],
        data_holder: ['registration_create', 'registration_view_own', 'protection_create', 'protection_view_own'],
        data_user: ['registration_view', 'protection_create']
    };
    return permissions[role] || [];
}

// 获取所有登记列表（管理后台）
router.get('/registrations', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { status, category } = req.query;

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

        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM registrations r ${whereClause}`,
            params
        );

        const rows = await dbAsync.all(
            `SELECT r.*, u.phone as holder_phone
             FROM registrations r
             JOIN users u ON r.holder_id = u.id
             ${whereClause}
             ORDER BY r.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        res.json(successResponse({
            list: rows,
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
router.get('/registrations/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const item = await dbAsync.get(
            `SELECT r.*, u.phone as holder_phone, u.email as holder_email,
                    reviewer.username as reviewer_name
             FROM registrations r
             JOIN users u ON r.holder_id = u.id
             LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
             WHERE r.id = ?`,
            [id]
        );

        if (!item) {
            return res.status(404).json(errorResponse('登记信息不存在', 404));
        }

        // 获取相关文件
        const files = await dbAsync.all(
            'SELECT * FROM registration_files WHERE registration_id = ?',
            [id]
        );

        res.json(successResponse({ ...item, files }));

    } catch (error) {
        console.error('获取登记详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

// 创建登记（管理员代提交）
router.post('/registrations', authMiddleware, requireAdmin, async (req, res) => {
    try {
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
            description,
            holderId,
            holderName
        } = req.body;

        // 生成登记编号
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        const registrationNo = `TJDR${year}${month}${day}${random}`;

        const result = await dbAsync.run(
            `INSERT INTO registrations (
                registration_no, title, category, data_type, data_size,
                data_source, application_scene, update_frequency, data_format,
                expected_value, description, holder_id, holder_name, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                registrationNo, title, category, dataType, dataSize,
                dataSource, applicationScene, updateFrequency, dataFormat,
                expectedValue, description, holderId, holderName
            ]
        );

        res.status(201).json(successResponse({
            id: result.id,
            registrationNo
        }, '登记创建成功'));

    } catch (error) {
        console.error('创建登记错误:', error);
        res.status(500).json(errorResponse('创建失败'));
    }
});

// 更新登记信息
router.put('/registrations/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
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

        await dbAsync.run(
            `UPDATE registrations SET
                title = COALESCE(?, title),
                category = COALESCE(?, category),
                data_type = COALESCE(?, data_type),
                data_size = COALESCE(?, data_size),
                data_source = COALESCE(?, data_source),
                application_scene = COALESCE(?, application_scene),
                update_frequency = COALESCE(?, update_frequency),
                data_format = COALESCE(?, data_format),
                expected_value = COALESCE(?, expected_value),
                description = COALESCE(?, description),
                updated_at = ?
             WHERE id = ?`,
            [
                title, category, dataType, dataSize, dataSource,
                applicationScene, updateFrequency, dataFormat,
                expectedValue, description, getCurrentTimestamp(), id
            ]
        );

        res.json(successResponse(null, '登记信息更新成功'));

    } catch (error) {
        console.error('更新登记错误:', error);
        res.status(500).json(errorResponse('更新失败'));
    }
});

// 删除登记
router.delete('/registrations/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await dbAsync.run('DELETE FROM registrations WHERE id = ?', [id]);

        res.json(successResponse(null, '登记删除成功'));

    } catch (error) {
        console.error('删除登记错误:', error);
        res.status(500).json(errorResponse('删除失败'));
    }
});

// 审核登记（通过/拒绝）
router.put('/registrations/:id/review', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, comment } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json(errorResponse('无效的审核状态，只能是 approved 或 rejected', 400));
        }

        const statusText = status === 'approved' ? '通过' : '拒绝';

        // 获取登记信息（用于日志记录）
        const registration = await dbAsync.get(
            'SELECT title, holder_id FROM registrations WHERE id = ?',
            [id]
        );

        const now = getCurrentTimestamp();
        await dbAsync.run(
            `UPDATE registrations SET
                status = ?,
                review_comment = ?,
                reviewed_by = ?,
                reviewed_at = ?,
                published_at = CASE WHEN ? = 'approved' THEN ? ELSE NULL END
             WHERE id = ?`,
            [status, comment, req.user.id, now, status, now, id]
        );

        // 记录操作日志
        if (registration) {
            await dbAsync.run(
                `INSERT INTO operation_logs (user_id, username, action, module, description)
                 VALUES (?, ?, '审核登记', 'admin', ?)`,
                [req.user.id, req.user.username, `审核${statusText}了登记申请「${registration.title}」`]
            );
        }

        res.json(successResponse(null, `审核${statusText}完成`));

    } catch (error) {
        console.error('审核登记错误:', error);
        res.status(500).json(errorResponse('审核失败'));
    }
});


// ==================== 维权案件管理 API ====================

// 获取维权案件列表
router.get('/cases', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { status, keyword } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            whereClause += ' AND c.status = ?';
            params.push(status);
        }

        if (keyword) {
            whereClause += ' AND (c.case_no LIKE ? OR c.title LIKE ? OR c.applicant_name LIKE ?)';
            const likeKeyword = `%${keyword}%`;
            params.push(likeKeyword, likeKeyword, likeKeyword);
        }

        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM protection_cases c ${whereClause}`,
            params
        );

        const rows = await dbAsync.all(
            `SELECT c.*, 
                    r.title as registration_title,
                    r.registration_no
             FROM protection_cases c
             LEFT JOIN registrations r ON c.registration_id = r.id
             ${whereClause}
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        res.json(successResponse({
            list: rows,
            pagination: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        }));

    } catch (error) {
        console.error('获取维权案件列表错误:', error);
        res.status(500).json(errorResponse('获取列表失败'));
    }
});

// 获取维权案件详情
router.get('/cases/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const item = await dbAsync.get(
            `SELECT c.*, 
                    r.title as registration_title,
                    r.registration_no,
                    r.category as registration_category,
                    r.data_type as registration_data_type,
                    u.phone as applicant_phone,
                    u.email as applicant_email
             FROM protection_cases c
             LEFT JOIN registrations r ON c.registration_id = r.id
             LEFT JOIN users u ON c.applicant_id = u.id
             WHERE c.id = ?`,
            [id]
        );

        if (!item) {
            return res.status(404).json(errorResponse('案件不存在', 404));
        }

        res.json(successResponse(item));

    } catch (error) {
        console.error('获取维权案件详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

// 更新案件状态和进度
router.put('/cases/:id/status', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, progress, remark, handleComment } = req.body;
        
        // 支持 remark 或 handleComment 字段
        const comment = handleComment || remark;

        if (!['pending', 'processing', 'investigating', 'resolved', 'closed', 'rejected'].includes(status)) {
            return res.status(400).json(errorResponse('无效的状态值', 400));
        }

        const now = getCurrentTimestamp();
        await dbAsync.run(
            `UPDATE protection_cases SET
                status = ?,
                progress = COALESCE(?, progress),
                handle_comment = COALESCE(?, handle_comment),
                resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END,
                updated_at = ?
             WHERE id = ?`,
            [status, progress, comment, status, now, now, id]
        );

        res.json(successResponse(null, '状态更新成功'));

    } catch (error) {
        console.error('更新案件状态错误:', error);
        res.status(500).json(errorResponse('更新失败'));
    }
});

// 更新案件信息（编辑）
router.put('/cases/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            applicantName,
            applicantPhone,
            infringementType,
            description,
            infringerInfo,
            expectedSolution
        } = req.body;

        await dbAsync.run(
            `UPDATE protection_cases SET
                title = COALESCE(?, title),
                applicant_name = COALESCE(?, applicant_name),
                applicant_phone = COALESCE(?, applicant_phone),
                infringement_type = COALESCE(?, infringement_type),
                description = COALESCE(?, description),
                infringer_info = COALESCE(?, infringer_info),
                expected_solution = COALESCE(?, expected_solution),
                updated_at = ?
             WHERE id = ?`,
            [title, applicantName, applicantPhone, infringementType, description, infringerInfo, expectedSolution, getCurrentTimestamp(), id]
        );

        res.json(successResponse(null, '案件信息更新成功'));

    } catch (error) {
        console.error('更新案件错误:', error);
        res.status(500).json(errorResponse('更新失败'));
    }
});

// 创建案件（管理员代提交）
router.post('/cases', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const {
            title,
            applicantName,
            applicantPhone,
            infringementType,
            description,
            infringerInfo,
            expectedSolution
        } = req.body;

        // 生成案件编号
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        const caseNo = `CASE${year}${month}${day}${random}`;

        const result = await dbAsync.run(
            `INSERT INTO protection_cases (
                case_no, title, applicant_id, applicant_name, applicant_phone,
                infringement_type, description, infringer_info, expected_solution, 
                status, progress
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
            [caseNo, title, req.user.id, applicantName, applicantPhone, 
             infringementType, description, infringerInfo, expectedSolution]
        );

        res.status(201).json(successResponse({
            id: result.id,
            caseNo
        }, '案件创建成功'));

    } catch (error) {
        console.error('创建案件错误:', error);
        res.status(500).json(errorResponse('创建失败'));
    }
});

// 删除维权案件
router.delete('/cases/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 先删除相关的证据文件记录
        await dbAsync.run('DELETE FROM protection_evidence WHERE case_id = ?', [id]);

        // 删除案件
        await dbAsync.run('DELETE FROM protection_cases WHERE id = ?', [id]);

        res.json(successResponse(null, '案件删除成功'));

    } catch (error) {
        console.error('删除维权案件错误:', error);
        res.status(500).json(errorResponse('删除失败'));
    }
});

// ==================== 新闻公告管理 API ====================

// 获取所有新闻（包括未发布的）
router.get('/news', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { category, status } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (category) {
            whereClause += ' AND category = ?';
            params.push(category);
        }

        if (status === 'published') {
            whereClause += ' AND is_published = 1';
        } else if (status === 'draft') {
            whereClause += ' AND is_published = 0';
        }

        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM news ${whereClause}`,
            params
        );

        const rows = await dbAsync.all(
            `SELECT id, title, summary, cover_image, author_id, author_name, category, 
                    is_published, view_count, published_at, created_at, updated_at
             FROM news 
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        res.json(successResponse({
            list: rows,
            pagination: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        }));

    } catch (error) {
        console.error('获取新闻列表错误:', error);
        res.status(500).json(errorResponse('获取列表失败'));
    }
});

// 获取新闻详情
router.get('/news/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const item = await dbAsync.get(
            'SELECT * FROM news WHERE id = ?',
            [id]
        );

        if (!item) {
            return res.status(404).json(errorResponse('新闻不存在', 404));
        }

        res.json(successResponse(item));

    } catch (error) {
        console.error('获取新闻详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

// 创建新闻
router.post('/news', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { title, content, summary, coverImage, category, isPublished } = req.body;

        if (!title || !content) {
            return res.status(400).json(errorResponse('标题和内容不能为空', 400));
        }

        const now = getCurrentTimestamp();
        const result = await dbAsync.run(
            `INSERT INTO news (title, content, summary, cover_image, author_id, author_name, category, is_published, published_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, content, summary, coverImage, req.user.id, req.user.username, category, isPublished ? 1 : 0, isPublished ? now : null, now, now]
        );

        res.status(201).json(successResponse({ id: result.id }, '新闻创建成功'));

    } catch (error) {
        console.error('创建新闻错误:', error);
        res.status(500).json(errorResponse('创建失败'));
    }
});

// 更新新闻
router.put('/news/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, summary, coverImage, category, isPublished } = req.body;

        // 先获取当前状态
        const current = await dbAsync.get('SELECT is_published FROM news WHERE id = ?', [id]);
        if (!current) {
            return res.status(404).json(errorResponse('新闻不存在', 404));
        }

        const now = getCurrentTimestamp();
        await dbAsync.run(
            `UPDATE news SET
                title = COALESCE(?, title),
                content = COALESCE(?, content),
                summary = COALESCE(?, summary),
                cover_image = COALESCE(?, cover_image),
                category = COALESCE(?, category),
                is_published = COALESCE(?, is_published),
                published_at = CASE 
                    WHEN ? = 1 AND (SELECT is_published FROM news WHERE id = ?) = 0 
                    THEN ? 
                    ELSE published_at 
                END,
                updated_at = ?
             WHERE id = ?`,
            [title, content, summary, coverImage, category, isPublished !== undefined ? (isPublished ? 1 : 0) : null, isPublished, id, now, now, id]
        );

        res.json(successResponse(null, '新闻更新成功'));

    } catch (error) {
        console.error('更新新闻错误:', error);
        res.status(500).json(errorResponse('更新失败'));
    }
});

// 删除新闻
router.delete('/news/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await dbAsync.run('DELETE FROM news WHERE id = ?', [id]);

        res.json(successResponse(null, '新闻删除成功'));

    } catch (error) {
        console.error('删除新闻错误:', error);
        res.status(500).json(errorResponse('删除失败'));
    }
});

// ==================== 系统配置 API ====================

// 获取系统配置
router.get('/config', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const rows = await dbAsync.all('SELECT * FROM system_config');
        
        const config = {};
        rows.forEach(row => {
            config[row.config_key] = row.config_value;
        });

        res.json(successResponse(config));

    } catch (error) {
        console.error('获取配置错误:', error);
        res.status(500).json(errorResponse('获取配置失败'));
    }
});

// 更新系统配置
router.put('/config/:key', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        const now = getCurrentTimestamp();
        await dbAsync.run(
            `INSERT INTO system_config (config_key, config_value, updated_at) 
             VALUES (?, ?, ?)
             ON CONFLICT(config_key) DO UPDATE SET 
                config_value = excluded.config_value,
                updated_at = ?`,
            [key, value, now, now]
        );

        res.json(successResponse(null, '配置更新成功'));

    } catch (error) {
        console.error('更新配置错误:', error);
        res.status(500).json(errorResponse('更新配置失败'));
    }
});

module.exports = router;

// ==================== 法律咨询管理 API ====================

// 获取法律咨询列表
router.get('/consultations', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { status, type } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            whereClause += ' AND lc.status = ?';
            params.push(status);
        }

        if (type) {
            whereClause += ' AND lc.type = ?';
            params.push(type);
        }

        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM legal_consultations lc ${whereClause}`,
            params
        );

        const rows = await dbAsync.all(
            `SELECT lc.*, u.username, u.phone, u.email
             FROM legal_consultations lc
             JOIN users u ON lc.user_id = u.id
             ${whereClause}
             ORDER BY lc.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        const typeMap = {
            'infringement': '侵权咨询',
            'contract': '合同咨询',
            'registration': '登记咨询',
            'other': '其他咨询'
        };

        const statusMap = {
            'pending': '待处理',
            'processing': '处理中',
            'resolved': '已解决'
        };

        res.json(successResponse({
            list: rows.map(item => ({
                ...item,
                typeText: typeMap[item.type] || item.type,
                statusText: statusMap[item.status] || item.status
            })),
            pagination: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        }));

    } catch (error) {
        console.error('获取法律咨询列表错误:', error);
        res.status(500).json(errorResponse('获取列表失败'));
    }
});

// 回复法律咨询
router.put('/consultations/:id/answer', authMiddleware, requireAdmin, [
    body('answer').notEmpty().withMessage('回复内容不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { id } = req.params;
        const { answer } = req.body;

        const now = getCurrentTimestamp();
        await dbAsync.run(
            `UPDATE legal_consultations SET
                answer = ?,
                status = 'resolved',
                answered_by = ?,
                answered_at = ?,
                updated_at = ?
             WHERE id = ?`,
            [answer, req.user.id, now, now, id]
        );

        res.json(successResponse(null, '回复成功'));

    } catch (error) {
        console.error('回复法律咨询错误:', error);
        res.status(500).json(errorResponse('回复失败'));
    }
});

// 获取成功案例列表（管理）
router.get('/success-cases', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);

        const countResult = await dbAsync.get('SELECT COUNT(*) as total FROM success_cases');

        const rows = await dbAsync.all(
            `SELECT * FROM success_cases
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [pageSize, offset]
        );

        res.json(successResponse({
            list: rows,
            pagination: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        }));

    } catch (error) {
        console.error('获取成功案例错误:', error);
        res.status(500).json(errorResponse('获取失败'));
    }
});

// 创建成功案例
router.post('/success-cases', authMiddleware, requireAdmin, [
    body('title').notEmpty().withMessage('案例标题不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { title, description, caseType, result, amount } = req.body;

        const insertResult = await dbAsync.run(
            `INSERT INTO success_cases (title, description, case_type, result, amount)
             VALUES (?, ?, ?, ?, ?)`,
            [title, description || null, caseType || null, result || null, amount || null]
        );

        res.status(201).json(successResponse({ id: insertResult.id }, '案例创建成功'));

    } catch (error) {
        console.error('创建成功案例错误:', error);
        res.status(500).json(errorResponse('创建失败: ' + error.message));
    }
});

// 删除成功案例
router.delete('/success-cases/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await dbAsync.run('DELETE FROM success_cases WHERE id = ?', [id]);

        res.json(successResponse(null, '删除成功'));

    } catch (error) {
        console.error('删除成功案例错误:', error);
        res.status(500).json(errorResponse('删除失败'));
    }
});
