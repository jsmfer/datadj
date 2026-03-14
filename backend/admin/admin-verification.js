/**
 * 管理员认证审核功能
 */

// 加载认证申请列表
window.loadVerificationApplications = async function(page = 1) {
    const type = document.getElementById('verificationTypeFilter')?.value || '';
    const status = document.getElementById('verificationStatusFilter')?.value || '';
    
    try {
        const response = await fetch(`${API_BASE}/admin/verification/applications?page=${page}&type=${type}&status=${status}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const { list, pagination } = result.data;
        
        // 渲染表格
        const tbody = document.getElementById('verificationTable');
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400">暂无认证申请</td></tr>';
        } else {
            tbody.innerHTML = list.map(item => renderVerificationRow(item)).join('');
        }
        
        // 渲染分页
        document.getElementById('verificationPagination').innerHTML = 
            renderPagination(pagination, 'loadVerificationApplications');
        
    } catch (error) {
        console.error('加载认证申请失败:', error);
        document.getElementById('verificationTable').innerHTML = 
            `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">加载失败: ${error.message}</td></tr>`;
    }
};

// 渲染认证申请行
function renderVerificationRow(item) {
    const typeMap = {
        'personal': { text: '个人认证', class: 'bg-blue-100 text-blue-800' },
        'enterprise': { text: '企业认证', class: 'bg-purple-100 text-purple-800' }
    };
    
    const statusMap = {
        'pending': { text: '待审核', class: 'bg-yellow-100 text-yellow-800' },
        'approved': { text: '已通过', class: 'bg-green-100 text-green-800' },
        'rejected': { text: '已拒绝', class: 'bg-red-100 text-red-800' }
    };
    
    const type = typeMap[item.type] || { text: item.type, class: 'bg-gray-100' };
    const status = statusMap[item.status] || { text: item.status, class: 'bg-gray-100' };
    
    const info = item.type === 'personal' 
        ? `${item.real_name || '未填写'} | ${item.id_card || '未填写'}`
        : `${item.enterprise_name || '未填写'} | ${item.credit_code || '未填写'}`;
    
    return `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm">#${item.id}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded text-xs ${type.class}">${type.text}</span>
            </td>
            <td class="px-6 py-4 text-sm">${item.username || '未知'}<br><span class="text-gray-400">${item.phone || ''}</span></td>
            <td class="px-6 py-4 text-sm" title="${info}">${truncateText(info, 25)}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded text-xs ${status.class}">${status.text}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">${formatDate(item.created_at)}</td>
            <td class="px-6 py-4">
                <button onclick="showVerificationDetail(${item.id})" class="text-blue-600 hover:text-blue-800 text-sm mr-2">
                    查看
                </button>
                ${item.status === 'pending' ? `
                    <button onclick="reviewVerification(${item.id}, 'approved')" class="text-green-600 hover:text-green-800 text-sm mr-2">
                        通过
                    </button>
                    <button onclick="reviewVerification(${item.id}, 'rejected')" class="text-red-600 hover:text-red-800 text-sm">
                        拒绝
                    </button>
                ` : ''}
            </td>
        </tr>
    `;
}

// 查看认证申请详情
window.showVerificationDetail = async function(id) {
    try {
        const response = await fetch(`${API_BASE}/admin/verification/applications/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        const item = result.data;
        
        const typeMap = { 'personal': '个人认证', 'enterprise': '企业认证' };
        const statusMap = { 'pending': '待审核', 'approved': '已通过', 'rejected': '已拒绝' };
        
        let content = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><span class="text-gray-500">申请类型:</span> ${typeMap[item.type] || item.type}</div>
                    <div><span class="text-gray-500">当前状态:</span> ${statusMap[item.status] || item.status}</div>
                    <div><span class="text-gray-500">申请人:</span> ${item.username || '未知'}</div>
                    <div><span class="text-gray-500">手机号:</span> ${item.phone || '未填写'}</div>
                    <div><span class="text-gray-500">申请时间:</span> ${formatDate(item.created_at)}</div>
                </div>
                <hr>
        `;
        
        if (item.type === 'personal') {
            content += `
                <h4 class="font-bold">个人认证信息</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div><span class="text-gray-500">真实姓名:</span> ${item.real_name || '未填写'}</div>
                    <div><span class="text-gray-500">身份证号:</span> ${item.id_card || '未填写'}</div>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <p class="text-gray-500 text-sm mb-2">身份证正面:</p>
                        ${item.id_card_front ? `<img src="${item.id_card_front}" class="max-w-full h-40 object-contain border rounded">` : '<span class="text-gray-400">未上传</span>'}
                    </div>
                    <div>
                        <p class="text-gray-500 text-sm mb-2">身份证反面:</p>
                        ${item.id_card_back ? `<img src="${item.id_card_back}" class="max-w-full h-40 object-contain border rounded">` : '<span class="text-gray-400">未上传</span>'}
                    </div>
                </div>
            `;
        } else {
            content += `
                <h4 class="font-bold">企业认证信息</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div><span class="text-gray-500">企业名称:</span> ${item.enterprise_name || '未填写'}</div>
                    <div><span class="text-gray-500">统一社会信用代码:</span> ${item.credit_code || '未填写'}</div>
                    <div><span class="text-gray-500">法人姓名:</span> ${item.legal_person_name || '未填写'}</div>
                    <div><span class="text-gray-500">法人身份证:</span> ${item.legal_person_id_card || '未填写'}</div>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <p class="text-gray-500 text-sm mb-2">营业执照:</p>
                        ${item.business_license ? `<img src="${item.business_license}" class="max-w-full h-40 object-contain border rounded">` : '<span class="text-gray-400">未上传</span>'}
                    </div>
                    <div>
                        <p class="text-gray-500 text-sm mb-2">授权函:</p>
                        ${item.authorization_letter ? `<img src="${item.authorization_letter}" class="max-w-full h-40 object-contain border rounded">` : '<span class="text-gray-400">未上传</span>'}
                    </div>
                </div>
            `;
        }
        
        if (item.review_comment) {
            content += `
                <hr>
                <div>
                    <span class="text-gray-500">审核意见:</span>
                    <p class="mt-1 p-3 bg-gray-50 rounded">${item.review_comment}</p>
                </div>
            `;
        }
        
        content += '</div>';
        
        // 显示弹窗
        showModal('认证申请详情', content, item.status === 'pending' ? `
            <button onclick="closeModal(); reviewVerification(${item.id}, 'approved')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                审核通过
            </button>
            <button onclick="closeModal(); reviewVerification(${item.id}, 'rejected')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded ml-2">
                拒绝
            </button>
        ` : '');
        
    } catch (error) {
        console.error('获取认证详情失败:', error);
        alert('获取详情失败: ' + error.message);
    }
};

// 审核认证申请
window.reviewVerification = async function(id, status) {
    const comment = prompt(status === 'approved' ? '请输入审核通过意见（可选）:' : '请输入拒绝原因:');
    if (comment === null) return; // 用户取消
    
    if (status === 'rejected' && !comment.trim()) {
        alert('拒绝时必须填写原因');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/verification/applications/${id}/review`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, comment: comment.trim() || undefined })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        alert(result.message || '审核完成');
        loadVerificationApplications();
        
    } catch (error) {
        console.error('审核失败:', error);
        alert('审核失败: ' + error.message);
    }
};

// 辅助函数：截断文本
function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

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

// 显示弹窗
function showModal(title, content, footer = '') {
    // 移除已存在的弹窗
    const existingModal = document.getElementById('adminModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'adminModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div class="p-6 border-b flex justify-between items-center">
                <h3 class="text-xl font-bold">${title}</h3>
                <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="p-6 overflow-y-auto max-h-[60vh]">
                ${content}
            </div>
            ${footer ? `<div class="p-6 border-t flex justify-end">${footer}</div>` : ''}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// 关闭弹窗
window.closeModal = function() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.remove();
};
