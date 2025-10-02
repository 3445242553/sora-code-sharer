// ===============================================================
// 请在这里替换成你自己的凭证
// ===============================================================
const AIRTABLE_TOKEN = "patFo2wrzCxbCdyWd.a799c046a822e0b5fba5058fee75b8b51990dcd5f806115012c82197b56b1321"; // 替换成你的 Personal Access Token
const AIRTABLE_BASE_ID = "appCxxXUwMyifQYY9";             // 替换成你的 Base ID
const AIRTABLE_TABLE_NAME = "Codes";                         // 你的表名，应该就是 "Codes"
// ===============================================================
// 下面的代码不需要修改
// ===============================================================

const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;
const codeListDiv = document.getElementById('code-list');
const submitForm = document.getElementById('submit-form');
const codeInput = document.getElementById('code-input');

// 封装一个 fetch 函数用于和 Airtable 交互
async function airtableFetch(url, method = 'GET', body = null) {
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
    };

    const options = {
        method: method,
        headers: headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Airtable API Error: ${errorData.error.message}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch Error:', error);
        alert(`与服务器通信失败: ${error.message}`);
        return null;
    }
}


// 渲染邀请码列表到页面上
function renderCodes(records) {
    codeListDiv.innerHTML = ''; // 清空旧内容
    if (!records || records.length === 0) {
        codeListDiv.innerHTML = '<p class="code-item-placeholder">目前没有可用的邀请码，快来分享一个吧！</p>';
        return;
    }

    records.forEach(record => {
        const fields = record.fields;
        
        // 跳过状态为“已失效”的码
        if (fields.Status === '已失效') {
            return; 
        }

        const usedCount = fields.UsedCount || 0;
        const totalChances = 4;
        const remaining = Math.max(0, totalChances - usedCount);

        const codeItem = document.createElement('div');
        codeItem.className = 'code-item';
        
        let statusText = `可用次数: ${remaining}/${totalChances}`;
        let statusColor = '#27ae60'; // Green

        if (remaining === 0) {
            statusText = `可能已用完`;
            statusColor = '#f39c12'; // Orange
        }
        if (fields.Status === '可能已用完') {
            statusText = `可能已用完 (由用户报告)`;
            statusColor = '#f39c12'; // Orange
        }

        codeItem.innerHTML = `
            <div class="code-info">
                <p class="code-text">${fields.Code}</p>
                <p class="code-status" style="color: ${statusColor};">${statusText}</p>
            </div>
            <div class="code-actions">
                <button onclick="markAsUsed('${record.id}', ${usedCount})">复制 & 标记使用</button>
                <button class="report-btn" onclick="reportInvalid('${record.id}')">报告无效</button>
            </div>
        `;
        codeListDiv.appendChild(codeItem);
    });
}

// 获取所有邀请码
async function fetchCodes() {
    // 按创建时间倒序排序，最新的在最前面
    const data = await airtableFetch(`${airtableUrl}?sort%5B0%5D%5Bfield%5D=CreatedAt&sort%5B0%5D%5Bdirection%5D=desc`);
    if (data && data.records) {
        renderCodes(data.records);
    } else {
        codeListDiv.innerHTML = '<p class="code-item-placeholder">加载邀请码失败，请检查网络或API设置。</p>';
    }
}

// 提交新邀请码
submitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
        alert('请输入一个6位数的邀请码！');
        return;
    }

    const newRecord = {
        fields: {
            "Code": code,
            "Status": "可用",
            "UsedCount": 0,
            "ReportedInvalid": 0
        }
    };

    const data = await airtableFetch(airtableUrl, 'POST', { records: [newRecord] });
    if (data) {
        alert('分享成功，感谢你的贡献！');
        codeInput.value = '';
        fetchCodes(); // 重新加载列表
    }
});

// 标记为已使用
async function markAsUsed(recordId, currentUsedCount) {
    const record = window.event.target.closest('.code-item').querySelector('.code-text').innerText;
    navigator.clipboard.writeText(record).then(() => {
        alert('邀请码已复制到剪贴板！');
    });

    const newUsedCount = (currentUsedCount || 0) + 1;
    const fieldsToUpdate = {
        "UsedCount": newUsedCount
    };

    // 如果使用次数达到4次，自动更新状态
    if (newUsedCount >= 4) {
        fieldsToUpdate.Status = "可能已用完";
    }

    const data = await airtableFetch(`${airtableUrl}/${recordId}`, 'PATCH', { fields: fieldsToUpdate });
    if (data) {
        fetchCodes(); // 更新成功后刷新列表
    }
}

// 报告无效
async function reportInvalid(recordId) {
    if (!confirm('确定要将此码报告为无效吗？这会帮助其他用户。')) {
        return;
    }
    const fieldsToUpdate = {
        "Status": "已失效" // 简化处理，报告一次即失效
    };
    
    const data = await airtableFetch(`${airtableUrl}/${recordId}`, 'PATCH', { fields: fieldsToUpdate });
    if (data) {
        alert('感谢你的反馈！');
        fetchCodes(); // 更新成功后刷新列表
    }
}


// 初始化：页面加载时立即获取邀请码
fetchCodes();