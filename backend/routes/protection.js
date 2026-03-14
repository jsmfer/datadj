/**
 * 维权服务路由
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbAsync } = require('../database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { 
    successResponse, 
    errorResponse, 
    getPagination,
    generateCaseNo,
    getCurrentTimestamp
} = require('../utils/helpers');

const router = express.Router();

// 获取维权案件列表
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { status } = req.query;

        let whereClause = 'WHERE applicant_id = ?';
        const params = [req.user.id];

        if (req.user.role === 'admin' || req.user.role === 'regulator') {
            whereClause = 'WHERE 1=1';
            params.length = 0;
        }

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM protection_cases ${whereClause}`,
            params
        );

        const rows = await dbAsync.all(
            `SELECT pc.*, r.title as registration_title
             FROM protection_cases pc
             LEFT JOIN registrations r ON pc.registration_id = r.id
             ${whereClause}
             ORDER BY pc.created_at DESC
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
        console.error('获取维权案件错误:', error);
        res.status(500).json(errorResponse('获取列表失败'));
    }
});

// 获取维权案件详情
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const item = await dbAsync.get(
            `SELECT pc.*, r.title as registration_title
             FROM protection_cases pc
             LEFT JOIN registrations r ON pc.registration_id = r.id
             WHERE pc.id = ? OR pc.case_no = ?`,
            [id, id]
        );

        if (!item) {
            return res.status(404).json(errorResponse('案件不存在', 404));
        }

        // 检查权限
        if (req.user.role !== 'admin' && req.user.role !== 'regulator' && 
            item.applicant_id !== req.user.id) {
            return res.status(403).json(errorResponse('无权访问此案件', 403));
        }

        // 获取证据文件
        const evidence = await dbAsync.all(
            'SELECT * FROM protection_evidence WHERE case_id = ?',
            [item.id]
        );

        res.json(successResponse({
            ...item,
            evidence
        }));

    } catch (error) {
        console.error('获取案件详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

// 提交维权申请
router.post('/', authMiddleware, [
    body('title').notEmpty().withMessage('案件标题不能为空'),
    body('applicantName').notEmpty().withMessage('申请人姓名不能为空'),
    body('applicantPhone').notEmpty().withMessage('联系电话不能为空'),
    body('infringementType').notEmpty().withMessage('侵权类型不能为空'),
    body('description').notEmpty().withMessage('侵权描述不能为空')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const {
            title,
            applicantName,
            applicantPhone,
            registrationId,
            registrationTitle,
            infringementType,
            description,
            infringerInfo,
            expectedSolution
        } = req.body;

        const caseNo = generateCaseNo();
        const now = getCurrentTimestamp();

        const result = await dbAsync.run(
            `INSERT INTO protection_cases (
                case_no, title, applicant_id, applicant_name, applicant_phone,
                registration_id, registration_title, infringement_type,
                description, infringer_info, expected_solution, status, progress,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', 10, ?, ?)`,
            [
                caseNo, title, req.user.id, applicantName, applicantPhone,
                registrationId, registrationTitle, infringementType,
                description, infringerInfo, expectedSolution, now, now
            ]
        );

        // 记录操作日志
        await dbAsync.run(
            `INSERT INTO operation_logs (user_id, username, action, module, description)
             VALUES (?, ?, '提交维权', 'protection', ?)`,
            [req.user.id, req.user.username, `提交了维权申请：${title}`]
        );

        res.status(201).json(successResponse({
            id: result.id,
            caseNo
        }, '维权申请提交成功'));

    } catch (error) {
        console.error('提交维权申请错误:', error);
        res.status(500).json(errorResponse('提交申请失败'));
    }
});

// 更新案件进度（管理员）
router.put('/:id/progress', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { progress, status, handleComment } = req.body;

        const updates = [];
        const params = [];

        if (progress !== undefined) {
            updates.push('progress = ?');
            params.push(progress);
        }

        if (status) {
            updates.push('status = ?');
            params.push(status);
            if (status === 'resolved') {
                updates.push('resolved_at = datetime("now")');
            }
        }

        if (handleComment) {
            updates.push('handle_comment = ?');
            params.push(handleComment);
        }

        updates.push('handler_id = ?');
        updates.push('handler_name = ?');
        updates.push('updated_at = datetime("now")');
        params.push(req.user.id, req.user.username);

        params.push(id);

        await dbAsync.run(
            `UPDATE protection_cases SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        res.json(successResponse(null, '案件更新成功'));

    } catch (error) {
        console.error('更新案件错误:', error);
        res.status(500).json(errorResponse('更新失败'));
    }
});

// 获取维权统计数据
router.get('/stats/overview', authMiddleware, async (req, res) => {
    try {
        const stats = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_cases,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_count,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
                COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count
             FROM protection_cases
             ${req.user.role !== 'admin' ? 'WHERE applicant_id = ' + req.user.id : ''}`
        );

        res.json(successResponse(stats));

    } catch (error) {
        console.error('获取维权统计错误:', error);
        res.status(500).json(errorResponse('获取统计数据失败'));
    }
});

module.exports = router;
