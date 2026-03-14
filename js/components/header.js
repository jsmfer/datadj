/**
 * Header组件 - 统一页面头部导航
 * 支持从后台API获取配置信息
 */

class HeaderComponent {
    constructor(options = {}) {
        this.containerId = options.containerId || 'header-container';
        this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:3002/api/site-config';
        this.currentPage = options.currentPage || '';
        this.config = null;
        this.defaultConfig = {
            siteName: '天津数据产权登记平台',
            logo: '',
            navItems: [
                { id: 'home', name: '首页', href: 'index.html', icon: '' },
                { id: 'user', name: '用户中心', href: 'user.html', icon: '' },
                { id: 'register', name: '产权登记', href: 'register.html', icon: '' },
                { id: 'search', name: '查询公示', href: 'search.html', icon: '' },
                { id: 'protect', name: '维权服务', href: 'protect.html', icon: '' }
            ],
            showLogin: true,
            customButtons: []
        };
    }

    /**
     * 初始化Header组件
     */
    async init() {
        await this.loadConfig();
        this.render();
        this.bindEvents();
        this.initScrollBehavior();
    }

    /**
     * 从后台API加载配置
     */
    async loadConfig() {
        try {
            // 尝试从后台获取配置
            const response = await fetch(`${this.apiBaseUrl}/site-config`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.config = { ...this.defaultConfig, ...result.data };
                    return;
                }
            }
        } catch (error) {
            console.warn('从后台获取Header配置失败，使用默认配置:', error);
        }
        
        // 使用默认配置
        this.config = { ...this.defaultConfig };
        
        // 尝试从localStorage读取缓存的配置
        const cachedConfig = localStorage.getItem('siteConfig');
        if (cachedConfig) {
            try {
                const parsed = JSON.parse(cachedConfig);
                this.config = { ...this.defaultConfig, ...parsed };
            } catch (e) {
                console.warn('解析缓存配置失败');
            }
        }
    }

    /**
     * 渲染Header HTML
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Header容器 #${this.containerId} 未找到`);
            return;
        }

        const { siteName, logo, navItems, showLogin } = this.config;
        const currentPage = this.currentPage;

        // 检查用户登录状态
        const isLoggedIn = this.checkLoginStatus();
        const userInfo = this.getUserInfo();

        container.innerHTML = `
            <nav class="main-header glass-card">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex justify-between items-center h-16">
                        <!-- Logo -->
                        <div class="flex items-center space-x-4">
                            <a href="index.html" class="header-logo">
                                ${logo ? `<img src="${logo}" alt="${siteName}" class="h-8 w-auto">` : ''}
                                <span>${siteName}</span>
                            </a>
                        </div>
                        
                        <!-- 导航菜单 - 桌面端 -->
                        <div class="hidden md:flex items-center space-x-8 header-nav">
                            ${navItems.map(item => {
                                const isActive = currentPage === item.id || 
                                    (currentPage === '' && item.id === 'home') ||
                                    window.location.pathname.includes(item.href);
                                return `
                                    <a href="${item.href}" 
                                       class="nav-link ${isActive ? 'active text-blue-400' : 'text-white hover:text-blue-400'}"
                                       data-page="${item.id}">
                                        ${item.name}
                                    </a>
                                `;
                            }).join('')}
                        </div>
                        
                        <!-- 右侧操作区 -->
                        <div class="flex items-center space-x-4">
                            ${isLoggedIn ? this.renderUserMenu(userInfo) : this.renderLoginButton(showLogin)}
                            
                            <!-- 移动端菜单按钮 -->
                            <button class="md:hidden text-white mobile-menu-btn" id="mobile-menu-btn">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 移动端菜单 -->
                <div class="md:hidden hidden" id="mobile-menu">
                    <div class="glass-card border-t border-gray-700">
                        <div class="px-4 py-3 space-y-2">
                            ${navItems.map(item => {
                                const isActive = currentPage === item.id || 
                                    (currentPage === '' && item.id === 'home');
                                return `
                                    <a href="${item.href}" 
                                       class="block py-2 px-3 rounded-lg ${isActive ? 'bg-blue-600 text-white' : 'text-white hover:bg-white hover:bg-opacity-10'}"
                                       data-page="${item.id}">
                                        ${item.name}
                                    </a>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </nav>
        `;
    }

    /**
     * 渲染用户菜单
     */
    renderUserMenu(userInfo) {
        const userName = userInfo?.username || userInfo?.phone || '用户';
        const roleText = this.getRoleText(userInfo?.role);
        
        return `
            <div class="relative" id="user-menu-container">
                <button class="flex items-center space-x-2 text-white hover:text-blue-400" id="user-menu-btn">
                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span class="text-sm font-medium">${userName.charAt(0)}</span>
                    </div>
                    <span class="hidden sm:block text-sm">${userName}</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                
                <!-- 下拉菜单 -->
                <div class="hidden absolute right-0 mt-2 w-48 glass-card rounded-lg shadow-lg py-2" id="user-dropdown">
                    <div class="px-4 py-2 border-b border-gray-700">
                        <p class="text-sm font-medium">${userName}</p>
                        <p class="text-xs text-gray-400">${roleText}</p>
                    </div>
                    <a href="user.html" class="block px-4 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10">
                        个人中心
                    </a>
                    <a href="user.html#settings" class="block px-4 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10">
                        账户设置
                    </a>
                    ${userInfo?.role === 'admin' ? `
                        <a href="http://localhost:3002/admin/" target="_blank" class="block px-4 py-2 text-sm text-white hover:bg-white hover:bg-opacity-10">
                            管理后台
                        </a>
                    ` : ''}
                    <div class="border-t border-gray-700 mt-2 pt-2">
                        <button onclick="headerComponent.logout()" class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white hover:bg-opacity-10">
                            退出登录
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染登录按钮
     */
    renderLoginButton(show) {
        if (!show) return '';
        return `
            <button onclick="headerComponent.showLoginModal()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors text-sm">
                登录/注册
            </button>
        `;
    }

    /**
     * 获取角色文本
     */
    getRoleText(role) {
        const roleMap = {
            'admin': '管理员',
            'data_holder': '数据持有方',
            'data_user': '数据使用方',
            'regulator': '监管方'
        };
        return roleMap[role] || '普通用户';
    }

    /**
     * 检查登录状态
     */
    checkLoginStatus() {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        return !!token;
    }

    /**
     * 获取用户信息
     */
    getUserInfo() {
        const userInfo = localStorage.getItem('userInfo') || sessionStorage.getItem('userInfo');
        if (userInfo) {
            try {
                return JSON.parse(userInfo);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 移动端菜单切换
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // 用户下拉菜单
        const userMenuBtn = document.getElementById('user-menu-btn');
        const userDropdown = document.getElementById('user-dropdown');
        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('hidden');
            });

            // 点击外部关闭下拉菜单
            document.addEventListener('click', () => {
                userDropdown.classList.add('hidden');
            });
        }
    }

    /**
     * 初始化滚动行为
     */
    initScrollBehavior() {
        let lastScrollTop = 0;
        const header = document.querySelector('.main-header');
        
        if (!header) return;

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                header.classList.add('hidden');
            } else {
                header.classList.remove('hidden');
            }
            lastScrollTop = scrollTop;
        });
    }

    /**
     * 显示登录弹窗
     */
    showLoginModal() {
        // 触发index.html中的登录弹窗，或跳转登录页面
        if (typeof showLoginModal === 'function') {
            showLoginModal();
        } else {
            // 创建登录弹窗
            this.createLoginModal();
        }
    }

    /**
     * 创建登录弹窗
     */
    createLoginModal() {
        // 检查是否已存在
        if (document.getElementById('login-modal')) {
            document.getElementById('login-modal').classList.remove('hidden');
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'login-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black bg-opacity-50" onclick="headerComponent.closeLoginModal()"></div>
            <div class="glass-card p-8 rounded-2xl w-full max-w-md relative animate-fade-in">
                <button onclick="headerComponent.closeLoginModal()" class="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
                <h2 class="text-2xl font-bold mb-6 text-center">用户登录</h2>
                <form id="header-login-form" onsubmit="headerComponent.handleLogin(event)">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-2">手机号/账号</label>
                        <input type="text" id="login-phone" required class="form-input w-full" placeholder="请输入手机号">
                    </div>
                    <div class="mb-6">
                        <label class="block text-sm font-medium mb-2">密码</label>
                        <input type="password" id="login-password" required class="form-input w-full" placeholder="请输入密码">
                    </div>
                    <button type="submit" class="btn-primary w-full py-3 rounded-lg font-medium">
                        登录
                    </button>
                </form>
                <p class="mt-4 text-center text-sm text-gray-400">
                    还没有账号？<a href="user.html?tab=register" class="text-blue-400 hover:text-blue-300">立即注册</a>
                </p>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * 关闭登录弹窗
     */
    closeLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 处理登录
     */
    async handleLogin(event) {
        event.preventDefault();
        const phone = document.getElementById('login-phone').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch(`http://localhost:3002/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });

            const result = await response.json();

            if (result.success) {
                // 保存登录信息
                localStorage.setItem('token', result.data.token);
                localStorage.setItem('userInfo', JSON.stringify(result.data.user));
                
                alert('登录成功！');
                this.closeLoginModal();
                
                // 刷新页面以更新UI
                window.location.reload();
            } else {
                alert(result.message || '登录失败');
            }
        } catch (error) {
            console.error('登录错误:', error);
            alert('登录失败，请稍后重试');
        }
    }

    /**
     * 退出登录
     */
    logout() {
        if (confirm('确定要退出登录吗？')) {
            localStorage.removeItem('token');
            localStorage.removeItem('userInfo');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('userInfo');
            window.location.href = 'index.html';
        }
    }

    /**
     * 更新配置（供后台调用）
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.render();
        this.bindEvents();
    }
}

// 导出组件
window.HeaderComponent = HeaderComponent;
