/**
 * Layout管理器 - 统一页面布局管理
 * 负责初始化和协调Header、Footer组件
 */

class LayoutManager {
    constructor(options = {}) {
        this.options = {
            apiBaseUrl: 'http://localhost:3002/api/site-config',
            headerContainerId: 'header-container',
            footerContainerId: 'footer-container',
            currentPage: '',
            loadHeader: true,
            loadFooter: true,
            ...options
        };
        
        this.header = null;
        this.footer = null;
        this.initialized = false;
    }

    /**
     * 初始化布局
     */
    async init() {
        if (this.initialized) return;

        // 创建容器元素（如果不存在）
        this.ensureContainers();
        
        // 加载公共CSS
        this.loadCommonStyles();
        
        // 初始化Header
        if (this.options.loadHeader) {
            await this.initHeader();
        }
        
        // 初始化Footer
        if (this.options.loadFooter) {
            await this.initFooter();
        }
        
        // 添加页面内容包装器
        this.wrapPageContent();
        
        this.initialized = true;
        
        // 触发布局初始化完成事件
        window.dispatchEvent(new CustomEvent('layoutInitialized', {
            detail: { layout: this }
        }));
    }

    /**
     * 确保容器元素存在
     */
    ensureContainers() {
        // Header容器
        if (this.options.loadHeader && !document.getElementById(this.options.headerContainerId)) {
            const headerContainer = document.createElement('div');
            headerContainer.id = this.options.headerContainerId;
            document.body.insertBefore(headerContainer, document.body.firstChild);
        }
        
        // Footer容器
        if (this.options.loadFooter && !document.getElementById(this.options.footerContainerId)) {
            const footerContainer = document.createElement('div');
            footerContainer.id = this.options.footerContainerId;
            document.body.appendChild(footerContainer);
        }
    }

    /**
     * 加载公共CSS样式
     */
    loadCommonStyles() {
        // 检查是否已加载
        if (document.getElementById('common-styles')) return;
        
        const link = document.createElement('link');
        link.id = 'common-styles';
        link.rel = 'stylesheet';
        link.href = 'js/components/common.css';
        document.head.appendChild(link);
    }

    /**
     * 初始化Header组件
     */
    async initHeader() {
        this.header = new HeaderComponent({
            containerId: this.options.headerContainerId,
            apiBaseUrl: this.options.apiBaseUrl,
            currentPage: this.options.currentPage
        });
        
        await this.header.init();
        
        // 将header组件暴露到全局，供页面使用
        window.headerComponent = this.header;
    }

    /**
     * 初始化Footer组件
     */
    async initFooter() {
        this.footer = new FooterComponent({
            containerId: this.options.footerContainerId,
            apiBaseUrl: this.options.apiBaseUrl
        });
        
        await this.footer.init();
        
        // 将footer组件暴露到全局
        window.footerComponent = this.footer;
    }

    /**
     * 包装页面内容
     * 为页面主要内容添加统一的样式容器
     */
    wrapPageContent() {
        // 查找页面主要内容区域
        const mainContent = document.querySelector('main') || 
                           document.querySelector('.page-content') ||
                           document.querySelector('.main-content');
        
        if (mainContent && !mainContent.classList.contains('page-content')) {
            mainContent.classList.add('page-content');
        }
    }

    /**
     * 更新Header配置
     */
    updateHeaderConfig(config) {
        if (this.header) {
            this.header.updateConfig(config);
        }
    }

    /**
     * 更新Footer配置
     */
    updateFooterConfig(config) {
        if (this.footer) {
            this.footer.updateConfig(config);
        }
    }

    /**
     * 刷新布局（从后台重新获取配置）
     */
    async refresh() {
        if (this.header) {
            await this.header.loadConfig();
            this.header.render();
            this.header.bindEvents();
        }
        
        if (this.footer) {
            await this.footer.loadConfig();
            this.footer.render();
        }
    }

    /**
     * 获取当前页面标识
     */
    static getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '');
        
        const pageMap = {
            '': 'home',
            'index': 'home',
            'user': 'user',
            'register': 'register',
            'search': 'search',
            'protect': 'protect'
        };
        
        return pageMap[page] || page;
    }
}

/**
 * 快速初始化函数
 * 在每个页面中调用此函数即可初始化统一布局
 * 
 * 用法:
 * <script>
 *   document.addEventListener('DOMContentLoaded', () => {
 *     initLayout({ currentPage: 'home' });
 *   });
 * </script>
 */
function initLayout(options = {}) {
    // 自动检测当前页面
    if (!options.currentPage) {
        options.currentPage = LayoutManager.getCurrentPage();
    }
    
    // 确保组件已加载
    const ensureComponents = async () => {
        // 等待HeaderComponent和FooterComponent可用
        let attempts = 0;
        const maxAttempts = 50; // 5秒超时
        
        while (attempts < maxAttempts) {
            if (typeof HeaderComponent !== 'undefined' && typeof FooterComponent !== 'undefined') {
                const layout = new LayoutManager(options);
                await layout.init();
                window.layoutManager = layout;
                return layout;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.error('Layout组件加载超时');
        return null;
    };
    
    return ensureComponents();
}

// 导出
window.LayoutManager = LayoutManager;
window.initLayout = initLayout;

// 自动初始化（如果设置了data-auto-init属性）
document.addEventListener('DOMContentLoaded', () => {
    const autoInitElements = document.querySelectorAll('[data-layout-auto-init]');
    autoInitElements.forEach(el => {
        const options = {
            currentPage: el.dataset.currentPage || LayoutManager.getCurrentPage(),
            loadHeader: el.dataset.loadHeader !== 'false',
            loadFooter: el.dataset.loadFooter !== 'false'
        };
        initLayout(options);
    });
});
