/**
 * 简化版布局组件 - 从后台API获取配置
 */

// 配置缓存
let cachedConfig = null;
let configCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 从后台API获取配置
async function fetchSiteConfig() {
    try {
        // 检查缓存是否有效
        const now = Date.now();
        if (cachedConfig && (now - configCacheTime) < CACHE_DURATION) {
            console.log('[Layout] 使用缓存的配置');
            return cachedConfig;
        }
        
        console.log('[Layout] 从API获取配置...');
        const response = await fetch('http://localhost:3002/api/site-config');
        const result = await response.json();
        
        if (result.success) {
            cachedConfig = result.data;
            configCacheTime = now;
            
            // 同时保存到localStorage作为备份
            localStorage.setItem('siteConfig', JSON.stringify(result.data));
            localStorage.setItem('siteConfigTime', String(now));
            
            return result.data;
        }
    } catch (error) {
        console.error('[Layout] 获取配置失败:', error);
        
        // 尝试从localStorage读取缓存
        const cached = localStorage.getItem('siteConfig');
        if (cached) {
            console.log('[Layout] 使用localStorage缓存');
            return JSON.parse(cached);
        }
    }
    
    // 返回默认配置
    return getDefaultConfig();
}

// 获取默认配置
function getDefaultConfig() {
    return {
        siteName: '天津数据产权登记平台',
        logo: '',
        slogan: '构建权威、高效、可信的数据产权登记体系',
        description: '构建权威、高效、可信的数据产权登记体系，为数据资产赋予清晰、可追溯的产权标识',
        showLogin: true,
        navItems: [
            { id: 'home', name: '首页', href: 'index.html' },
            { id: 'user', name: '用户中心', href: 'user.html' },
            { id: 'register', name: '产权登记', href: 'register.html' },
            { id: 'search', name: '查询公示', href: 'search.html' },
            { id: 'protect', name: '维权服务', href: 'protect.html' }
        ],
        footer: {
            links: {
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
            },
            contact: {
                phone: '400-123-4567',
                email: 'service@tjdata.gov.cn',
                address: '天津市滨海新区'
            },
            copyright: '© 2024 天津市数据产权登记中心',
            icp: '津ICP备12345678号'
        }
    };
}

// 清除配置缓存
function clearConfigCache() {
    cachedConfig = null;
    configCacheTime = 0;
    localStorage.removeItem('siteConfig');
    localStorage.removeItem('siteConfigTime');
    console.log('[Layout] 配置缓存已清除');
}

// Header组件
async function renderHeader(containerId, currentPage) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Header容器不存在:', containerId);
        return;
    }
    
    // 获取配置
    const config = await fetchSiteConfig();
    const navItems = config.navItems || getDefaultConfig().navItems;
    const siteName = config.siteName || '天津数据产权登记平台';
    const logo = config.logo || '';
    
    const currentPath = window.location.pathname;
    const currentPageId = currentPage || (currentPath.includes('index') || currentPath === '/' ? 'home' : 
                                          currentPath.includes('user') ? 'user' :
                                          currentPath.includes('register') ? 'register' :
                                          currentPath.includes('search') ? 'search' :
                                          currentPath.includes('protect') ? 'protect' : 'home');
    
    // 检查登录状态
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const isLoggedIn = !!token;
    let userInfo = null;
    try {
        const userStr = localStorage.getItem('userInfo') || sessionStorage.getItem('userInfo');
        if (userStr) userInfo = JSON.parse(userStr);
    } catch(e) {}
    
    // 构建Logo HTML
    const logoHtml = logo 
        ? `<img src="${logo}" alt="${siteName}" style="height:32px;width:auto;margin-right:8px;">` 
        : '';
    
    container.innerHTML = `
        <nav class="main-header glass-card" style="position:fixed;top:0;width:100%;z-index:50;">
            <div style="max-width:1280px;margin:0 auto;padding:0 1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;height:64px;">
                    <a href="index.html" style="font-size:1.25rem;font-weight:bold;color:white;text-decoration:none;display:flex;align-items:center;">
                        ${logoHtml}
                        <span>${siteName}</span>
                    </a>
                    <div class="header-nav" style="display:flex;align-items:center;gap:2rem;">
                        ${navItems.map(item => {
                            const isActive = currentPageId === item.id;
                            return `<a href="${item.href}" style="color:${isActive ? '#60a5fa' : 'white'};text-decoration:none;transition:all 0.3s;${isActive ? 'font-weight:500;' : ''}">${item.name}</a>`;
                        }).join('')}
                    </div>
                    <div style="display:flex;align-items:center;gap:1rem;">
                        ${isLoggedIn ? `
                            <div style="color:white;">${userInfo?.username || '用户'}</div>
                            <button onclick="logout()" style="background:#dc2626;color:white;padding:0.5rem 1rem;border-radius:0.5rem;border:none;cursor:pointer;">退出</button>
                        ` : config.showLogin !== false ? `
                            <button onclick="window.location.href='login.html'" style="background:transparent;border:1px solid #3b82f6;color:#3b82f6;padding:0.5rem 1rem;border-radius:0.5rem;cursor:pointer;margin-right:0.5rem;">登录</button>
                            <button onclick="window.location.href='register-user.html'" style="background:#2563eb;color:white;padding:0.5rem 1rem;border-radius:0.5rem;border:none;cursor:pointer;">注册</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </nav>
    `;
    
    console.log('[Layout] Header渲染完成，网站名称:', siteName);
}

// Footer组件
async function renderFooter(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Footer容器不存在:', containerId);
        return;
    }
    
    // 获取配置
    const config = await fetchSiteConfig();
    const footer = config.footer || getDefaultConfig().footer;
    const siteName = config.siteName || '天津数据产权登记平台';
    
    // 构建链接HTML
    const aboutLinks = footer.links?.about || [];
    const serviceLinks = footer.links?.service || [];
    const helpLinks = footer.links?.help || [];
    
    const aboutHtml = aboutLinks.map(link => 
        `<li style="margin-bottom:0.5rem;"><a href="${link.href}" style="color:rgba(255,255,255,0.7);text-decoration:none;">${link.name}</a></li>`
    ).join('');
    
    const serviceHtml = serviceLinks.map(link => 
        `<li style="margin-bottom:0.5rem;"><a href="${link.href}" style="color:rgba(255,255,255,0.7);text-decoration:none;">${link.name}</a></li>`
    ).join('');
    
    const helpHtml = helpLinks.map(link => 
        `<li style="margin-bottom:0.5rem;"><a href="${link.href}" style="color:rgba(255,255,255,0.7);text-decoration:none;">${link.name}</a></li>`
    ).join('');
    
    container.innerHTML = `
        <footer class="main-footer" style="background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.1);padding:3rem 0;margin-top:auto;">
            <div style="max-width:1280px;margin:0 auto;padding:0 1rem;">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2rem;margin-bottom:2rem;">
                    <div>
                        <h3 style="font-size:1.125rem;font-weight:bold;margin-bottom:1rem;">${siteName}</h3>
                        <p style="color:rgba(255,255,255,0.7);font-size:0.875rem;">${config.slogan || '构建权威、高效、可信的数据产权登记体系'}</p>
                    </div>
                    <div>
                        <h4 style="font-weight:500;margin-bottom:0.75rem;">关于我们</h4>
                        <ul style="list-style:none;padding:0;font-size:0.875rem;color:rgba(255,255,255,0.7);">
                            ${aboutHtml || '<li style="margin-bottom:0.5rem;">平台介绍</li>'}
                        </ul>
                    </div>
                    <div>
                        <h4 style="font-weight:500;margin-bottom:0.75rem;">服务支持</h4>
                        <ul style="list-style:none;padding:0;font-size:0.875rem;color:rgba(255,255,255,0.7);">
                            ${serviceHtml || '<li style="margin-bottom:0.5rem;">产权登记</li><li style="margin-bottom:0.5rem;">查询公示</li>'}
                        </ul>
                    </div>
                    <div>
                        <h4 style="font-weight:500;margin-bottom:0.75rem;">联系我们</h4>
                        <ul style="list-style:none;padding:0;font-size:0.875rem;color:rgba(255,255,255,0.7);">
                            ${footer.contact?.phone ? `<li style="margin-bottom:0.5rem;">电话：${footer.contact.phone}</li>` : ''}
                            ${footer.contact?.email ? `<li style="margin-bottom:0.5rem;">邮箱：${footer.contact.email}</li>` : ''}
                            ${footer.contact?.address ? `<li style="margin-bottom:0.5rem;">地址：${footer.contact.address}</li>` : ''}
                        </ul>
                    </div>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:2rem;text-align:center;font-size:0.875rem;color:rgba(255,255,255,0.5);">
                    <p>${footer.copyright || '© 2024 天津市数据产权登记中心'} ${footer.icp ? '| ' + footer.icp : ''}</p>
                </div>
            </div>
        </footer>
    `;
    
    console.log('[Layout] Footer渲染完成');
}

// 统一初始化函数
async function initLayoutSimple(options) {
    console.log('[Layout] 开始初始化布局...');
    const { currentPage = 'home', headerId = 'header-container', footerId = 'footer-container' } = options || {};
    
    // 检查是否需要强制刷新配置（URL参数）
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('refresh')) {
        console.log('[Layout] 检测到刷新参数，清除缓存');
        clearConfigCache();
    }
    
    // 渲染Header和Footer
    await Promise.all([
        renderHeader(headerId, currentPage),
        renderFooter(footerId)
    ]);
    
    console.log('[Layout] 初始化完成');
    
    // 触发布局组件加载完成事件
    window.layoutComponentsLoaded = true;
    window.dispatchEvent(new CustomEvent('layoutComponentsLoaded'));
}

// 退出登录函数
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userInfo');
    window.location.href = 'index.html';
}

// 自动初始化（如果页面有data-layout-init属性）
document.addEventListener('DOMContentLoaded', async function() {
    const autoInit = document.querySelector('[data-layout-init]');
    if (autoInit) {
        const currentPage = autoInit.dataset.currentPage || 'home';
        await initLayoutSimple({ currentPage });
    }
});

// 导出函数供外部使用
window.initLayoutSimple = initLayoutSimple;
window.clearConfigCache = clearConfigCache;
window.fetchSiteConfig = fetchSiteConfig;

console.log('[Layout] 布局组件已加载，支持从API获取配置');
