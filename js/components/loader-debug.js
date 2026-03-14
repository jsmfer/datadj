/**
 * 调试版组件加载器
 */
(function() {
    'use strict';
    
    console.log('[LOADER] 开始加载组件...');
    
    const basePath = 'js/components/';
    const cacheBuster = '?_t=' + new Date().getTime();
    
    // 加载CSS
    function loadCSS() {
        console.log('[LOADER] 加载CSS...');
        if (document.getElementById('common-styles')) {
            console.log('[LOADER] CSS已加载，跳过');
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.id = 'common-styles';
            link.rel = 'stylesheet';
            link.href = basePath + 'common.css' + cacheBuster;
            link.onload = function() {
                console.log('[LOADER] CSS加载成功');
                resolve();
            };
            link.onerror = function(err) {
                console.error('[LOADER] CSS加载失败:', err);
                reject(err);
            };
            document.head.appendChild(link);
        });
    }
    
    // 加载JS脚本
    function loadScript(src, name) {
        console.log('[LOADER] 开始加载 ' + name + '...');
        
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src*="${name}"]`)) {
                console.log('[LOADER] ' + name + ' 已加载，跳过');
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = function() {
                console.log('[LOADER] ' + name + ' 加载成功');
                resolve();
            };
            script.onerror = function(err) {
                console.error('[LOADER] ' + name + ' 加载失败:', err);
                reject(new Error('加载失败: ' + name));
            };
            document.head.appendChild(script);
        });
    }
    
    // 按顺序加载所有组件
    async function loadComponents() {
        try {
            await loadCSS();
            
            await loadScript(basePath + 'header.js' + cacheBuster, 'header.js');
            console.log('[LOADER] HeaderComponent 状态:', typeof HeaderComponent);
            
            await loadScript(basePath + 'footer.js' + cacheBuster, 'footer.js');
            console.log('[LOADER] FooterComponent 状态:', typeof FooterComponent);
            
            await loadScript(basePath + 'layout.js' + cacheBuster, 'layout.js');
            console.log('[LOADER] initLayout 状态:', typeof initLayout);
            
            window.layoutComponentsLoaded = true;
            console.log('[LOADER] 所有组件加载完成，触发事件');
            window.dispatchEvent(new CustomEvent('layoutComponentsLoaded'));
            
        } catch (error) {
            console.error('[LOADER] 加载布局组件失败:', error);
        }
    }
    
    loadComponents();
})();
