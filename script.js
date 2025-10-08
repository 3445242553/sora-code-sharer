// ===============================================================
// 您的凭证（请注意，暴露在前端有安全风险）
// ===============================================================
const AIRTABLE_TOKEN = "patFo2wrzCxbCdyWd.a799c046a822e0b5fba5058fee75b8b51990dcd5f806115012c82197b56b1321"; 
const AIRTABLE_BASE_ID = "appCxxXUwMyifQYY9";            
const AIRTABLE_TABLE_NAME = "Codes"; 
const BANNED_USERS_TABLE_NAME = "BannedUsers";
// ===============================================================

const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;
const bannedUsersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BANNED_USERS_TABLE_NAME}`;

const codeListDiv = document.getElementById('code-list');
const submitForm = document.getElementById('submit-form');
const codeInput = document.getElementById('code-input');
let visitorId = null;

// FingerprintJS 初始化函数
async function initFingerprintJS() {
    try {
        const fpPromise = FingerprintJS.load();
        const fp = await fpPromise;
        const result = await fp.get();
        visitorId = result.visitorId;
        console.log('设备指纹ID:', visitorId);

        // 初始化后，先检查是否被封锁
        const isBanned = await checkIfBanned(visitorId);
        if (isBanned) {
            document.body.innerHTML = '<h1 style="text-align: center; margin-top: 50px;">您已被限制访问</h1>';
            return; // 阻断后续所有操作
        }

        // 如果未被封锁，则继续正常流程
        const submitButton = submitForm.querySelector('button');
        const input = submitForm.querySelector('input');
        
        if (localStorage.getItem('hasSubmittedSoraCode') !== 'true') {
            input.disabled = false;
            input.placeholder = '请输入6位邀请码 (字母+数字)'; 
            submitButton.disabled = false;
            submitButton.textContent = '分享';
        }
        
        checkSubmissionStatus();
        fetchCodes(); 

    } catch (error) {
        console.error("FingerprintJS 初始化失败:", error);
        const submitButton = submitForm.querySelector('button');
        submitButton.textContent = '初始化失败';
        codeInput.placeholder = '无法验证设备';
    }
}

// 检查用户是否在黑名单中
async function checkIfBanned(fingerprint) {
    if (!fingerprint) return false;
    const filter = `filterByFormula={Fingerprint}='${fingerprint}'`;
    const data = await airtableFetch(`${bannedUsersUrl}?${filter}`);
    return data && data.records && data.records.length > 0;
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
        codeListDiv.innerHTML = '<p class="code-item-placeholder">目前没有可用的邀请码，感谢您的耐心等待。</p>';
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

// 获取邀请码列表 (逻辑不变，但现在因为好码直接可见，所以效果不同了)
async function fetchCodes() {
    if (!visitorId) return; 
    codeListDiv.innerHTML = '<p class="code-item-placeholder">正在努力加载邀请码...</p>';
    
    // 注意：这个查询依然只拉取 "Visible" 的码，因为我们不希望显示其他状态的码
    const filter = `filterByFormula={Visibility}='Visible'`;
    const sort = "sort%5B0%5D%5Bfield%5D=CreatedAt&sort%5B0%5D%5Bdirection%5D=desc";
    const data = await airtableFetch(`${airtableUrl}?${filter}&${sort}`);

    if (data && data.records) {
        renderCodes(data.records);
    } else {
        codeListDiv.innerHTML = '<p class="code-item-placeholder">加载邀请码失败，请检查网络或API设置。</p>';
    }
}

codeInput.addEventListener('input', () => {
    let value = codeInput.value;
    value = value.toUpperCase();
    value = value.replace(/[^A-Z0-9]/g, '');
    codeInput.value = value;
});

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
    const code = codeInput.value.trim();

    if (code.length !== 6) {
        alert('请输入一个6位数的邀请码！');
        submitButton.disabled = false;
        submitButton.textContent = '分享';
        return;
    }
    const isAlphanumeric = /^[A-Z0-9]{6}$/.test(code);
    if (!isAlphanumeric) {
        alert('邀请码只能包含字母和数字！');
        submitButton.disabled = false;
        submitButton.textContent = '分享';
        return;
    }

    const isPureNumber = /^[0-9]{6}$/.test(code);

    if (isPureNumber) {
        // --- 提交了纯数字，执行封锁 ---
        submitButton.textContent = '处理中...';
        
        const banRecord = { fields: { "Fingerprint": visitorId } };
        await airtableFetch(bannedUsersUrl, 'POST', { records: [banRecord] });

        alert('提交失败：不支持纯数字邀请码。您的设备已被限制访问。');
        document.body.innerHTML = '<h1 style="text-align: center; margin-top: 50px;">您已被限制访问</h1>';
        return;

    } else {
        // --- 提交了字母+数字，直接分享 ---
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

        // START: 核心修改点 - 状态直接设为 "Visible"
        const newRecord = {
            fields: {
                "Code": code,
                "UsedCount": 0,
                "Fingerprint": visitorId,
                "SubmitterIP": "N/A",
                "Visibility": "Visible" // 直接设为可见
            }
        };
        // END: 核心修改点

        const data = await airtableFetch(airtableUrl, 'POST', { records: [newRecord] });
        if (data) {
            // START: 核心修改点 - 更新成功提示
            alert('分享成功！感谢您的贡献。');
            // END: 核心修改点
            localStorage.setItem('hasSubmittedSoraCode', 'true');
            checkSubmissionStatus();
            codeInput.value = '';
            fetchCodes(); // 立即刷新列表，让所有人看到新码
        } else {
            submitButton.disabled = false;
            submitButton.textContent = '分享';
        }
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

// 初始化调用
initFingerprintJS();
