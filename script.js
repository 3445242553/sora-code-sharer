// START: 修改点 - 使用 import 方式加载 FingerprintJS
import FingerprintJS from 'https://fpcdn.io/v3/esm.min.js';
// END: 修改点

// ===============================================================
// 您的凭证（请注意，暴露在前端有安全风险）
// ===============================================================
const AIRTABLE_TOKEN = "patFo2wrzCxbCdyWd.a799c046a822e0b5fba5058fee75b8b51990dcd5f806115012c82197b56b1321"; 
const AIRTABLE_BASE_ID = "appCxxXUwMyifQYY9";            
const AIRTABLE_TABLE_NAME = "Codes"; 
// ===============================================================

const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;
const codeListDiv = document.getElementById('code-list');
const submitForm = document.getElementById('submit-form');
const codeInput = document.getElementById('code-input');
let visitorId = null;

async function initFingerprintJS() {
    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        visitorId = result.visitorId;
        console.log('设备指纹ID:', visitorId);

        const submitButton = submitForm.querySelector('button');
        const input = submitForm.querySelector('input');
        
        if (localStorage.getItem('hasSubmittedSoraCode') !== 'true') {
            input.disabled = false;
            input.placeholder = '请输入6位Sora邀请码';
            submitButton.disabled = false;
            submitButton.textContent = '分享';
        }
    } catch (error) {
        console.error("FingerprintJS 初始化失败:", error);
        const submitButton = submitForm.querySelector('button');
        submitButton.textContent = '初始化失败';
        codeInput.placeholder = '无法验证设备';
    }
}

function checkSubmissionStatus() {
    if (localStorage.getItem('hasSubmittedSoraCode') === 'true') {
        const submitButton = submitForm.querySelector('button');
        const input = submitForm.querySelector('input');
        input.disabled = true;
        input.placeholder = '您已经分享过邀请码了';
        submitButton.disabled = true;
        submitButton.textContent = '已分享';
    }
}

async function airtableFetch(url, method = 'GET', body = null) {
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
    };
    const options = { method, headers };
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

function renderCodes(records) {
    codeListDiv.innerHTML = '';
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
        let statusColor = '#27ae60';
        if (remaining === 0) {
            statusText = `可能已用完`;
            statusColor = '#f39c12';
        }
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

async function fetchCodes() {
    codeListDiv.innerHTML = '<p class="code-item-placeholder">正在努力加载邀请码...</p>';
    const data = await airtableFetch(`${airtableUrl}?sort%5B0%5D%5Bfield%5D=CreatedAt&sort%5B0%5D%5Bdirection%5D=desc`);
    if (data && data.records) {
        renderCodes(data.records);
    } else {
        codeListDiv.innerHTML = '<p class="code-item-placeholder">加载邀请码失败，请检查网络或API设置。</p>';
    }
}

submitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button');
    submitButton.disabled = true;
    submitButton.textContent = '校验中...';

    if (!visitorId) {
        alert('设备信息仍在初始化，请刷新页面或稍等片刻再试。');
        submitButton.disabled = false;
        submitButton.textContent = '分享';
        return;
    }
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 6) {
        alert('请输入一个6位数的邀请码！');
        submitButton.disabled = false;
        submitButton.textContent = '分享';
        return;
    }
    const hasChinese = /[\u4e00-\u9fa5]/.test(code);
    if (hasChinese) {
        alert('邀请码不能包含汉字！');
        submitButton.disabled = false;
        submitButton.textContent = '分享';
        return;
    }
    const checkFingerprintUrl = `${airtableUrl}?filterByFormula={Fingerprint}="${visitorId}"`;
    const existingFingerprintRecords = await airtableFetch(checkFingerprintUrl);
    if (existingFingerprintRecords && existingFingerprintRecords.records.length > 0) {
        alert('感谢您的热情，但每个设备只能分享一次哦！');
        localStorage.setItem('hasSubmittedSoraCode', 'true');
        checkSubmissionStatus();
        return;
    }
    const checkCodeUrl = `${airtableUrl}?filterByFormula={Code}="${code}"`;
    const existingCodeRecords = await airtableFetch(checkCodeUrl);
    if (existingCodeRecords && existingCodeRecords.records.length > 0) {
        alert('这个邀请码已经被其他人分享过了，请不要重复提交！');
        submitButton.disabled = false;
        submitButton.textContent = '分享';
        return;
    }
    submitButton.textContent = '分享中...';
    const newRecord = {
        fields: {
            "Code": code,
            "UsedCount": 0,
            "Fingerprint": visitorId,
            "SubmitterIP": "N/A"
        }
    };
    const data = await airtableFetch(airtableUrl, 'POST', { records: [newRecord] });
    if (data) {
        alert('分享成功，感谢你的贡献！');
        localStorage.setItem('hasSubmittedSoraCode', 'true');
        checkSubmissionStatus();
        codeInput.value = '';
        fetchCodes();
    } else {
        submitButton.disabled = false;
        submitButton.textContent = '分享';
    }
});

async function markAsUsed(event, recordId, currentUsedCount) {
    const recordText = event.target.closest('.code-item').querySelector('.code-text').innerText;
    navigator.clipboard.writeText(recordText).then(() => {
        alert('邀请码已复制到剪贴板！');
    });
    const newUsedCount = (currentUsedCount || 0) + 1;
    const fieldsToUpdate = { "UsedCount": newUsedCount };
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

// START: 修改点 - 初始化调用
checkSubmissionStatus();
fetchCodes();
initFingerprintJS();
// END: 修改点
