// ===============================================================
// 请在这里替换成你自己的凭证
// ===============================================================
const AIRTABLE_TOKEN = "patFo2wrzCxbCdyWd.a799c046a822e0b5fba5058fee75b8b51990dcd5f806115012c82197b56b1321"; 
const AIRTABLE_BASE_ID = "appCxxXUwMyifQYY9";            
const AIRTABLE_TABLE_NAME = "Codes"; 
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
        
        const usedCount = fields.UsedCount || 0;
        const totalChances = 4;
        const remaining = Math.max(0, totalChances - usedCount);

        const codeItem = document.createElement('div');
        codeItem.className = 'code-item';
        codeItem.id = `code-${record.id}`;
        
        let statusText = `可用次数: ${remaining}/${totalChances}`;
        let statusColor = '#27ae60'; // Green

        if (remaining === 0) {
            statusText = `可能已用完`;
            statusColor = '#f39c12'; // Orange
        }

        // ***** 主要修改点 *****
        // HTML 中已移除“报告无效”按钮
        codeItem.innerHTML = `
            <div class="code-info">
                <p class="code-text">${fields.Code}</p>
                <p class="code-status" style="color: ${statusColor};">${statusText}</p>
            </div>
            <div class="code-actions">
                <button onclick="markAsUsed(event, '${record.id}', ${usedCount})">复制 & 标记使用</button>
            </div>
        `;
        codeListDiv.appendChild(codeItem);
    });
}

// 获取所有邀请码
async function fetchCodes() {
    codeListDiv.innerHTML = '<p class="code-item-placeholder">正在努力加载邀请码...</p>';
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
    const submitButton = e.target.querySelector('button');
    submitButton.disabled = true;
    submitButton.textContent = '分享中...';

    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
        alert('请输入一个6位数的邀请码！');
        submitButton.disabled = false;
        submitButton.textContent = '分享';
        return;
    }

    const newRecord = {
        fields: {
            "Code": code,
            "UsedCount": 0
        }
    };

    const data = await airtableFetch(airtableUrl, 'POST', { records: [newRecord] });
    if (data) {
        alert('分享成功，感谢你的贡献！');
        codeInput.value = '';
        fetchCodes();
    }
    submitButton.disabled = false;
    submitButton.textContent = '分享';
});

// 标记为已使用
async function markAsUsed(event, recordId, currentUsedCount) {
    const recordText = event.target.closest('.code-item').querySelector('.code-text').innerText;
    navigator.clipboard.writeText(recordText).then(() => {
        alert('邀请码已复制到剪贴板！');
    });

    const newUsedCount = (currentUsedCount || 0) + 1;
    const fieldsToUpdate = {
        "UsedCount": newUsedCount
    };

    const codeItem = document.getElementById(`code-${recordId}`);
    if(codeItem) {
        const statusElement = codeItem.querySelector('.code-status');
        if (newUsedCount < 4) {
             statusElement.textContent = `可用次数: ${4 - newUsedCount}/4`;
        } else {
            statusElement.textContent = '可能已用完';
            statusElement.style.color = '#f39c12';
        }
    }
    
    airtableFetch(`${airtableUrl}/${recordId}`, 'PATCH', { fields: fieldsToUpdate });
}

// reportInvalid 函数已被完全移除

// 初始化
fetchCodes();
