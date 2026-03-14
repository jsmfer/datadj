/**
 * 新闻公告路由
 */

const express = require('express');
const { dbAsync } = require('../database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { successResponse, errorResponse, getPagination, getCurrentTimestamp } = require('../utils/helpers');

const router = express.Router();

// 获取系统配置（公开）
router.get('/config', async (req, res) => {
    try {
        const rows = await dbAsync.all(
            'SELECT config_key, config_value, description FROM system_config'
        );
        
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

// 获取新闻列表（公开）
router.get('/', async (req, res) => {
    try {
        const { page, pageSize, offset } = getPagination(req);
        const { category } = req.query;

        let whereClause = 'WHERE is_published = 1';
        const params = [];

        if (category) {
            whereClause += ' AND category = ?';
            params.push(category);
        }

        const countResult = await dbAsync.get(
            `SELECT COUNT(*) as total FROM news ${whereClause}`,
            params
        );

        const rows = await dbAsync.all(
            `SELECT id, title, summary, cover_image, author_name, category, 
                    view_count, published_at, created_at
             FROM news 
             ${whereClause}
             ORDER BY published_at DESC
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
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const item = await dbAsync.get(
            'SELECT * FROM news WHERE id = ? AND is_published = 1',
            [id]
        );

        if (!item) {
            return res.status(404).json(errorResponse('新闻不存在', 404));
        }

        // 增加浏览量
        await dbAsync.run(
            'UPDATE news SET view_count = view_count + 1 WHERE id = ?',
            [id]
        );

        res.json(successResponse(item));

    } catch (error) {
        console.error('获取新闻详情错误:', error);
        res.status(500).json(errorResponse('获取详情失败'));
    }
});

// 创建新闻（管理员）
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { title, content, summary, coverImage, category } = req.body;

        const now = getCurrentTimestamp();
        const result = await dbAsync.run(
            `INSERT INTO news (title, content, summary, cover_image, author_id, author_name, category, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, content, summary, coverImage, req.user.id, req.user.username, category, now, now]
        );

        res.status(201).json(successResponse({ id: result.id }, '新闻创建成功'));

    } catch (error) {
        console.error('创建新闻错误:', error);
        res.status(500).json(errorResponse('创建失败'));
    }
});

// 更新新闻（管理员）
router.put('/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, summary, coverImage, category, isPublished } = req.body;

        await dbAsync.run(
            `UPDATE news SET
                title = COALESCE(?, title),
                content = COALESCE(?, content),
                summary = COALESCE(?, summary),
                cover_image = COALESCE(?, cover_image),
                category = COALESCE(?, category),
                is_published = COALESCE(?, is_published),
                published_at = CASE WHEN ? = 1 AND is_published = 0 THEN ? ELSE published_at END,
                updated_at = ?
             WHERE id = ?`,
            [title, content, summary, coverImage, category, isPublished, isPublished, getCurrentTimestamp(), getCurrentTimestamp(), id]
        );

        res.json(successResponse(null, '新闻更新成功'));

    } catch (error) {
        console.error('更新新闻错误:', error);
        res.status(500).json(errorResponse('更新失败'));
    }
});

// 删除新闻（管理员）
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await dbAsync.run('DELETE FROM news WHERE id = ?', [id]);

        res.json(successResponse(null, '新闻删除成功'));

    } catch (error) {
        console.error('删除新闻错误:', error);
        res.status(500).json(errorResponse('删除失败'));
    }
});

module.exports = router;
