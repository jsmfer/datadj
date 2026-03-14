/**
 * 前端API服务层
 * 封装所有与后端API的通信
 */

const API_BASE_URL = 'http://localhost:3002/api';

// API服务对象
const ApiService = {
    // 获取token
    getToken() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    },

    // 设置token
    setToken(token, remember = false) {
        if (remember) {
            localStorage.setItem('token', token);
        } else {
            sessionStorage.setItem('token', token);
        }
    },

    // 清除token
    clearToken() {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    // 获取请求头
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    // GET请求
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${API_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    },

    // POST请求
    async post(endpoint, data = {}) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        
        return this.handleResponse(response);
    },

    // PUT请求
    async put(endpoint, data = {}) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        
        return this.handleResponse(response);
    },

    // DELETE请求
    async delete(endpoint) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        
        return this.handleResponse(response);
    },

    // 处理响应
    async handleResponse(response) {
        let data;
        const contentType = response.headers.get('content-type');
        
        console.log('[ApiService] 响应状态:', response.status, 'Content-Type:', contentType);
        
        try {
            // 首先尝试解析JSON（大多数API返回JSON）
            const text = await response.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                // 不是JSON，使用文本
                data = { message: text || '请求失败', raw: text };
            }
        } catch (e) {
            console.error('[ApiService] 响应解析失败:', e);
            data = { message: '响应解析失败: ' + e.message };
        }
        
        if (!response.ok) {
            console.error('[ApiService] API请求失败:', response.status, data);
            
            if (response.status === 401) {
                // token过期，清除登录状态
                this.clearToken();
                if (!window.location.href.includes('index.html') && window.location.pathname !== '/') {
                    alert('登录已过期，请重新登录');
                    window.location.href = 'index.html';
                }
            }
            throw new Error(data.message || data.error || `请求失败 (${response.status})`);
        }
        
        return data;
    },

    // 检查是否已登录
    isLoggedIn() {
        return !!this.getToken();
    },

    // 获取当前用户
    getCurrentUser() {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    // 设置当前用户
    setCurrentUser(user, remember = false) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(user));
    }
};

// ==================== 认证API ====================
const AuthAPI = {
    // 登录
    async login(phone, password, remember = false) {
        const result = await ApiService.post('/auth/login', { phone, password });
        if (result.success) {
            ApiService.setToken(result.data.token, remember);
            ApiService.setCurrentUser(result.data.user, remember);
        }
        return result;
    },

    // 注册
    async register(userData) {
        return await ApiService.post('/auth/register', userData);
    },

    // 获取当前用户信息
    async getCurrentUser() {
        return await ApiService.get('/auth/me');
    },

    // 修改密码
    async changePassword(oldPassword, newPassword) {
        return await ApiService.put('/auth/password', { oldPassword, newPassword });
    },

    // 更新个人信息
    async updateProfile(profile) {
        return await ApiService.put('/auth/profile', profile);
    },

    // 获取用户最近活动
    async getActivities() {
        return await ApiService.get('/auth/activities');
    },

    // 获取用户通知
    async getNotifications() {
        return await ApiService.get('/auth/notifications');
    },

    // 退出登录
    logout() {
        ApiService.clearToken();
    }
};

// ==================== 法律咨询API ====================
const ConsultationAPI = {
    // 提交法律咨询
    async submit(data) {
        return await ApiService.post('/consultation', data);
    },

    // 获取我的咨询列表
    async getMyList() {
        return await ApiService.get('/consultation/my');
    },

    // 获取咨询统计数据（公开）
    async getStats() {
        return await ApiService.get('/consultation/stats');
    },

    // 获取成功案例（公开）
    async getCases(limit = 5) {
        return await ApiService.get('/consultation/cases', { limit });
    },

    // 获取案件统计数据（公开）
    async getCaseStats() {
        return await ApiService.get('/consultation/case-stats');
    }
};

// ==================== 认证API ====================
const VerificationAPI = {
    // 获取用户认证状态
    async getStatus() {
        return await ApiService.get('/verification/status');
    },

    // 提交个人身份认证申请
    async submitPersonal(data) {
        return await ApiService.post('/verification/personal', data);
    },

    // 提交企业认证申请
    async submitEnterprise(data) {
        return await ApiService.post('/verification/enterprise', data);
    },

    // 获取认证申请详情
    async getApplicationDetail(id) {
        return await ApiService.get(`/verification/application/${id}`);
    }
};

// ==================== 登记API ====================
const RegistrationAPI = {
    // 获取登记列表
    async getList(params = {}) {
        return await ApiService.get('/registrations', params);
    },

    // 获取登记详情
    async getDetail(id) {
        return await ApiService.get(`/registrations/${id}`);
    },

    // 提交登记申请
    async create(data) {
        return await ApiService.post('/registrations', data);
    },

    // 获取我的登记
    async getMyList(params = {}) {
        return await ApiService.get('/registrations/user/my', params);
    },

    // 获取统计数据
    async getStats() {
        return await ApiService.get('/registrations/stats/overview');
    }
};

// ==================== 维权API ====================
const ProtectionAPI = {
    // 获取案件列表
    async getList(params = {}) {
        return await ApiService.get('/protection', params);
    },

    // 获取案件详情
    async getDetail(id) {
        return await ApiService.get(`/protection/${id}`);
    },

    // 提交维权申请
    async create(data) {
        return await ApiService.post('/protection', data);
    },

    // 获取统计数据
    async getStats() {
        return await ApiService.get('/protection/stats/overview');
    }
};

// ==================== 新闻API ====================
const NewsAPI = {
    // 获取新闻列表
    async getList(params = {}) {
        return await ApiService.get('/news', params);
    },

    // 获取新闻详情
    async getDetail(id) {
        return await ApiService.get(`/news/${id}`);
    }
};

// ==================== 管理API ====================
const AdminAPI = {
    // 获取仪表盘数据
    async getDashboard() {
        return await ApiService.get('/admin/dashboard');
    },

    // 获取用户列表
    async getUsers(params = {}) {
        return await ApiService.get('/admin/users', params);
    },

    // 更新用户状态
    async updateUserStatus(id, status) {
        return await ApiService.put(`/admin/users/${id}/status`, { status });
    },

    // 获取所有登记
    async getAllRegistrations(params = {}) {
        return await ApiService.get('/admin/registrations', params);
    },

    // 审核登记
    async reviewRegistration(id, data) {
        return await ApiService.put(`/admin/registrations/${id}/review`, data);
    },

    // 获取系统配置（需要管理员权限）
    async getConfig() {
        return await ApiService.get('/admin/config');
    },

    // 更新系统配置
    async updateConfig(key, value) {
        return await ApiService.put(`/admin/config/${key}`, { value });
    }
};

// ==================== 公共配置API ====================
const ConfigAPI = {
    // 获取系统配置（公开接口，无需登录）
    async getConfig() {
        try {
            const response = await fetch(`${API_BASE_URL}/news/config`);
            return await response.json();
        } catch (error) {
            console.error('获取配置失败:', error);
            return { success: false, data: {} };
        }
    },
    
    // 加载配置到页面
    async loadConfigToPage() {
        const result = await this.getConfig();
        if (result.success && result.data) {
            const config = result.data;
            
            // 更新网站标题
            if (config.site_name) {
                document.title = config.site_name;
                // 更新所有显示网站名称的元素
                document.querySelectorAll('.site-name').forEach(el => {
                    el.textContent = config.site_name;
                });
            }
            
            // 更新网站描述
            if (config.site_description) {
                document.querySelectorAll('.site-description').forEach(el => {
                    el.textContent = config.site_description;
                });
            }
            
            return config;
        }
        return null;
    }
};

// 导出API
window.ApiService = ApiService;
window.AuthAPI = AuthAPI;
window.ConsultationAPI = ConsultationAPI;
window.VerificationAPI = VerificationAPI;
window.RegistrationAPI = RegistrationAPI;
window.ProtectionAPI = ProtectionAPI;
window.NewsAPI = NewsAPI;
window.AdminAPI = AdminAPI;
window.ConfigAPI = ConfigAPI;
