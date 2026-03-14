/**
 * 管理员认证管理路由
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbAsync } = require('../database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { successResponse, errorResponse, getPagination, getCurrentTimestamp } = require('../utils/helpers');

const router = express.Router();

// 获取认证申请列表
router.get('/applications', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { type, status } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (type) {
            whereClause += ' AND va.type = ?';
            params.push(type);
        }

        if (status) {
            whereClause += ' AND va.status = ?';
            params.push(status);
        }

        // 获取总数
        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM verification_applications va ${whereClause}`,
            params
        );

        // 获取列表
        const rows = await dbAsync.all(
            `SELECT va.*, u.username, u.phone
             FROM verification_applications va
             JOIN users u ON va.user_id = u.id
             ${whereClause}
             ORDER BY va.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        // 敏感信息脱敏
        const maskedRows = rows.map(row => ({
            ...row,
            id_card: row.id_card ? row.id_card.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2') : null,
            legal_person_id_card: row.legal_person_id_card ? row.legal_person_id_card.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2') : null
        }));

        res.json(successResponse({
            list: maskedRows,
            pagination: {
                page,
                pageSize,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / pageSize)
            }
        }));

    } catch (error) {
        console.error('获取认证申请列表错误:', error);
        res.status(500).json(errorResponse('获取列表失败'));
    }
});

// 获取认证申请详情
router.get('/applications/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const application = await dbAsync.get(
            `SELECT va.*, u.username, u.phone, u.email
             FROM verification_applications va
             JOIN users u ON va.user_id = u.id
             WHERE va.id = ?`,
            [id]
        );

        if (!application) {
            return res.status(404).json(errorResponse('申请记录不存在', 404));
        }

        res.json(successResponse(application));

    } catch (error) {
        console.error('获取认证申请详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

// 审核认证申请
router.put('/applications/:id/review', authMiddleware, requireAdmin, [
    body('status').isIn(['approved', 'rejected']).withMessage('审核状态只能是 approved 或 rejected'),
    body('comment').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { id } = req.params;
        const { status, comment } = req.body;

        // 获取申请信息
        const application = await dbAsync.get(
            'SELECT * FROM verification_applications WHERE id = ?',
            [id]
        );

        if (!application) {
            return res.status(404).json(errorResponse('申请记录不存在', 404));
        }

        if (application.status !== 'pending') {
            return res.status(400).json(errorResponse('该申请已审核，不能重复操作', 400));
        }

        // 更新申请状态
        const now = getCurrentTimestamp();
        await dbAsync.run(
            `UPDATE verification_applications SET
                status = ?,
                review_comment = ?,
                reviewed_by = ?,
                reviewed_at = ?
             WHERE id = ?`,
            [status, comment || null, req.user.id, now, id]
        );

        // 如果审核通过，更新用户认证状态
        if (status === 'approved') {
            if (application.type === 'personal') {
                // 个人认证：获取用户已有的 organization 作为所属机构
                const user = await dbAsync.get(
                    'SELECT organization FROM users WHERE id = ?',
                    [application.user_id]
                );
                await dbAsync.run(
                    `UPDATE users SET
                        verified = 1,
                        real_name = ?,
                        id_card = ?,
                        organization = COALESCE(?, organization),
                        verified_at = ?
                     WHERE id = ?`,
                    [application.real_name, application.id_card, user?.organization, now, application.user_id]
                );
            } else if (application.type === 'enterprise') {
                // 企业认证：法人姓名作为 real_name，企业名称作为 organization
                await dbAsync.run(
                    `UPDATE users SET
                        verified = 1,
                        real_name = COALESCE(?, real_name),
                        organization = ?,
                        org_code = ?,
                        verified_at = ?
                     WHERE id = ?`,
                    [application.legal_person_name, application.enterprise_name, application.credit_code, now, application.user_id]
                );
            }
        }

        // 记录操作日志
        await dbAsync.run(
            `INSERT INTO operation_logs (user_id, username, action, module, description)
             VALUES (?, ?, '审核认证', 'admin', ?)`,
            [req.user.id, req.user.username, `审核${status === 'approved' ? '通过' : '拒绝'}了用户 ${application.user_id} 的${application.type === 'personal' ? '个人' : '企业'}认证申请`]
        );

        const statusText = status === 'approved' ? '通过' : '拒绝';
        res.json(successResponse(null, `审核${statusText}完成`));

    } catch (error) {
        console.error('审核认证申请错误:', error);
        res.status(500).json(errorResponse('审核失败: ' + error.message));
    }
});

module.exports = router;

// 更新成功案例
router.put('/success-cases/:id', authMiddleware, requireAdmin, [
    body('title').notEmpty().withMessage('案例标题不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { id } = req.params;
        const { title, caseType, result, amount, description } = req.body;

        await dbAsync.run(
            `UPDATE success_cases SET
                title = ?,
                case_type = ?,
                result = ?,
                amount = ?,
                description = ?
             WHERE id = ?`,
            [title, caseType || null, result || null, amount || null, description || null, id]
        );

        res.json(successResponse(null, '案例更新成功'));

    } catch (error) {
        console.error('更新成功案例错误:', error);
        res.status(500).json(errorResponse('更新失败: ' + error.message));
    }
});
