/**
 * 认证路由
 * 个人身份认证和企业认证
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { dbAsync } = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { successResponse, errorResponse, getCurrentTimestamp } = require('../utils/helpers');

const router = express.Router();

// 获取用户认证状态
router.get('/status', authMiddleware, async (req, res) => {
    try {
        // 获取用户当前认证状态
        const user = await dbAsync.get(
            'SELECT verified, real_name, id_card, organization FROM users WHERE id = ?',
            [req.user.id]
        );

        // 获取最新的认证申请记录
        const applications = await dbAsync.all(
            `SELECT * FROM verification_applications 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT 5`,
            [req.user.id]
        );

        res.json(successResponse({
            verified: user.verified === 1,
            realName: user.real_name,
            idCard: user.id_card ? user.id_card.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2') : null,
            organization: user.organization,
            applications: applications.map(app => ({
                id: app.id,
                type: app.type,
                status: app.status,
                createdAt: app.created_at,
                reviewedAt: app.reviewed_at,
                reviewComment: app.review_comment
            }))
        }));

    } catch (error) {
        console.error('获取认证状态错误:', error);
        res.status(500).json(errorResponse('获取认证状态失败'));
    }
});

// 提交个人身份认证申请
router.post('/personal', authMiddleware, [
    body('realName').notEmpty().withMessage('真实姓名不能为空'),
    body('idCard').matches(/^\d{17}[\dXx]$/).withMessage('身份证号格式不正确'),
    body('idCardFront').notEmpty().withMessage('请上传身份证正面照片'),
    body('idCardBack').notEmpty().withMessage('请上传身份证反面照片')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const { realName, idCard, idCardFront, idCardBack } = req.body;

        // 检查是否已有待审核的申请
        const pendingApp = await dbAsync.get(
            `SELECT id FROM verification_applications 
             WHERE user_id = ? AND type = 'personal' AND status = 'pending'`,
            [req.user.id]
        );

        if (pendingApp) {
            return res.status(400).json(errorResponse('您已有待审核的个人认证申请，请勿重复提交', 400));
        }

        // 创建认证申请
        const now = getCurrentTimestamp();
        const result = await dbAsync.run(
            `INSERT INTO verification_applications 
             (user_id, type, real_name, id_card, id_card_front, id_card_back, status, created_at, updated_at)
             VALUES (?, 'personal', ?, ?, ?, ?, 'pending', ?, ?)`,
            [req.user.id, realName, idCard, idCardFront, idCardBack, now, now]
        );

        // 记录操作日志
        await dbAsync.run(
            `INSERT INTO operation_logs (user_id, username, action, module, description)
             VALUES (?, ?, '提交个人认证', 'verification', ?)`,
            [req.user.id, req.user.username, `提交了个人身份认证申请`]
        );

        res.status(201).json(successResponse({
            id: result.id,
            status: 'pending'
        }, '个人身份认证申请提交成功，请等待审核'));

    } catch (error) {
        console.error('提交个人认证错误:', error);
        res.status(500).json(errorResponse('提交申请失败: ' + error.message));
    }
});

// 提交企业认证申请
router.post('/enterprise', authMiddleware, [
    body('enterpriseName').notEmpty().withMessage('企业名称不能为空'),
    body('creditCode').notEmpty().withMessage('统一社会信用代码不能为空'),
    body('legalPersonName').notEmpty().withMessage('法人姓名不能为空'),
    body('legalPersonIdCard').matches(/^\d{17}[\dXx]$/).withMessage('法人身份证号格式不正确'),
    body('businessLicense').notEmpty().withMessage('请上传企业营业执照'),
    body('authorizationLetter').notEmpty().withMessage('请上传加盖企业公章的授权函')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errorResponse(errors.array()[0].msg, 400));
        }

        const {
            enterpriseName,
            creditCode,
            legalPersonName,
            legalPersonIdCard,
            businessLicense,
            authorizationLetter
        } = req.body;

        // 检查是否已有待审核的申请
        const pendingApp = await dbAsync.get(
            `SELECT id FROM verification_applications 
             WHERE user_id = ? AND type = 'enterprise' AND status = 'pending'`,
            [req.user.id]
        );

        if (pendingApp) {
            return res.status(400).json(errorResponse('您已有待审核的企业认证申请，请勿重复提交', 400));
        }

        // 创建认证申请
        const now = getCurrentTimestamp();
        const result = await dbAsync.run(
            `INSERT INTO verification_applications 
             (user_id, type, enterprise_name, credit_code, business_license, 
              authorization_letter, legal_person_name, legal_person_id_card, status, created_at, updated_at)
             VALUES (?, 'enterprise', ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [req.user.id, enterpriseName, creditCode, businessLicense, 
             authorizationLetter, legalPersonName, legalPersonIdCard, now, now]
        );

        // 记录操作日志
        await dbAsync.run(
            `INSERT INTO operation_logs (user_id, username, action, module, description)
             VALUES (?, ?, '提交企业认证', 'verification', ?)`,
            [req.user.id, req.user.username, `提交了企业认证申请：${enterpriseName}`]
        );

        res.status(201).json(successResponse({
            id: result.id,
            status: 'pending'
        }, '企业认证申请提交成功，请等待审核'));

    } catch (error) {
        console.error('提交企业认证错误:', error);
        res.status(500).json(errorResponse('提交申请失败: ' + error.message));
    }
});

// 获取认证申请详情
router.get('/application/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const application = await dbAsync.get(
            `SELECT * FROM verification_applications WHERE id = ? AND user_id = ?`,
            [id, req.user.id]
        );

        if (!application) {
            return res.status(404).json(errorResponse('申请记录不存在', 404));
        }

        // 敏感信息脱敏处理
        const maskedApp = {
            ...application,
            id_card: application.id_card ? application.id_card.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2') : null,
            legal_person_id_card: application.legal_person_id_card ? application.legal_person_id_card.replace(/(\d{4})\d{10}(\d{4})/, '$1**********$2') : null
        };

        res.json(successResponse(maskedApp));

    } catch (error) {
        console.error('获取认证申请详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

module.exports = router;
