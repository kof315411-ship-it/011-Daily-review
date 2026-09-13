/**
 * 每日復盤與時間手帳 - Core Application Logic
 * 支援全平台自適應、歷史復盤翻閱檢索庫、PWA 離線快取
 */

// --- 全域狀態管理 ---
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
let currentDateStr = getTodayDateStr(); // 格式: YYYY-MM-DD
let currentDayData = null;
let currentView = 'today'; // 'today' | 'history'
let historySearchTerm = '';
let historyRangeFilter = 'all'; // 'all' | '7days' | '30days' | 'thisMonth'

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

// 初次啟動時，若無任何資料，填入圖片中的範例資料讓使用者立即體驗
function checkAndInitSampleData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('daily_review_'));
  if (keys.length === 0) {
    const today = getTodayDateStr();
    const sampleData = {
      date: today,
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
        { id: generateId(), desc: '追蹤農科專結案審核進度', completed: false },
        { id: generateId(), desc: '準備下週會議簡報大綱', completed: false }
      ]
    };
    saveDayData(today, sampleData);
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
    return data;
  } catch (e) {
    console.error('資料解析失敗，載入預設值', e);
    return createDefaultDayData(dateStr);
  }
}

// 儲存某日資料
function saveDayData(dateStr, data) {
  localStorage.setItem(`daily_review_${dateStr}`, JSON.stringify(data));
  updateHistoryTotalBadge();
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
  // 按照日期倒序排列 (最新的在前)
  records.sort((a, b) => b.date.localeCompare(a.date));
  return records;
}

// 更新歷史天數徽章
function updateHistoryTotalBadge() {
  const count = getAllHistoryRecords().length;
  const badge = document.getElementById('history-total-badge');
  if (badge) badge.textContent = count;
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

    tabBtnToday.className = 'px-3 py-1 text-xs font-bold rounded-lg transition shadow-xs bg-white text-emerald-700 flex items-center gap-1.5';
    tabBtnHistory.className = 'px-3 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5';

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

    tabBtnToday.className = 'px-3 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5';
    tabBtnHistory.className = 'px-3 py-1 text-xs font-bold rounded-lg transition shadow-xs bg-white text-emerald-700 flex items-center gap-1.5';

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

  // 重置新增項目的時間預設為當下時間
  const now = getCurrentTimeStr();
  const workTime = document.getElementById('new-work-time');
  if (workTime && !workTime.value) workTime.value = now;
  const entTime = document.getElementById('new-entertainment-time');
  if (entTime && !entTime.value) entTime.value = now;
  const learnTime = document.getElementById('new-learning-time');
  if (learnTime && !learnTime.value) learnTime.value = now;
  const otherTime = document.getElementById('new-other-time');
  if (otherTime && !otherTime.value) otherTime.value = now;
}

// 1. 渲染家務清單
function renderChores() {
  const container = document.getElementById('chores-list');
  container.innerHTML = '';

  if (currentDayData.chores.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-2.5 text-center bg-white/60 rounded-xl border border-dashed border-slate-200">今日尚無家務紀錄，可點擊上方快捷標籤或下方新增</div>`;
    return;
  }

  currentDayData.chores.forEach(item => {
    const div = document.createElement('div');
    div.className = `flex items-center justify-between gap-2 p-2 sm:p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-teal-300 transition ${item.completed ? 'item-completed bg-slate-50/80' : ''}`;
    div.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 min-w-0">
        <input type="checkbox" class="custom-checkbox chore-checkbox" data-id="${item.id}" ${item.completed ? 'checked' : ''} />
        <span class="text-xs font-semibold text-slate-800 item-text truncate">${escapeHtml(item.name)}</span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-500 text-[11px] mono-font">
          <span>${item.time || '--:--'}</span>
          <button type="button" class="btn-update-chore-time text-slate-400 hover:text-teal-600" data-id="${item.id}" title="更新為現在時間">
            <i data-lucide="clock" class="w-3 h-3"></i>
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

    const check = row.querySelector('.diet-check');
    const timeInputs = row.querySelectorAll('.diet-time');
    const contentInput = row.querySelector('.diet-content');

    check.checked = !!mealData.completed;
    timeInputs.forEach(t => t.value = mealData.time || '');
    contentInput.value = mealData.content || '';

    if (mealData.completed) {
      row.classList.add('item-completed');
    } else {
      row.classList.remove('item-completed');
    }
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

  listData.forEach(item => {
    const div = document.createElement('div');
    div.className = `flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition ${item.completed ? 'item-completed bg-slate-50/80' : ''}`;
    
    div.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 min-w-0">
        <input type="checkbox" class="custom-checkbox item-checkbox" data-category="${categoryKey}" data-id="${item.id}" ${item.completed ? 'checked' : ''} />
        <span class="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700 flex-shrink-0 border border-slate-200/80">
          ${escapeHtml(item.tag || '項目')}
        </span>
        <input type="text" class="item-inline-desc flex-1 text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition py-0.5" data-category="${categoryKey}" data-id="${item.id}" value="${escapeHtml(item.desc || '')}" placeholder="點擊編輯內容..." />
      </div>
      <div class="flex items-center justify-end gap-2 flex-shrink-0 self-end sm:self-auto">
        <div class="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600 text-xs mono-font">
          <input type="time" class="item-inline-time bg-transparent text-xs w-16 focus:outline-none" data-category="${categoryKey}" data-id="${item.id}" value="${item.time || ''}" />
          <button type="button" class="btn-update-item-time text-slate-400 hover:text-blue-600" data-category="${categoryKey}" data-id="${item.id}" title="重設為現在時間">
            <i data-lucide="clock" class="w-3 h-3"></i>
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
    div.className = `flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 transition ${item.completed ? 'item-completed bg-slate-50/80' : ''}`;
    div.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 min-w-0">
        <input type="checkbox" class="custom-checkbox item-checkbox" data-category="other" data-id="${item.id}" ${item.completed ? 'checked' : ''} />
        <input type="text" class="item-inline-desc flex-1 text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-none transition py-0.5" data-category="other" data-id="${item.id}" value="${escapeHtml(item.desc || '')}" placeholder="點擊編輯內容..." />
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600 text-xs mono-font">
          <input type="time" class="item-inline-time bg-transparent text-xs w-16 focus:outline-none" data-category="other" data-id="${item.id}" value="${item.time || ''}" />
          <button type="button" class="btn-update-item-time text-slate-400 hover:text-amber-600" data-category="other" data-id="${item.id}" title="重設為現在時間">
            <i data-lucide="clock" class="w-3 h-3"></i>
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

// 6. 渲染明日待辦事項
function renderTomorrowTodos() {
  const container = document.getElementById('tomorrow-todo-list');
  container.innerHTML = '';

  if (!currentDayData.tomorrowTodos || currentDayData.tomorrowTodos.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-3 text-center bg-white/70 rounded-xl border border-dashed border-amber-200">尚無明日待辦事項，點擊上方按鈕可一鍵將未完成轉入</div>`;
    return;
  }

  currentDayData.tomorrowTodos.forEach(item => {
    const div = document.createElement('div');
    div.className = `flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-amber-200 shadow-2xs hover:border-amber-300 transition ${item.completed ? 'item-completed bg-slate-50/70' : ''}`;
    div.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <input type="checkbox" class="custom-checkbox tomorrow-checkbox" data-id="${item.id}" ${item.completed ? 'checked' : ''} />
        <span class="text-xs text-slate-800 item-text flex-1 truncate">${escapeHtml(item.desc)}</span>
      </div>
      <button type="button" class="btn-del-tomorrow text-slate-300 hover:text-rose-500 p-1 transition" data-id="${item.id}" title="刪除">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    `;
    container.appendChild(div);
  });
}

// 計算完成度進度與統計
function calculateDayStats(dayData) {
  let total = 0;
  let completed = 0;

  // 家務
  dayData.chores.forEach(i => { total++; if (i.completed) completed++; });

  // 飲食 (有填寫內容才計入統計)
  ['breakfast', 'lunch', 'dinner', 'snack'].forEach(k => {
    const m = dayData.diet[k];
    if (m && m.content && m.content.trim() !== '') {
      total++;
      if (m.completed) completed++;
    }
  });

  // 工作
  dayData.work.forEach(i => { total++; if (i.completed) completed++; });

  // 娛樂
  dayData.entertainment.forEach(i => { total++; if (i.completed) completed++; });

  // 學習
  dayData.learning.forEach(i => { total++; if (i.completed) completed++; });

  // 其他
  dayData.other.forEach(i => { total++; if (i.completed) completed++; });

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

function updateProgressAndStats() {
  const { total, completed, percentage } = calculateDayStats(currentDayData);
  const progressBar = document.getElementById('daily-progress-bar');
  const statsText = document.getElementById('stats-completion-text');

  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (statsText) {
    statsText.textContent = `今日完成進度：${completed} / ${total} 項目 (${percentage}%)`;
  }
}

// --- 復盤文字生成引擎 (對齊使用者上傳格式) ---
function generateReviewTextForData(data) {
  const title = formatReviewDateTitle(data.date);
  const lines = [title];

  // 1. 生活
  lines.push('生活');
  // 1.1 家務
  if (data.chores && data.chores.length > 0) {
    const choresText = data.chores.map(c => c.name).join('、');
    lines.push(`  · 家務：${choresText}`);
  } else {
    lines.push('  · 家務：');
  }

  // 1.2 飲食
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

  // 2. 工作
  lines.push('工作');
  if (data.work && data.work.length > 0) {
    data.work.forEach(w => {
      const tag = w.tag ? `${w.tag}：` : '';
      lines.push(`  · ${tag}${w.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  // 3. 娛樂
  lines.push('娛樂');
  if (data.entertainment && data.entertainment.length > 0) {
    data.entertainment.forEach(e => {
      const tag = e.tag ? `${e.tag}：` : '';
      lines.push(`  · ${tag}${e.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  // 4. 學習
  lines.push('學習');
  if (data.learning && data.learning.length > 0) {
    data.learning.forEach(l => {
      const tag = l.tag ? `${l.tag}：` : '';
      lines.push(`  · ${tag}${l.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  // 5. 其他事件
  lines.push('其他事件');
  if (data.other && data.other.length > 0) {
    data.other.forEach(o => {
      lines.push(`  · ${o.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  // 6. 明日待辦事項 (若有)
  if (data.tomorrowTodos && data.tomorrowTodos.length > 0) {
    lines.push('');
    lines.push('明日待辦事項');
    data.tomorrowTodos.forEach(t => {
      lines.push(`  · ${t.desc || ''}`);
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

// 高亮搜尋關鍵字
function highlightText(str, term) {
  if (!str) return '';
  const escaped = escapeHtml(str);
  if (!term || !term.trim()) return escaped;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// 篩選與渲染歷史紀錄
function renderHistory() {
  const container = document.getElementById('history-cards-container');
  const emptyState = document.getElementById('history-empty-state');
  container.innerHTML = '';

  const allRecords = getAllHistoryRecords();
  const now = new Date();
  const todayStr = getTodayDateStr();

  // 1. 時間區間過濾
  const filteredRecords = allRecords.filter(item => {
    if (historyRangeFilter === 'all') return true;
    
    const itemDate = new Date(item.date);
    const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));

    if (historyRangeFilter === '7days') {
      return diffDays >= 0 && diffDays <= 7;
    }
    if (historyRangeFilter === '30days') {
      return diffDays >= 0 && diffDays <= 30;
    }
    if (historyRangeFilter === 'thisMonth') {
      return item.date.startsWith(todayStr.slice(0, 7));
    }
    return true;
  });

  // 2. 關鍵字搜尋過濾
  const term = historySearchTerm.trim().toLowerCase();
  const matchedRecords = filteredRecords.filter(item => {
    if (!term) return true;
    // 檢查日期
    if (item.date.toLowerCase().includes(term)) return true;
    const dateTitle = formatReviewDateTitle(item.date).toLowerCase();
    if (dateTitle.includes(term)) return true;

    // 檢查家務
    if (item.chores.some(c => c.name.toLowerCase().includes(term))) return true;

    // 檢查飲食
    const dietVals = Object.values(item.diet || {}).map(d => (d.content || '').toLowerCase());
    if (dietVals.some(v => v.includes(term))) return true;

    // 檢查工作
    if (item.work.some(w => (w.tag || '').toLowerCase().includes(term) || (w.desc || '').toLowerCase().includes(term))) return true;

    // 檢查娛樂
    if (item.entertainment.some(e => (e.tag || '').toLowerCase().includes(term) || (e.desc || '').toLowerCase().includes(term))) return true;

    // 檢查學習
    if (item.learning.some(l => (l.tag || '').toLowerCase().includes(term) || (l.desc || '').toLowerCase().includes(term))) return true;

    // 檢查其他
    if (item.other.some(o => (o.desc || '').toLowerCase().includes(term))) return true;

    // 檢查明日待辦
    if (item.tomorrowTodos.some(t => (t.desc || '').toLowerCase().includes(term))) return true;

    return false;
  });

  if (matchedRecords.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  // 渲染卡片
  matchedRecords.forEach(dayItem => {
    const card = document.createElement('div');
    card.className = 'history-card bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col justify-between';

    const { total, completed, percentage } = calculateDayStats(dayItem);
    const dateTitle = formatReviewDateTitle(dayItem.date);
    const fullDate = formatFullDateTitle(dayItem.date);

    // 家務摘錄
    const choreNames = dayItem.chores.map(c => highlightText(c.name, term)).join('、') || '無';

    // 飲食摘錄
    const dietSummary = [
      dayItem.diet.breakfast?.content ? `早：${highlightText(dayItem.diet.breakfast.content, term)}` : '',
      dayItem.diet.lunch?.content ? `午：${highlightText(dayItem.diet.lunch.content, term)}` : '',
      dayItem.diet.dinner?.content ? `晚：${highlightText(dayItem.diet.dinner.content, term)}` : ''
    ].filter(Boolean).join(' | ') || '無填寫';

    // 工作摘錄
    let workHtml = '';
    if (dayItem.work.length > 0) {
      workHtml = dayItem.work.map(w => `
        <li class="flex items-start gap-1.5 truncate">
          <span class="text-blue-600 flex-shrink-0 font-bold">·</span>
          <span class="truncate">${w.tag ? `<strong>${highlightText(w.tag, term)}</strong>：` : ''}${highlightText(w.desc, term)}</span>
        </li>
      `).join('');
    } else {
      workHtml = '<li class="text-slate-400">無工作記錄</li>';
    }

    // 娛樂摘錄
    let entHtml = '';
    if (dayItem.entertainment.length > 0) {
      entHtml = dayItem.entertainment.map(e => `
        <li class="flex items-start gap-1.5 truncate">
          <span class="text-pink-600 flex-shrink-0 font-bold">·</span>
          <span class="truncate">${e.tag ? `<strong>${highlightText(e.tag, term)}</strong>：` : ''}${highlightText(e.desc, term)}</span>
        </li>
      `).join('');
    } else {
      entHtml = '<li class="text-slate-400">無娛樂記錄</li>';
    }

    // 學習摘錄
    let learnHtml = '';
    if (dayItem.learning.length > 0) {
      learnHtml = dayItem.learning.map(l => `
        <li class="flex items-start gap-1.5 truncate">
          <span class="text-indigo-600 flex-shrink-0 font-bold">·</span>
          <span class="truncate">${l.tag ? `<strong>${highlightText(l.tag, term)}</strong>：` : ''}${highlightText(l.desc, term)}</span>
        </li>
      `).join('');
    } else {
      learnHtml = '<li class="text-slate-400">無學習記錄</li>';
    }

    // 明日待辦摘錄
    let todoHtml = '';
    if (dayItem.tomorrowTodos.length > 0) {
      todoHtml = dayItem.tomorrowTodos.map(t => `
        <li class="truncate text-amber-900/90 font-medium">· ${highlightText(t.desc, term)}</li>
      `).join('');
    }

    card.innerHTML = `
      <div>
        <!-- 卡片頭部：日期與完成度標籤 -->
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div>
            <span class="text-base font-bold text-slate-900">${dateTitle}</span>
            <span class="text-xs text-slate-400 ml-1.5">${fullDate}</span>
          </div>
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${percentage === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}">
            完成度 ${percentage}% (${completed}/${total})
          </span>
        </div>

        <!-- 內容摘要區域 (還原圖片清單版型) -->
        <div class="space-y-2.5 text-xs text-slate-700">
          <!-- 生活 -->
          <div class="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
            <span class="font-bold text-teal-800 block mb-1">🌿 生活</span>
            <p class="text-slate-600 truncate"><strong class="text-slate-700">家務：</strong>${choreNames}</p>
            <p class="text-slate-600 truncate mt-0.5"><strong class="text-slate-700">飲食：</strong>${dietSummary}</p>
          </div>

          <!-- 工作 -->
          <div class="p-2 rounded-xl border border-slate-100">
            <span class="font-bold text-blue-800 block mb-1">💼 工作</span>
            <ul class="space-y-0.5">${workHtml}</ul>
          </div>

          <!-- 娛樂與學習 (並排或精簡) -->
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

      <!-- 卡片底部按鈕 -->
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

// 匯出當前篩選期間的所有復盤統整報告
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

// 輔助防 XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 切換日期
function switchDate(newDateStr) {
  saveCurrentDayData();
  currentDateStr = newDateStr;
  currentDayData = loadDayData(currentDateStr);
  render();
}

// 儲存當前日期的所有在畫面上改動
function saveCurrentDayData() {
  if (currentDayData) {
    saveDayData(currentDateStr, currentDayData);
  }
}

// --- 事件監聽器註冊 ---
function initEventListeners() {
  // 1. 視圖切換標籤 (今日記錄 vs 歷史翻閱)
  document.getElementById('tab-btn-today').addEventListener('click', () => switchMainView('today'));
  document.getElementById('tab-btn-history').addEventListener('click', () => switchMainView('history'));

  // 2. 行動端底部導航
  const navToday = document.getElementById('mobile-nav-today');
  const navHistory = document.getElementById('mobile-nav-history');
  const navExport = document.getElementById('mobile-nav-export');
  const navBackup = document.getElementById('mobile-nav-backup');

  if (navToday) navToday.addEventListener('click', () => switchMainView('today'));
  if (navHistory) navHistory.addEventListener('click', () => switchMainView('history'));
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

  // 3. 家務快捷標籤點擊
  document.querySelectorAll('.quick-chore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      addChore(name);
    });
  });

  // 家務手動輸入
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

  function addChore(name) {
    currentDayData.chores.push({
      id: generateId(),
      name: name,
      completed: true,
      time: getCurrentTimeStr()
    });
    saveCurrentDayData();
    renderChores();
    updateProgressAndStats();
    if (window.lucide) window.lucide.createIcons();
    showToast(`已記錄家務：${name}`);
  }

  // 家務列表事件 (Checkbox, 更新時間, 刪除)
  document.getElementById('chores-list').addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('chore-checkbox')) {
      const id = target.getAttribute('data-id');
      const item = currentDayData.chores.find(c => c.id === id);
      if (item) {
        item.completed = target.checked;
        saveCurrentDayData();
        renderChores();
        updateProgressAndStats();
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }

    const timeBtn = target.closest('.btn-update-chore-time');
    if (timeBtn) {
      const id = timeBtn.getAttribute('data-id');
      const item = currentDayData.chores.find(c => c.id === id);
      if (item) {
        item.time = getCurrentTimeStr();
        saveCurrentDayData();
        renderChores();
        if (window.lucide) window.lucide.createIcons();
        showToast('已更新為當下時間');
      }
      return;
    }

    const delBtn = target.closest('.btn-del-chore');
    if (delBtn) {
      const id = delBtn.getAttribute('data-id');
      currentDayData.chores = currentDayData.chores.filter(c => c.id !== id);
      saveCurrentDayData();
      renderChores();
      updateProgressAndStats();
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // 4. 飲食輸入監聽
  document.getElementById('diet-list').addEventListener('change', (e) => {
    const row = e.target.closest('.diet-row');
    if (!row) return;
    const mealKey = row.getAttribute('data-diet-key');
    const check = row.querySelector('.diet-check');
    const timeInput = row.querySelector('.diet-time');
    const contentInput = row.querySelector('.diet-content');

    if (currentDayData.diet[mealKey]) {
      currentDayData.diet[mealKey].completed = check.checked;
      currentDayData.diet[mealKey].time = timeInput.value;
      currentDayData.diet[mealKey].content = contentInput.value;
      saveCurrentDayData();
      renderDiet();
      updateProgressAndStats();
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
        showToast('已填入當下時間');
      }
    });
  });

  // 5. 工作新增
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
      completed: true,
      time: workTime.value || getCurrentTimeStr()
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

  // 6. 娛樂新增
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
      completed: true,
      time: entTime.value || getCurrentTimeStr()
    });
    entDesc.value = '';
    entTime.value = getCurrentTimeStr();
    saveCurrentDayData();
    renderEntertainmentList();
    updateProgressAndStats();
    if (window.lucide) window.lucide.createIcons();
    showToast('已記錄娛樂項目');
  };
  btnAddEnt.addEventListener('click', handleAddEnt);
  entDesc.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddEnt(); });

  // 7. 學習新增
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
      completed: true,
      time: learnTime.value || getCurrentTimeStr()
    });
    learnDesc.value = '';
    learnTime.value = getCurrentTimeStr();
    saveCurrentDayData();
    renderLearningList();
    updateProgressAndStats();
    if (window.lucide) window.lucide.createIcons();
    showToast('已記錄學習項目');
  };
  btnAddLearn.addEventListener('click', handleAddLearn);
  learnDesc.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddLearn(); });

  // 8. 其他事件新增
  const btnAddOther = document.getElementById('btn-add-other');
  const otherDesc = document.getElementById('new-other-desc');
  const otherTime = document.getElementById('new-other-time');
  const handleAddOther = () => {
    const desc = otherDesc.value.trim();
    if (!desc) return;
    currentDayData.other.push({
      id: generateId(),
      desc: desc,
      completed: true,
      time: otherTime.value || getCurrentTimeStr()
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

  // 9. 通用列表監聽器（工作、娛樂、學習、其他事件）：勾選、編輯、重設時間、刪除
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
          showToast('已更新為當下時間');
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
  });

  // 10. 明日待辦清單操作
  const btnAddTomorrow = document.getElementById('btn-add-tomorrow');
  const tomorrowInput = document.getElementById('new-tomorrow-input');
  const handleAddTomorrow = () => {
    const desc = tomorrowInput.value.trim();
    if (!desc) return;
    currentDayData.tomorrowTodos.push({
      id: generateId(),
      desc: desc,
      completed: false
    });
    tomorrowInput.value = '';
    saveCurrentDayData();
    renderTomorrowTodos();
    if (window.lucide) window.lucide.createIcons();
    showToast('已新增明日待辦事項');
  };
  btnAddTomorrow.addEventListener('click', handleAddTomorrow);
  tomorrowInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddTomorrow(); });

  document.getElementById('tomorrow-todo-list').addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('tomorrow-checkbox')) {
      const id = target.getAttribute('data-id');
      const item = currentDayData.tomorrowTodos.find(x => x.id === id);
      if (item) {
        item.completed = target.checked;
        saveCurrentDayData();
        renderTomorrowTodos();
        if (window.lucide) window.lucide.createIcons();
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

  // 11. 一鍵將今日未完成事項轉移至明日待辦
  const transferUncompleted = () => {
    const uncompletedItems = [];

    currentDayData.work.filter(w => !w.completed && w.desc).forEach(w => {
      uncompletedItems.push(`[工作] ${w.tag ? w.tag + '：' : ''}${w.desc}`);
    });

    currentDayData.learning.filter(l => !l.completed && l.desc).forEach(l => {
      uncompletedItems.push(`[學習] ${l.tag ? l.tag + '：' : ''}${l.desc}`);
    });

    currentDayData.other.filter(o => !o.completed && o.desc).forEach(o => {
      uncompletedItems.push(`[其他] ${o.desc}`);
    });

    if (uncompletedItems.length === 0) {
      showToast('太棒了！今日所有工作與學習事項均已完成！');
      return;
    }

    let count = 0;
    uncompletedItems.forEach(desc => {
      const exists = currentDayData.tomorrowTodos.some(t => t.desc === desc);
      if (!exists) {
        currentDayData.tomorrowTodos.push({
          id: generateId(),
          desc: desc,
          completed: false
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

  // 12. 將昨日預排待辦匯入今日工作
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
      const cleanDesc = item.desc.replace(/^\[(工作|學習|其他)\]\s*/, '');
      const exists = currentDayData.work.some(w => w.desc === cleanDesc);
      if (!exists) {
        currentDayData.work.push({
          id: generateId(),
          tag: '昨日待辦',
          desc: cleanDesc,
          completed: false,
          time: getCurrentTimeStr()
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

  // 13. 復盤視窗開啟與複製
  document.getElementById('btn-export-text').addEventListener('click', () => showReviewModal());
  document.getElementById('btn-close-modal').addEventListener('click', hideReviewModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', hideReviewModal);
  document.getElementById('btn-copy-clipboard').addEventListener('click', copyReviewText);

  document.getElementById('review-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('review-modal')) {
      hideReviewModal();
    }
  });

  // 14. 歷史翻閱庫監聽 (搜尋、篩選、卡片點擊)
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

  // 篩選區間按鈕點擊
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

  // 匯出歷史區間統整報告
  document.getElementById('btn-export-history-summary').addEventListener('click', exportHistorySummary);

  // 歷史卡片內操作委派 (複製、載入編輯、刪除)
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
        showToast(`已刪除 ${dateStr} 的紀錄`);
      }
    }
  });

  // 15. 清空當日紀錄 (電腦端與手機端)
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

  // 16. 匯出備份 (JSON)
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

  // 17. 匯入備份 (JSON)
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

  // 實時更新頂部時鐘
  setInterval(() => {
    const d = new Date();
    const clockEl = document.getElementById('current-clock-display');
    if (clockEl) {
      clockEl.textContent = `當下時間：${d.toTimeString().split(' ')[0]}`;
    }
  }, 1000);
}

// 應用程式初始化
window.addEventListener('DOMContentLoaded', () => {
  checkAndInitSampleData();
  currentDayData = loadDayData(currentDateStr);
  initEventListeners();
  render();
});
