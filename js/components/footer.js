/**
 * Footer组件 - 统一页面底部
 * 支持从后台API获取配置信息
 */

class FooterComponent {
    constructor(options = {}) {
        this.containerId = options.containerId || 'footer-container';
        this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:3002/api/site-config';
        this.config = null;
        this.defaultConfig = {
            siteName: '天津数据产权登记平台',
            slogan: '构建权威、高效、可信的数据产权登记体系',
            copyright: '© 2024 天津数据产权登记服务平台 版权所有',
            icp: '津ICP备XXXXXXXX号',
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
            qrCode: '', // 微信公众号二维码
            socialLinks: []
        };
    }

    /**
     * 初始化Footer组件
     */
    async init() {
        await this.loadConfig();
        this.render();
    }

    /**
     * 从后台API加载配置
     */
    async loadConfig() {
        try {
            // 尝试从后台获取配置
            const response = await fetch(`${this.apiBaseUrl}/site-config/footer`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.config = this.mergeConfig(this.defaultConfig, result.data);
                    return;
                }
            }
        } catch (error) {
            console.warn('从后台获取Footer配置失败，使用默认配置:', error);
        }
        
        // 使用默认配置
        this.config = { ...this.defaultConfig };
        
        // 尝试从localStorage读取缓存的配置
        const cachedConfig = localStorage.getItem('footerConfig');
        if (cachedConfig) {
            try {
                const parsed = JSON.parse(cachedConfig);
                this.config = this.mergeConfig(this.defaultConfig, parsed);
            } catch (e) {
                console.warn('解析缓存配置失败');
            }
        }
    }

    /**
     * 合并配置（深度合并）
     */
    mergeConfig(defaults, custom) {
        const merged = { ...defaults };
        for (const key in custom) {
            if (custom.hasOwnProperty(key)) {
                if (typeof custom[key] === 'object' && custom[key] !== null && !Array.isArray(custom[key])) {
                    merged[key] = this.mergeConfig(defaults[key] || {}, custom[key]);
                } else {
                    merged[key] = custom[key];
                }
            }
        }
        return merged;
    }

    /**
     * 渲染Footer HTML
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Footer容器 #${this.containerId} 未找到`);
            return;
        }

        const { siteName, slogan, copyright, icp, links, contact, qrCode } = this.config;

        container.innerHTML = `
            <footer class="main-footer">
                <!-- 主要内容区 -->
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                        
                        <!-- 品牌介绍 -->
                        <div class="lg:col-span-2">
                            <h3 class="text-xl font-bold mb-4">${siteName}</h3>
                            <p class="text-gray-400 mb-6 text-sm leading-relaxed">${slogan}</p>
                            
                            <!-- 联系方式 -->
                            <div class="space-y-2 text-sm text-gray-400">
                                ${contact.phone ? `
                                    <div class="flex items-center space-x-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                        </svg>
                                        <span>${contact.phone}</span>
                                    </div>
                                ` : ''}
                                ${contact.email ? `
                                    <div class="flex items-center space-x-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                        </svg>
                                        <span>${contact.email}</span>
                                    </div>
                                ` : ''}
                                ${contact.address ? `
                                    <div class="flex items-center space-x-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        </svg>
                                        <span>${contact.address}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- 关于我们 -->
                        <div>
                            <h4 class="text-lg font-semibold mb-4">关于我们</h4>
                            <ul class="space-y-2">
                                ${links.about.map(link => `
                                    <li>
                                        <a href="${link.href}" class="footer-link text-sm">${link.name}</a>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        
                        <!-- 服务支持 -->
                        <div>
                            <h4 class="text-lg font-semibold mb-4">服务支持</h4>
                            <ul class="space-y-2">
                                ${links.service.map(link => `
                                    <li>
                                        <a href="${link.href}" class="footer-link text-sm">${link.name}</a>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        
                        <!-- 帮助中心 -->
                        <div>
                            <h4 class="text-lg font-semibold mb-4">帮助中心</h4>
                            <ul class="space-y-2">
                                ${links.help.map(link => `
                                    <li>
                                        <a href="${link.href}" class="footer-link text-sm">${link.name}</a>
                                    </li>
                                `).join('')}
                            </ul>
                            
                            <!-- 二维码 -->
                            ${qrCode ? `
                                <div class="mt-4">
                                    <p class="text-xs text-gray-500 mb-2">关注微信公众号</p>
                                    <img src="${qrCode}" alt="微信公众号" class="w-20 h-20 rounded">
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- 底部版权区 -->
                <div class="border-t border-gray-800">
                    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                            <div class="text-sm text-gray-500 text-center md:text-left">
                                <p>${copyright}</p>
                                <p class="mt-1">${icp}</p>
                            </div>
                            
                            <!-- 社交媒体链接 -->
                            <div class="flex items-center space-x-4">
                                <a href="#" class="text-gray-400 hover:text-white transition-colors">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                    </svg>
                                </a>
                                <a href="#" class="text-gray-400 hover:text-white transition-colors">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 回到顶部按钮 -->
                <button id="back-to-top" onclick="footerComponent.scrollToTop()" 
                        class="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all opacity-0 invisible">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                    </svg>
                </button>
            </footer>
        `;

        this.initBackToTop();
    }

    /**
     * 初始化回到顶部按钮
     */
    initBackToTop() {
        const backToTopBtn = document.getElementById('back-to-top');
        if (!backToTopBtn) return;

        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.remove('opacity-0', 'invisible');
                backToTopBtn.classList.add('opacity-100', 'visible');
            } else {
                backToTopBtn.classList.add('opacity-0', 'invisible');
                backToTopBtn.classList.remove('opacity-100', 'visible');
            }
        });
    }

    /**
     * 回到顶部
     */
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    /**
     * 更新配置（供后台调用）
     */
    updateConfig(newConfig) {
        this.config = this.mergeConfig(this.config, newConfig);
        this.render();
    }

    /**
     * 获取统计信息（可选）
     */
    async getStats() {
        try {
            const response = await fetch(`http://localhost:3002/api/registrations/stats/overview`);
            if (response.ok) {
                const result = await response.json();
                return result.data;
            }
        } catch (error) {
            console.warn('获取统计信息失败:', error);
        }
        return null;
    }
}

// 导出组件
window.FooterComponent = FooterComponent;
