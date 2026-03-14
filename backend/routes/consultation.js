/**
 * 法律咨询路由
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbAsync } = require('../database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { successResponse, errorResponse, getCurrentTimestamp } = require('../utils/helpers');

const router = express.Router();

// 提交法律咨询（需要登录）
router.post('/', authMiddleware, [
    body('type').isIn(['infringement', 'contract', 'registration', 'other']).withMessage('无效的咨询类型'),
    body('question').isLength({ min: 10 }).withMessage('咨询问题至少10个字符'),
    body('contact').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { type, question, contact } = req.body;

        const now = getCurrentTimestamp();
        const result = await dbAsync.run(
            `INSERT INTO legal_consultations (user_id, type, question, contact, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
            [req.user.id, type, question, contact || null, now, now]
        );

        // 记录操作日志
        await dbAsync.run(
            `INSERT INTO operation_logs (user_id, username, action, module, description)
             VALUES (?, ?, '提交法律咨询', 'consultation', ?)`,
            [req.user.id, req.user.username, `提交了${getTypeText(type)}咨询`]
        );

        res.status(201).json(successResponse({
            id: result.id,
            status: 'pending'
        }, '咨询提交成功，我们将尽快回复'));

    } catch (error) {
        console.error('提交法律咨询错误:', error);
        res.status(500).json(errorResponse('提交失败: ' + error.message));
    }
});

// 获取我的咨询列表（需要登录）
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const consultations = await dbAsync.all(
            `SELECT id, type, question, status, answer, created_at, updated_at
             FROM legal_consultations
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json(successResponse(consultations.map(c => ({
            ...c,
            typeText: getTypeText(c.type),
            statusText: getStatusText(c.status)
        }))));

    } catch (error) {
        console.error('获取咨询列表错误:', error);
        res.status(500).json(errorResponse('获取失败'));
    }
});

// 获取咨询统计数据（公开）
router.get('/stats', async (req, res) => {
    try {
        // 咨询统计
        const consultationStats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
             FROM legal_consultations`
        );

        // 计算解决率
        const resolutionRate = consultationStats.total > 0 
            ? Math.round((consultationStats.resolved / consultationStats.total) * 100) 
            : 0;

        res.json(successResponse({
            total: consultationStats.total,
            resolved: consultationStats.resolved,
            pending: consultationStats.pending,
            resolutionRate
        }));

    } catch (error) {
        console.error('获取咨询统计错误:', error);
        res.status(500).json(errorResponse('获取失败'));
    }
});

// 获取成功案例列表（公开）
router.get('/cases', async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        const cases = await dbAsync.all(
            `SELECT * FROM success_cases 
             WHERE is_published = 1
             ORDER BY created_at DESC
             LIMIT ?`,
            [parseInt(limit)]
        );

        res.json(successResponse(cases));

    } catch (error) {
        console.error('获取成功案例错误:', error);
        res.status(500).json(errorResponse('获取失败'));
    }
});

// 获取案件统计数据（公开）
router.get('/case-stats', async (req, res) => {
    try {
        // 从protection_cases表获取统计
        const caseStats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
                COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed
             FROM protection_cases`
        );

        // 计算成功率（已解决+已关闭视为成功）
        const successful = caseStats.resolved + caseStats.closed;
        const successRate = caseStats.total > 0 
            ? Math.round((successful / caseStats.total) * 100) 
            : 0;

        res.json(successResponse({
            total: caseStats.total,
            processing: caseStats.processing,
            resolved: caseStats.resolved,
            closed: caseStats.closed,
            successRate
        }));

    } catch (error) {
        console.error('获取案件统计错误:', error);
        res.status(500).json(errorResponse('获取失败'));
    }
});

// 辅助函数
function getTypeText(type) {
    const typeMap = {
        'infringement': '侵权咨询',
        'contract': '合同咨询',
        'registration': '登记咨询',
        'other': '其他咨询'
    };
    return typeMap[type] || type;
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'processing': '处理中',
        'resolved': '已解决'
    };
    return statusMap[status] || status;
}

module.exports = router;
