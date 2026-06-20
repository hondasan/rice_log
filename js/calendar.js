const CalendarView = (() => {
  // 現在カレンダーで表示している年月
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1;
  // カレンダーで選択されている日付 (デフォルト今日、YYYY-MM-DD)
  let selectedDateStr = new Date().toISOString().split('T')[0];

  // まとめて入力モーダルで選択されている日付の配列
  let batchSelectedDates = [];

  /**
   * カレンダーの初期化と描画
   */
  function initCalendar() {
    renderCalendar(currentYear, currentMonth);
    renderDayDetail(selectedDateStr);
  }

  /**
   * カレンダー本体のレンダリング
   */
  function renderCalendar(year, month) {
    currentYear = year;
    currentMonth = month;

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    const startWeekDay = firstDay.getDay(); // 1日の曜日 (0:日 ~ 6:土)
    const totalDays = lastDay.getDate();   // 今月の総日数

    const prevLastDay = new Date(year, month - 1, 0).getDate(); // 先月の総日数

    const calendarBody = document.getElementById('calendar-tbody');
    const monthTitle = document.getElementById('calendar-month-title');

    if (!calendarBody || !monthTitle) return;

    monthTitle.textContent = `${year}年 ${month}月`;

    // 炊飯ログの読み込み
    const settings = Store.getSettings();
    const monthLogs = Store.getCookingLogsByMonth(year, month);
    const cupsPerGram = settings.cupsPerGram || 150;

    // 日ごとの合数の合計値を計算
    const dailyTotalCups = {};
    monthLogs.forEach(log => {
      dailyTotalCups[log.date] = (dailyTotalCups[log.date] || 0) + log.cups;
    });

    // 今月の総合計合数とグラム数
    const totalCups = monthLogs.reduce((sum, log) => sum + log.cups, 0);
    const totalKg = (totalCups * cupsPerGram) / 1000;

    const summaryEl = document.getElementById('calendar-total-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `今月の合計: <span class="number-display" style="color:var(--color-primary); font-size:1.1rem; font-weight:700;">${totalCups}</span> 合 (約 ${totalKg.toFixed(1)} kg)`;
    }

    let html = '';
    let day = 1;
    let nextMonthDay = 1;
    const todayStr = new Date().toISOString().split('T')[0];

    // カレンダーの6行分のセルを描画
    for (let r = 0; r < 6; r++) {
      html += '<tr>';
      for (let d = 0; d < 7; d++) {
        const cellIndex = r * 7 + d;
        
        if (cellIndex < startWeekDay) {
          // 前月の日付
          const prevDay = prevLastDay - startWeekDay + cellIndex + 1;
          html += `<td class="other-month"><div class="calendar-day-cell other-month"><span class="calendar-day-num">${prevDay}</span></div></td>`;
        } else if (day > totalDays) {
          // 翌月の日付
          html += `<td class="other-month"><div class="calendar-day-cell other-month"><span class="calendar-day-num">${nextMonthDay++}</span></div></td>`;
        } else {
          // 今月の日付
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDateStr;
          const cups = dailyTotalCups[dateStr] || 0;
          const hasLog = cups > 0;

          const cellClass = [
            'calendar-day-cell',
            isToday ? 'today' : '',
            isSelected ? 'selected' : '',
            hasLog ? 'has-log' : ''
          ].filter(Boolean).join(' ');

          const cupsDisplay = cups > 0 ? `${cups}合` : '';

          html += `
            <td>
              <div class="${cellClass}" onclick="CalendarView.selectDate('${dateStr}')">
                <span class="calendar-day-num">${day}</span>
                <span class="calendar-day-cups number-display">${cupsDisplay}</span>
              </div>
            </td>
          `;
          day++;
        }
      }
      html += '</tr>';
      
      // 今月の日付をすべて描き終わっていて、かつ行の終わりならループを抜ける
      if (day > totalDays && r >= 4) {
        break;
      }
    }

    calendarBody.innerHTML = html;
  }

  /**
   * カレンダーの前月・翌月移動
   */
  function navigateMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    } else if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    renderCalendar(currentYear, currentMonth);
  }

  /**
   * カレンダーの日付セル選択
   */
  function selectDate(dateStr) {
    selectedDateStr = dateStr;
    
    // カレンダー再描画（選択状態を反映）
    renderCalendar(currentYear, currentMonth);
    // 下部詳細パネルを更新
    renderDayDetail(dateStr);
  }

  /**
   * 日別詳細パネルのレンダリング
   */
  function renderDayDetail(dateStr) {
    const detailPanel = document.getElementById('calendar-day-detail');
    if (!detailPanel) return;

    const logs = Store.getCookingLogsByDate(dateStr);
    const settings = Store.getSettings();
    const presets = settings.frequentCups || [1, 1.5, 2, 3];

    // 日付ヘッダーの曜日を作成
    const dateObj = new Date(dateStr);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayStr = days[dateObj.getDay()];

    let html = `
      <div class="day-detail-title">${month}月${day}日(${dayStr}) の記録</div>
    `;

    // 炊飯ログ一覧
    if (logs.length === 0) {
      html += `<div class="day-detail-empty">この日の炊飯記録はありません</div>`;
    } else {
      html += `<div class="log-list" style="margin-bottom: 16px;">`;
      logs.forEach(log => {
        html += `
          <div class="swipe-delete-container" data-log-id="${log.id}">
            <div class="swipe-delete-wrapper">
              <div class="swipe-content" onclick="CalendarView.startInlineEdit(this, '${log.id}', ${log.cups})">
                <div class="log-item-left">
                  <span class="log-cups number-display" style="font-size:1.1rem;">${log.cups} 合</span>
                </div>
                <span class="log-date" style="color:var(--color-text-sub); font-size:0.8rem;">タップして編集</span>
              </div>
              <div class="swipe-delete-btn" onclick="CalendarView.deleteLog('${log.id}')">削除</div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // クイック追加入力UI (インライン、モーダルなし)
    html += `
      <div class="form-group" style="margin-top:16px; border-top:1.5px dashed var(--color-border); padding-top:16px;">
        <label class="form-label" style="font-size:0.9rem;">この日に炊飯を追加</label>
        <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
          <!-- プリセットボタン -->
          <div style="display:flex; gap:6px; flex-wrap:wrap; flex:1;">
    `;

    presets.forEach(p => {
      const isDefault = p === settings.defaultCups;
      html += `
        <button class="btn btn-secondary btn-sm ${isDefault ? 'btn-primary' : ''}" 
                style="padding: 8px 10px; min-width:44px;" 
                onclick="CalendarView.addQuickLog('${dateStr}', ${p})">
          ${p}合
        </button>
      `;
    });

    html += `
          </div>
          <!-- ステッパー（微調整用） -->
          <div class="stepper" style="height:36px;">
            <button class="stepper-btn" style="width:36px; height:36px; font-size:1rem;" onclick="CalendarView.addStepperLog('${dateStr}', -0.5)">-</button>
            <button class="stepper-btn" style="width:36px; height:36px; font-size:1rem;" onclick="CalendarView.addStepperLog('${dateStr}', 0.5)">+</button>
          </div>
        </div>
      </div>
    `;

    detailPanel.innerHTML = html;

    // スワイプ削除イベントのバインド
    const wrappers = detailPanel.querySelectorAll('.swipe-delete-wrapper');
    wrappers.forEach(wrapper => {
      let startX = 0;
      let currentX = 0;
      let isSwiping = false;

      wrapper.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isSwiping = true;
        wrapper.style.transition = 'none';
      }, { passive: true });

      wrapper.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        currentX = e.touches[0].clientX;
        const diffX = currentX - startX;
        if (diffX < 0) {
          const move = Math.max(diffX, -70);
          wrapper.style.transform = `translateX(${move}px)`;
        } else {
          wrapper.style.transform = 'translateX(0px)';
        }
      }, { passive: true });

      wrapper.addEventListener('touchend', (e) => {
        isSwiping = false;
        wrapper.style.transition = 'transform 0.2s ease-out';
        const diffX = currentX - startX;
        if (diffX < -35) {
          wrapper.style.transform = 'translateX(-70px)';
        } else {
          wrapper.style.transform = 'translateX(0px)';
        }
        startX = 0;
        currentX = 0;
      });
    });
  }

  /**
   * クイック追加
   */
  function addQuickLog(date, cups) {
    Store.addCookingLog({ date, cups });
    App.showToast(`${cups}合 記録しました`);
  }

  /**
   * ステッパーでの追加
   */
  function addStepperLog(date, diff) {
    const settings = Store.getSettings();
    const cups = settings.defaultCups || 2;
    // ステッパーボタンを押した場合は、デフォルト合数を増減させて即追加
    const targetCups = Math.max(0.5, cups + diff);
    addQuickLog(date, targetCups);
  }

  /**
   * インライン編集モードの開始
   */
  function startInlineEdit(contentEl, id, currentCups) {
    const settings = Store.getSettings();
    const presets = settings.frequentCups || [1, 2, 3];
    
    // スワイプコンテンツの中身を書き換え
    contentEl.innerHTML = `
      <div class="inline-edit-area">
        <span class="log-cups number-display" style="font-size:1.1rem; min-width:40px;" id="inline-val-${id}">${currentCups}合</span>
        <div class="inline-edit-cups">
          ${presets.map(p => `
            <button class="inline-edit-btn ${p === currentCups ? 'active' : ''}" 
                    onclick="event.stopPropagation(); CalendarView.updateLogCups('${id}', ${p})">
              ${p}
            </button>
          `).join('')}
          <!-- インライン用微調整ステッパー -->
          <button class="inline-edit-btn" onclick="event.stopPropagation(); CalendarView.adjustInlineCups('${id}', -0.5)">-</button>
          <button class="inline-edit-btn" onclick="event.stopPropagation(); CalendarView.adjustInlineCups('${id}', 0.5)">+</button>
        </div>
        <button class="btn btn-primary btn-sm" style="padding:4px 8px; font-size:0.75rem;" onclick="event.stopPropagation(); CalendarView.finishInlineEdit()">完了</button>
      </div>
    `;
    
    // 他の要素をタップされたときに編集終了できるよう、イベント伝播防止などを挟む
    contentEl.removeAttribute('onclick'); // 多重起動防止
  }

  function finishInlineEdit() {
    renderDayDetail(selectedDateStr);
  }

  function adjustInlineCups(id, diff) {
    const valEl = document.getElementById(`inline-val-${id}`);
    if (valEl) {
      let cups = parseFloat(valEl.innerText);
      cups = Math.max(0.5, cups + diff);
      valEl.innerText = `${cups}合`;
      Store.updateCookingLog(id, { cups });
      App.showToast('記録を更新しました');
    }
  }

  function updateLogCups(id, cups) {
    Store.updateCookingLog(id, { cups });
    App.showToast('記録を更新しました');
  }

  /**
   * 記録の削除
   */
  function deleteLog(id) {
    if (confirm('この炊飯記録を削除しますか？')) {
      Store.deleteCookingLog(id);
      App.showToast('記録を削除しました');
    } else {
      renderDayDetail(selectedDateStr);
    }
  }

  // --- まとめて入力モーダルのロジック ---

  /**
   * まとめて入力モーダルの表示
   */
  function showBatchInputModal() {
    batchSelectedDates = []; // 選択クリア
    const settings = Store.getSettings();
    const defCups = settings.defaultCups || 2;

    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    let html = `
      <div class="modal-header">
        <div class="modal-title">まとめて入力</div>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group text-center">
          <div class="form-label" style="margin-bottom:2px;">いつもの量: <span class="number-display">${defCups}合</span></div>
          <div class="settings-label-desc">📅 タップで炊いた日を選んでね（複数可）</div>
        </div>

        <!-- ミニカレンダーの配置 -->
        <div class="card" style="padding:10px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <button class="calendar-nav-btn" style="width:28px; height:28px; font-size:0.75rem;" onclick="CalendarView.navigateBatchMonth(-1)">◀</button>
            <span id="batch-month-title" style="font-weight:700; font-size:0.95rem;"></span>
            <button class="calendar-nav-btn" style="width:28px; height:28px; font-size:0.75rem;" onclick="CalendarView.navigateBatchMonth(1)">▶</button>
          </div>
          <table class="calendar-table batch-calendar" style="margin-bottom:0;">
            <thead>
              <tr>
                <th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th>
              </tr>
            </thead>
            <tbody id="batch-calendar-tbody">
              <!-- カレンダー描画 -->
            </tbody>
          </table>
        </div>

        <!-- 選択された日のリストと合数調整 -->
        <div class="form-label" id="batch-selected-count">選択中: 0日分</div>
        <div class="batch-selected-list" id="batch-selected-list">
          <div class="day-detail-empty" style="padding:10px 0;">カレンダーで日付をタップしてください</div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <button class="btn btn-secondary btn-sm" onclick="CalendarView.setAllBatchCups(${defCups})">全部 ${defCups}合 にする</button>
        </div>

        <button class="btn btn-primary btn-block" onclick="CalendarView.saveBatchInput()">まとめて記録する 🍚</button>
      </div>
    `;

    App.openModal(html);

    // 初期ミニカレンダー描画
    renderBatchCalendar(year, month);
  }

  // ミニカレンダー年月管理
  let batchYear = new Date().getFullYear();
  let batchMonth = new Date().getMonth() + 1;

  function navigateBatchMonth(dir) {
    batchMonth += dir;
    if (batchMonth < 1) {
      batchMonth = 12;
      batchYear--;
    } else if (batchMonth > 12) {
      batchMonth = 1;
      batchYear++;
    }
    renderBatchCalendar(batchYear, batchMonth);
  }

  /**
   * ミニカレンダー描画
   */
  function renderBatchCalendar(year, month) {
    batchYear = year;
    batchMonth = month;

    const tbody = document.getElementById('batch-calendar-tbody');
    const title = document.getElementById('batch-month-title');

    if (!tbody || !title) return;

    title.textContent = `${year}年 ${month}月`;

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startWeekDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevLastDay = new Date(year, month - 1, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];
    const logs = Store.getCookingLogs();
    const datesWithLogs = new Set(logs.map(log => log.date));

    let html = '';
    let day = 1;
    let nextMonthDay = 1;

    for (let r = 0; r < 6; r++) {
      html += '<tr>';
      for (let d = 0; d < 7; d++) {
        const cellIndex = r * 7 + d;

        if (cellIndex < startWeekDay) {
          const prevDay = prevLastDay - startWeekDay + cellIndex + 1;
          html += `<td class="other-month"><div class="calendar-day-cell other-month"><span class="calendar-day-num" style="font-size:0.8rem;">${prevDay}</span></div></td>`;
        } else if (day > totalDays) {
          html += `<td class="other-month"><div class="calendar-day-cell other-month"><span class="calendar-day-num" style="font-size:0.8rem;">${nextMonthDay++}</span></div></td>`;
        } else {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          // 未来日は選択不可にする
          const isFuture = dateStr > todayStr;
          const isSelected = batchSelectedDates.some(item => item.date === dateStr);
          const hasLog = datesWithLogs.has(dateStr);

          const cellClass = [
            'calendar-day-cell',
            isSelected ? 'selected' : '',
            isFuture ? 'other-month' : ''
          ].filter(Boolean).join(' ');

          html += `
            <td>
              <div class="${cellClass}" ${isFuture ? '' : `onclick="CalendarView.toggleBatchDate('${dateStr}')"`}>
                <span class="calendar-day-num" style="font-size:0.85rem;">${day}</span>
                ${hasLog ? '<div class="batch-calendar-indicator"></div>' : ''}
              </div>
            </td>
          `;
          day++;
        }
      }
      html += '</tr>';
      if (day > totalDays && r >= 4) break;
    }

    tbody.innerHTML = html;
  }

  /**
   * モーダル内の日付選択切り替え
   */
  function toggleBatchDate(dateStr) {
    const settings = Store.getSettings();
    const defCups = settings.defaultCups || 2;

    const index = batchSelectedDates.findIndex(item => item.date === dateStr);

    if (index === -1) {
      // 選択に追加
      batchSelectedDates.push({ date: dateStr, cups: defCups });
    } else {
      // 選択解除
      batchSelectedDates.splice(index, 1);
    }

    // 昇順にソート
    batchSelectedDates.sort((a, b) => a.date.localeCompare(b.date));

    // カレンダー再描画（選択状態をトグル）
    renderBatchCalendar(batchYear, batchMonth);
    // リストの描画
    renderBatchSelectedList();
  }

  /**
   * 選択された日付の編集リスト
   */
  function renderBatchSelectedList() {
    const listEl = document.getElementById('batch-selected-list');
    const countEl = document.getElementById('batch-selected-count');

    if (!listEl || !countEl) return;

    countEl.textContent = `選択中: ${batchSelectedDates.length}日分`;

    if (batchSelectedDates.length === 0) {
      listEl.innerHTML = '<div class="day-detail-empty" style="padding:10px 0;">カレンダーで日付をタップしてください</div>';
      return;
    }

    listEl.innerHTML = batchSelectedDates.map((item, index) => {
      const dateObj = new Date(item.date);
      const month = dateObj.getMonth() + 1;
      const date = dateObj.getDate();
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      const dayStr = days[dateObj.getDay()];

      return `
        <div class="batch-selected-item">
          <span class="batch-selected-date">${month}/${date}(${dayStr})</span>
          <div class="batch-selected-ctrl">
            <button class="batch-mini-btn" onclick="CalendarView.adjustBatchCups(${index}, -0.5)">-</button>
            <span class="batch-mini-value number-display" id="batch-val-${index}">${item.cups}</span>
            <button class="batch-mini-btn" onclick="CalendarView.adjustBatchCups(${index}, 0.5)">+</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * まとめて入力における個別日付の合数微調整
   */
  function adjustBatchCups(index, diff) {
    if (batchSelectedDates[index]) {
      let cups = batchSelectedDates[index].cups;
      cups = Math.max(0.5, cups + diff);
      batchSelectedDates[index].cups = cups;

      const valEl = document.getElementById(`batch-val-${index}`);
      if (valEl) {
        valEl.textContent = cups;
      }
    }
  }

  /**
   * 「全部○合にする」一括処理
   */
  function setAllBatchCups(cups) {
    batchSelectedDates.forEach(item => {
      item.cups = cups;
    });
    renderBatchSelectedList();
  }

  /**
   * 一括保存
   */
  function saveBatchInput() {
    if (batchSelectedDates.length === 0) {
      alert('記録する日付を選択してください');
      return;
    }

    Store.addCookingLogsBatch(batchSelectedDates);
    App.closeModal();
    App.showToast(`${batchSelectedDates.length}日分 記録しました`);
  }

  return {
    initCalendar,
    renderCalendar,
    navigateMonth,
    selectDate,
    renderDayDetail,
    addQuickLog,
    addStepperLog,
    startInlineEdit,
    finishInlineEdit,
    adjustInlineCups,
    updateLogCups,
    deleteLog,
    showBatchInputModal,
    navigateBatchMonth,
    toggleBatchDate,
    adjustBatchCups,
    setAllBatchCups,
    saveBatchInput
  };
})();
