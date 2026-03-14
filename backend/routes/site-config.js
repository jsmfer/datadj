/**
 * 网站配置路由 - 管理Header、Footer等前端配置
 */

const express = require('express');
const { dbAsync } = require('../database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { successResponse, errorResponse, getCurrentTimestamp } = require('../utils/helpers');

const router = express.Router();

// 配置项键名常量
const CONFIG_KEYS = {
    // Header配置
    SITE_NAME: 'site_name',
    SITE_LOGO: 'site_logo',
    SITE_SLOGAN: 'site_slogan',
    SITE_DESCRIPTION: 'site_description',
    NAV_ITEMS: 'nav_items',
    SHOW_LOGIN: 'show_login',
    
    // Footer配置
    FOOTER_LINKS: 'footer_links',
    FOOTER_CONTACT: 'footer_contact',
    FOOTER_QR_CODE: 'footer_qr_code',
    FOOTER_COPYRIGHT: 'footer_copyright',
    FOOTER_ICP: 'footer_icp',
    
    // 全局样式配置
    PRIMARY_COLOR: 'primary_color',
    SECONDARY_COLOR: 'secondary_color'
};

// 默认配置
const DEFAULT_CONFIG = {
    [CONFIG_KEYS.SITE_NAME]: '天津数据产权登记平台',
    [CONFIG_KEYS.SITE_SLOGAN]: '构建权威、高效、可信的数据产权登记体系',
    [CONFIG_KEYS.SITE_DESCRIPTION]: '构建权威、高效、可信的数据产权登记体系，为数据资产赋予清晰、可追溯的产权标识',
    [CONFIG_KEYS.SHOW_LOGIN]: 'true',
    [CONFIG_KEYS.FOOTER_COPYRIGHT]: '© 2024 天津市数据产权登记中心',
    [CONFIG_KEYS.FOOTER_ICP]: '津ICP备12345678号'
};

/**
 * 获取网站完整配置（公开接口）
 * 用于前端初始化Header和Footer组件
 */
router.get('/', async (req, res) => {
    try {
        const rows = await dbAsync.all(
            'SELECT config_key, config_value FROM system_config WHERE config_key LIKE ? OR config_key LIKE ?',
            ['site_%', 'footer_%']
        );
        
        const config = { ...DEFAULT_CONFIG };
        rows.forEach(row => {
            config[row.config_key] = row.config_value;
        });

        // 解析JSON类型的配置
        const parsedConfig = {
            siteName: config[CONFIG_KEYS.SITE_NAME] || DEFAULT_CONFIG[CONFIG_KEYS.SITE_NAME],
            logo: config[CONFIG_KEYS.SITE_LOGO] || '',
            slogan: config[CONFIG_KEYS.SITE_SLOGAN] || DEFAULT_CONFIG[CONFIG_KEYS.SITE_SLOGAN],
            description: config[CONFIG_KEYS.SITE_DESCRIPTION] || DEFAULT_CONFIG[CONFIG_KEYS.SITE_DESCRIPTION],
            showLogin: config[CONFIG_KEYS.SHOW_LOGIN] === 'true',
            navItems: parseJSON(config[CONFIG_KEYS.NAV_ITEMS], getDefaultNavItems()),
            footer: {
                links: parseJSON(config[CONFIG_KEYS.FOOTER_LINKS], getDefaultFooterLinks()),
                contact: parseJSON(config[CONFIG_KEYS.FOOTER_CONTACT], getDefaultFooterContact()),
                qrCode: config[CONFIG_KEYS.FOOTER_QR_CODE] || '',
                copyright: config[CONFIG_KEYS.FOOTER_COPYRIGHT] || DEFAULT_CONFIG[CONFIG_KEYS.FOOTER_COPYRIGHT],
                icp: config[CONFIG_KEYS.FOOTER_ICP] || DEFAULT_CONFIG[CONFIG_KEYS.FOOTER_ICP]
            }
        };

        res.json(successResponse(parsedConfig));

    } catch (error) {
        console.error('获取网站配置错误:', error);
        // 返回默认配置
        res.json(successResponse({
            siteName: DEFAULT_CONFIG[CONFIG_KEYS.SITE_NAME],
            logo: '',
            slogan: DEFAULT_CONFIG[CONFIG_KEYS.SITE_SLOGAN],
            description: DEFAULT_CONFIG[CONFIG_KEYS.SITE_DESCRIPTION],
            showLogin: true,
            navItems: getDefaultNavItems(),
            footer: {
                links: getDefaultFooterLinks(),
                contact: getDefaultFooterContact(),
                qrCode: '',
                copyright: DEFAULT_CONFIG[CONFIG_KEYS.FOOTER_COPYRIGHT],
                icp: DEFAULT_CONFIG[CONFIG_KEYS.FOOTER_ICP]
            }
        }));
    }
});

/**
 * 获取Header配置（公开接口）
 */
router.get('/header', async (req, res) => {
    try {
        const rows = await dbAsync.all(
            'SELECT config_key, config_value FROM system_config WHERE config_key IN (?, ?, ?, ?, ?, ?)',
            [CONFIG_KEYS.SITE_NAME, CONFIG_KEYS.SITE_LOGO, CONFIG_KEYS.SITE_SLOGAN, 
             CONFIG_KEYS.NAV_ITEMS, CONFIG_KEYS.SHOW_LOGIN, CONFIG_KEYS.SITE_DESCRIPTION]
        );
        
        const config = {};
        rows.forEach(row => {
            config[row.config_key] = row.config_value;
        });

        const headerConfig = {
            siteName: config[CONFIG_KEYS.SITE_NAME] || DEFAULT_CONFIG[CONFIG_KEYS.SITE_NAME],
            logo: config[CONFIG_KEYS.SITE_LOGO] || '',
            slogan: config[CONFIG_KEYS.SITE_SLOGAN] || DEFAULT_CONFIG[CONFIG_KEYS.SITE_SLOGAN],
            description: config[CONFIG_KEYS.SITE_DESCRIPTION] || DEFAULT_CONFIG[CONFIG_KEYS.SITE_DESCRIPTION],
            showLogin: config[CONFIG_KEYS.SHOW_LOGIN] !== 'false',
            navItems: parseJSON(config[CONFIG_KEYS.NAV_ITEMS], getDefaultNavItems())
        };

        res.json(successResponse(headerConfig));

    } catch (error) {
        console.error('获取Header配置错误:', error);
        res.status(500).json(errorResponse('获取配置失败'));
    }
});

/**
 * 获取Footer配置（公开接口）
 */
router.get('/footer', async (req, res) => {
    try {
        const rows = await dbAsync.all(
            'SELECT config_key, config_value FROM system_config WHERE config_key IN (?, ?, ?, ?, ?, ?)',
            [CONFIG_KEYS.SITE_NAME, CONFIG_KEYS.FOOTER_LINKS, CONFIG_KEYS.FOOTER_CONTACT, 
             CONFIG_KEYS.FOOTER_QR_CODE, CONFIG_KEYS.FOOTER_COPYRIGHT, CONFIG_KEYS.FOOTER_ICP]
        );
        
        const config = {};
        rows.forEach(row => {
            config[row.config_key] = row.config_value;
        });

        const footerConfig = {
            siteName: config[CONFIG_KEYS.SITE_NAME] || DEFAULT_CONFIG[CONFIG_KEYS.SITE_NAME],
            links: parseJSON(config[CONFIG_KEYS.FOOTER_LINKS], getDefaultFooterLinks()),
            contact: parseJSON(config[CONFIG_KEYS.FOOTER_CONTACT], getDefaultFooterContact()),
            qrCode: config[CONFIG_KEYS.FOOTER_QR_CODE] || '',
            copyright: config[CONFIG_KEYS.FOOTER_COPYRIGHT] || DEFAULT_CONFIG[CONFIG_KEYS.FOOTER_COPYRIGHT],
            icp: config[CONFIG_KEYS.FOOTER_ICP] || DEFAULT_CONFIG[CONFIG_KEYS.FOOTER_ICP]
        };

        res.json(successResponse(footerConfig));

    } catch (error) {
        console.error('获取Footer配置错误:', error);
        res.status(500).json(errorResponse('获取配置失败'));
    }
});

// ==================== 管理员接口 ====================

/**
 * 更新Header配置（管理员）
 */
router.put('/header', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { siteName, logo, slogan, description, navItems, showLogin } = req.body;

        // 使用事务批量更新
        await dbAsync.run('BEGIN TRANSACTION');

        try {
            if (siteName !== undefined) {
                await saveConfig(CONFIG_KEYS.SITE_NAME, siteName);
            }
            if (logo !== undefined) {
                await saveConfig(CONFIG_KEYS.SITE_LOGO, logo);
            }
            if (slogan !== undefined) {
                await saveConfig(CONFIG_KEYS.SITE_SLOGAN, slogan);
            }
            if (description !== undefined) {
                await saveConfig(CONFIG_KEYS.SITE_DESCRIPTION, description);
            }
            if (navItems !== undefined) {
                await saveConfig(CONFIG_KEYS.NAV_ITEMS, JSON.stringify(navItems));
            }
            if (showLogin !== undefined) {
                await saveConfig(CONFIG_KEYS.SHOW_LOGIN, String(showLogin));
            }

            await dbAsync.run('COMMIT');
            res.json(successResponse(null, 'Header配置更新成功'));

        } catch (err) {
            await dbAsync.run('ROLLBACK');
            throw err;
        }

    } catch (error) {
        console.error('更新Header配置错误:', error);
        res.status(500).json(errorResponse('更新配置失败'));
    }
});

/**
 * 更新Footer配置（管理员）
 */
router.put('/footer', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { links, contact, qrCode, copyright, icp } = req.body;

        await dbAsync.run('BEGIN TRANSACTION');

        try {
            if (links !== undefined) {
                await saveConfig(CONFIG_KEYS.FOOTER_LINKS, JSON.stringify(links));
            }
            if (contact !== undefined) {
                await saveConfig(CONFIG_KEYS.FOOTER_CONTACT, JSON.stringify(contact));
            }
            if (qrCode !== undefined) {
                await saveConfig(CONFIG_KEYS.FOOTER_QR_CODE, qrCode);
            }
            if (copyright !== undefined) {
                await saveConfig(CONFIG_KEYS.FOOTER_COPYRIGHT, copyright);
            }
            if (icp !== undefined) {
                await saveConfig(CONFIG_KEYS.FOOTER_ICP, icp);
            }

            await dbAsync.run('COMMIT');
            res.json(successResponse(null, 'Footer配置更新成功'));

        } catch (err) {
            await dbAsync.run('ROLLBACK');
            throw err;
        }

    } catch (error) {
        console.error('更新Footer配置错误:', error);
        res.status(500).json(errorResponse('更新配置失败'));
    }
});

/**
 * 批量更新网站配置（管理员）
 */
router.put('/', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const config = req.body;

        await dbAsync.run('BEGIN TRANSACTION');

        try {
            for (const [key, value] of Object.entries(config)) {
                const configKey = Object.values(CONFIG_KEYS).find(k => k === key) || key;
                const configValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                await saveConfig(configKey, configValue);
            }

            await dbAsync.run('COMMIT');
            res.json(successResponse(null, '配置更新成功'));

        } catch (err) {
            await dbAsync.run('ROLLBACK');
            throw err;
        }

    } catch (error) {
        console.error('批量更新配置错误:', error);
        res.status(500).json(errorResponse('更新配置失败'));
    }
});

/**
 * 重置配置为默认值（管理员）
 */
router.post('/reset', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { type } = req.body; // 'header', 'footer', 或 'all'

        await dbAsync.run('BEGIN TRANSACTION');

        try {
            if (type === 'header' || type === 'all') {
                await saveConfig(CONFIG_KEYS.SITE_NAME, DEFAULT_CONFIG[CONFIG_KEYS.SITE_NAME]);
                await saveConfig(CONFIG_KEYS.SITE_LOGO, '');
                await saveConfig(CONFIG_KEYS.SITE_SLOGAN, DEFAULT_CONFIG[CONFIG_KEYS.SITE_SLOGAN]);
                await saveConfig(CONFIG_KEYS.SITE_DESCRIPTION, DEFAULT_CONFIG[CONFIG_KEYS.SITE_DESCRIPTION]);
                await saveConfig(CONFIG_KEYS.NAV_ITEMS, JSON.stringify(getDefaultNavItems()));
                await saveConfig(CONFIG_KEYS.SHOW_LOGIN, 'true');
            }

            if (type === 'footer' || type === 'all') {
                await saveConfig(CONFIG_KEYS.FOOTER_LINKS, JSON.stringify(getDefaultFooterLinks()));
                await saveConfig(CONFIG_KEYS.FOOTER_CONTACT, JSON.stringify(getDefaultFooterContact()));
                await saveConfig(CONFIG_KEYS.FOOTER_QR_CODE, '');
                await saveConfig(CONFIG_KEYS.FOOTER_COPYRIGHT, DEFAULT_CONFIG[CONFIG_KEYS.FOOTER_COPYRIGHT]);
                await saveConfig(CONFIG_KEYS.FOOTER_ICP, DEFAULT_CONFIG[CONFIG_KEYS.FOOTER_ICP]);
            }

            await dbAsync.run('COMMIT');
            res.json(successResponse(null, '配置已重置为默认值'));

        } catch (err) {
            await dbAsync.run('ROLLBACK');
            throw err;
        }

    } catch (error) {
        console.error('重置配置错误:', error);
        res.status(500).json(errorResponse('重置配置失败'));
    }
});

// ==================== 辅助函数 ====================

/**
 * 保存单个配置项
 */
async function saveConfig(key, value) {
    const now = getCurrentTimestamp();
    await dbAsync.run(
        `INSERT INTO system_config (config_key, config_value, updated_at) 
         VALUES (?, ?, ?)
         ON CONFLICT(config_key) DO UPDATE SET 
            config_value = excluded.config_value,
            updated_at = ?`,
        [key, value, now, now]
    );
}

/**
 * 解析JSON字符串
 */
function parseJSON(str, defaultValue) {
    if (!str) return defaultValue;
    try {
        return JSON.parse(str);
    } catch (e) {
        return defaultValue;
    }
}

/**
 * 获取默认导航菜单
 */
function getDefaultNavItems() {
    return [
        { id: 'home', name: '首页', href: 'index.html', icon: '' },
        { id: 'user', name: '用户中心', href: 'user.html', icon: '' },
        { id: 'register', name: '产权登记', href: 'register.html', icon: '' },
        { id: 'search', name: '查询公示', href: 'search.html', icon: '' },
        { id: 'protect', name: '维权服务', href: 'protect.html', icon: '' }
    ];
}

/**
 * 获取默认Footer链接
 */
function getDefaultFooterLinks() {
    return {
        about: [
            { name: '关于我们', href: '#about' },
            { name: '平台介绍', href: '#intro' },
            { name: '联系我们', href: '#contact' }
        ],
        service: [
            { name: '产权登记', href: 'register.html' },
            { name: '查询公示', href: 'search.html' },
            { name: '维权服务', href: 'protect.html' }
        ],
        help: [
            { name: '使用指南', href: '#guide' },
            { name: '常见问题', href: '#faq' },
            { name: '隐私政策', href: '#privacy' }
        ]
    };
}

/**
 * 获取默认Footer联系方式
 */
function getDefaultFooterContact() {
    return {
        phone: '400-123-4567',
        email: 'service@tjdata.gov.cn',
        address: '天津市滨海新区'
    };
}

module.exports = router;
