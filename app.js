/**
 * 每日復盤與時間手帳 - Core Application Logic
 * 支援全平台自適應、歷史復盤翻閱檢索庫、PWA 離線快取、跨設備 (手機/電腦) 雲端智慧同步
 */

// --- 全域狀態管理 ---
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
let currentDateStr = getTodayDateStr(); // 格式: YYYY-MM-DD
let currentDayData = null;
let currentView = 'today'; // 'today' | 'history'
let historySearchTerm = '';
let historyRangeFilter = 'all'; // 'all' | '7days' | '30days' | 'thisMonth'

// 雲端同步狀態
let cloudSyncTimer = null;
let isSyncing = false;

// --- PWA Service Worker 註冊 ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('Service Worker 註冊略過或受限環境:', err);
    });
  });
}

// 取得今天 YYYY-MM-DD 字串
function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 取得當前時間 HH:mm 字串
function getCurrentTimeStr() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// 嚴格校正並格式化為 24 小時制時間字串 (HH:mm)
function format24hTime(val) {
  if (!val) return '';
  val = String(val).trim();
  // 已經是合法 HH:mm (00:00 ~ 23:59)
  const exactMatch = val.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (exactMatch) {
    const h = exactMatch[1].padStart(2, '0');
    const m = exactMatch[2];
    return `${h}:${m}`;
  }
  // 帶冒號但分鐘僅一位 (如 9:0 -> 09:00, 16:5 -> 16:05)
  const singleMinMatch = val.match(/^([01]?\d|2[0-3]):(\d)$/);
  if (singleMinMatch) {
    const h = singleMinMatch[1].padStart(2, '0');
    const m = singleMinMatch[2].padStart(2, '0');
    return `${h}:${m}`;
  }
  // 純數字處理
  const digits = val.replace(/\D/g, '');
  if (digits.length === 3) {
    const h = digits.slice(0, 1).padStart(2, '0');
    const m = digits.slice(1, 3);
    if (parseInt(h, 10) < 24 && parseInt(m, 10) < 60) return `${h}:${m}`;
  } else if (digits.length === 4) {
    const h = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    if (parseInt(h, 10) < 24 && parseInt(m, 10) < 60) return `${h}:${m}`;
  } else if (digits.length === 1 || digits.length === 2) {
    const h = digits.padStart(2, '0');
    if (parseInt(h, 10) < 24) return `${h}:00`;
  }
  return val;
}


// 將 YYYY-MM-DD 轉成 0909 (三) 格式
function formatReviewDateTitle(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const month = parts[1];
  const day = parts[2];
  const dateObj = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
  const weekday = WEEKDAYS[dateObj.getDay()];
  return `${month}${day} (${weekday})`;
}

// 將 YYYY-MM-DD 轉成 2026/09/09 (三) 完整格式
function formatFullDateTitle(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const dateObj = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
  const weekday = WEEKDAYS[dateObj.getDay()];
  return `${year}/${month}/${day} (${weekday})`;
}

// 生成唯一 ID
function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// 預設資料骨架
function createDefaultDayData(dateStr) {
  return {
    date: dateStr,
    updatedAt: Date.now(),
    chores: [],
    diet: {
      breakfast: { completed: false, time: '08:00', content: '' },
      lunch: { completed: false, time: '12:30', content: '' },
      dinner: { completed: false, time: '18:30', content: '' },
      snack: { completed: false, time: '15:00', content: '' }
    },
    work: [],
    entertainment: [],
    learning: [],
    other: [],
    tomorrowTodos: []
  };
}

// 初次啟動時，若無任何資料，填入範例資料讓使用者立即體驗
function checkAndInitSampleData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('daily_review_'));
  if (keys.length === 0) {
    const today = getTodayDateStr();
    const sampleData = {
      date: today,
      updatedAt: Date.now(),
      chores: [
        { id: generateId(), name: '洗衣服', completed: true, time: '09:00' },
        { id: generateId(), name: '曬衣服', completed: true, time: '09:40' },
        { id: generateId(), name: '洗碗', completed: true, time: '13:00' },
        { id: generateId(), name: '整理回收', completed: true, time: '19:30' }
      ],
      diet: {
        breakfast: { completed: true, time: '08:15', content: '鷹嘴豆起司雞饅頭、米牛奶' },
        lunch: { completed: true, time: '12:20', content: '牛肉湯麵、小菜乾絲、泡菜' },
        dinner: { completed: true, time: '18:40', content: '炸春捲河粉、奇異果鳳梨汁' },
        snack: { completed: false, time: '15:30', content: '' }
      },
      work: [
        { id: generateId(), tag: '格雷農科專', desc: '完成結案報告修改', completed: true, time: '10:30' },
        { id: generateId(), tag: '格雷SBIR', desc: '確認會計查核時間、回信、承辦聯繫', completed: true, time: '14:15' },
        { id: generateId(), tag: '格雷創業綻放', desc: '約會議時間', completed: true, time: '16:00' }
      ],
      entertainment: [
        { id: generateId(), tag: '番茄小說', desc: '穿成侯夫人，讓當外室的女主絕望（有空就看一些）', completed: true, time: '21:00' }
      ],
      learning: [
        { id: generateId(), tag: '英文', desc: 'Duolingo、刷刷庫、26秒背單字、Speak', completed: true, time: '22:00' }
      ],
      other: [],
      tomorrowTodos: [
        { id: generateId(), tag: '格雷農科專', desc: '追蹤農科專結案審核進度', completed: false, time: '10:00' },
        { id: generateId(), tag: '工作任務', desc: '準備下週會議簡報大綱', completed: false, time: '14:00' }
      ]
    };
    saveDayData(today, sampleData, false);
  }
}

// 讀取某日資料
function loadDayData(dateStr) {
  const raw = localStorage.getItem(`daily_review_${dateStr}`);
  if (!raw) {
    return createDefaultDayData(dateStr);
  }
  try {
    const data = JSON.parse(raw);
    if (!data.updatedAt) {
      data.updatedAt = Date.now();
    }
    if (!data.diet) {
      data.diet = createDefaultDayData(dateStr).diet;
    }
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(meal => {
      if (!data.diet[meal]) {
        data.diet[meal] = { completed: false, time: '12:00', content: '' };
      }
    });
    if (!Array.isArray(data.chores)) data.chores = [];
    if (!Array.isArray(data.work)) data.work = [];
    if (!Array.isArray(data.entertainment)) data.entertainment = [];
    if (!Array.isArray(data.learning)) data.learning = [];
    if (!Array.isArray(data.other)) data.other = [];
    if (!Array.isArray(data.tomorrowTodos)) data.tomorrowTodos = [];
    // 清理舊資料中的「昨日待辦」標籤，一律恢復為專案或工作任務
    data.work.forEach(w => {
      if (w.tag === '昨日待辦') w.tag = '工作任務';
    });
    return data;
  } catch (e) {
    console.error('資料解析失敗，載入預設值', e);
    return createDefaultDayData(dateStr);
  }
}

// 儲存某日資料
function saveDayData(dateStr, data, triggerSync = true) {
  data.updatedAt = Date.now();
  localStorage.setItem(`daily_review_${dateStr}`, JSON.stringify(data));
  updateHistoryTotalBadge();

  if (triggerSync) {
    scheduleCloudSync(1500); // 1.5 秒防抖自動推送到雲端
  }
}

// 取得所有歷史紀錄清單（由新到舊排序）
function getAllHistoryRecords() {
  const records = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('daily_review_')) {
      const dateStr = key.replace('daily_review_', '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const data = loadDayData(dateStr);
        records.push(data);
      }
    }
  }
  records.sort((a, b) => b.date.localeCompare(a.date));
  return records;
}

// 更新歷史天數徽章
function updateHistoryTotalBadge() {
  const count = getAllHistoryRecords().length;
  const badge = document.getElementById('history-total-badge');
  if (badge) badge.textContent = count;
}

// ==========================================
// ☁️ 跨設備雲端同步核心引擎 (GitHub Gist API)
// ==========================================

const SYNC_STORAGE_KEYS = {
  TOKEN: 'sync_github_token',
  GIST_ID: 'sync_github_gist_id',
  LAST_TIME: 'sync_last_time'
};

function getSyncConfig() {
  return {
    token: localStorage.getItem(SYNC_STORAGE_KEYS.TOKEN) || '',
    gistId: localStorage.getItem(SYNC_STORAGE_KEYS.GIST_ID) || '',
    lastTime: localStorage.getItem(SYNC_STORAGE_KEYS.LAST_TIME) || ''
  };
}

function setSyncConfig(token, gistId) {
  if (token) localStorage.setItem(SYNC_STORAGE_KEYS.TOKEN, token.trim());
  if (gistId) localStorage.setItem(SYNC_STORAGE_KEYS.GIST_ID, gistId.trim());
}

// 更新頂部雲端同步狀態標籤
function updateSyncStatusUI(status, label = '') {
  const dot = document.getElementById('sync-status-dot');
  const text = document.getElementById('sync-status-text');
  const icon = document.getElementById('manual-sync-icon');

  if (icon) {
    if (status === 'syncing') {
      icon.classList.add('spin-sync');
    } else {
      icon.classList.remove('spin-sync');
    }
  }

  if (!dot || !text) return;

  const cfg = getSyncConfig();
  if (!cfg.token) {
    dot.className = 'w-2 h-2 rounded-full bg-slate-400';
    text.textContent = '雲端未綁定';
    return;
  }

  if (status === 'syncing') {
    dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    text.textContent = '同步中...';
  } else if (status === 'success') {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
    text.textContent = label || '雲端已同步';
  } else if (status === 'error') {
    dot.className = 'w-2 h-2 rounded-full bg-rose-500';
    text.textContent = label || '同步失敗';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
    text.textContent = '雲端已就緒';
  }
}

// 排程防抖自動同步
function scheduleCloudSync(delayMs = 1500) {
  const cfg = getSyncConfig();
  if (!cfg.token) return;

  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  updateSyncStatusUI('syncing');

  cloudSyncTimer = setTimeout(() => {
    performCloudSync(false);
  }, delayMs);
}

// 核心同步操作：雙向比對時間戳進行 Smart Merge
async function performCloudSync(isManual = false) {
  const cfg = getSyncConfig();
  if (!cfg.token) {
    if (isManual) showToast('尚未設定雲端同步，請先填入 GitHub Token');
    updateSyncStatusUI('idle');
    return false;
  }

  if (isSyncing) return;
  isSyncing = true;
  updateSyncStatusUI('syncing');

  try {
    let gistId = cfg.gistId;
    let remoteData = null;

    // 1. 如果有 Gist ID，先從 Gist 取得遠端資料
    if (gistId) {
      const getRes = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github+json'
        }
      });

      if (getRes.status === 404) {
        throw new Error('找不到指定的 Gist，可能已被刪除');
      } else if (!getRes.ok) {
        throw new Error(`GitHub API 錯誤 (${getRes.status})`);
      }

      const gistJson = await getRes.json();
      const targetFile = gistJson.files && gistJson.files['daily_review_data.json'];
      if (targetFile && targetFile.content) {
        try {
          remoteData = JSON.parse(targetFile.content);
        } catch (e) {
          console.warn('遠端資料格式非 JSON，將重新覆寫');
        }
      }
    }

    // 2. 本地資料搜集
    const localRecords = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('daily_review_')) {
        const dStr = key.replace('daily_review_', '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
          localRecords[dStr] = loadDayData(dStr);
        }
      }
    }

    // 3. 智慧時間戳合併 (Smart Merge)
    let needsPushToRemote = false;
    let localWasUpdated = false;
    let remoteRecords = (remoteData && remoteData.records) || {};

    const mergedRecords = { ...remoteRecords };

    // 合併本地至遠端對照表
    for (const [dateStr, localItem] of Object.entries(localRecords)) {
      const remoteItem = remoteRecords[dateStr];
      if (!remoteItem) {
        // 遠端沒有這天 -> 上傳本地這天
        mergedRecords[dateStr] = localItem;
        needsPushToRemote = true;
      } else {
        const localTime = localItem.updatedAt || 0;
        const remoteTime = remoteItem.updatedAt || 0;

        if (localTime > remoteTime) {
          // 本地比較新 -> 採用本地，需推送遠端
          mergedRecords[dateStr] = localItem;
          needsPushToRemote = true;
        } else if (remoteTime > localTime) {
          // 遠端比較新 -> 採用遠端，需更新本地
          localStorage.setItem(`daily_review_${dateStr}`, JSON.stringify(remoteItem));
          localWasUpdated = true;
        }
      }
    }

    // 檢查遠端有而本地沒有的天數
    for (const [dateStr, remoteItem] of Object.entries(remoteRecords)) {
      if (!localRecords[dateStr]) {
        localStorage.setItem(`daily_review_${dateStr}`, JSON.stringify(remoteItem));
        localWasUpdated = true;
      }
    }

    // 4. 若沒有 Gist ID，自動在 GitHub 建立私有 Gist
    if (!gistId) {
      const createRes = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: '每日復盤手帳 - 個人專屬雲端同步資料庫 (請勿手動修改)',
          public: false,
          files: {
            'daily_review_data.json': {
              content: JSON.stringify({
                version: 1,
                lastSync: Date.now(),
                records: mergedRecords
              }, null, 2)
            }
          }
        })
      });

      if (!createRes.ok) {
        throw new Error('無法自動建立 GitHub Gist，請確認 Token 具備 gist 權限');
      }

      const createdGist = await createRes.json();
      gistId = createdGist.id;
      setSyncConfig(cfg.token, gistId);
      needsPushToRemote = false;

      const gistInput = document.getElementById('input-sync-gist-id');
      if (gistInput) gistInput.value = gistId;

      showToast('☁️ 雲端同步庫建立成功！');
    } else if (needsPushToRemote || !remoteData) {
      // 5. 將最新合併資料 PATCH 至遠端 Gist
      const patchRes = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: {
            'daily_review_data.json': {
              content: JSON.stringify({
                version: 1,
                lastSync: Date.now(),
                records: mergedRecords
              }, null, 2)
            }
          }
        })
      });

      if (!patchRes.ok) {
        throw new Error('推送到 GitHub 失敗');
      }
    }

    // 6. 如果本地資料有被遠端較新版本更新，刷新當前畫面
    if (localWasUpdated) {
      currentDayData = loadDayData(currentDateStr);
      render();
      if (currentView === 'history') {
        renderHistory();
      }
      showToast('☁️ 已自動同步來自其他設備的最新修改！');
    } else if (isManual) {
      showToast('☁️ 雲端同步完成，目前資料已是最新版！');
    }

    const nowStr = new Date().toLocaleTimeString();
    localStorage.setItem(SYNC_STORAGE_KEYS.LAST_TIME, nowStr);
    updateSyncStatusUI('success', `已同步 (${nowStr.slice(0, 5)})`);
    return true;

  } catch (err) {
    console.error('雲端同步失敗:', err);
    updateSyncStatusUI('error', '同步錯誤');
    if (isManual) {
      showToast(`同步失敗: ${err.message}`);
    }
    return false;
  } finally {
    isSyncing = false;
  }
}

// 強制從雲端覆蓋本地
async function forcePullFromCloud() {
  const cfg = getSyncConfig();
  if (!cfg.token || !cfg.gistId) {
    alert('請先填入 Token 與 Gist ID');
    return;
  }

  if (!confirm('⚠️ 警告：這將會以雲端的版本「完全覆蓋」您這台設備的所有本地資料，確定要繼續嗎？')) {
    return;
  }

  try {
    updateSyncStatusUI('syncing');
    const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!res.ok) throw new Error('無法讀取遠端資料');
    const json = await res.json();
    const content = json.files['daily_review_data.json']?.content;
    if (!content) throw new Error('雲端資料庫中找不到紀錄');

    const remote = JSON.parse(content);
    const records = remote.records || {};

    let count = 0;
    for (const [dStr, item] of Object.entries(records)) {
      localStorage.setItem(`daily_review_${dStr}`, JSON.stringify(item));
      count++;
    }

    currentDayData = loadDayData(currentDateStr);
    render();
    if (currentView === 'history') renderHistory();
    updateSyncStatusUI('success', '已覆蓋完成');
    showToast(`成功從雲端強制拉取 ${count} 天紀錄！`);
    document.getElementById('sync-settings-modal').classList.add('hidden');
  } catch (e) {
    alert(`拉取失敗: ${e.message}`);
    updateSyncStatusUI('error');
  }
}

// 強制以本地覆蓋雲端
async function forcePushToCloud() {
  const cfg = getSyncConfig();
  if (!cfg.token || !cfg.gistId) {
    alert('請先填入 Token 與 Gist ID');
    return;
  }

  if (!confirm('⚠️ 警告：這將會以這台設備的本地資料「完全覆蓋」雲端紀錄，確定要繼續嗎？')) {
    return;
  }

  try {
    updateSyncStatusUI('syncing');
    const localRecords = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('daily_review_')) {
        const dStr = key.replace('daily_review_', '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
          localRecords[dStr] = loadDayData(dStr);
        }
      }
    }

    const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'daily_review_data.json': {
            content: JSON.stringify({
              version: 1,
              lastSync: Date.now(),
              records: localRecords
            }, null, 2)
          }
        }
      })
    });

    if (!res.ok) throw new Error('推送失敗');
    updateSyncStatusUI('success', '已強制上傳');
    showToast('成功以本地資料強制覆蓋雲端！');
    document.getElementById('sync-settings-modal').classList.add('hidden');
  } catch (e) {
    alert(`推送失敗: ${e.message}`);
    updateSyncStatusUI('error');
  }
}

// --- 視圖切換 (今日記錄 vs 歷史翻閱) ---
function switchMainView(view) {
  currentView = view;
  const todayView = document.getElementById('view-today');
  const historyView = document.getElementById('view-history');
  const tabBtnToday = document.getElementById('tab-btn-today');
  const tabBtnHistory = document.getElementById('tab-btn-history');
  const mobileNavToday = document.getElementById('mobile-nav-today');
  const mobileNavHistory = document.getElementById('mobile-nav-history');
  const dateController = document.getElementById('header-date-controller');
  const progressContainer = document.getElementById('header-progress-container');
  const statsContainer = document.getElementById('header-stats-container');

  if (view === 'today') {
    todayView.classList.remove('hidden');
    historyView.classList.add('hidden');

    tabBtnToday.className = 'px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition shadow-xs bg-white text-emerald-700 flex items-center gap-1.5';
    tabBtnHistory.className = 'px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5';

    if (mobileNavToday) {
      mobileNavToday.className = 'flex flex-col items-center gap-0.5 py-1 px-3 text-emerald-600';
      mobileNavHistory.className = 'flex flex-col items-center gap-0.5 py-1 px-3 text-slate-400 hover:text-slate-800';
    }

    if (dateController) dateController.classList.remove('opacity-40', 'pointer-events-none');
    if (progressContainer) progressContainer.classList.remove('hidden');
    if (statsContainer) statsContainer.classList.remove('hidden');

    render();
  } else {
    todayView.classList.add('hidden');
    historyView.classList.remove('hidden');

    tabBtnToday.className = 'px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5';
    tabBtnHistory.className = 'px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition shadow-xs bg-white text-emerald-700 flex items-center gap-1.5';

    if (mobileNavToday) {
      mobileNavToday.className = 'flex flex-col items-center gap-0.5 py-1 px-3 text-slate-400 hover:text-slate-800';
      mobileNavHistory.className = 'flex flex-col items-center gap-0.5 py-1 px-3 text-emerald-600';
    }

    if (dateController) dateController.classList.add('opacity-40', 'pointer-events-none');
    if (progressContainer) progressContainer.classList.add('hidden');
    if (statsContainer) statsContainer.classList.add('hidden');

    renderHistory();
  }
}

// --- DOM 渲染與更新 ---
function render() {
  updateDateHeader();
  renderChores();
  renderDiet();
  renderWorkList();
  renderEntertainmentList();
  renderLearningList();
  renderOtherList();
  renderTomorrowTodos();
  updateProgressAndStats();
  updateHistoryTotalBadge();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// 更新日期顯示
function updateDateHeader() {
  const picker = document.getElementById('date-picker');
  const badge = document.getElementById('date-badge');
  picker.value = currentDateStr;

  const parts = currentDateStr.split('-');
  const dateObj = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
  const weekday = WEEKDAYS[dateObj.getDay()];
  badge.textContent = `${parts[1]}/${parts[2]} (${weekday})`;

  const now = getCurrentTimeStr();
  const choreTime = document.getElementById('new-chore-time');
  if (choreTime && !choreTime.value) choreTime.value = now;
  const workTime = document.getElementById('new-work-time');
  if (workTime && !workTime.value) workTime.value = now;
  const entTime = document.getElementById('new-entertainment-time');
  if (entTime && !entTime.value) entTime.value = now;
  const learnTime = document.getElementById('new-learning-time');
  if (learnTime && !learnTime.value) learnTime.value = now;
  const otherTime = document.getElementById('new-other-time');
  if (otherTime && !otherTime.value) otherTime.value = now;
  const tomorrowTime = document.getElementById('new-tomorrow-time');
  if (tomorrowTime && !tomorrowTime.value) tomorrowTime.value = now;
}

// 1. 渲染家務清單 (可自訂時間 + 現在時間按鈕)
function renderChores() {
  const container = document.getElementById('chores-list');
  container.innerHTML = '';

  if (currentDayData.chores.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-2.5 text-center bg-white/60 rounded-xl border border-dashed border-slate-200">今日尚無家務紀錄，可點擊上方快捷標籤或下方新增</div>`;
    return;
  }

  currentDayData.chores.forEach(item => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between gap-2 p-2 sm:p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-teal-300 transition';
    div.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0"></span>
        <span class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(item.name)}</span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 text-xs mono-font">
          <input type="text" class="chore-inline-time time-24h-input bg-transparent text-xs text-slate-700 focus:outline-none" data-id="${item.id}" value="${item.time || ''}" placeholder="HH:mm" maxlength="5" inputmode="numeric" title="點擊自訂時間 (HH:mm)" />
          <button type="button" class="btn-update-chore-time text-slate-400 hover:text-teal-600 p-0.5" data-id="${item.id}" title="更新為現在時間">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <button type="button" class="btn-del-chore text-slate-300 hover:text-rose-500 p-1.5 transition" data-id="${item.id}" title="刪除">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

// 2. 渲染飲食記錄
function renderDiet() {
  const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
  meals.forEach(mealKey => {
    const mealData = currentDayData.diet[mealKey];
    const row = document.querySelector(`.diet-row[data-diet-key="${mealKey}"]`);
    if (!row || !mealData) return;

    const timeInputs = row.querySelectorAll('.diet-time');
    const contentInput = row.querySelector('.diet-content');

    timeInputs.forEach(t => t.value = mealData.time || '');
    contentInput.value = mealData.content || '';
    row.classList.remove('item-completed');
  });
}

// 通用渲染列表函數 (工作, 娛樂, 學習)
function renderTaggedList(listData, containerId, categoryKey, placeholderEmpty) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (listData.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center bg-white/60 rounded-xl border border-dashed border-slate-200">${placeholderEmpty}</div>`;
    return;
  }

  const isWork = (categoryKey === 'work');

  listData.forEach(item => {
    const div = document.createElement('div');
    // 只有工作才支援完成狀態淡化刪除線
    div.className = `flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition ${isWork && item.completed ? 'item-completed bg-slate-50/80' : ''}`;
    
    // 只有工作才需要 Checkbox
    const checkboxHtml = isWork
      ? `<input type="checkbox" class="custom-checkbox item-checkbox" data-category="${categoryKey}" data-id="${item.id}" ${item.completed ? 'checked' : ''} />`
      : '';

    let tagClass = 'bg-slate-100 text-slate-700 border-slate-200/80';
    if (categoryKey === 'work') tagClass = 'bg-blue-50 text-blue-700 border-blue-200/80';
    else if (categoryKey === 'entertainment') tagClass = 'bg-pink-50 text-pink-700 border-pink-200/80';
    else if (categoryKey === 'learning') tagClass = 'bg-indigo-50 text-indigo-700 border-indigo-200/80';

    div.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 min-w-0">
        ${checkboxHtml}
        <span class="px-2 py-0.5 text-xs font-bold rounded flex-shrink-0 border ${tagClass}">
          ${escapeHtml(item.tag || (isWork ? '工作任務' : (categoryKey === 'entertainment' ? '休閒' : '學習')))}
        </span>
        <input type="text" class="item-inline-desc flex-1 text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition py-0.5" data-category="${categoryKey}" data-id="${item.id}" value="${escapeHtml(item.desc || '')}" placeholder="點擊編輯內容..." />
      </div>
      <div class="flex items-center justify-end gap-2 flex-shrink-0 self-end sm:self-auto">
        <div class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 text-xs mono-font">
          <input type="text" class="item-inline-time time-24h-input bg-transparent text-xs text-slate-700 focus:outline-none" data-category="${categoryKey}" data-id="${item.id}" value="${item.time || ''}" placeholder="HH:mm" maxlength="5" inputmode="numeric" title="點擊自訂時間 (HH:mm)" />
          <button type="button" class="btn-update-item-time text-slate-400 hover:text-blue-600 p-0.5" data-category="${categoryKey}" data-id="${item.id}" title="重設為現在時間">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <button type="button" class="btn-del-item text-slate-300 hover:text-rose-500 p-1.5 transition" data-category="${categoryKey}" data-id="${item.id}" title="刪除">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderWorkList() {
  renderTaggedList(currentDayData.work, 'work-list', 'work', '今日尚無工作項目，在下方預留格子填入專案與內容');
}

function renderEntertainmentList() {
  renderTaggedList(currentDayData.entertainment, 'entertainment-list', 'entertainment', '今日尚無娛樂紀錄，在下方格子填入小說、影劇或休閒');
}

function renderLearningList() {
  renderTaggedList(currentDayData.learning, 'learning-list', 'learning', '今日尚無學習紀錄，在下方格子填入語言、技能或讀書進度');
}

// 5. 渲染其他事件
function renderOtherList() {
  const container = document.getElementById('other-list');
  container.innerHTML = '';

  if (currentDayData.other.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center bg-white/60 rounded-xl border border-dashed border-slate-200">尚無其他事件，隨手記下外出或雜項</div>`;
    return;
  }

  currentDayData.other.forEach(item => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition';
    div.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
        <input type="text" class="item-inline-desc flex-1 text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none transition py-0.5" data-category="other" data-id="${item.id}" value="${escapeHtml(item.desc || '')}" placeholder="點擊編輯內容..." />
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 text-xs mono-font">
          <input type="text" class="item-inline-time time-24h-input bg-transparent text-xs text-slate-700 focus:outline-none" data-category="other" data-id="${item.id}" value="${item.time || ''}" placeholder="HH:mm" maxlength="5" inputmode="numeric" title="點擊自訂時間 (HH:mm)" />
          <button type="button" class="btn-update-item-time text-slate-400 hover:text-amber-600 p-0.5" data-category="other" data-id="${item.id}" title="重設為現在時間">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <button type="button" class="btn-del-item text-slate-300 hover:text-rose-500 p-1.5 transition" data-category="other" data-id="${item.id}" title="刪除">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

// 6. 渲染明日待辦事項 (可自訂時間 + 現在時間按鈕)
function renderTomorrowTodos() {
  const container = document.getElementById('tomorrow-todo-list');
  container.innerHTML = '';

  if (!currentDayData.tomorrowTodos || currentDayData.tomorrowTodos.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center bg-white/70 rounded-xl border border-dashed border-amber-200">尚無明日待辦事項，點擊上方按鈕可一鍵將未完成工作轉入</div>`;
    return;
  }

  currentDayData.tomorrowTodos.forEach(item => {
    const div = document.createElement('div');
    div.className = 'flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-amber-200/90 shadow-2xs hover:border-amber-300 transition';
    div.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        ${item.tag ? `<span class="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-800 flex-shrink-0 border border-amber-200/80">${escapeHtml(item.tag)}</span>` : ''}
        <input type="text" class="tomorrow-inline-desc flex-1 text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-amber-300 focus:border-amber-500 focus:outline-none transition py-0.5" data-id="${item.id}" value="${escapeHtml(item.desc || '')}" placeholder="點擊編輯內容..." />
      </div>
      <div class="flex items-center justify-end gap-2 flex-shrink-0 self-end sm:self-auto">
        <div class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 text-xs mono-font">
          <input type="text" class="tomorrow-inline-time time-24h-input bg-transparent text-xs text-slate-700 focus:outline-none" data-id="${item.id}" value="${item.time || ''}" placeholder="HH:mm" maxlength="5" inputmode="numeric" title="點擊自訂預排時間 (HH:mm)" />
          <button type="button" class="btn-update-tomorrow-time text-slate-400 hover:text-amber-600 p-0.5" data-id="${item.id}" title="填入現在時間">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <button type="button" class="btn-del-tomorrow text-slate-300 hover:text-rose-500 p-1.5 transition" data-id="${item.id}" title="刪除">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

// 計算完成度進度與統計（以需追蹤完成狀態的工作任務為基準）
function calculateDayStats(dayData) {
  let total = 0;
  let completed = 0;

  if (Array.isArray(dayData.work)) {
    dayData.work.forEach(i => {
      total++;
      if (i.completed) completed++;
    });
  }

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

function updateProgressAndStats() {
  const { total, completed, percentage } = calculateDayStats(currentDayData);
  const progressBar = document.getElementById('daily-progress-bar');
  const statsText = document.getElementById('stats-completion-text');

  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (statsText) {
    if (total === 0) {
      statsText.textContent = '今日工作進度：尚未建立工作任務';
    } else {
      statsText.textContent = `今日工作進度：${completed} / ${total} 項完成 (${percentage}%)`;
    }
  }
}

// --- 復盤文字生成引擎 ---
function generateReviewTextForData(data) {
  const title = formatReviewDateTitle(data.date);
  const lines = [title];

  lines.push('生活');
  if (data.chores && data.chores.length > 0) {
    const choresText = data.chores.map(c => c.name).join('、');
    lines.push(`  · 家務：${choresText}`);
  } else {
    lines.push('  · 家務：');
  }

  lines.push('  · 飲食：');
  const bf = data.diet.breakfast?.content || '';
  const lu = data.diet.lunch?.content || '';
  const di = data.diet.dinner?.content || '';
  const sn = data.diet.snack?.content || '';

  lines.push(`  - 早餐：${bf}`);
  lines.push(`  - 午餐：${lu}`);
  lines.push(`  - 晚餐：${di}`);
  if (sn && sn.trim()) {
    lines.push(`  - 點心/飲品：${sn}`);
  }

  lines.push('工作');
  if (data.work && data.work.length > 0) {
    data.work.forEach(w => {
      const tag = w.tag ? `${w.tag}：` : '';
      lines.push(`  · ${tag}${w.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  lines.push('娛樂');
  if (data.entertainment && data.entertainment.length > 0) {
    data.entertainment.forEach(e => {
      const tag = e.tag ? `${e.tag}：` : '';
      lines.push(`  · ${tag}${e.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  lines.push('學習');
  if (data.learning && data.learning.length > 0) {
    data.learning.forEach(l => {
      const tag = l.tag ? `${l.tag}：` : '';
      lines.push(`  · ${tag}${l.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  lines.push('其他事件');
  if (data.other && data.other.length > 0) {
    data.other.forEach(o => {
      lines.push(`  · ${o.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  if (data.tomorrowTodos && data.tomorrowTodos.length > 0) {
    lines.push('');
    lines.push('明日待辦事項');
    data.tomorrowTodos.forEach(t => {
      const tag = t.tag ? `${t.tag}：` : '';
      lines.push(`  · ${tag}${t.desc || ''}`);
    });
  }

  return lines.join('\n');
}

function generateReviewText() {
  return generateReviewTextForData(currentDayData);
}

// 彈出復盤視窗
function showReviewModal(textToDisplay = null, customTitle = null) {
  const text = textToDisplay || generateReviewText();
  const output = document.getElementById('review-text-output');
  output.textContent = text;
  
  const titleEl = document.getElementById('modal-review-title');
  if (titleEl) {
    titleEl.textContent = customTitle || `復盤文本預覽 - ${formatReviewDateTitle(currentDateStr)}`;
  }

  document.getElementById('review-modal').classList.remove('hidden');
  document.getElementById('copy-status-indicator').classList.add('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function hideReviewModal() {
  document.getElementById('review-modal').classList.add('hidden');
}

// 複製到剪貼簿
async function copyReviewText() {
  const text = document.getElementById('review-text-output').textContent;
  try {
    await navigator.clipboard.writeText(text);
    const indicator = document.getElementById('copy-status-indicator');
    indicator.classList.remove('hidden');
    showToast('復盤文本已成功複製到剪貼簿！');
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('復盤文本已成功複製到剪貼簿！');
  }
}

// ==========================================
// 📚 歷史復盤翻閱與全文搜尋核心邏輯
// ==========================================

function highlightText(str, term) {
  if (!str) return '';
  const escaped = escapeHtml(str);
  if (!term || !term.trim()) return escaped;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function renderHistory() {
  const container = document.getElementById('history-cards-container');
  const emptyState = document.getElementById('history-empty-state');
  container.innerHTML = '';

  const allRecords = getAllHistoryRecords();
  const now = new Date();
  const todayStr = getTodayDateStr();

  const filteredRecords = allRecords.filter(item => {
    if (historyRangeFilter === 'all') return true;
    const itemDate = new Date(item.date);
    const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
    if (historyRangeFilter === '7days') return diffDays >= 0 && diffDays <= 7;
    if (historyRangeFilter === '30days') return diffDays >= 0 && diffDays <= 30;
    if (historyRangeFilter === 'thisMonth') return item.date.startsWith(todayStr.slice(0, 7));
    return true;
  });

  const term = historySearchTerm.trim().toLowerCase();
  const matchedRecords = filteredRecords.filter(item => {
    if (!term) return true;
    if (item.date.toLowerCase().includes(term)) return true;
    const dateTitle = formatReviewDateTitle(item.date).toLowerCase();
    if (dateTitle.includes(term)) return true;

    if (item.chores.some(c => c.name.toLowerCase().includes(term))) return true;

    const dietVals = Object.values(item.diet || {}).map(d => (d.content || '').toLowerCase());
    if (dietVals.some(v => v.includes(term))) return true;

    if (item.work.some(w => (w.tag || '').toLowerCase().includes(term) || (w.desc || '').toLowerCase().includes(term))) return true;
    if (item.entertainment.some(e => (e.tag || '').toLowerCase().includes(term) || (e.desc || '').toLowerCase().includes(term))) return true;
    if (item.learning.some(l => (l.tag || '').toLowerCase().includes(term) || (l.desc || '').toLowerCase().includes(term))) return true;
    if (item.other.some(o => (o.desc || '').toLowerCase().includes(term))) return true;
    if (item.tomorrowTodos.some(t => (t.tag || '').toLowerCase().includes(term) || (t.desc || '').toLowerCase().includes(term))) return true;

    return false;
  });

  if (matchedRecords.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  matchedRecords.forEach(dayItem => {
    const card = document.createElement('div');
    card.className = 'history-card bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col justify-between';

    const { total, completed, percentage } = calculateDayStats(dayItem);
    const dateTitle = formatReviewDateTitle(dayItem.date);
    const fullDate = formatFullDateTitle(dayItem.date);

    const choreNames = dayItem.chores.map(c => highlightText(c.name, term)).join('、') || '無';

    const dietSummary = [
      dayItem.diet.breakfast?.content ? `早：${highlightText(dayItem.diet.breakfast.content, term)}` : '',
      dayItem.diet.lunch?.content ? `午：${highlightText(dayItem.diet.lunch.content, term)}` : '',
      dayItem.diet.dinner?.content ? `晚：${highlightText(dayItem.diet.dinner.content, term)}` : ''
    ].filter(Boolean).join(' | ') || '無填寫';

    let workHtml = '';
    if (dayItem.work.length > 0) {
      workHtml = dayItem.work.map(w => `
        <li class="flex items-start gap-1.5 truncate ${w.completed ? 'line-through text-slate-400' : 'text-slate-700'}">
          <span class="${w.completed ? 'text-emerald-500' : 'text-blue-600'} flex-shrink-0 font-bold">${w.completed ? '✓' : '·'}</span>
          <span class="truncate">${w.tag ? `<strong>${highlightText(w.tag, term)}</strong>：` : ''}${highlightText(w.desc, term)}</span>
        </li>
      `).join('');
    } else {
      workHtml = '<li class="text-slate-400">無工作記錄</li>';
    }

    let entHtml = '';
    if (dayItem.entertainment.length > 0) {
      entHtml = dayItem.entertainment.map(e => `
        <li class="flex items-start gap-1.5 truncate text-slate-700">
          <span class="text-pink-600 flex-shrink-0 font-bold">·</span>
          <span class="truncate">${e.tag ? `<strong>${highlightText(e.tag, term)}</strong>：` : ''}${highlightText(e.desc, term)}</span>
        </li>
      `).join('');
    } else {
      entHtml = '<li class="text-slate-400">無娛樂記錄</li>';
    }

    let learnHtml = '';
    if (dayItem.learning.length > 0) {
      learnHtml = dayItem.learning.map(l => `
        <li class="flex items-start gap-1.5 truncate text-slate-700">
          <span class="text-indigo-600 flex-shrink-0 font-bold">·</span>
          <span class="truncate">${l.tag ? `<strong>${highlightText(l.tag, term)}</strong>：` : ''}${highlightText(l.desc, term)}</span>
        </li>
      `).join('');
    } else {
      learnHtml = '<li class="text-slate-400">無學習記錄</li>';
    }

    let todoHtml = '';
    if (dayItem.tomorrowTodos.length > 0) {
      todoHtml = dayItem.tomorrowTodos.map(t => `
        <li class="truncate text-amber-900/90 font-medium">· ${t.tag ? `<strong>${highlightText(t.tag, term)}</strong>：` : ''}${highlightText(t.desc, term)}</li>
      `).join('');
    }

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div>
            <span class="text-base font-bold text-slate-900">${dateTitle}</span>
            <span class="text-xs text-slate-400 ml-1.5">${fullDate}</span>
          </div>
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${percentage === 100 && total > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}">
            工作完成度 ${total === 0 ? '無任務' : `${percentage}% (${completed}/${total})`}
          </span>
        </div>

        <div class="space-y-2.5 text-xs text-slate-700">
          <div class="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
            <span class="font-bold text-teal-800 block mb-1">🌿 生活</span>
            <p class="text-slate-600 truncate"><strong class="text-slate-700">家務：</strong>${choreNames}</p>
            <p class="text-slate-600 truncate mt-0.5"><strong class="text-slate-700">飲食：</strong>${dietSummary}</p>
          </div>

          <div class="p-2 rounded-xl border border-slate-100">
            <span class="font-bold text-blue-800 block mb-1">💼 工作</span>
            <ul class="space-y-0.5">${workHtml}</ul>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="p-2 rounded-xl border border-slate-100 bg-pink-50/30">
              <span class="font-bold text-pink-800 block mb-1">🎮 娛樂</span>
              <ul class="space-y-0.5">${entHtml}</ul>
            </div>
            <div class="p-2 rounded-xl border border-slate-100 bg-indigo-50/30">
              <span class="font-bold text-indigo-800 block mb-1">📖 學習</span>
              <ul class="space-y-0.5">${learnHtml}</ul>
            </div>
          </div>

          ${todoHtml ? `
            <div class="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60 text-xs">
              <span class="font-bold text-amber-800 block mb-0.5">📌 預定明日待辦：</span>
              <ul class="space-y-0.5">${todoHtml}</ul>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
        <button type="button" class="btn-history-copy text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 p-1" data-date="${dayItem.date}">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          <span>複製文本</span>
        </button>

        <div class="flex items-center gap-1.5">
          <button type="button" class="btn-history-load px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1" data-date="${dayItem.date}">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            <span>載入編輯</span>
          </button>
          <button type="button" class="btn-history-delete p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition" data-date="${dayItem.date}" title="刪除此日紀錄">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

function exportHistorySummary() {
  const allRecords = getAllHistoryRecords();
  const now = new Date();
  const todayStr = getTodayDateStr();

  const filtered = allRecords.filter(item => {
    if (historyRangeFilter === 'all') return true;
    const itemDate = new Date(item.date);
    const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
    if (historyRangeFilter === '7days') return diffDays >= 0 && diffDays <= 7;
    if (historyRangeFilter === '30days') return diffDays >= 0 && diffDays <= 30;
    if (historyRangeFilter === 'thisMonth') return item.date.startsWith(todayStr.slice(0, 7));
    return true;
  });

  if (filtered.length === 0) {
    showToast('目前篩選區間無任何記錄可匯出');
    return;
  }

  const reports = filtered.map(d => generateReviewTextForData(d));
  const fullContent = reports.join('\n\n====================\n\n');
  showReviewModal(fullContent, `歷史復盤統整報告 (${filtered.length} 天)`);
}

// Toast 提示
function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  toastMsg.textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function switchDate(newDateStr) {
  saveCurrentDayData();
  currentDateStr = newDateStr;
  currentDayData = loadDayData(currentDateStr);
  render();
}

function saveCurrentDayData() {
  if (currentDayData) {
    saveDayData(currentDateStr, currentDayData, true);
  }
}

// 彈出雲端同步設定視窗
function openSyncSettingsModal() {
  const cfg = getSyncConfig();
  document.getElementById('input-sync-token').value = cfg.token;
  document.getElementById('input-sync-gist-id').value = cfg.gistId;
  document.getElementById('sync-settings-modal').classList.remove('hidden');
  document.getElementById('sync-test-status').classList.add('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeSyncSettingsModal() {
  document.getElementById('sync-settings-modal').classList.add('hidden');
}

// --- 事件監聽器註冊 ---
function initEventListeners() {
  // 1. 視圖切換標籤 (今日記錄 vs 歷史翻閱)
  document.getElementById('tab-btn-today').addEventListener('click', () => switchMainView('today'));
  document.getElementById('tab-btn-history').addEventListener('click', () => switchMainView('history'));

  // 2. 雲端同步視窗與觸發按鈕
  document.getElementById('btn-open-sync-modal').addEventListener('click', openSyncSettingsModal);
  document.getElementById('btn-menu-open-sync').addEventListener('click', openSyncSettingsModal);
  document.getElementById('btn-mobile-open-sync').addEventListener('click', () => {
    document.getElementById('mobile-backup-modal').classList.add('hidden');
    openSyncSettingsModal();
  });
  document.getElementById('btn-open-sync-help').addEventListener('click', openSyncSettingsModal);

  document.getElementById('btn-close-sync-modal').addEventListener('click', closeSyncSettingsModal);
  document.getElementById('btn-cancel-sync-modal').addEventListener('click', closeSyncSettingsModal);

  // 手動同步按鈕
  document.getElementById('btn-manual-sync').addEventListener('click', () => {
    performCloudSync(true);
  });

  // 儲存同步設定並執行同步
  document.getElementById('btn-save-sync-config').addEventListener('click', async () => {
    const token = document.getElementById('input-sync-token').value.trim();
    const gistId = document.getElementById('input-sync-gist-id').value.trim();

    if (!token) {
      alert('請先輸入 GitHub Personal Access Token (PAT)');
      return;
    }

    setSyncConfig(token, gistId);
    showToast('正在驗證並同步雲端資料...');
    const ok = await performCloudSync(true);
    if (ok) {
      closeSyncSettingsModal();
    }
  });

  // 清除同步綁定
  document.getElementById('btn-disconnect-sync').addEventListener('click', () => {
    if (confirm('確定要清除這台設備的雲端同步設定嗎？本地已記錄的資料不會被刪除。')) {
      localStorage.removeItem(SYNC_STORAGE_KEYS.TOKEN);
      localStorage.removeItem(SYNC_STORAGE_KEYS.GIST_ID);
      document.getElementById('input-sync-token').value = '';
      document.getElementById('input-sync-gist-id').value = '';
      updateSyncStatusUI('idle');
      closeSyncSettingsModal();
      showToast('已清除雲端同步設定');
    }
  });

  // 強制拉取與推送
  document.getElementById('btn-force-pull').addEventListener('click', forcePullFromCloud);
  document.getElementById('btn-force-push').addEventListener('click', forcePushToCloud);

  // 3. 行動端底部導航
  const navToday = document.getElementById('mobile-nav-today');
  const navHistory = document.getElementById('mobile-nav-history');
  const navSync = document.getElementById('mobile-nav-sync');
  const navExport = document.getElementById('mobile-nav-export');
  const navBackup = document.getElementById('mobile-nav-backup');

  if (navToday) navToday.addEventListener('click', () => switchMainView('today'));
  if (navHistory) navHistory.addEventListener('click', () => switchMainView('history'));
  if (navSync) navSync.addEventListener('click', () => performCloudSync(true));
  if (navExport) navExport.addEventListener('click', () => showReviewModal());
  if (navBackup) navBackup.addEventListener('click', () => {
    document.getElementById('mobile-backup-modal').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById('btn-close-backup-modal').addEventListener('click', () => {
    document.getElementById('mobile-backup-modal').classList.add('hidden');
  });

  // 日期切換
  document.getElementById('date-picker').addEventListener('change', (e) => {
    if (e.target.value) {
      switchDate(e.target.value);
    }
  });

  document.getElementById('today-btn').addEventListener('click', () => {
    switchDate(getTodayDateStr());
  });

  document.getElementById('prev-day-btn').addEventListener('click', () => {
    const parts = currentDateStr.split('-');
    const d = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    switchDate(`${y}-${m}-${day}`);
  });

  document.getElementById('next-day-btn').addEventListener('click', () => {
    const parts = currentDateStr.split('-');
    const d = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    switchDate(`${y}-${m}-${day}`);
  });

  // 4. 家務快捷標籤點擊
  // 4. 家務快捷標籤點擊
  document.querySelectorAll('.quick-chore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      addChore(name);
    });
  });

  const choreInput = document.getElementById('new-chore-input');
  const btnAddChore = document.getElementById('btn-add-chore');
  const handleAddChoreInput = () => {
    const val = choreInput.value.trim();
    if (val) {
      addChore(val);
      choreInput.value = '';
    }
  };
  btnAddChore.addEventListener('click', handleAddChoreInput);
  choreInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddChoreInput();
  });

  // 家務新增列的現在時間按鈕
  document.getElementById('btn-now-new-chore')?.addEventListener('click', () => {
    const el = document.getElementById('new-chore-time');
    if (el) el.value = getCurrentTimeStr();
    showToast('已填入現在時間');
  });

  function addChore(name) {
    const choreTimeEl = document.getElementById('new-chore-time');
    const timeVal = (choreTimeEl && choreTimeEl.value) ? format24hTime(choreTimeEl.value) : getCurrentTimeStr();
    currentDayData.chores.push({
      id: generateId(),
      name: name,
      completed: true,
      time: timeVal
    });
    if (choreTimeEl) choreTimeEl.value = getCurrentTimeStr();
    saveCurrentDayData();
    renderChores();
    updateProgressAndStats();
    if (window.lucide) window.lucide.createIcons();
    showToast(`已記錄家務：${name}`);
  }

  // 家務列表事件 (自訂時間輸入, 現在時間按鈕, 刪除)
  document.getElementById('chores-list').addEventListener('click', (e) => {
    const target = e.target;

    const timeBtn = target.closest('.btn-update-chore-time');
    if (timeBtn) {
      const id = timeBtn.getAttribute('data-id');
      const item = currentDayData.chores.find(c => c.id === id);
      if (item) {
        item.time = getCurrentTimeStr();
        saveCurrentDayData();
        renderChores();
        if (window.lucide) window.lucide.createIcons();
        showToast('已更新為現在時間');
      }
      return;
    }

    const delBtn = target.closest('.btn-del-chore');
    if (delBtn) {
      const id = delBtn.getAttribute('data-id');
      currentDayData.chores = currentDayData.chores.filter(c => c.id !== id);
      saveCurrentDayData();
      renderChores();
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // 家務自訂時間輸入即時儲存與格式化
  document.getElementById('chores-list').addEventListener('input', (e) => {
    const target = e.target;
    if (target.classList.contains('chore-inline-time')) {
      const id = target.getAttribute('data-id');
      const item = currentDayData.chores.find(c => c.id === id);
      if (item) {
        item.time = target.value;
        saveCurrentDayData();
      }
    }
  });

  document.getElementById('chores-list').addEventListener('change', (e) => {
    const target = e.target;
    if (target.classList.contains('chore-inline-time')) {
      target.value = format24hTime(target.value);
      const id = target.getAttribute('data-id');
      const item = currentDayData.chores.find(c => c.id === id);
      if (item) {
        item.time = target.value;
        saveCurrentDayData();
      }
    }
  });

  // 5. 飲食輸入監聽
  document.getElementById('diet-list').addEventListener('change', (e) => {
    const row = e.target.closest('.diet-row');
    if (!row) return;
    const mealKey = row.getAttribute('data-diet-key');
    const timeInput = row.querySelector('.diet-time');
    const contentInput = row.querySelector('.diet-content');

    if (currentDayData.diet[mealKey]) {
      currentDayData.diet[mealKey].time = format24hTime(timeInput.value);
      currentDayData.diet[mealKey].content = contentInput.value;
      saveCurrentDayData();
      renderDiet();
    }
  });

  document.querySelectorAll('#diet-list .btn-now-time').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.diet-row');
      const timeInputs = row.querySelectorAll('.diet-time');
      const mealKey = row.getAttribute('data-diet-key');
      const now = getCurrentTimeStr();
      timeInputs.forEach(t => t.value = now);
      if (currentDayData.diet[mealKey]) {
        currentDayData.diet[mealKey].time = now;
        saveCurrentDayData();
        showToast('已填入現在時間');
      }
    });
  });

  // 6. 工作新增
  const btnAddWork = document.getElementById('btn-add-work');
  const workTag = document.getElementById('new-work-tag');
  const workDesc = document.getElementById('new-work-desc');
  const workTime = document.getElementById('new-work-time');
    const handleAddWork = () => {
    const desc = workDesc.value.trim();
    const tag = workTag.value.trim();
    if (!desc && !tag) return;
    currentDayData.work.push({
      id: generateId(),
      tag: tag || '工作任務',
      desc: desc,
      completed: false,
      time: (workTime && workTime.value) ? format24hTime(workTime.value) : getCurrentTimeStr()
    });
    workDesc.value = '';
    workTime.value = getCurrentTimeStr();
    saveCurrentDayData();
    renderWorkList();
    updateProgressAndStats();
    if (window.lucide) window.lucide.createIcons();
    showToast('已記錄工作項目');
  };
  btnAddWork.addEventListener('click', handleAddWork);
  workDesc.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddWork(); });

  // 7. 娛樂新增
  const btnAddEnt = document.getElementById('btn-add-entertainment');
  const entTag = document.getElementById('new-entertainment-tag');
  const entDesc = document.getElementById('new-entertainment-desc');
  const entTime = document.getElementById('new-entertainment-time');
  const handleAddEnt = () => {
    const desc = entDesc.value.trim();
    const tag = entTag.value.trim();
    if (!desc && !tag) return;
    currentDayData.entertainment.push({
      id: generateId(),
      tag: tag || '休閒',
      desc: desc,
      completed: false,
      time: (entTime && entTime.value) ? format24hTime(entTime.value) : getCurrentTimeStr()
    });
    entDesc.value = '';
    entTime.value = getCurrentTimeStr();
    saveCurrentDayData();
    renderEntertainmentList();
    if (window.lucide) window.lucide.createIcons();
    showToast('已記錄娛樂項目');
  };
  btnAddEnt.addEventListener('click', handleAddEnt);
  entDesc.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddEnt(); });

  // 8. 學習新增
  const btnAddLearn = document.getElementById('btn-add-learning');
  const learnTag = document.getElementById('new-learning-tag');
  const learnDesc = document.getElementById('new-learning-desc');
  const learnTime = document.getElementById('new-learning-time');
  const handleAddLearn = () => {
    const desc = learnDesc.value.trim();
    const tag = learnTag.value.trim();
    if (!desc && !tag) return;
    currentDayData.learning.push({
      id: generateId(),
      tag: tag || '學習',
      desc: desc,
      completed: false,
      time: (learnTime && learnTime.value) ? format24hTime(learnTime.value) : getCurrentTimeStr()
    });
    learnDesc.value = '';
    learnTime.value = getCurrentTimeStr();
    saveCurrentDayData();
    renderLearningList();
    if (window.lucide) window.lucide.createIcons();
    showToast('已記錄學習項目');
  };
  btnAddLearn.addEventListener('click', handleAddLearn);
  learnDesc.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddLearn(); });

  // 9. 其他事件新增
  const btnAddOther = document.getElementById('btn-add-other');
  const otherDesc = document.getElementById('new-other-desc');
  const otherTime = document.getElementById('new-other-time');
  const handleAddOther = () => {
    const desc = otherDesc.value.trim();
    if (!desc) return;
    currentDayData.other.push({
      id: generateId(),
      desc: desc,
      completed: false,
      time: (otherTime && otherTime.value) ? format24hTime(otherTime.value) : getCurrentTimeStr()
    });
    otherDesc.value = '';
    otherTime.value = getCurrentTimeStr();
    saveCurrentDayData();
    renderOtherList();
    updateProgressAndStats();
    if (window.lucide) window.lucide.createIcons();
    showToast('已記錄其他事項');
  };
  btnAddOther.addEventListener('click', handleAddOther);
  otherDesc.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddOther(); });

  // 10. 列表點擊與編輯監聽器
  const listContainerIds = ['work-list', 'entertainment-list', 'learning-list', 'other-list'];
  listContainerIds.forEach(cId => {
    const el = document.getElementById(cId);
    if (!el) return;

    el.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('item-checkbox')) {
        const cat = target.getAttribute('data-category');
        const id = target.getAttribute('data-id');
        const item = currentDayData[cat]?.find(x => x.id === id);
        if (item) {
          item.completed = target.checked;
          saveCurrentDayData();
          renderTaggedList(currentDayData[cat], `${cat}-list`, cat, '');
          updateProgressAndStats();
          if (window.lucide) window.lucide.createIcons();
        }
        return;
      }

      const timeBtn = target.closest('.btn-update-item-time');
      if (timeBtn) {
        const cat = timeBtn.getAttribute('data-category');
        const id = timeBtn.getAttribute('data-id');
        const item = currentDayData[cat]?.find(x => x.id === id);
        if (item) {
          item.time = getCurrentTimeStr();
          saveCurrentDayData();
          renderTaggedList(currentDayData[cat], `${cat}-list`, cat, '');
          if (window.lucide) window.lucide.createIcons();
          showToast('已更新為現在時間');
        }
        return;
      }

      const delBtn = target.closest('.btn-del-item');
      if (delBtn) {
        const cat = delBtn.getAttribute('data-category');
        const id = delBtn.getAttribute('data-id');
        if (currentDayData[cat]) {
          currentDayData[cat] = currentDayData[cat].filter(x => x.id !== id);
          saveCurrentDayData();
          renderTaggedList(currentDayData[cat], `${cat}-list`, cat, '');
          updateProgressAndStats();
          if (window.lucide) window.lucide.createIcons();
        }
      }
    });

    el.addEventListener('input', (e) => {
      const target = e.target;
      if (target.classList.contains('item-inline-desc')) {
        const cat = target.getAttribute('data-category');
        const id = target.getAttribute('data-id');
        const item = currentDayData[cat]?.find(x => x.id === id);
        if (item) {
          item.desc = target.value;
          saveCurrentDayData();
        }
      } else if (target.classList.contains('item-inline-time')) {
        const cat = target.getAttribute('data-category');
        const id = target.getAttribute('data-id');
        const item = currentDayData[cat]?.find(x => x.id === id);
        if (item) {
          item.time = target.value;
          saveCurrentDayData();
        }
      }
    });

    el.addEventListener('change', (e) => {
      const target = e.target;
      if (target.classList.contains('item-inline-time')) {
        target.value = format24hTime(target.value);
        const cat = target.getAttribute('data-category');
        const id = target.getAttribute('data-id');
        const item = currentDayData[cat]?.find(x => x.id === id);
        if (item) {
          item.time = target.value;
          saveCurrentDayData();
        }
      }
    });
  });

  // 各分類新增列的「現在時間」按鈕
  document.getElementById('btn-now-new-work')?.addEventListener('click', () => {
    const el = document.getElementById('new-work-time');
    if (el) el.value = getCurrentTimeStr();
    showToast('已填入現在時間');
  });

  document.getElementById('btn-now-new-entertainment')?.addEventListener('click', () => {
    const el = document.getElementById('new-entertainment-time');
    if (el) el.value = getCurrentTimeStr();
    showToast('已填入現在時間');
  });

  document.getElementById('btn-now-new-learning')?.addEventListener('click', () => {
    const el = document.getElementById('new-learning-time');
    if (el) el.value = getCurrentTimeStr();
    showToast('已填入現在時間');
  });

  document.getElementById('btn-now-new-other')?.addEventListener('click', () => {
    const el = document.getElementById('new-other-time');
    if (el) el.value = getCurrentTimeStr();
    showToast('已填入現在時間');
  });

  document.getElementById('btn-now-new-tomorrow')?.addEventListener('click', () => {
    const el = document.getElementById('new-tomorrow-time');
    if (el) el.value = getCurrentTimeStr();
    showToast('已填入現在時間');
  });

  // 11. 明日待辦清單操作
  const btnAddTomorrow = document.getElementById('btn-add-tomorrow');
  const tomorrowTagInput = document.getElementById('new-tomorrow-tag');
  const tomorrowDescInput = document.getElementById('new-tomorrow-desc');
  const tomorrowTimeInput = document.getElementById('new-tomorrow-time');
  const handleAddTomorrow = () => {
    const tag = tomorrowTagInput ? tomorrowTagInput.value.trim() : '';
    const desc = tomorrowDescInput ? tomorrowDescInput.value.trim() : '';
    if (!desc && !tag) return;
    const timeVal = (tomorrowTimeInput && tomorrowTimeInput.value) ? format24hTime(tomorrowTimeInput.value) : '';
    currentDayData.tomorrowTodos.push({
      id: generateId(),
      tag: tag || '工作任務',
      desc: desc,
      completed: false,
      time: timeVal
    });
    if (tomorrowDescInput) tomorrowDescInput.value = '';
    if (tomorrowTimeInput) tomorrowTimeInput.value = getCurrentTimeStr();
    saveCurrentDayData();
    renderTomorrowTodos();
    if (window.lucide) window.lucide.createIcons();
    showToast('已新增明日待辦事項');
  };
  btnAddTomorrow?.addEventListener('click', handleAddTomorrow);
  tomorrowTagInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddTomorrow(); });
  tomorrowDescInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddTomorrow(); });

  document.getElementById('tomorrow-todo-list').addEventListener('click', (e) => {
    const target = e.target;

    const timeBtn = target.closest('.btn-update-tomorrow-time');
    if (timeBtn) {
      const id = timeBtn.getAttribute('data-id');
      const item = currentDayData.tomorrowTodos.find(x => x.id === id);
      if (item) {
        item.time = getCurrentTimeStr();
        saveCurrentDayData();
        renderTomorrowTodos();
        if (window.lucide) window.lucide.createIcons();
        showToast('已更新為現在時間');
      }
      return;
    }

    const delBtn = target.closest('.btn-del-tomorrow');
    if (delBtn) {
      const id = delBtn.getAttribute('data-id');
      currentDayData.tomorrowTodos = currentDayData.tomorrowTodos.filter(x => x.id !== id);
      saveCurrentDayData();
      renderTomorrowTodos();
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // 明日待辦行內說明與時間輸入即時儲存與格式化
  document.getElementById('tomorrow-todo-list').addEventListener('input', (e) => {
    const target = e.target;
    if (target.classList.contains('tomorrow-inline-desc')) {
      const id = target.getAttribute('data-id');
      const item = currentDayData.tomorrowTodos.find(x => x.id === id);
      if (item) {
        item.desc = target.value;
        saveCurrentDayData();
      }
    } else if (target.classList.contains('tomorrow-inline-time')) {
      const id = target.getAttribute('data-id');
      const item = currentDayData.tomorrowTodos.find(x => x.id === id);
      if (item) {
        item.time = target.value;
        saveCurrentDayData();
      }
    }
  });

  document.getElementById('tomorrow-todo-list').addEventListener('change', (e) => {
    const target = e.target;
    if (target.classList.contains('tomorrow-inline-time')) {
      target.value = format24hTime(target.value);
      const id = target.getAttribute('data-id');
      const item = currentDayData.tomorrowTodos.find(x => x.id === id);
      if (item) {
        item.time = target.value;
        saveCurrentDayData();
      }
    }
  });

  // 12. 一鍵將今日未完成工作轉移至明日待辦
  const transferUncompleted = () => {
    const uncompletedItems = [];

    currentDayData.work.filter(w => !w.completed && w.desc).forEach(w => {
      uncompletedItems.push({
        tag: w.tag || '工作任務',
        desc: w.desc
      });
    });

    if (uncompletedItems.length === 0) {
      showToast('太棒了！今日所有工作任務均已完成！');
      return;
    }

    let count = 0;
    uncompletedItems.forEach(u => {
      const exists = currentDayData.tomorrowTodos.some(t => t.desc === u.desc && (t.tag || '') === (u.tag || ''));
      if (!exists) {
        currentDayData.tomorrowTodos.push({
          id: generateId(),
          tag: u.tag,
          desc: u.desc,
          completed: false,
          time: ''
        });
        count++;
      }
    });

    saveCurrentDayData();
    renderTomorrowTodos();
    if (window.lucide) window.lucide.createIcons();
    showToast(`已將 ${count} 項未完成事項加入明日待辦！`);
  };

  document.getElementById('btn-transfer-to-tomorrow').addEventListener('click', transferUncompleted);
  document.getElementById('btn-copy-uncompleted-to-tomorrow').addEventListener('click', transferUncompleted);

  // 13. 將昨日預排待辦匯入今日工作
  document.getElementById('btn-import-yesterday-todo').addEventListener('click', () => {
    const parts = currentDateStr.split('-');
    const d = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const yesterdayStr = `${y}-${m}-${day}`;

    const yesterdayData = loadDayData(yesterdayStr);
    if (!yesterdayData.tomorrowTodos || yesterdayData.tomorrowTodos.length === 0) {
      showToast('昨天未規劃待辦事項');
      return;
    }

    let addedCount = 0;
    yesterdayData.tomorrowTodos.forEach(item => {
      let finalTag = (item.tag || '').trim();
      let cleanDesc = (item.desc || '').trim();
      // 兼容舊資料格式：若 item.desc 含有 [工作] 或 [學習] 等前綴，拆解出 tag 與純文字
      const prefixMatch = cleanDesc.match(/^\[(.*?)\]\s*(.*)$/);
      if (prefixMatch) {
        if (!finalTag) finalTag = prefixMatch[1];
        cleanDesc = prefixMatch[2];
      }
      // 排除「昨日待辦」字樣，改為原專案名稱或「工作任務」
      if (finalTag === '昨日待辦' || !finalTag) {
        finalTag = '工作任務';
      }

      const exists = currentDayData.work.some(w => w.desc === cleanDesc);
      if (!exists) {
        currentDayData.work.push({
          id: generateId(),
          tag: finalTag,
          desc: cleanDesc,
          completed: false,
          time: item.time || getCurrentTimeStr()
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      saveCurrentDayData();
      renderWorkList();
      updateProgressAndStats();
      if (window.lucide) window.lucide.createIcons();
      showToast(`成功匯入 ${addedCount} 項昨日待辦至今日工作！`);
    } else {
      showToast('昨日待辦已全部存在於今日清單中');
    }
  });

  // 14. 復盤視窗開啟與複製
  document.getElementById('btn-export-text').addEventListener('click', () => showReviewModal());
  document.getElementById('btn-close-modal').addEventListener('click', hideReviewModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', hideReviewModal);
  document.getElementById('btn-copy-clipboard').addEventListener('click', copyReviewText);

  document.getElementById('review-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('review-modal')) {
      hideReviewModal();
    }
  });

  // 15. 歷史翻閱庫監聽
  const searchInput = document.getElementById('history-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');

  searchInput.addEventListener('input', (e) => {
    historySearchTerm = e.target.value;
    if (historySearchTerm) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }
    renderHistory();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    historySearchTerm = '';
    clearSearchBtn.classList.add('hidden');
    renderHistory();
  });

  document.querySelectorAll('.history-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.history-filter-btn').forEach(b => {
        b.className = 'history-filter-btn px-3 py-1.5 text-xs rounded-lg font-medium transition bg-slate-100 hover:bg-slate-200 text-slate-700';
      });
      btn.className = 'history-filter-btn px-3 py-1.5 text-xs rounded-lg font-medium transition bg-emerald-600 text-white';
      historyRangeFilter = btn.getAttribute('data-range');
      renderHistory();
    });
  });

  document.getElementById('btn-export-history-summary').addEventListener('click', exportHistorySummary);

  document.getElementById('history-cards-container').addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.btn-history-copy');
    if (copyBtn) {
      const dateStr = copyBtn.getAttribute('data-date');
      const data = loadDayData(dateStr);
      const text = generateReviewTextForData(data);
      showReviewModal(text, `歷史復盤 - ${formatReviewDateTitle(dateStr)}`);
      return;
    }

    const loadBtn = e.target.closest('.btn-history-load');
    if (loadBtn) {
      const dateStr = loadBtn.getAttribute('data-date');
      switchDate(dateStr);
      switchMainView('today');
      showToast(`已載入 ${formatReviewDateTitle(dateStr)} 的紀錄`);
      return;
    }

    const delBtn = e.target.closest('.btn-history-delete');
    if (delBtn) {
      const dateStr = delBtn.getAttribute('data-date');
      if (confirm(`確定要刪除 ${dateStr} 的復盤紀錄嗎？刪除後無法復原。`)) {
        localStorage.removeItem(`daily_review_${dateStr}`);
        renderHistory();
        updateHistoryTotalBadge();
        scheduleCloudSync(500); // 同步刪除至雲端
        showToast(`已刪除 ${dateStr} 的紀錄`);
      }
    }
  });

  // 16. 清空當日紀錄
  const handleClearDay = () => {
    if (confirm(`確定要清空 ${currentDateStr} 的所有紀錄嗎？清空後無法復原。`)) {
      currentDayData = createDefaultDayData(currentDateStr);
      saveCurrentDayData();
      render();
      showToast('已清空當日紀錄');
      document.getElementById('mobile-backup-modal').classList.add('hidden');
    }
  };
  document.getElementById('btn-clear-day').addEventListener('click', handleClearDay);
  document.getElementById('btn-mobile-clear-day').addEventListener('click', handleClearDay);

  // 17. 匯出備份 (JSON)
  const handleBackupJson = () => {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('daily_review_')) {
        backup[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily_review_backup_${getTodayDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('完整備份檔案已下載！');
    document.getElementById('mobile-backup-modal').classList.add('hidden');
  };
  document.getElementById('btn-backup-json').addEventListener('click', handleBackupJson);
  document.getElementById('btn-mobile-backup-json').addEventListener('click', handleBackupJson);

  // 18. 匯入備份 (JSON)
  const handleImportJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        let count = 0;
        for (const [k, v] of Object.entries(data)) {
          if (k.startsWith('daily_review_')) {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            count++;
          }
        }
        showToast(`成功還原 ${count} 天的歷史資料！`);
        currentDayData = loadDayData(currentDateStr);
        render();
        renderHistory();
        scheduleCloudSync(1000);
        document.getElementById('mobile-backup-modal').classList.add('hidden');
      } catch (err) {
        alert('備份檔案格式不正確，無法匯入。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  document.getElementById('file-import-json').addEventListener('change', handleImportJson);
  document.getElementById('mobile-file-import-json').addEventListener('change', handleImportJson);

  // 19. 當設備從背景切換回前景時（例如手機解鎖螢幕、電腦切換分頁），自動觸發靜默拉取
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      performCloudSync(false);
    }
  });

  // 20. 實時更新頂部時鐘
  setInterval(() => {
    const d = new Date();
    const clockEl = document.getElementById('current-clock-display');
    if (clockEl) {
      clockEl.textContent = `當下時間：${d.toTimeString().split(' ')[0]}`;
    }
  }, 1000);

  // 21. 全域監聽 24 小時制時間輸入框（HH:mm）過濾非法字元、自動補冒號與失焦校正
  document.addEventListener('input', (e) => {
    if (e.target && e.target.classList.contains('time-24h-input')) {
      let val = e.target.value;
      const filtered = val.replace(/[^0-9:]/g, '');
      if (filtered !== val) {
        e.target.value = filtered;
        val = filtered;
      }
      // 輸入 4 碼純數字 (如 1640) 自動插入冒號為 16:40
      if (/^\d{4}$/.test(val)) {
        e.target.value = val.slice(0, 2) + ':' + val.slice(2, 4);
      }
    }
  });

  document.addEventListener('blur', (e) => {
    if (e.target && e.target.classList.contains('time-24h-input')) {
      if (e.target.value.trim() !== '') {
        const formatted = format24hTime(e.target.value);
        if (formatted !== e.target.value) {
          e.target.value = formatted;
          e.target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  }, true);
}

// 應用程式初始化
window.addEventListener('DOMContentLoaded', () => {
  checkAndInitSampleData();
  currentDayData = loadDayData(currentDateStr);
  initEventListeners();
  render();

  // 若已設定雲端同步，啟動時自動拉取最新資料進行合併
  const cfg = getSyncConfig();
  if (cfg.token) {
    updateSyncStatusUI('success');
    performCloudSync(false);
  } else {
    updateSyncStatusUI('idle');
  }
});
