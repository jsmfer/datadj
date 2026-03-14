/**
 * 统一的登录状态检查和页面初始化
 * 所有页面引入此脚本，确保登录状态一致
 */

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    updateNavigation();
});

// 检查登录状态
function checkLoginStatus() {
    const token = ApiService.getToken();
    const currentUser = ApiService.getCurrentUser();
    
    // 获取当前页面文件名
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // 需要登录才能访问的页面
    const protectedPages = ['user.html', 'register.html', 'protect.html'];
    
    // 检查是否在受保护页面
    if (protectedPages.includes(currentPage)) {
        if (!token) {
            // 未登录，重定向到首页
            alert('请先登录');
            window.location.href = 'index.html';
            return false;
        }
    }
    
    return { token, user: currentUser };
}

// 更新导航栏显示
function updateNavigation() {
    const currentUser = ApiService.getCurrentUser();
    const navContainer = document.querySelector('nav .flex.items-center.space-x-4:last-child');
    
    if (!navContainer) return;
    
    if (currentUser) {
        // 已登录状态
        const roleMap = {
            'admin': '管理员',
            'regulator': '监管方',
            'data_holder': '数据持有方',
            'data_user': '数据使用方'
        };
        
        navContainer.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-white text-sm">${currentUser.username}</span>
                <span class="text-xs text-gray-300">(${roleMap[currentUser.role] || currentUser.role})</span>
                <button onclick="logout()" class="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm transition-colors">
                    退出
                </button>
            </div>
        `;
    } else {
        // 未登录状态
        navContainer.innerHTML = `
            <button onclick="showLoginModal()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
                登录/注册
            </button>
        `;
    }
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        AuthAPI.logout();
        window.location.href = 'index.html';
    }
}

// 获取当前用户信息
async function refreshUserInfo() {
    try {
        const result = await AuthAPI.getCurrentUser();
        if (result.success) {
            // 更新存储的用户信息
            const storage = localStorage.getItem('user') ? localStorage : sessionStorage;
            storage.setItem('user', JSON.stringify(result.data));
            return result.data;
        }
    } catch (error) {
        console.error('刷新用户信息失败:', error);
    }
    return null;
}
