/**
 * 组件加载器 - 按顺序加载布局组件
 * 确保依赖正确加载
 */

(function() {
    'use strict';
    
    const basePath = 'js/components/';
    
    const components = [
        'header.js',
        'footer.js',
        'layout.js'
    ];
    
    // 添加时间戳防止缓存
    const cacheBuster = '?_t=' + new Date().getTime();
    
    // 加载CSS
    function loadCSS() {
        if (document.getElementById('common-styles')) return Promise.resolve();
        
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.id = 'common-styles';
            link.rel = 'stylesheet';
            link.href = basePath + 'common.css' + cacheBuster;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }
    
    // 加载JS脚本
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查是否已加载
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // 保持顺序
            script.onload = resolve;
            script.onerror = () => reject(new Error(`加载失败: ${src}`));
            document.head.appendChild(script);
        });
    }
    
    // 按顺序加载所有组件
    async function loadComponents() {
        try {
            // 先加载CSS
            await loadCSS();
            
            // 按顺序加载JS组件
            for (const component of components) {
                await loadScript(basePath + component + cacheBuster);
            }
            
            // 设置加载完成标志
            window.layoutComponentsLoaded = true;
            
            // 触发组件加载完成事件
            window.dispatchEvent(new CustomEvent('layoutComponentsLoaded'));
            
        } catch (error) {
            console.error('加载布局组件失败:', error);
        }
    }
    
    // 立即加载
    loadComponents();
})();
