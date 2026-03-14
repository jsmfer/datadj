/**
 * 维权提交诊断脚本
 * 在浏览器控制台(F12)中运行此脚本进行诊断
 */

async function diagnoseProtectionSubmit() {
    console.log('=== 维权提交诊断开始 ===\n');
    
    // 1. 检查登录状态
    console.log('1. 检查登录状态...');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    console.log('   Token存在:', !!token);
    if (token) {
        console.log('   Token前30字符:', token.substring(0, 30) + '...');
    } else {
        console.error('   ❌ 未登录，请先登录');
        return;
    }
    
    // 2. 检查表单字段
    console.log('\n2. 检查表单字段...');
    const fields = ['caseTitle', 'applicantName', 'applicantPhone', 'dataProperty', 'infringementType', 'infringementDescription'];
    const values = {};
    let allValid = true;
    
    for (let id of fields) {
        const el = document.getElementById(id);
        if (!el) {
            console.error(`   ❌ 找不到字段: ${id}`);
            allValid = false;
            continue;
        }
        const value = el.value.trim();
        values[id] = value;
        console.log(`   ${id}: "${value.substring(0, 30)}${value.length > 30 ? '...' : ''}" ${value ? '✅' : '❌'}`);
        if (!value) allValid = false;
    }
    
    if (!allValid) {
        console.error('\n   ❌ 有字段为空，请填写所有必填项');
        return;
    }
    
    // 3. 准备提交数据
    console.log('\n3. 准备提交数据...');
    const dataProperty = document.getElementById('dataProperty');
    const selectedOption = dataProperty.options[dataProperty.selectedIndex];
    
    let registrationTitle = '其他数据产权';
    if (dataProperty.value && dataProperty.value !== 'other') {
        registrationTitle = selectedOption ? selectedOption.text : '未知数据';
    } else if (dataProperty.value === 'other') {
        const otherInput = document.getElementById('otherProperty');
        if (otherInput && otherInput.value.trim()) {
            registrationTitle = otherInput.value.trim();
        }
    }
    
    const submitData = {
        title: values.caseTitle,
        applicantName: values.applicantName,
        applicantPhone: values.applicantPhone,
        registrationId: dataProperty.value === 'other' ? null : dataProperty.value,
        registrationTitle: registrationTitle,
        infringementType: values.infringementType,
        description: values.infringementDescription,
        infringerInfo: document.getElementById('infringerInfo')?.value?.trim() || '',
        expectedSolution: '待确认'
    };
    
    console.log('   提交数据:', JSON.stringify(submitData, null, 2));
    
    // 4. 测试API调用
    console.log('\n4. 测试API调用...');
    try {
        const result = await ProtectionAPI.create(submitData);
        console.log('   API返回:', result);
        if (result.success) {
            console.log('\n   ✅ 提交成功！案件编号:', result.data.caseNo);
        } else {
            console.error('\n   ❌ 提交失败:', result.message);
        }
    } catch (e) {
        console.error('\n   ❌ API调用异常:', e.message);
        console.error('   错误详情:', e);
    }
    
    console.log('\n=== 诊断完成 ===');
}

// 自动运行
diagnoseProtectionSubmit();
