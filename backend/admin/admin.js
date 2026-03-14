/**
 * 管理后台 JavaScript
 */

// 函数已挂载到window对象
'use strict';

const API_BASE = 'http://localhost:3002/api';

// 全局状态
let currentPage = 'dashboard';
let currentUser = null;
let authToken = localStorage.getItem('adminToken');

console.log('[Admin] 脚本加载完成，Token:', authToken ? '存在' : '不存在');

// 初始化
window.init = async function() {
    console.log('[Admin] === 开始初始化 ===');
    
    // 获取token
    authToken = localStorage.getItem('adminToken');
    
    if (!authToken) {
        console.log('[Admin] 未找到token，跳转到登录页');
        window.location.href = 'login.html';
        return;
    }

    try {
        // 验证token
        console.log('[Admin] 正在验证token...');
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('[Admin] 验证响应状态:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error('认证失败: ' + response.status);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '获取用户信息失败');
        }
        
        currentUser = result.data;
        console.log('[Admin] 当前用户:', currentUser.username, '角色:', currentUser.role);
        
        // 检查权限（管理员或监管方都可以访问后台）
        if (currentUser.role !== 'admin' && currentUser.role !== 'regulator') {
            alert('您没有管理员权限');
            logout();
            return;
        }
        
        // 显示用户名
        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) {
            adminNameEl.textContent = currentUser.username;
        }
        
        // 加载页面
        console.log('[Admin] 加载dashboard...');
        loadPage('dashboard');
        
        // 绑定导航事件
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                loadPage(page);
            });
        });
        
        console.log('[Admin] === 初始化完成 ===');
        
    } catch (error) {
        console.error('[Admin] 初始化失败:', error);
        alert('登录验证失败: ' + (error.message || '请重新登录'));
        logout();
    }
}

// 加载页面
window.loadPage = function(page) {
    currentPage = page;
    
    // 更新导航状态
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // 隐藏所有页面
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    
    // 显示当前页面
    const pageEl = document.getElementById(`${page}-page`);
    if (pageEl) {
        pageEl.classList.remove('hidden');
    }
    
    // 更新标题
    const titles = {
        dashboard: '仪表盘',
        registrations: '产权登记管理',
        users: '用户管理',
        verification: '认证审核管理',
        protection: '维权案件管理',
        consultations: '法律咨询管理',
        cases: '成功案例管理',
        news: '新闻公告管理',
        settings: '系统设置',
        'site-config': '网站配置'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    
    // 加载页面数据
    switch (page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'registrations':
            loadRegistrations();
            break;
        case 'users':
            loadUsers();
            break;
        case 'verification':
            loadVerificationApplications();
            break;
        case 'protection':
            loadCases();
            break;
        case 'consultations':
            loadConsultations();
            break;
        case 'cases':
            loadSuccessCases();
            break;
        case 'news':
            loadNews();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'site-config':
            loadSiteConfig();
            break;
    }
}

// 加载仪表盘数据
window.loadDashboard = async function() {
    try {
        const response = await fetch(`${API_BASE}/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const data = result.data;
        
        // 更新统计数据
        document.getElementById('totalUsers').textContent = data.userStats.total_users || 0;
        document.getElementById('todayUsers').textContent = '+' + (data.userStats.today_users || 0);
        document.getElementById('totalRegistrations').textContent = data.registrationStats.total_registrations || 0;
        document.getElementById('todayRegistrations').textContent = '+' + (data.registrationStats.today_count || 0);
        document.getElementById('pendingCount').textContent = data.registrationStats.pending_count || 0;
        document.getElementById('totalCases').textContent = data.caseStats.total_cases || 0;
        document.getElementById('processingCases').textContent = (data.caseStats.processing_count || 0) + '个';
        
        // 渲染待审核列表
        const pendingListEl = document.getElementById('pendingList');
        if (data.pendingList && data.pendingList.length > 0) {
            pendingListEl.innerHTML = data.pendingList.map(item => `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                        <p class="font-medium">${item.title}</p>
                        <p class="text-sm text-gray-500">${item.holder_name} · ${item.registration_no}</p>
                    </div>
                    <button onclick="openReviewModal(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm">审核</button>
                </div>
            `).join('');
        } else {
            pendingListEl.innerHTML = '<p class="text-gray-400 text-center py-8">暂无待审核</p>';
        }
        
        // 渲染趋势图表
        renderTrendChart(data.dailyTrend);
        
    } catch (error) {
        console.error('加载仪表盘失败:', error);
    }
}

// 渲染趋势图表（日趋势 - 最近30天）
window.renderTrendChart = function(data) {
    const chartDom = document.getElementById('trendChart');
    if (!chartDom) return;
    
    const chart = echarts.init(chartDom);
    
    // 格式化日期显示为 M/D
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    };
    
    const option = {
        tooltip: { 
            trigger: 'axis',
            formatter: function(params) {
                const item = params[0];
                return item.name + '<br/>登记数量: ' + item.value;
            }
        },
        xAxis: {
            type: 'category',
            data: data.map(d => formatDate(d.date)),
            axisLabel: {
                rotate: 45,
                interval: 4
            }
        },
        yAxis: { type: 'value' },
        series: [{
            data: data.map(d => d.count),
            type: 'line',
            smooth: true,
            itemStyle: { color: '#3b82f6' },
            areaStyle: { color: 'rgba(59, 130, 246, 0.1)' }
        }]
    };
    chart.setOption(option);
}

// 加载登记列表
window.loadRegistrations = async function(page = 1) {
    try {
        const status = document.getElementById('regStatusFilter')?.value || '';
        const category = document.getElementById('regCategoryFilter')?.value || '';
        
        const response = await fetch(
            `${API_BASE}/admin/registrations?page=${page}&status=${status}&category=${category}`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const { list, pagination } = result.data;
        
        const tbody = document.getElementById('registrationsTable');
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">暂无数据</td></tr>';
        } else {
            tbody.innerHTML = list.map(item => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm font-mono">${item.registration_no}</td>
                    <td class="px-6 py-4 text-sm font-medium">${item.title}</td>
                    <td class="px-6 py-4 text-sm">${categoryMap(item.category)}</td>
                    <td class="px-6 py-4 text-sm">${item.holder_name}</td>
                    <td class="px-6 py-4">${statusBadge(item.status)}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(item.created_at)}</td>
                    <td class="px-6 py-4">
                        <div class="flex space-x-2">
                            <button onclick="viewRegistrationDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm" title="查看">👁️</button>
                            <button onclick="openEditRegistrationModal(${item.id})" class="text-green-600 hover:text-green-800 text-sm" title="编辑">✏️</button>
                            ${item.status === 'pending' ? 
                                `<button onclick="openReviewModal(${item.id})" class="text-purple-600 hover:text-purple-800 text-sm" title="审核">✓</button>` : 
                                ''
                            }
                            <button onclick="deleteRegistration(${item.id})" class="text-red-600 hover:text-red-800 text-sm" title="删除">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        // 分页
        renderPagination('regPagination', pagination, 'loadRegistrations');
        
    } catch (error) {
        console.error('加载登记列表失败:', error);
    }
}

// ==================== 登记管理功能 ====================

// 显示新增登记模态框
window.showRegistrationModal = function() {
    document.getElementById('regModalTitle').textContent = '新增登记';
    document.getElementById('regModalId').value = '';
    document.getElementById('regTitle').value = '';
    document.getElementById('regCategory').value = 'financial';
    document.getElementById('regDataType').value = 'structured';
    document.getElementById('regDataSize').value = 'medium';
    document.getElementById('regUpdateFrequency').value = 'daily';
    document.getElementById('regDataSource').value = '';
    document.getElementById('regDataFormat').value = '';
    document.getElementById('regApplicationScene').value = '';
    document.getElementById('regExpectedValue').value = '';
    document.getElementById('regDescription').value = '';
    document.getElementById('regHolderId').value = '';
    document.getElementById('holderSelectContainer').style.display = 'block';
    
    document.getElementById('registrationModal').classList.remove('hidden');
    document.getElementById('registrationModal').classList.add('flex');
}

// 关闭登记编辑模态框
window.closeRegistrationModal = function() {
    document.getElementById('registrationModal').classList.add('hidden');
    document.getElementById('registrationModal').classList.remove('flex');
}

// 打开编辑登记模态框
window.openEditRegistrationModal = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/registrations/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        
        document.getElementById('regModalTitle').textContent = '编辑登记';
        document.getElementById('regModalId').value = id;
        document.getElementById('regTitle').value = item.title;
        document.getElementById('regCategory').value = item.category;
        document.getElementById('regDataType').value = item.data_type;
        document.getElementById('regDataSize').value = item.data_size || 'medium';
        document.getElementById('regUpdateFrequency').value = item.update_frequency || 'daily';
        document.getElementById('regDataSource').value = item.data_source || '';
        document.getElementById('regDataFormat').value = item.data_format || '';
        document.getElementById('regApplicationScene').value = item.application_scene || '';
        document.getElementById('regExpectedValue').value = item.expected_value || '';
        document.getElementById('regDescription').value = item.description || '';
        document.getElementById('holderSelectContainer').style.display = 'none';
        
        document.getElementById('registrationModal').classList.remove('hidden');
        document.getElementById('registrationModal').classList.add('flex');
        
    } catch (error) {
        console.error('获取登记详情失败:', error);
        alert('获取详情失败');
    }
}

// 保存登记（新增/编辑）
window.saveRegistration = async function() {
    try {
        const id = document.getElementById('regModalId').value;
        const isEdit = !!id;
        
        const data = {
            title: document.getElementById('regTitle').value,
            category: document.getElementById('regCategory').value,
            dataType: document.getElementById('regDataType').value,
            dataSize: document.getElementById('regDataSize').value,
            updateFrequency: document.getElementById('regUpdateFrequency').value,
            dataSource: document.getElementById('regDataSource').value,
            dataFormat: document.getElementById('regDataFormat').value,
            applicationScene: document.getElementById('regApplicationScene').value,
            expectedValue: document.getElementById('regExpectedValue').value,
            description: document.getElementById('regDescription').value
        };
        
        // 验证必填字段
        if (!data.title || !data.dataSource || !data.applicationScene) {
            alert('请填写所有必填字段');
            return;
        }
        
        if (isEdit) {
            // 更新
            const response = await fetch(`${API_BASE}/admin/registrations/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            alert('登记信息更新成功');
        } else {
            // 新增
            const holderId = document.getElementById('regHolderId').value;
            if (!holderId) {
                alert('请输入持有人ID');
                return;
            }
            
            data.holderId = parseInt(holderId);
            data.holderName = '用户' + holderId; // 这里可以查询用户名
            
            const response = await fetch(`${API_BASE}/admin/registrations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            alert('登记创建成功，编号：' + result.data.registrationNo);
        }
        
        closeRegistrationModal();
        loadRegistrations();
        
    } catch (error) {
        console.error('保存登记失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 查看登记详情
window.viewRegistrationDetail = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/registrations/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        
        // 存储当前查看的ID，用于从详情页编辑
        window.currentDetailId = id;
        
        // 构建附件列表HTML
        let attachmentsHtml = '';
        if (item.files && item.files.length > 0) {
            const sampleFiles = item.files.filter(f => f.file_type === 'sample');
            const ownershipFiles = item.files.filter(f => f.file_type === 'ownership');
            const additionalFiles = item.files.filter(f => f.file_type === 'additional' || f.file_type === 'other');
            
            attachmentsHtml = `
                <div class="col-span-2 border-t pt-4">
                    <label class="text-sm text-gray-500">附件材料</label>
                    <div class="mt-2 space-y-3">
                        ${sampleFiles.length > 0 ? `
                            <div class="bg-blue-50 p-3 rounded-lg">
                                <p class="text-sm font-medium text-blue-700 mb-2">📊 数据样本</p>
                                <div class="space-y-2">
                                    ${sampleFiles.map(file => `
                                        <div class="flex items-center justify-between bg-white p-2 rounded">
                                            <div class="flex items-center space-x-2">
                                                <span class="text-sm">${file.file_name || file.original_name}</span>
                                                <span class="text-xs text-gray-400">(${formatFileSize(file.file_size)})</span>
                                            </div>
                                            <a href="http://localhost:3002${file.url || file.file_path}" 
                                               target="_blank"
                                               class="text-blue-600 hover:text-blue-800 text-sm">
                                                查看
                                            </a>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${ownershipFiles.length > 0 ? `
                            <div class="bg-green-50 p-3 rounded-lg">
                                <p class="text-sm font-medium text-green-700 mb-2">📄 权属证明</p>
                                <div class="space-y-2">
                                    ${ownershipFiles.map(file => `
                                        <div class="flex items-center justify-between bg-white p-2 rounded">
                                            <div class="flex items-center space-x-2">
                                                <span class="text-sm">${file.file_name || file.original_name}</span>
                                                <span class="text-xs text-gray-400">(${formatFileSize(file.file_size)})</span>
                                            </div>
                                            <a href="http://localhost:3002${file.url || file.file_path}" 
                                               target="_blank"
                                               class="text-blue-600 hover:text-blue-800 text-sm">
                                                查看
                                            </a>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${additionalFiles.length > 0 ? `
                            <div class="bg-gray-50 p-3 rounded-lg">
                                <p class="text-sm font-medium text-gray-700 mb-2">📎 补充材料</p>
                                <div class="space-y-2">
                                    ${additionalFiles.map(file => `
                                        <div class="flex items-center justify-between bg-white p-2 rounded">
                                            <div class="flex items-center space-x-2">
                                                <span class="text-sm">${file.file_name || file.original_name}</span>
                                                <span class="text-xs text-gray-400">(${formatFileSize(file.file_size)})</span>
                                            </div>
                                            <a href="http://localhost:3002${file.url || file.file_path}" 
                                               target="_blank"
                                               class="text-blue-600 hover:text-blue-800 text-sm">
                                                查看
                                            </a>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        } else {
            attachmentsHtml = `
                <div class="col-span-2 border-t pt-4">
                    <label class="text-sm text-gray-500">附件材料</label>
                    <p class="text-gray-400 text-sm mt-1">暂无附件</p>
                </div>
            `;
        }
        
        const content = document.getElementById('registrationDetailContent');
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2 bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-bold text-lg mb-2">${item.title}</h4>
                    <p class="text-gray-500">${item.registration_no}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">数据分类</label>
                    <p class="font-medium">${categoryMap(item.category)}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">数据类型</label>
                    <p class="font-medium">${item.data_type}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">数据规模</label>
                    <p class="font-medium">${item.data_size || '-'}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">更新频率</label>
                    <p class="font-medium">${item.update_frequency || '-'}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">数据来源</label>
                    <p class="font-medium">${item.data_source || '-'}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">数据格式</label>
                    <p class="font-medium">${item.data_format || '-'}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">应用场景</label>
                    <p class="text-sm bg-gray-50 p-2 rounded mt-1">${item.application_scene || '-'}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">预期价值</label>
                    <p class="text-sm bg-gray-50 p-2 rounded mt-1">${item.expected_value || '-'}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">详细描述</label>
                    <p class="text-sm bg-gray-50 p-2 rounded mt-1">${item.description || '-'}</p>
                </div>
                <div class="col-span-2 border-t pt-4">
                    <label class="text-sm text-gray-500">持有人信息</label>
                    <p class="font-medium">${item.holder_name} (ID: ${item.holder_id})</p>
                    <p class="text-sm text-gray-500">电话: ${item.holder_phone || '-'}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">当前状态</label>
                    <p class="mt-1">${statusBadge(item.status)}</p>
                </div>
                ${attachmentsHtml}
                ${item.review_comment ? `
                <div class="col-span-2 bg-yellow-50 p-3 rounded">
                    <label class="text-sm text-yellow-700">审核意见</label>
                    <p class="text-sm mt-1">${item.review_comment}</p>
                    <p class="text-xs text-gray-500 mt-1">审核人: ${item.reviewer_name || '管理员'} · ${formatDate(item.reviewed_at)}</p>
                </div>
                ` : ''}
                <div class="col-span-2 text-xs text-gray-400">
                    <p>创建时间: ${formatDate(item.created_at)}</p>
                    <p>更新时间: ${formatDate(item.updated_at)}</p>
                </div>
            </div>
        `;
        
        document.getElementById('registrationDetailModal').classList.remove('hidden');
        document.getElementById('registrationDetailModal').classList.add('flex');
        
    } catch (error) {
        console.error('获取登记详情失败:', error);
        alert('获取详情失败');
    }
}

// 从详情页打开编辑
window.editFromDetail = function() {
    closeRegistrationDetailModal();
    if (window.currentDetailId) {
        openEditRegistrationModal(window.currentDetailId);
    }
}

// 从案件详情页打开编辑
window.editCaseFromDetail = function() {
    closeCaseDetailModal();
    if (window.currentCaseId) {
        openEditCaseModal(window.currentCaseId);
    }
}

// 关闭登记详情模态框
window.closeRegistrationDetailModal = function() {
    document.getElementById('registrationDetailModal').classList.add('hidden');
    document.getElementById('registrationDetailModal').classList.remove('flex');
    window.currentDetailId = null;
}

// 删除登记
window.deleteRegistration = async function(id) {
    if (!confirm('确定要删除这条登记记录吗？\n此操作不可恢复！')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/registrations/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('登记删除成功');
        loadRegistrations();
        
    } catch (error) {
        console.error('删除登记失败:', error);
        alert('删除失败: ' + error.message);
    }
}

// 加载用户列表
window.loadUsers = async function(page = 1) {
    try {
        const keyword = document.getElementById('userSearch')?.value || '';
        const role = document.getElementById('userRoleFilter')?.value || '';
        
        const response = await fetch(
            `${API_BASE}/admin/users?page=${page}&keyword=${keyword}&role=${role}`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const { list, pagination } = result.data;
        
        const tbody = document.getElementById('usersTable');
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-400">暂无数据</td></tr>';
        } else {
            tbody.innerHTML = list.map(item => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm">${item.id}</td>
                    <td class="px-6 py-4 text-sm font-medium">${item.username}</td>
                    <td class="px-6 py-4 text-sm">${item.phone}</td>
                    <td class="px-6 py-4 text-sm">${roleMap(item.role)} ${getRoleBadge(item.role)}</td>
                    <td class="px-6 py-4">${item.verified ? '<span class="text-green-600">已认证</span>' : '<span class="text-gray-400">未认证</span>'}</td>
                    <td class="px-6 py-4">${item.status === 1 ? '<span class="text-green-600">正常</span>' : '<span class="text-red-600">禁用</span>'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(item.created_at)}</td>
                    <td class="px-6 py-4">
                        <div class="flex space-x-2">
                            <button onclick="viewUserDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm" title="查看">👁️</button>
                            <button onclick="openEditUserModal(${item.id})" class="text-green-600 hover:text-green-800 text-sm" title="编辑">✏️</button>
                            <button onclick="resetUserPassword(${item.id})" class="text-yellow-600 hover:text-yellow-800 text-sm" title="重置密码">🔑</button>
                            ${item.status === 1 ? 
                                `<button onclick="toggleUserStatus(${item.id}, 0)" class="text-orange-600 hover:text-orange-800 text-sm" title="禁用">🚫</button>` : 
                                `<button onclick="toggleUserStatus(${item.id}, 1)" class="text-green-600 hover:text-green-800 text-sm" title="启用">✓</button>`
                            }
                            <button onclick="deleteUser(${item.id})" class="text-red-600 hover:text-red-800 text-sm" title="删除">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        renderPagination('userPagination', pagination, 'loadUsers');
        
    } catch (error) {
        console.error('加载用户列表失败:', error);
    }
}

// 获取角色权限标签
window.getRoleBadge = function(role) {
    const badges = {
        admin: '<span class="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">超管</span>',
        regulator: '<span class="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">监管</span>',
        data_holder: '<span class="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">持有方</span>',
        data_user: '<span class="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">使用方</span>'
    };
    return badges[role] || '';
}

// 加载维权案件
window.loadCases = async function(page = 1) {
    try {
        const status = document.getElementById('caseStatusFilter')?.value || '';
        
        const response = await fetch(
            `${API_BASE}/admin/cases?page=${page}&status=${status}`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const { list, pagination } = result.data;
        
        const tbody = document.getElementById('casesTable');
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">暂无数据</td></tr>';
        } else {
            tbody.innerHTML = list.map(item => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm">${item.case_no}</td>
                    <td class="px-6 py-4 text-sm font-medium">${item.title || item.registration_title || '未关联登记'}</td>
                    <td class="px-6 py-4 text-sm">${item.applicant_name}</td>
                    <td class="px-6 py-4 text-sm">${item.infringement_type}</td>
                    <td class="px-6 py-4">${caseStatusBadge(item.status)}</td>
                    <td class="px-6 py-4">
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${item.progress || 0}%"></div>
                        </div>
                        <span class="text-xs text-gray-500">${item.progress || 0}%</span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex space-x-2">
                            <button onclick="viewCaseDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm" title="查看">👁️</button>
                            <button onclick="openEditCaseModal(${item.id})" class="text-green-600 hover:text-green-800 text-sm" title="编辑">✏️</button>
                            <button onclick="openCaseStatusModal(${item.id})" class="text-purple-600 hover:text-purple-800 text-sm" title="更新状态">✓</button>
                            <button onclick="deleteCase(${item.id})" class="text-red-600 hover:text-red-800 text-sm" title="删除">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        renderPagination('casePagination', pagination, 'loadCases');
        
    } catch (error) {
        console.error('加载案件列表失败:', error);
        // 如果admin/cases不存在，回退到普通API
        try {
            const response = await fetch(
                `${API_BASE}/protection?page=${page}&status=${document.getElementById('caseStatusFilter')?.value || ''}`,
                { headers: { 'Authorization': `Bearer ${authToken}` } }
            );
            const result = await response.json();
            if (result.success) {
                const { list, pagination } = result.data;
                const tbody = document.getElementById('casesTable');
                tbody.innerHTML = list.map(item => `
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 text-sm">${item.case_no}</td>
                        <td class="px-6 py-4 text-sm font-medium">${item.registration_title || '未关联登记'}</td>
                        <td class="px-6 py-4 text-sm">${item.applicant_name}</td>
                        <td class="px-6 py-4 text-sm">${item.infringement_type}</td>
                        <td class="px-6 py-4">${caseStatusBadge(item.status)}</td>
                        <td class="px-6 py-4">
                            <div class="w-full bg-gray-200 rounded-full h-2">
                                <div class="bg-blue-600 h-2 rounded-full" style="width: ${item.progress || 0}%"></div>
                            </div>
                            <span class="text-xs text-gray-500">${item.progress || 0}%</span>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex space-x-2">
                                <button onclick="viewCaseDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm" title="查看">👁️</button>
                                <button onclick="openCaseStatusModal(${item.id})" class="text-purple-600 hover:text-purple-800 text-sm" title="更新状态">✓</button>
                            </div>
                        </td>
                    </tr>
                `).join('');
                renderPagination('casePagination', pagination, 'loadCases');
            }
        } catch (e) {
            console.error('加载案件列表失败:', e);
        }
    }
}

// 查看案件详情
window.viewCaseDetail = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/cases/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        window.currentCaseId = id;
        
        const content = document.getElementById('caseDetailContent');
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2 bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-bold text-lg mb-2">${item.title || '无标题'}</h4>
                    <p class="text-gray-500">${item.case_no}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">申请人</label>
                    <p class="font-medium">${item.applicant_name}</p>
                    <p class="text-sm text-gray-500">电话: ${item.applicant_phone || '-'}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">侵权类型</label>
                    <p class="font-medium">${item.infringement_type}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">关联登记</label>
                    <p class="font-medium">${item.registration_title || '未关联登记'}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">侵权描述</label>
                    <p class="text-sm bg-gray-50 p-2 rounded mt-1">${item.description || '-'}</p>
                </div>
                ${item.infringer_info ? `
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">侵权方信息</label>
                    <p class="text-sm bg-gray-50 p-2 rounded mt-1">${item.infringer_info}</p>
                </div>
                ` : ''}
                ${item.expected_solution ? `
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">期望解决方案</label>
                    <p class="text-sm bg-gray-50 p-2 rounded mt-1">${item.expected_solution}</p>
                </div>
                ` : ''}
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">当前状态</label>
                    <p class="mt-1">${caseStatusBadge(item.status)}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">处理进度</label>
                    <div class="mt-2">
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-600 h-2 rounded-full" style="width: ${item.progress || 0}%"></div>
                        </div>
                        <span class="text-xs text-gray-500">${item.progress || 0}%</span>
                    </div>
                </div>
                ${item.handle_comment ? `
                <div class="col-span-2 bg-blue-50 p-3 rounded">
                    <label class="text-sm text-blue-700">处理意见</label>
                    <p class="text-sm mt-1">${item.handle_comment}</p>
                    <p class="text-xs text-gray-500 mt-1">处理人: ${item.handler_name || '管理员'} · ${formatDate(item.updated_at)}</p>
                </div>
                ` : ''}
                ${item.resolved_at ? `
                <div class="col-span-2 bg-green-50 p-3 rounded">
                    <label class="text-sm text-green-700">解决时间</label>
                    <p class="text-sm mt-1">${formatDate(item.resolved_at)}</p>
                </div>
                ` : ''}
                <div class="col-span-2 text-xs text-gray-400">
                    <p>创建时间: ${formatDate(item.created_at)}</p>
                    <p>更新时间: ${formatDate(item.updated_at)}</p>
                </div>
            </div>
        `;
        
        document.getElementById('caseDetailModal').classList.remove('hidden');
        document.getElementById('caseDetailModal').classList.add('flex');
        
    } catch (error) {
        console.error('获取案件详情失败:', error);
        alert('获取详情失败');
    }
}

// 关闭案件详情模态框
window.closeCaseDetailModal = function() {
    document.getElementById('caseDetailModal').classList.add('hidden');
    document.getElementById('caseDetailModal').classList.remove('flex');
    window.currentCaseId = null;
}

// 打开编辑案件模态框
window.openEditCaseModal = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/cases/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        
        document.getElementById('caseModalTitle').textContent = '编辑案件';
        document.getElementById('caseModalId').value = id;
        document.getElementById('caseTitle').value = item.title || '';
        document.getElementById('caseApplicantName').value = item.applicant_name || '';
        document.getElementById('caseApplicantPhone').value = item.applicant_phone || '';
        document.getElementById('caseInfringementType').value = item.infringement_type || '';
        document.getElementById('caseDescription').value = item.description || '';
        document.getElementById('caseInfringerInfo').value = item.infringer_info || '';
        document.getElementById('caseExpectedSolution').value = item.expected_solution || '';
        
        document.getElementById('caseEditModal').classList.remove('hidden');
        document.getElementById('caseEditModal').classList.add('flex');
        
    } catch (error) {
        console.error('获取案件详情失败:', error);
        alert('获取详情失败');
    }
}

// 显示新增案件模态框
window.showCaseModal = function() {
    document.getElementById('caseModalTitle').textContent = '新增案件';
    document.getElementById('caseModalId').value = '';
    document.getElementById('caseTitle').value = '';
    document.getElementById('caseApplicantName').value = '';
    document.getElementById('caseApplicantPhone').value = '';
    document.getElementById('caseInfringementType').value = 'copyright';
    document.getElementById('caseDescription').value = '';
    document.getElementById('caseInfringerInfo').value = '';
    document.getElementById('caseExpectedSolution').value = '';
    
    document.getElementById('caseEditModal').classList.remove('hidden');
    document.getElementById('caseEditModal').classList.add('flex');
}

// 关闭案件编辑模态框
window.closeCaseEditModal = function() {
    document.getElementById('caseEditModal').classList.add('hidden');
    document.getElementById('caseEditModal').classList.remove('flex');
}

// 保存案件（新增/编辑）
window.saveCase = async function() {
    try {
        const id = document.getElementById('caseModalId').value;
        const isEdit = !!id;
        
        const data = {
            title: document.getElementById('caseTitle').value,
            applicantName: document.getElementById('caseApplicantName').value,
            applicantPhone: document.getElementById('caseApplicantPhone').value,
            infringementType: document.getElementById('caseInfringementType').value,
            description: document.getElementById('caseDescription').value,
            infringerInfo: document.getElementById('caseInfringerInfo').value,
            expectedSolution: document.getElementById('caseExpectedSolution').value
        };
        
        if (!data.title || !data.applicantName || !data.description) {
            alert('请填写必填字段');
            return;
        }
        
        if (isEdit) {
            const response = await fetch(`${API_BASE}/admin/cases/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            alert('案件信息更新成功');
        } else {
            const response = await fetch(`${API_BASE}/admin/cases`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            alert('案件创建成功，编号：' + result.data.caseNo);
        }
        
        closeCaseEditModal();
        loadCases();
        
    } catch (error) {
        console.error('保存案件失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 打开案件状态更新模态框
window.openCaseStatusModal = function(id) {
    document.getElementById('caseStatusCaseId').value = id;
    document.getElementById('caseStatusSelect').value = 'processing';
    document.getElementById('caseProgress').value = '50';
    document.getElementById('caseHandleComment').value = '';
    
    document.getElementById('caseStatusModal').classList.remove('hidden');
    document.getElementById('caseStatusModal').classList.add('flex');
}

// 关闭案件状态更新模态框
window.closeCaseStatusModal = function() {
    document.getElementById('caseStatusModal').classList.add('hidden');
    document.getElementById('caseStatusModal').classList.remove('flex');
}

// 提交案件状态更新
window.submitCaseStatusUpdate = async function() {
    try {
        const id = document.getElementById('caseStatusCaseId').value;
        const status = document.getElementById('caseStatusSelect').value;
        const progress = parseInt(document.getElementById('caseProgress').value);
        const handleComment = document.getElementById('caseHandleComment').value;
        
        const response = await fetch(`${API_BASE}/admin/cases/${id}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, progress, handleComment })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('案件状态更新成功');
        closeCaseStatusModal();
        loadCases();
        
    } catch (error) {
        console.error('更新案件状态失败:', error);
        alert('更新失败: ' + error.message);
    }
}

// 删除案件
window.deleteCase = async function(id) {
    if (!confirm('确定要删除这条维权案件吗？\n此操作不可恢复！')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/cases/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('案件删除成功');
        loadCases();
        
    } catch (error) {
        console.error('删除案件失败:', error);
        alert('删除失败: ' + error.message);
    }
}

// 加载新闻列表
// 当前新闻页码
let currentNewsPage = 1;

window.loadNews = async function(page = 1) {
    currentNewsPage = page;
    try {
        // 使用admin API获取所有新闻（包括未发布的），每页10条
        const response = await fetch(`${API_BASE}/admin/news?page=${page}&pageSize=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const { list, pagination } = result.data;
        
        const tbody = document.getElementById('newsTable');
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">暂无数据</td></tr>';
        } else {
            tbody.innerHTML = list.map(item => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm font-medium">${item.title}</td>
                    <td class="px-6 py-4 text-sm">${item.category || '-'}</td>
                    <td class="px-6 py-4">${newsStatusBadge(item.is_published)}</td>
                    <td class="px-6 py-4 text-sm">${item.author_name}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(item.published_at || item.created_at)}</td>
                    <td class="px-6 py-4 text-sm">${item.view_count || 0}</td>
                    <td class="px-6 py-4">
                        <div class="flex space-x-2">
                            <button onclick="viewNewsDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm" title="查看">👁️</button>
                            <button onclick="openEditNewsModal(${item.id})" class="text-green-600 hover:text-green-800 text-sm" title="编辑">✏️</button>
                            <button onclick="deleteNews(${item.id})" class="text-red-600 hover:text-red-800 text-sm" title="删除">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        // 渲染分页
        renderNewsPagination(pagination);
        
        
    } catch (error) {
        console.error('加载新闻列表失败:', error);
        // 如果admin/news不存在，使用普通API
        const response = await fetch(`${API_BASE}/news?page=1&pageSize=100`);
        const result = await response.json();
        if (result.success) {
            const list = result.data.list;
            const tbody = document.getElementById('newsTable');
            tbody.innerHTML = list.map(item => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm font-medium">${item.title}</td>
                    <td class="px-6 py-4 text-sm">${item.category || '-'}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">已发布</span></td>
                    <td class="px-6 py-4 text-sm">${item.author_name}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(item.published_at)}</td>
                    <td class="px-6 py-4 text-sm">${item.view_count || 0}</td>
                    <td class="px-6 py-4">
                        <div class="flex space-x-2">
                            <button onclick="viewNewsDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm" title="查看">👁️</button>
                            <button onclick="openEditNewsModal(${item.id})" class="text-green-600 hover:text-green-800 text-sm" title="编辑">✏️</button>
                            <button onclick="deleteNews(${item.id})" class="text-red-600 hover:text-red-800 text-sm" title="删除">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    }
}

// 新闻发布状态徽章
window.newsStatusBadge = function(isPublished) {
    if (isPublished === 1) {
        return '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">已发布</span>';
    }
    return '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">草稿</span>';
}

// 加载设置
window.loadSettings = async function() {
    try {
        const response = await fetch(`${API_BASE}/admin/config`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        // 后端返回的是对象格式 {key: value}
        const configMap = result.data || {};
        console.log('[Admin] 加载配置:', configMap);
        
        document.getElementById('settingsForm').innerHTML = `
            <div class="space-y-6">
                <!-- 网站基本信息 -->
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-bold text-gray-800 mb-4 border-b pb-2">网站基本信息</h4>
                    <div class="grid grid-cols-1 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">网站名称 <span class="text-red-500">*</span></label>
                            <input type="text" id="site_name" value="${configMap.site_name || '天津数据产权登记服务平台'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入网站名称">
                            <p class="text-xs text-gray-500 mt-1">显示在浏览器标签和页面顶部</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">网站描述 <span class="text-red-500">*</span></label>
                            <textarea id="site_description" rows="3" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入网站描述">${configMap.site_description || ''}</textarea>
                            <p class="text-xs text-gray-500 mt-1">显示在首页和搜索引擎中</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">网站关键词</label>
                            <input type="text" id="site_keywords" value="${configMap.site_keywords || '数据产权,登记服务,天津数据,数据资产'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="多个关键词用逗号分隔">
                            <p class="text-xs text-gray-500 mt-1">用于SEO优化，多个关键词用逗号分隔</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">网站Logo URL</label>
                            <input type="text" id="site_logo" value="${configMap.site_logo || ''}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入Logo图片URL">
                            <p class="text-xs text-gray-500 mt-1">建议使用200x60像素的透明背景PNG</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">网站备案号</label>
                            <input type="text" id="site_icp" value="${configMap.site_icp || '津ICP备12345678号'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入备案号">
                        </div>
                    </div>
                </div>
                
                <!-- 联系信息 -->
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-bold text-gray-800 mb-4 border-b pb-2">联系信息</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">联系电话</label>
                            <input type="text" id="contact_phone" value="${configMap.contact_phone || ''}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入联系电话">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">联系邮箱</label>
                            <input type="email" id="contact_email" value="${configMap.contact_email || ''}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入联系邮箱">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">联系地址</label>
                            <input type="text" id="contact_address" value="${configMap.contact_address || ''}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入联系地址">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">工作时间</label>
                            <input type="text" id="contact_hours" value="${configMap.contact_hours || '周一至周五 9:00-18:00'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入工作时间">
                        </div>
                    </div>
                </div>
                
                <!-- 业务流程配置 -->
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-bold text-gray-800 mb-4 border-b pb-2">业务流程配置</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">审核周期（天）</label>
                            <input type="number" id="review_days" value="${configMap.review_days || '7'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入审核周期" min="1" max="30">
                            <p class="text-xs text-gray-500 mt-1">产权登记审核所需工作日</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">公示周期（天）</label>
                            <input type="number" id="publicity_days" value="${configMap.publicity_days || '15'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入公示周期" min="1" max="90">
                            <p class="text-xs text-gray-500 mt-1">审核通过后公示期时长</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">单日最大申请数</label>
                            <input type="number" id="max_daily_applications" value="${configMap.max_daily_applications || '10'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入单日最大申请数" min="1" max="100">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">文件大小限制（MB）</label>
                            <input type="number" id="max_file_size" value="${configMap.max_file_size || '50'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入文件大小限制" min="1" max="500">
                        </div>
                    </div>
                </div>
                
                <!-- 版权信息 -->
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-bold text-gray-800 mb-4 border-b pb-2">版权信息</h4>
                    <div class="grid grid-cols-1 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">版权所有</label>
                            <input type="text" id="copyright_text" value="${configMap.copyright_text || '© 2024 天津市数据产权登记中心 版权所有'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入版权信息">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">技术支持单位</label>
                            <input type="text" id="tech_support" value="${configMap.tech_support || '天津大数据管理中心'}" 
                                class="w-full border rounded-lg px-4 py-2" placeholder="请输入技术支持单位">
                        </div>
                    </div>
                </div>
                
                <!-- 操作按钮 -->
                <div class="flex justify-between items-center pt-4 border-t">
                    <button onclick="resetSettings()" class="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        恢复默认
                    </button>
                    <div class="space-x-3">
                        <button onclick="previewSettings()" class="px-6 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            预览效果
                        </button>
                        <button onclick="saveSettings()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                            保存设置
                        </button>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('加载设置失败:', error);
        document.getElementById('settingsForm').innerHTML = `
            <div class="text-center py-8 text-red-600">
                <p>加载设置失败: ${error.message}</p>
                <button onclick="loadSettings()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">重试</button>
            </div>
        `;
    }
}

// 保存设置
window.saveSettings = async function() {
    try {
        // 所有配置项
        const settings = [
            'site_name', 'site_description', 'site_keywords', 'site_logo', 'site_icp',
            'contact_phone', 'contact_email', 'contact_address', 'contact_hours',
            'review_days', 'publicity_days', 'max_daily_applications', 'max_file_size',
            'copyright_text', 'tech_support'
        ];
        
        let savedCount = 0;
        
        for (const key of settings) {
            const element = document.getElementById(key);
            if (element) {
                const value = element.value;
                const response = await fetch(`${API_BASE}/admin/config/${key}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ value })
                });
                
                if (response.ok) {
                    savedCount++;
                }
            }
        }
        
        alert(`设置保存成功！共保存 ${savedCount} 项配置。`);
        console.log('[Admin] 设置保存成功:', savedCount, '项');
        
    } catch (error) {
        console.error('保存设置失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 恢复默认设置
window.resetSettings = function() {
    if (!confirm('确定要恢复默认设置吗？这将覆盖您当前的所有配置。')) return;
    
    const defaults = {
        site_name: '天津数据产权登记服务平台',
        site_description: '构建权威、高效、可信的数据产权登记体系',
        site_keywords: '数据产权,登记服务,天津数据,数据资产',
        site_logo: '',
        site_icp: '津ICP备12345678号',
        contact_phone: '400-123-4567',
        contact_email: 'service@tjdata.gov.cn',
        contact_address: '',
        contact_hours: '周一至周五 9:00-18:00',
        review_days: '7',
        publicity_days: '15',
        max_daily_applications: '10',
        max_file_size: '50',
        copyright_text: '© 2024 天津市数据产权登记中心 版权所有',
        tech_support: '天津大数据管理中心'
    };
    
    for (const [key, value] of Object.entries(defaults)) {
        const element = document.getElementById(key);
        if (element) {
            element.value = value;
        }
    }
    
    alert('已恢复默认设置，请点击"保存设置"按钮保存更改。');
}

// 预览设置效果
window.previewSettings = function() {
    const siteName = document.getElementById('site_name')?.value || '网站名称';
    const siteDesc = document.getElementById('site_description')?.value || '网站描述';
    
    const previewWindow = window.open('', '_blank', 'width=800,height=600');
    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>设置预览 - ${siteName}</title>
            <style>
                body { font-family: sans-serif; padding: 40px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #1e3a8a; margin-bottom: 10px; }
                .desc { color: #666; margin-bottom: 30px; }
                .section { margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; }
                .section h3 { margin-top: 0; color: #374151; }
                .info-row { display: flex; margin: 8px 0; }
                .info-label { width: 120px; color: #6b7280; font-size: 14px; }
                .info-value { flex: 1; color: #111827; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${siteName}</h1>
                <p class="desc">${siteDesc}</p>
                
                <div class="section">
                    <h3>联系信息</h3>
                    <div class="info-row">
                        <span class="info-label">电话:</span>
                        <span class="info-value">${document.getElementById('contact_phone')?.value || '未设置'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">邮箱:</span>
                        <span class="info-value">${document.getElementById('contact_email')?.value || '未设置'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">地址:</span>
                        <span class="info-value">${document.getElementById('contact_address')?.value || '未设置'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">工作时间:</span>
                        <span class="info-value">${document.getElementById('contact_hours')?.value || '未设置'}</span>
                    </div>
                </div>
                
                <div class="section">
                    <h3>业务流程</h3>
                    <div class="info-row">
                        <span class="info-label">审核周期:</span>
                        <span class="info-value">${document.getElementById('review_days')?.value || '7'} 天</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">公示周期:</span>
                        <span class="info-value">${document.getElementById('publicity_days')?.value || '15'} 天</span>
                    </div>
                </div>
                
                <div class="section">
                    <h3>版权信息</h3>
                    <p>${document.getElementById('copyright_text')?.value || ''}</p>
                    <p style="margin-top: 8px; color: #6b7280;">技术支持: ${document.getElementById('tech_support')?.value || ''}</p>
                </div>
            </div>
        </body>
        </html>
    `);
}

// 审核相关 - 支持通过和拒绝
window.openReviewModal = function(id, defaultStatus = 'approved') {
    document.getElementById('reviewRegId').value = id;
    document.getElementById('reviewStatus').value = defaultStatus;
    document.getElementById('reviewComment').value = '';
    document.getElementById('reviewModal').classList.remove('hidden');
    document.getElementById('reviewModal').classList.add('flex');
}

window.closeReviewModal = function() {
    document.getElementById('reviewModal').classList.add('hidden');
    document.getElementById('reviewModal').classList.remove('flex');
}

window.submitReview = async function() {
    try {
        const id = document.getElementById('reviewRegId').value;
        const status = document.getElementById('reviewStatus').value;
        const comment = document.getElementById('reviewComment').value;
        
        if (!comment.trim()) {
            alert('请输入审核意见');
            return;
        }
        
        const statusText = status === 'approved' ? '通过' : '拒绝';
        
        if (!confirm(`确定要${statusText}该登记申请吗？`)) {
            return;
        }
        
        const response = await fetch(`${API_BASE}/admin/registrations/${id}/review`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, comment })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert(`审核${statusText}成功`);
        closeReviewModal();
        loadRegistrations();
        
        // 如果在仪表盘页面，也刷新仪表盘
        if (currentPage === 'dashboard') {
            loadDashboard();
        }
        
    } catch (error) {
        console.error('审核失败:', error);
        alert('审核失败: ' + error.message);
    }
}

// 用户状态切换
window.toggleUserStatus = async function(id, status) {
    try {
        const response = await fetch(`${API_BASE}/admin/users/${id}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        loadUsers();
        
    } catch (error) {
        console.error('更新用户状态失败:', error);
        alert('操作失败');
    }
}

// 更新案件进度
window.updateCaseProgress = async function(id) {
    const progress = prompt('请输入进度 (0-100):');
    if (progress === null) return;
    
    try {
        const response = await fetch(`${API_BASE}/protection/${id}/progress`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ progress: parseInt(progress) })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        loadCases();
        
    } catch (error) {
        console.error('更新进度失败:', error);
        alert('更新失败');
    }
}

// 渲染分页
window.renderPagination = function(id, pagination, callbackName) {
    const { page, totalPages } = pagination;
    const container = document.getElementById(id);
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // 上一页
    html += `<button onclick="window.${callbackName}(${page - 1})" ${page === 1 ? 'disabled' : ''} class="px-3 py-1 border rounded mx-1 ${page === 1 ? 'opacity-50' : 'hover:bg-gray-100'}">上一页</button>`;
    
    // 页码
    for (let i = 1; i <= totalPages; i++) {
        if (i === page) {
            html += `<span class="px-3 py-1 bg-blue-600 text-white rounded mx-1">${i}</span>`;
        } else {
            html += `<button onclick="window.${callbackName}(${i})" class="px-3 py-1 border rounded mx-1 hover:bg-gray-100">${i}</button>`;
        }
    }
    
    // 下一页
    html += `<button onclick="window.${callbackName}(${page + 1})" ${page === totalPages ? 'disabled' : ''} class="px-3 py-1 border rounded mx-1 ${page === totalPages ? 'opacity-50' : 'hover:bg-gray-100'}">下一页</button>`;
    
    container.innerHTML = html;
}

// 辅助函数
window.categoryMap = function(category) {
    const map = {
        financial: '金融数据',
        medical: '医疗数据',
        traffic: '交通数据',
        education: '教育数据',
        industrial: '工业数据',
        other: '其他数据'
    };
    return map[category] || category;
}

window.roleMap = function(role) {
    const map = {
        data_holder: '数据持有方',
        data_user: '数据使用方',
        regulator: '监管方',
        admin: '管理员'
    };
    return map[role] || role;
}

window.statusBadge = function(status) {
    const map = {
        pending: { text: '待审核', class: 'bg-yellow-100 text-yellow-800' },
        reviewing: { text: '审核中', class: 'bg-blue-100 text-blue-800' },
        approved: { text: '已通过', class: 'bg-green-100 text-green-800' },
        rejected: { text: '已拒绝', class: 'bg-red-100 text-red-800' },
        revoked: { text: '已撤销', class: 'bg-gray-100 text-gray-800' }
    };
    const s = map[status] || { text: status, class: 'bg-gray-100' };
    return `<span class="px-2 py-1 rounded-full text-xs ${s.class}">${s.text}</span>`;
}

window.caseStatusBadge = function(status) {
    const map = {
        pending: { text: '待处理', class: 'bg-gray-100 text-gray-800' },
        processing: { text: '处理中', class: 'bg-yellow-100 text-yellow-800' },
        investigating: { text: '调查中', class: 'bg-blue-100 text-blue-800' },
        resolved: { text: '已解决', class: 'bg-green-100 text-green-800' },
        rejected: { text: '已驳回', class: 'bg-red-100 text-red-800' },
        closed: { text: '已关闭', class: 'bg-gray-100 text-gray-600' }
    };
    const s = map[status] || { text: status, class: 'bg-gray-100' };
    return `<span class="px-2 py-1 rounded-full text-xs ${s.class}">${s.text}</span>`;
}

window.formatDate = function(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('zh-CN');
}

window.formatFileSize = function(size) {
    if (!size) return '0 B';
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
    if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
    return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

window.logout = function() {
    console.log('退出登录...');
    localStorage.removeItem('adminToken');
    currentUser = null;
    authToken = null;
    window.location.href = 'login.html';
}

// ==================== 用户管理功能 ====================

// 显示新增用户模态框
window.showUserModal = function() {
    document.getElementById('userModalTitle').textContent = '新增用户';
    document.getElementById('userModalId').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userPhone').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('userRole').value = 'data_holder';
    document.getElementById('userRealName').value = '';
    document.getElementById('userOrg').value = '';
    document.getElementById('userVerified').checked = false;
    document.getElementById('userPassword').value = '';
    document.getElementById('passwordContainer').style.display = 'block';
    
    document.getElementById('userModal').classList.remove('hidden');
    document.getElementById('userModal').classList.add('flex');
}

// 关闭用户编辑模态框
window.closeUserModal = function() {
    document.getElementById('userModal').classList.add('hidden');
    document.getElementById('userModal').classList.remove('flex');
}

// 打开编辑用户模态框
window.openEditUserModal = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/users/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        
        document.getElementById('userModalTitle').textContent = '编辑用户';
        document.getElementById('userModalId').value = id;
        document.getElementById('userName').value = item.username;
        document.getElementById('userPhone').value = item.phone;
        document.getElementById('userEmail').value = item.email || '';
        document.getElementById('userRole').value = item.role;
        document.getElementById('userRealName').value = item.real_name || '';
        document.getElementById('userOrg').value = item.organization || '';
        document.getElementById('userVerified').checked = item.verified === 1;
        document.getElementById('passwordContainer').style.display = 'none';
        
        document.getElementById('userModal').classList.remove('hidden');
        document.getElementById('userModal').classList.add('flex');
        
    } catch (error) {
        console.error('获取用户详情失败:', error);
        alert('获取详情失败');
    }
}

// 保存用户（新增/编辑）
window.saveUser = async function() {
    try {
        const id = document.getElementById('userModalId').value;
        const isEdit = !!id;
        
        const data = {
            username: document.getElementById('userName').value,
            phone: document.getElementById('userPhone').value,
            email: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value,
            realName: document.getElementById('userRealName').value,
            organization: document.getElementById('userOrg').value,
            verified: document.getElementById('userVerified').checked
        };
        
        if (!data.username || !data.phone) {
            alert('请填写用户名和手机号');
            return;
        }
        
        if (!data.organization || data.organization.trim() === '') {
            alert('请填写所属机构/单位');
            return;
        }
        
        if (isEdit) {
            const response = await fetch(`${API_BASE}/admin/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            alert('用户信息更新成功');
        } else {
            const password = document.getElementById('userPassword').value;
            if (!password || password.length < 6) {
                alert('密码至少6位');
                return;
            }
            data.password = password;
            
            const response = await fetch(`${API_BASE}/admin/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            alert('用户创建成功');
        }
        
        closeUserModal();
        loadUsers();
        
    } catch (error) {
        console.error('保存用户失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 查看用户详情
window.viewUserDetail = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/users/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        
        const content = document.getElementById('userDetailContent');
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2 bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-bold text-lg mb-2">${item.username}</h4>
                    <p class="text-gray-500">ID: ${item.id}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">手机号</label>
                    <p class="font-medium">${item.phone}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">邮箱</label>
                    <p class="font-medium">${item.email || '-'}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">角色类型</label>
                    <p class="font-medium">${roleMap(item.role)} ${getRoleBadge(item.role)}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">认证状态</label>
                    <p class="font-medium">${item.verified === 1 ? '<span class="text-green-600">已认证</span>' : '<span class="text-gray-400">未认证</span>'}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">账号状态</label>
                    <p class="font-medium">${item.status === 1 ? '<span class="text-green-600">正常</span>' : '<span class="text-red-600">禁用</span>'}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">真实姓名</label>
                    <p class="font-medium">${item.real_name || '-'}</p>
                </div>
                <div class="col-span-2">
                    <label class="text-sm text-gray-500">所属机构</label>
                    <p class="font-medium">${item.organization || '-'}</p>
                </div>
                <div class="col-span-2 bg-blue-50 p-3 rounded">
                    <label class="text-sm text-blue-700 font-medium">权限标签</label>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${getPermissionTags(item.role)}
                    </div>
                </div>
                <div class="col-span-2 text-xs text-gray-400">
                    <p>创建时间: ${formatDate(item.created_at)}</p>
                    <p>更新时间: ${formatDate(item.updated_at)}</p>
                </div>
            </div>
        `;
        
        document.getElementById('userDetailModal').classList.remove('hidden');
        document.getElementById('userDetailModal').classList.add('flex');
        
    } catch (error) {
        console.error('获取用户详情失败:', error);
        alert('获取详情失败');
    }
}

// 获取权限标签HTML
window.getPermissionTags = function(role) {
    const permissions = {
        admin: ['全部权限', '用户管理', '登记管理', '维权管理', '新闻管理', '系统配置'],
        regulator: ['登记审核', '登记查看', '维权处理', '维权查看', '统计查看'],
        data_holder: ['登记创建', '我的登记', '维权申请', '我的维权'],
        data_user: ['登记查看', '维权申请']
    };
    
    const rolePerms = permissions[role] || [];
    return rolePerms.map(p => `<span class="px-2 py-1 bg-white rounded text-xs text-blue-600 border border-blue-200">${p}</span>`).join('');
}

// 关闭用户详情模态框
window.closeUserDetailModal = function() {
    document.getElementById('userDetailModal').classList.add('hidden');
    document.getElementById('userDetailModal').classList.remove('flex');
}

// 重置用户密码
window.resetUserPassword = async function(id) {
    const newPassword = prompt('请输入新密码（至少6位）:');
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
        alert('密码至少6位');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${id}/password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: newPassword })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('密码重置成功');
        
    } catch (error) {
        console.error('重置密码失败:', error);
        alert('重置失败: ' + error.message);
    }
}

// 删除用户
window.deleteUser = async function(id) {
    if (!confirm('确定要删除该用户吗？\n此操作不可恢复！')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('用户删除成功');
        loadUsers();
        
    } catch (error) {
        console.error('删除用户失败:', error);
        alert('删除失败: ' + error.message);
    }
}

// ==================== 新闻管理功能 ====================

// 显示新闻编辑模态框
window.showNewsModal = function() {
    document.getElementById('newsModalTitle').textContent = '发布新闻';
    document.getElementById('newsModalId').value = '';
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsCategory').value = '平台动态';
    document.getElementById('newsSummary').value = '';
    document.getElementById('newsContent').value = '';
    document.getElementById('newsCover').value = '';
    document.getElementById('newsPublished').checked = true;
    
    document.getElementById('newsEditModal').classList.remove('hidden');
    document.getElementById('newsEditModal').classList.add('flex');
}

// 关闭新闻编辑模态框
window.closeNewsEditModal = function() {
    document.getElementById('newsEditModal').classList.add('hidden');
    document.getElementById('newsEditModal').classList.remove('flex');
}

// 打开编辑新闻模态框
window.openEditNewsModal = async function(id) {
    try {
        // 获取新闻详情（需要通过admin API获取未发布的）
        const response = await fetch(`${API_BASE}/admin/news/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        
        document.getElementById('newsModalTitle').textContent = '编辑新闻';
        document.getElementById('newsModalId').value = id;
        document.getElementById('newsTitle').value = item.title;
        document.getElementById('newsCategory').value = item.category || '平台动态';
        document.getElementById('newsSummary').value = item.summary || '';
        document.getElementById('newsContent').value = item.content;
        document.getElementById('newsCover').value = item.cover_image || '';
        document.getElementById('newsPublished').checked = item.is_published === 1;
        
        document.getElementById('newsEditModal').classList.remove('hidden');
        document.getElementById('newsEditModal').classList.add('flex');
        
    } catch (error) {
        console.error('获取新闻详情失败:', error);
        alert('获取详情失败');
    }
}

// 保存新闻（新增/编辑）
window.saveNews = async function() {
    try {
        const id = document.getElementById('newsModalId').value;
        const isEdit = !!id;
        
        const data = {
            title: document.getElementById('newsTitle').value,
            category: document.getElementById('newsCategory').value,
            summary: document.getElementById('newsSummary').value,
            content: document.getElementById('newsContent').value,
            coverImage: document.getElementById('newsCover').value,
            isPublished: document.getElementById('newsPublished').checked ? 1 : 0
        };
        
        if (!data.title || !data.content) {
            alert('请填写标题和内容');
            return;
        }
        
        if (isEdit) {
            const response = await fetch(`${API_BASE}/admin/news/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            alert('新闻更新成功');
        } else {
            const response = await fetch(`${API_BASE}/admin/news`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            alert('新闻发布成功');
        }
        
        closeNewsEditModal();
        loadNews();
        
    } catch (error) {
        console.error('保存新闻失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 查看新闻详情
window.viewNewsDetail = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/news/${id}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        
        const content = document.getElementById('newsDetailContent');
        content.innerHTML = `
            <div class="space-y-4">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-bold text-lg mb-2">${item.title}</h4>
                    <div class="flex space-x-4 text-sm text-gray-500">
                        <span>分类: ${item.category || '-'}</span>
                        <span>作者: ${item.author_name || '-'}</span>
                        <span>浏览: ${item.view_count || 0}</span>
                    </div>
                </div>
                <div>
                    <label class="text-sm text-gray-500">摘要</label>
                    <p class="text-sm bg-gray-50 p-3 rounded mt-1">${item.summary || '-'}</p>
                </div>
                <div>
                    <label class="text-sm text-gray-500">内容</label>
                    <div class="text-sm bg-gray-50 p-3 rounded mt-1 max-h-60 overflow-y-auto">${item.content}</div>
                </div>
                <div class="flex justify-between text-xs text-gray-400">
                    <span>发布状态: ${item.is_published === 1 ? '<span class="text-green-600">已发布</span>' : '<span class="text-yellow-600">草稿</span>'}</span>
                    <span>发布时间: ${formatDate(item.published_at)}</span>
                </div>
            </div>
        `;
        
        // 存储当前ID供编辑使用
        window.currentNewsId = id;
        
        document.getElementById('newsDetailModal').classList.remove('hidden');
        document.getElementById('newsDetailModal').classList.add('flex');
        
    } catch (error) {
        console.error('获取新闻详情失败:', error);
        alert('获取详情失败');
    }
}

// 从详情页编辑新闻
window.editNewsFromDetail = function() {
    closeNewsDetailModal();
    if (window.currentNewsId) {
        openEditNewsModal(window.currentNewsId);
    }
}

// 关闭新闻详情模态框
window.closeNewsDetailModal = function() {
    document.getElementById('newsDetailModal').classList.add('hidden');
    document.getElementById('newsDetailModal').classList.remove('flex');
    window.currentNewsId = null;
}

// 删除新闻
window.deleteNews = async function(id) {
    if (!confirm('确定要删除这条新闻吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/news/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('新闻删除成功');
        loadNews();
        
    } catch (error) {
        console.error('删除新闻失败:', error);
        alert('删除失败: ' + error.message);
    }
}

// ==================== 网站配置功能 ====================

const SITE_CONFIG_API = '/site-config';
let currentSiteConfig = {};

// 加载网站配置
window.loadSiteConfig = async function() {
    try {
        const response = await fetch(`${API_BASE}${SITE_CONFIG_API}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        currentSiteConfig = result.data;
        fillSiteConfigForm(result.data);
        
    } catch (error) {
        console.error('加载网站配置失败:', error);
        alert('加载配置失败: ' + error.message);
    }
};

// 填充表单
function fillSiteConfigForm(config) {
    // Header 配置
    document.getElementById('siteName').value = config.siteName || '';
    document.getElementById('siteLogo').value = config.logo || '';
    document.getElementById('siteDescription').value = config.description || '';
    document.getElementById('showLogin').checked = config.showLogin !== false;
    
    // 导航菜单
    renderNavItems(config.navItems || []);
    
    // Footer 配置
    const footer = config.footer || {};
    document.getElementById('contactPhone').value = footer.contact?.phone || '';
    document.getElementById('contactEmail').value = footer.contact?.email || '';
    document.getElementById('contactAddress').value = footer.contact?.address || '';
    document.getElementById('copyright').value = footer.copyright || '';
    document.getElementById('icp').value = footer.icp || '';
}

// 渲染导航菜单
function renderNavItems(items) {
    const container = document.getElementById('navItemsContainer');
    container.innerHTML = items.map((item, index) => `
        <div class="flex items-center space-x-2 bg-gray-50 p-2 rounded">
            <input type="text" value="${item.name}" placeholder="名称" 
                   class="nav-item-name flex-1 border rounded px-2 py-1 text-sm">
            <input type="text" value="${item.href}" placeholder="链接" 
                   class="nav-item-href flex-1 border rounded px-2 py-1 text-sm">
            <button onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');
}

// 添加导航项
window.addNavItem = function() {
    const container = document.getElementById('navItemsContainer');
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2 bg-gray-50 p-2 rounded';
    div.innerHTML = `
        <input type="text" placeholder="名称" class="nav-item-name flex-1 border rounded px-2 py-1 text-sm">
        <input type="text" placeholder="链接" class="nav-item-href flex-1 border rounded px-2 py-1 text-sm">
        <button onclick="this.parentElement.remove()" class="text-red-500 hover:text-red-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;
    container.appendChild(div);
};

// 获取导航项
function getNavItems() {
    const items = [];
    document.querySelectorAll('#navItemsContainer > div').forEach(div => {
        const name = div.querySelector('.nav-item-name').value;
        const href = div.querySelector('.nav-item-href').value;
        if (name && href) {
            items.push({ id: name.toLowerCase().replace(/\\s+/g, '-'), name, href });
        }
    });
    return items;
}

// 保存 Header 配置
window.saveHeaderConfig = async function() {
    const config = {
        siteName: document.getElementById('siteName').value,
        logo: document.getElementById('siteLogo').value,
        description: document.getElementById('siteDescription').value,
        showLogin: document.getElementById('showLogin').checked,
        navItems: getNavItems()
    };
    
    try {
        const response = await fetch(`${API_BASE}${SITE_CONFIG_API}/header`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('Header 配置保存成功！\\n\\n前端页面将在刷新后自动更新。\\n提示：用户可以在前台页面按 F5 刷新查看最新效果。');
        
    } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error.message);
    }
};

// 保存 Footer 配置
window.saveFooterConfig = async function() {
    const config = {
        contact: {
            phone: document.getElementById('contactPhone').value,
            email: document.getElementById('contactEmail').value,
            address: document.getElementById('contactAddress').value
        },
        copyright: document.getElementById('copyright').value,
        icp: document.getElementById('icp').value
    };
    
    try {
        const response = await fetch(`${API_BASE}${SITE_CONFIG_API}/footer`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('Footer 配置保存成功！\\n\\n前端页面将在刷新后自动更新。\\n提示：用户可以在前台页面按 F5 刷新查看最新效果。');
        
    } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error.message);
    }
};

// 保存所有配置
window.saveAllSiteConfig = async function() {
    await saveHeaderConfig();
    await saveFooterConfig();
    alert('所有配置已保存！\\n\\n前端页面将在刷新后自动更新。');
};

// 重置配置
window.resetSiteConfig = async function() {
    if (!confirm('确定要重置为默认配置吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE}${SITE_CONFIG_API}/reset`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type: 'all' })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('配置已重置为默认值！\\n\\n前端页面将在刷新后自动更新。');
        loadSiteConfig();
        
    } catch (error) {
        console.error('重置失败:', error);
        alert('重置失败: ' + error.message);
    }
};

// 刷新预览
window.refreshPreview = function() {
    const frame = document.getElementById('sitePreviewFrame');
    if (frame) {
        // 添加时间戳参数强制刷新
        frame.src = 'http://localhost:8888?_t=' + Date.now();
        console.log('[Preview] 预览已刷新');
    }
};

// 启动
window.init();

// ==================== 法律咨询管理 ====================

// 加载法律咨询列表
window.loadConsultations = async function(page = 1) {
    const status = document.getElementById('consultationStatusFilter')?.value || '';
    const type = document.getElementById('consultationTypeFilter')?.value || '';
    
    try {
        const response = await fetch(`${API_BASE}/admin/consultations?page=${page}&status=${status}&type=${type}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const { list, pagination } = result.data;
        
        // 渲染表格
        const tbody = document.getElementById('consultationsTable');
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">暂无法律咨询</td></tr>';
        } else {
            tbody.innerHTML = list.map(item => renderConsultationRow(item)).join('');
        }
        
        // 渲染分页
        document.getElementById('consultationsPagination').innerHTML = 
            renderPagination(pagination, 'loadConsultations');
        
    } catch (error) {
        console.error('加载法律咨询失败:', error);
        document.getElementById('consultationsTable').innerHTML = 
            `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">加载失败: ${error.message}</td></tr>`;
    }
};

// 渲染法律咨询行
function renderConsultationRow(item) {
    const statusMap = {
        'pending': { text: '待处理', class: 'bg-yellow-100 text-yellow-800' },
        'processing': { text: '处理中', class: 'bg-blue-100 text-blue-800' },
        'resolved': { text: '已解决', class: 'bg-green-100 text-green-800' }
    };
    
    const status = statusMap[item.status] || { text: item.status, class: 'bg-gray-100' };
    
    // 问题摘要（截断）
    const questionPreview = item.question ? item.question.substring(0, 30) + (item.question.length > 30 ? '...' : '') : '-';
    
    return `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm">#${item.id}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">${item.typeText}</span>
            </td>
            <td class="px-6 py-4 text-sm">${item.username || '未知'}<br><span class="text-gray-400 text-xs">${item.phone || ''}</span></td>
            <td class="px-6 py-4 text-sm" title="${item.question}">${questionPreview}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded text-xs ${status.class}">${status.text}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">${formatDate(item.created_at)}</td>
            <td class="px-6 py-4">
                <button onclick="showConsultationDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm mr-2">
                    查看
                </button>
                ${item.status !== 'resolved' ? `
                    <button onclick="answerConsultation(${item.id})" class="text-green-600 hover:text-green-800 text-sm">
                        回复
                    </button>
                ` : ''}
            </td>
        </tr>
    `;
}

// 查看法律咨询详情
window.showConsultationDetail = async function(id) {
    try {
        // 从列表中找到该项
        const response = await fetch(`${API_BASE}/admin/consultations?page=1&pageSize=100`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data.list.find(c => c.id === id);
        if (!item) throw new Error('未找到该咨询');
        
        const statusMap = { 'pending': '待处理', 'processing': '处理中', 'resolved': '已解决' };
        
        let content = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><span class="text-gray-500">咨询类型:</span> ${item.typeText}</div>
                    <div><span class="text-gray-500">当前状态:</span> ${statusMap[item.status]}</div>
                    <div><span class="text-gray-500">咨询人:</span> ${item.username || '未知'}</div>
                    <div><span class="text-gray-500">联系方式:</span> ${item.contact || item.phone || '未填写'}</div>
                    <div><span class="text-gray-500">提交时间:</span> ${formatDate(item.created_at)}</div>
                </div>
                <hr>
                <div>
                    <h4 class="font-bold mb-2">咨询问题</h4>
                    <p class="p-3 bg-gray-50 rounded">${item.question || '无内容'}</p>
                </div>
        `;
        
        if (item.answer) {
            content += `
                <hr>
                <div>
                    <h4 class="font-bold mb-2">回复内容</h4>
                    <p class="p-3 bg-green-50 rounded">${item.answer}</p>
                    <div class="text-sm text-gray-500 mt-2">回复时间: ${formatDate(item.answered_at)}</div>
                </div>
            `;
        }
        
        content += '</div>';
        
        // 显示弹窗
        showModal('法律咨询详情', content, item.status !== 'resolved' ? `
            <button onclick="closeModal(); answerConsultation(${item.id})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                回复咨询
            </button>
        ` : '');
        
    } catch (error) {
        console.error('获取咨询详情失败:', error);
        alert('获取详情失败: ' + error.message);
    }
};

// 回复法律咨询
window.answerConsultation = async function(id) {
    const answer = prompt('请输入回复内容:');
    if (answer === null || !answer.trim()) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/consultations/${id}/answer`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answer: answer.trim() })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('回复成功');
        loadConsultations();
        
    } catch (error) {
        console.error('回复失败:', error);
        alert('回复失败: ' + error.message);
    }
};

// 辅助函数：格式化日期
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== 新闻分页渲染 ====================

function renderNewsPagination(pagination) {
    const container = document.getElementById('newsPagination');
    if (!container) return;
    
    if (pagination.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // 上一页
    html += `<button onclick="loadNews(${pagination.page - 1})" ${pagination.page === 1 ? 'disabled' : ''} class="px-3 py-1 border rounded mx-1 ${pagination.page === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}">上一页</button>`;
    
    // 页码
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.page) {
            html += `<span class="px-3 py-1 bg-blue-600 text-white rounded mx-1">${i}</span>`;
        } else if (i === 1 || i === pagination.totalPages || Math.abs(i - pagination.page) <= 2) {
            html += `<button onclick="loadNews(${i})" class="px-3 py-1 border rounded mx-1 hover:bg-gray-100">${i}</button>`;
        } else if (Math.abs(i - pagination.page) === 3) {
            html += `<span class="px-2">...</span>`;
        }
    }
    
    // 下一页
    html += `<button onclick="loadNews(${pagination.page + 1})" ${pagination.page === pagination.totalPages ? 'disabled' : ''} class="px-3 py-1 border rounded mx-1 ${pagination.page === pagination.totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}">下一页</button>`;
    
    // 页码信息
    html += `<span class="ml-4 text-sm text-gray-500">共 ${pagination.total} 条，${pagination.totalPages} 页</span>`;
    
    container.innerHTML = html;
}

// ==================== 成功案例管理 ====================

let currentCasePage = 1;

// 加载成功案例列表
window.loadSuccessCases = async function(page = 1) {
    currentCasePage = page;
    try {
        const response = await fetch(`${API_BASE}/admin/success-cases?page=${page}&pageSize=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const { list, pagination } = result.data;
        
        const tbody = document.getElementById('successCasesTable');
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-400">暂无成功案例</td></tr>';
        } else {
            tbody.innerHTML = list.map(item => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm">#${item.id}</td>
                    <td class="px-6 py-4 text-sm font-medium">${item.title}</td>
                    <td class="px-6 py-4 text-sm">${item.case_type || '-'}</td>
                    <td class="px-6 py-4 text-sm">${item.result || '-'}</td>
                    <td class="px-6 py-4 text-sm">${item.amount ? '¥' + parseFloat(item.amount).toLocaleString() : '-'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(item.created_at)}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">${item.is_published ? '已发布' : '未发布'}</span>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex space-x-2">
                            <button onclick="viewSuccessCaseDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm" title="查看">👁️</button>
                            <button onclick="editSuccessCase(${item.id})" class="text-green-600 hover:text-green-800 text-sm" title="编辑">✏️</button>
                            <button onclick="deleteSuccessCase(${item.id})" class="text-red-600 hover:text-red-800 text-sm" title="删除">🗑️</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        // 渲染分页
        renderSuccessCasesPagination(pagination);
        
    } catch (error) {
        console.error('加载成功案例失败:', error);
        document.getElementById('casesTable').innerHTML = 
            `<tr><td colspan="8" class="px-6 py-8 text-center text-red-500">加载失败: ${error.message}</td></tr>`;
    }
};

// 渲染成功案例分页
function renderSuccessCasesPagination(pagination) {
    const container = document.getElementById('successCasesPagination');
    if (!container) return;
    
    if (pagination.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // 上一页
    html += `<button onclick="loadSuccessCases(${pagination.page - 1})" ${pagination.page === 1 ? 'disabled' : ''} class="px-3 py-1 border rounded mx-1 ${pagination.page === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}">上一页</button>`;
    
    // 页码
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === pagination.page) {
            html += `<span class="px-3 py-1 bg-blue-600 text-white rounded mx-1">${i}</span>`;
        } else if (i === 1 || i === pagination.totalPages || Math.abs(i - pagination.page) <= 2) {
            html += `<button onclick="loadSuccessCases(${i})" class="px-3 py-1 border rounded mx-1 hover:bg-gray-100">${i}</button>`;
        } else if (Math.abs(i - pagination.page) === 3) {
            html += `<span class="px-2">...</span>`;
        }
    }
    
    // 下一页
    html += `<button onclick="loadSuccessCases(${pagination.page + 1})" ${pagination.page === pagination.totalPages ? 'disabled' : ''} class="px-3 py-1 border rounded mx-1 ${pagination.page === pagination.totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}">下一页</button>`;
    
    // 页码信息
    html += `<span class="ml-4 text-sm text-gray-500">共 ${pagination.total} 条，${pagination.totalPages} 页</span>`;
    
    container.innerHTML = html;
}

// 显示添加成功案例模态框
window.showCaseModal = function() {
    const content = `
        <form id="successCaseForm" class="space-y-4">
            <div>
                <label class="block text-sm font-medium mb-1">案例标题</label>
                <input type="text" id="caseTitle" class="w-full border rounded px-3 py-2" placeholder="请输入案例标题" required>
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">案件类型</label>
                <input type="text" id="caseType" class="w-full border rounded px-3 py-2" placeholder="如：数据侵权、合同纠纷等">
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">维权结果</label>
                <input type="text" id="caseResult" class="w-full border rounded px-3 py-2" placeholder="如：获得赔偿50万元">
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">涉案金额（元）</label>
                <input type="number" id="caseAmount" class="w-full border rounded px-3 py-2" placeholder="请输入金额">
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">案例描述</label>
                <textarea id="caseDescription" class="w-full border rounded px-3 py-2 h-24" placeholder="请输入案例详细描述"></textarea>
            </div>
        </form>
    `;
    
    showModal('添加成功案例', content, `
        <button onclick="submitSuccessCase()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            保存
        </button>
    `);
};

// 提交成功案例
window.submitSuccessCase = async function() {
    const title = document.getElementById('caseTitle').value.trim();
    const caseType = document.getElementById('caseType').value.trim();
    const result = document.getElementById('caseResult').value.trim();
    const amount = document.getElementById('caseAmount').value;
    const description = document.getElementById('caseDescription').value.trim();
    
    if (!title) {
        alert('请输入案例标题');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/success-cases`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                caseType,
                result,
                amount: amount ? parseFloat(amount) : null,
                description
            })
        });
        
        const res = await response.json();
        if (!res.success) throw new Error(res.message);
        
        alert('案例添加成功');
        closeModal();
        loadSuccessCases();
        
    } catch (error) {
        console.error('添加案例失败:', error);
        alert('添加失败: ' + error.message);
    }
};

// 查看成功案例详情
window.viewSuccessCaseDetail = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/success-cases?page=1&pageSize=100`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data.list.find(c => c.id === id);
        if (!item) throw new Error('案例不存在');
        
        const content = `
            <div class="space-y-4">
                <div><span class="text-gray-500">标题:</span> ${item.title}</div>
                <div><span class="text-gray-500">类型:</span> ${item.case_type || '-'}</div>
                <div><span class="text-gray-500">结果:</span> ${item.result || '-'}</div>
                <div><span class="text-gray-500">金额:</span> ${item.amount ? '¥' + parseFloat(item.amount).toLocaleString() : '-'}</div>
                <div><span class="text-gray-500">描述:</span></div>
                <div class="p-3 bg-gray-50 rounded">${item.description || '无描述'}</div>
            </div>
        `;
        
        showModal('案例详情', content, `
            <button onclick="closeModal(); editSuccessCase(${item.id})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                编辑
            </button>
        `);
        
    } catch (error) {
        console.error('获取案例详情失败:', error);
        alert('获取详情失败: ' + error.message);
    }
};

// 编辑成功案例
window.editSuccessCase = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/success-cases?page=1&pageSize=100`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data.list.find(c => c.id === id);
        if (!item) throw new Error('案例不存在');
        
        const content = `
            <form id="editSuccessCaseForm" class="space-y-4">
                <input type="hidden" id="editSuccessCaseId" value="${item.id}">
                <div>
                    <label class="block text-sm font-medium mb-1">案例标题</label>
                    <input type="text" id="editSuccessCaseTitle" class="w-full border rounded px-3 py-2" value="${item.title}" required>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">案件类型</label>
                    <input type="text" id="editSuccessCaseType" class="w-full border rounded px-3 py-2" value="${item.case_type || ''}">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">维权结果</label>
                    <input type="text" id="editSuccessCaseResult" class="w-full border rounded px-3 py-2" value="${item.result || ''}">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">涉案金额（元）</label>
                    <input type="number" id="editSuccessCaseAmount" class="w-full border rounded px-3 py-2" value="${item.amount || ''}">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">案例描述</label>
                    <textarea id="editSuccessCaseDescription" class="w-full border rounded px-3 py-2 h-24">${item.description || ''}</textarea>
                </div>
            </form>
        `;
        
        showModal('编辑案例', content, `
            <button onclick="updateSuccessCase()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                保存修改
            </button>
        `);
        
    } catch (error) {
        console.error('获取案例失败:', error);
        alert('获取失败: ' + error.message);
    }
};

// 更新成功案例
window.updateSuccessCase = async function() {
    const id = document.getElementById('editSuccessCaseId').value;
    const title = document.getElementById('editSuccessCaseTitle').value.trim();
    const caseType = document.getElementById('editSuccessCaseType').value.trim();
    const result = document.getElementById('editSuccessCaseResult').value.trim();
    const amount = document.getElementById('editSuccessCaseAmount').value;
    const description = document.getElementById('editSuccessCaseDescription').value.trim();
    
    if (!title) {
        alert('请输入案例标题');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/success-cases/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                caseType,
                result,
                amount: amount ? parseFloat(amount) : null,
                description
            })
        });
        
        const res = await response.json();
        if (!res.success) throw new Error(res.message);
        
        alert('案例更新成功');
        closeModal();
        loadSuccessCases();
        
    } catch (error) {
        console.error('更新案例失败:', error);
        alert('更新失败: ' + error.message);
    }
};

// 删除成功案例
window.deleteSuccessCase = async function(id) {
    if (!confirm('确定要删除这个案例吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/success-cases/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert('删除成功');
        loadSuccessCases();
        
    } catch (error) {
        console.error('删除案例失败:', error);
        alert('删除失败: ' + error.message);
    }
};
