/**
 * 每日復盤與時間手帳 - Core Application Logic
 */

// --- 全域狀態管理 ---
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
let currentDateStr = getTodayDateStr(); // 格式: YYYY-MM-DD
let currentDayData = null;

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
    container.innerHTML = `<div class="text-xs text-slate-400 py-2 text-center bg-white/60 rounded-lg border border-dashed border-slate-200">今日尚無家務紀錄，可點擊上方快捷標籤或下方新增</div>`;
    return;
  }

  currentDayData.chores.forEach(item => {
    const div = document.createElement('div');
    div.className = `flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-teal-300 transition ${item.completed ? 'item-completed bg-slate-50/80' : ''}`;
    div.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 min-w-0">
        <input type="checkbox" class="custom-checkbox chore-checkbox" data-id="${item.id}" ${item.completed ? 'checked' : ''} />
        <span class="text-xs font-semibold text-slate-800 item-text truncate">${escapeHtml(item.name)}</span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 text-[11px] mono-font">
          <span>${item.time || '--:--'}</span>
          <button type="button" class="btn-update-chore-time text-slate-400 hover:text-teal-600" data-id="${item.id}" title="更新為現在時間">
            <i data-lucide="clock" class="w-3 h-3"></i>
          </button>
        </div>
        <button type="button" class="btn-del-chore text-slate-300 hover:text-rose-500 p-1 transition" data-id="${item.id}" title="刪除">
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
    const timeInput = row.querySelector('.diet-time');
    const contentInput = row.querySelector('.diet-content');

    check.checked = !!mealData.completed;
    timeInput.value = mealData.time || '';
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
function updateProgressAndStats() {
  let total = 0;
  let completed = 0;

  // 家務
  currentDayData.chores.forEach(i => { total++; if (i.completed) completed++; });

  // 飲食 (有填寫內容才計入統計)
  ['breakfast', 'lunch', 'dinner', 'snack'].forEach(k => {
    const m = currentDayData.diet[k];
    if (m && m.content && m.content.trim() !== '') {
      total++;
      if (m.completed) completed++;
    }
  });

  // 工作
  currentDayData.work.forEach(i => { total++; if (i.completed) completed++; });

  // 娛樂
  currentDayData.entertainment.forEach(i => { total++; if (i.completed) completed++; });

  // 學習
  currentDayData.learning.forEach(i => { total++; if (i.completed) completed++; });

  // 其他
  currentDayData.other.forEach(i => { total++; if (i.completed) completed++; });

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  const progressBar = document.getElementById('daily-progress-bar');
  const statsText = document.getElementById('stats-completion-text');

  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (statsText) {
    statsText.textContent = `今日完成進度：${completed} / ${total} 項目 (${percentage}%)`;
  }
}

// --- 復盤文字生成引擎 (對齊使用者上傳格式) ---
function generateReviewText() {
  const title = formatReviewDateTitle(currentDateStr);
  const lines = [title];

  // 1. 生活
  lines.push('生活');
  // 1.1 家務
  if (currentDayData.chores && currentDayData.chores.length > 0) {
    const choresText = currentDayData.chores.map(c => c.name).join('、');
    lines.push(`  · 家務：${choresText}`);
  } else {
    lines.push('  · 家務：');
  }

  // 1.2 飲食
  lines.push('  · 飲食：');
  const bf = currentDayData.diet.breakfast?.content || '';
  const lu = currentDayData.diet.lunch?.content || '';
  const di = currentDayData.diet.dinner?.content || '';
  const sn = currentDayData.diet.snack?.content || '';

  lines.push(`  - 早餐：${bf}`);
  lines.push(`  - 午餐：${lu}`);
  lines.push(`  - 晚餐：${di}`);
  if (sn.trim()) {
    lines.push(`  - 點心/飲品：${sn}`);
  }

  // 2. 工作
  lines.push('工作');
  if (currentDayData.work && currentDayData.work.length > 0) {
    currentDayData.work.forEach(w => {
      const tag = w.tag ? `${w.tag}：` : '';
      lines.push(`  · ${tag}${w.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  // 3. 娛樂
  lines.push('娛樂');
  if (currentDayData.entertainment && currentDayData.entertainment.length > 0) {
    currentDayData.entertainment.forEach(e => {
      const tag = e.tag ? `${e.tag}：` : '';
      lines.push(`  · ${tag}${e.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  // 4. 學習
  lines.push('學習');
  if (currentDayData.learning && currentDayData.learning.length > 0) {
    currentDayData.learning.forEach(l => {
      const tag = l.tag ? `${l.tag}：` : '';
      lines.push(`  · ${tag}${l.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  // 5. 其他事件
  lines.push('其他事件');
  if (currentDayData.other && currentDayData.other.length > 0) {
    currentDayData.other.forEach(o => {
      lines.push(`  · ${o.desc || ''}`);
    });
  } else {
    lines.push('  · ');
  }

  // 6. 明日待辦事項 (若有)
  if (currentDayData.tomorrowTodos && currentDayData.tomorrowTodos.length > 0) {
    lines.push('');
    lines.push('明日待辦事項');
    currentDayData.tomorrowTodos.forEach(t => {
      lines.push(`  · ${t.desc || ''}`);
    });
  }

  return lines.join('\n');
}

// 彈出復盤視窗
function showReviewModal() {
  const text = generateReviewText();
  const output = document.getElementById('review-text-output');
  output.textContent = text;
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
    console.error('複製失敗', err);
    // 退避方案
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('復盤文本已成功複製到剪貼簿！');
  }
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

  // 1. 家務快捷標籤點擊
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

  // 家務列表內事件委派 (Checkbox, 更新時間, 刪除)
  document.getElementById('chores-list').addEventListener('click', (e) => {
    const target = e.target;
    // 勾選
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

    // 更新時間按鈕
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

    // 刪除按鈕
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

  // 2. 飲食輸入監聽
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

  // 飲食現在時間按鈕
  document.querySelectorAll('#diet-list .btn-now-time').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.diet-row');
      const timeInput = row.querySelector('.diet-time');
      const mealKey = row.getAttribute('data-diet-key');
      const now = getCurrentTimeStr();
      timeInput.value = now;
      if (currentDayData.diet[mealKey]) {
        currentDayData.diet[mealKey].time = now;
        saveCurrentDayData();
        showToast('已填入當下時間');
      }
    });
  });

  // 3. 工作新增
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

  // 4. 娛樂新增
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

  // 5. 學習新增
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

  // 6. 其他事件新增
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

  // 通用列表監聽器（工作、娛樂、學習、其他事件）：勾選、編輯、重設時間、刪除
  const listContainerIds = ['work-list', 'entertainment-list', 'learning-list', 'other-list'];
  listContainerIds.forEach(cId => {
    const el = document.getElementById(cId);
    if (!el) return;

    el.addEventListener('click', (e) => {
      const target = e.target;
      // 勾選
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

      // 重設為當前時間按鈕
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

      // 刪除按鈕
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

    // 文字即時修改
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

  // 7. 明日待辦清單操作
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

  // 8. 一鍵將今日未完成事項轉移至明日待辦
  const transferUncompleted = () => {
    const uncompletedItems = [];

    // 檢查工作
    currentDayData.work.filter(w => !w.completed && w.desc).forEach(w => {
      uncompletedItems.push(`[工作] ${w.tag ? w.tag + '：' : ''}${w.desc}`);
    });

    // 檢查學習
    currentDayData.learning.filter(l => !l.completed && l.desc).forEach(l => {
      uncompletedItems.push(`[學習] ${l.tag ? l.tag + '：' : ''}${l.desc}`);
    });

    // 檢查其他
    currentDayData.other.filter(o => !o.completed && o.desc).forEach(o => {
      uncompletedItems.push(`[其他] ${o.desc}`);
    });

    if (uncompletedItems.length === 0) {
      showToast('太棒了！今日所有工作與學習事項均已完成！');
      return;
    }

    // 將未完成項加入 tomorrowTodos
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

  // 9. 將昨日預排待辦匯入今日工作
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

  // 10. 復盤視窗開啟與複製
  document.getElementById('btn-export-text').addEventListener('click', showReviewModal);
  const mobileBtn = document.getElementById('btn-export-text-mobile');
  if (mobileBtn) mobileBtn.addEventListener('click', showReviewModal);

  document.getElementById('btn-close-modal').addEventListener('click', hideReviewModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', hideReviewModal);
  document.getElementById('btn-copy-clipboard').addEventListener('click', copyReviewText);

  // 點擊遮罩關閉 Modal
  document.getElementById('review-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('review-modal')) {
      hideReviewModal();
    }
  });

  // 11. 清空當日紀錄
  document.getElementById('btn-clear-day').addEventListener('click', () => {
    if (confirm(`確定要清空 ${currentDateStr} 的所有紀錄嗎？清空後無法復原。`)) {
      currentDayData = createDefaultDayData(currentDateStr);
      saveCurrentDayData();
      render();
      showToast('已清空當日紀錄');
    }
  });

  // 12. 匯出備份 (JSON)
  document.getElementById('btn-backup-json').addEventListener('click', () => {
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
  });

  // 13. 匯入備份 (JSON)
  document.getElementById('file-import-json').addEventListener('change', (e) => {
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
      } catch (err) {
        alert('備份檔案格式不正確，無法匯入。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

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
