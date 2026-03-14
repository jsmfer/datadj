/**
 * 认证路由
 * 用户登录、注册、信息获取
 */

require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { dbAsync } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { successResponse, errorResponse, getCurrentTimestamp } = require('../utils/helpers');

// JWT密钥 - 使用环境变量或默认值
const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== '' 
    ? process.env.JWT_SECRET 
    : 'tianjin-data-property-default-secret-key-2024';

const router = express.Router();

// 用户登录
router.post('/login', [
    body('phone').notEmpty().withMessage('手机号不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { phone, password } = req.body;

        // 查找用户
        const user = await dbAsync.get(
            'SELECT * FROM users WHERE phone = ? AND status = 1',
            [phone]
        );

        if (!user) {
            return res.status(401).json(errorResponse('用户不存在或已被禁用', 401));
        }

        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json(errorResponse('密码错误', 401));
        }

        // 生成Token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                phone: user.phone,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 更新最后登录时间
        await dbAsync.run(
            'UPDATE users SET updated_at = datetime("now") WHERE id = ?',
            [user.id]
        );

        res.json(successResponse({
            token,
            user: {
                id: user.id,
                username: user.username,
                phone: user.phone,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                realName: user.real_name,
                organization: user.organization,
                verified: user.verified === 1,
                registerTime: user.created_at
            }
        }, '登录成功'));

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json(errorResponse('登录失败'));
    }
});

// 用户注册
router.post('/register', [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('phone').notEmpty().withMessage('手机号不能为空'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
    body('role').optional().isIn(['data_holder', 'data_user']).withMessage('无效的用户角色')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { username, phone, password, role = 'data_holder', organization } = req.body;

        // 验证必填字段
        if (!organization || organization.trim() === '') {
            return res.status(400).json(errorResponse('所属机构/单位不能为空', 400));
        }

        // 检查手机号是否已存在
        const existingUser = await dbAsync.get(
            'SELECT id FROM users WHERE phone = ?',
            [phone]
        );

        if (existingUser) {
            return res.status(400).json(errorResponse('该手机号已注册', 400));
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = getCurrentTimestamp();

        // 创建用户
        const result = await dbAsync.run(
            `INSERT INTO users (username, phone, password, role, organization, verified, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
            [username, phone, hashedPassword, role, organization, now, now]
        );

        res.status(201).json(successResponse({
            userId: result.id
        }, '注册成功'));

    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json(errorResponse('注册失败'));
    }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await dbAsync.get(
            `SELECT id, username, phone, email, role, avatar, real_name, organization, 
                    verified, created_at as register_time
             FROM users WHERE id = ?`,
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json(errorResponse('用户不存在', 404));
        }

        // 获取用户统计数据
        const stats = await dbAsync.get(
            `SELECT 
                COUNT(DISTINCT r.id) as registration_count,
                COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN r.id END) as approved_count,
                COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END) as pending_count,
                COUNT(DISTINCT pc.id) as protection_count
             FROM users u
             LEFT JOIN registrations r ON r.holder_id = u.id
             LEFT JOIN protection_cases pc ON pc.applicant_id = u.id
             WHERE u.id = ?`,
            [req.user.id]
        );

        res.json(successResponse({
            ...user,
            verified: user.verified === 1,
            stats: {
                registrationCount: stats.registration_count || 0,
                approvedCount: stats.approved_count || 0,
                pendingCount: stats.pending_count || 0,
                protectionCount: stats.protection_count || 0
            }
        }));

    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(500).json(errorResponse('获取用户信息失败'));
    }
});

// 修改密码
router.put('/password', authMiddleware, [
    body('oldPassword').notEmpty().withMessage('原密码不能为空'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { oldPassword, newPassword } = req.body;

        // 获取用户
        const user = await dbAsync.get(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );

        // 验证原密码
        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) {
            return res.status(400).json(errorResponse('原密码错误', 400));
        }

        // 更新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await dbAsync.run(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );

        res.json(successResponse(null, '密码修改成功'));

    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json(errorResponse('修改密码失败'));
    }
});

// 更新用户信息
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { username, email, realName, organization } = req.body;

        await dbAsync.run(
            `UPDATE users SET 
                username = COALESCE(?, username),
                email = COALESCE(?, email),
                real_name = COALESCE(?, real_name),
                organization = COALESCE(?, organization),
                updated_at = ?
             WHERE id = ?`,
            [username, email, realName, organization, getCurrentTimestamp(), req.user.id]
        );

        res.json(successResponse(null, '个人信息更新成功'));

    } catch (error) {
        console.error('更新用户信息错误:', error);
        res.status(500).json(errorResponse('更新失败'));
    }
});

// 获取用户最近活动
router.get('/activities', authMiddleware, async (req, res) => {
    try {
        // 从操作日志获取用户活动（转换为本地时间）
        const activities = await dbAsync.all(
            `SELECT 
                action,
                description,
                created_at as time
             FROM operation_logs
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 10`,
            [req.user.id]
        );

        // 同时获取最近的登记记录作为活动（转换为本地时间）
        const registrations = await dbAsync.all(
            `SELECT 
                'submit_registration' as action,
                '提交了新的数据产权登记申请' as action_text,
                title as detail,
                created_at as time
             FROM registrations
             WHERE holder_id = ?
             ORDER BY created_at DESC
             LIMIT 5`,
            [req.user.id]
        );

        // 获取最近的维权案件作为活动（转换为本地时间）
        const protections = await dbAsync.all(
            `SELECT 
                'submit_protection' as action,
                '提交了维权申请' as action_text,
                title as detail,
                created_at as time
             FROM protection_cases
             WHERE applicant_id = ?
             ORDER BY created_at DESC
             LIMIT 5`,
            [req.user.id]
        );

        // 合并所有活动，按时间排序
        const allActivities = [
            ...activities.map(a => ({
                action: a.action,
                detail: a.description,
                time: a.time
            })),
            ...registrations.map(r => ({
                action: r.action_text,
                detail: r.detail,
                time: r.time
            })),
            ...protections.map(p => ({
                action: p.action_text,
                detail: p.detail,
                time: p.time
            }))
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

        res.json(successResponse(allActivities));

    } catch (error) {
        console.error('获取用户活动错误:', error);
        res.status(500).json(errorResponse('获取活动记录失败'));
    }
});

// 获取用户通知
router.get('/notifications', authMiddleware, async (req, res) => {
    try {
        // 从登记状态变化生成通知（转换为本地时间）
        const registrationNotifications = await dbAsync.all(
            `SELECT 
                CASE 
                    WHEN status = 'approved' THEN '审核通过通知'
                    WHEN status = 'rejected' THEN '审核未通过通知'
                    ELSE '状态更新通知'
                END as title,
                '您的登记申请「' || title || '」' || 
                CASE 
                    WHEN status = 'approved' THEN '已通过审核'
                    WHEN status = 'rejected' THEN '未通过审核'
                    ELSE '状态已更新'
                END as content,
                reviewed_at as time,
                CASE WHEN reviewed_at > datetime('now', '-7 days', 'localtime') THEN 0 ELSE 1 END as read  -- 使用相对时间判断，不影响显示
             FROM registrations
             WHERE holder_id = ? 
               AND status IN ('approved', 'rejected')
               AND reviewed_at IS NOT NULL
             ORDER BY reviewed_at DESC
             LIMIT 5`,
            [req.user.id]
        );

        // 从维权案件状态生成通知（转换为本地时间）
        const protectionNotifications = await dbAsync.all(
            `SELECT 
                CASE 
                    WHEN status = 'resolved' THEN '维权处理完成通知'
                    WHEN status = 'processing' THEN '维权进度更新'
                    ELSE '维权状态更新'
                END as title,
                '您的维权申请「' || title || '」' ||
                CASE 
                    WHEN status = 'resolved' THEN '已处理完成'
                    WHEN status = 'processing' THEN '正在处理中'
                    ELSE '状态已更新'
                END as content,
                updated_at as time,
                CASE WHEN updated_at > datetime('now', '-7 days', 'localtime') THEN 0 ELSE 1 END as read
             FROM protection_cases
             WHERE applicant_id = ?
               AND status IN ('resolved', 'processing')
             ORDER BY updated_at DESC
             LIMIT 3`,
            [req.user.id]
        );

        // 合并所有通知，按时间排序
        const allNotifications = [
            ...registrationNotifications,
            ...protectionNotifications
        ].sort((a, b) => new Date(b.time) - new Date(a.time));

        // 如果没有通知，返回系统通知
        if (allNotifications.length === 0) {
            allNotifications.push({
                title: '欢迎使用',
                content: '欢迎使用天津数据产权登记服务平台',
                time: new Date().toISOString(),
                read: false
            });
        }

        res.json(successResponse(allNotifications.slice(0, 10)));

    } catch (error) {
        console.error('获取用户通知错误:', error);
        res.status(500).json(errorResponse('获取通知失败'));
    }
});

module.exports = router;
