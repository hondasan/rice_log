const StatsView = (() => {
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth() + 1;
  let activeTab = 'monthly'; // 'monthly' | 'yearly'

  /**
   * 統計の初期化
   */
  function initStats() {
    setupStatsEvents();
    renderStats();
  }

  /**
   * イベントバインディング
   */
  function setupStatsEvents() {
    const btnMonthly = document.getElementById('stats-btn-monthly');
    const btnYearly = document.getElementById('stats-btn-yearly');
    const btnPrev = document.getElementById('stats-prev-btn');
    const btnNext = document.getElementById('stats-next-btn');

    if (btnMonthly && btnYearly) {
      btnMonthly.onclick = () => {
        activeTab = 'monthly';
        btnMonthly.classList.add('active');
        btnYearly.classList.remove('active');
        renderStats();
      };

      btnYearly.onclick = () => {
        activeTab = 'yearly';
        btnYearly.classList.add('active');
        btnMonthly.classList.remove('active');
        renderStats();
      };
    }

    if (btnPrev && btnNext) {
      btnPrev.onclick = () => {
        if (activeTab === 'monthly') {
          currentMonth--;
          if (currentMonth < 1) {
            currentMonth = 12;
            currentYear--;
          }
        } else {
          currentYear--;
        }
        renderStats();
      };

      btnNext.onclick = () => {
        if (activeTab === 'monthly') {
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
          }
        } else {
          currentYear++;
        }
        renderStats();
      };
    }
  }

  /**
   * 統計情報の再表示
   */
  function renderStats() {
    const titleEl = document.getElementById('stats-date-title');
    if (titleEl) {
      titleEl.textContent = activeTab === 'monthly' ? `${currentYear}年 ${currentMonth}月` : `${currentYear}年`;
    }

    if (activeTab === 'monthly') {
      renderMonthlyStats(currentYear, currentMonth);
    } else {
      renderYearlyStats(currentYear);
    }
  }

  /**
   * 最頻値（よく炊く合数）を求める
   */
  function getModeCups(logs) {
    if (logs.length === 0) return 0;
    const freqs = {};
    let maxFreq = 0;
    let modeValue = 0;

    logs.forEach(log => {
      freqs[log.cups] = (freqs[log.cups] || 0) + 1;
      if (freqs[log.cups] > maxFreq) {
        maxFreq = freqs[log.cups];
        modeValue = log.cups;
      }
    });

    return modeValue;
  }

  /**
   * 指定年月のお米の正味消費量（kg）を計算する（使い切り分＋現在使用中の消費分）
   */
  function getActualConsumptionKg(year, month) {
    const stocks = Store.getRiceStocks();
    const logs = Store.getCookingLogs();
    const settings = Store.getSettings();
    const cupsPerGram = settings.cupsPerGram || 150;

    const targetMonthStr = `${year}-${String(month).padStart(2, '0')}`;
    let totalGram = 0;

    // 1. その月に使い切ったお米
    const finishedInMonth = stocks.filter(s => s.isFinished && s.finishedDate.startsWith(targetMonthStr));
    finishedInMonth.forEach(rice => {
      const consumed = (rice.weightKg * 1000) - (rice.finishReason === 'discarded' ? (rice.remainingAtFinishGram || 0) : 0);
      totalGram += consumed;
    });

    // 2. その月に使用中の（まだ使い切っていない）お米から、今月消費された炊飯ログ分
    const activeStocks = stocks.filter(s => s.isOpen && !s.isFinished);
    activeStocks.forEach(rice => {
      const riceLogs = logs.filter(log => log.date >= rice.openDate && log.date.startsWith(targetMonthStr));
      const consumedCups = riceLogs.reduce((sum, log) => sum + log.cups, 0);
      totalGram += (consumedCups * cupsPerGram);
    });

    return totalGram / 1000;
  }

  /**
   * 指定年のお米の正味消費量（kg）を計算する
   */
  function getActualConsumptionYearlyKg(year) {
    const stocks = Store.getRiceStocks();
    const logs = Store.getCookingLogs();
    const settings = Store.getSettings();
    const cupsPerGram = settings.cupsPerGram || 150;

    const targetYearStr = `${year}-`;
    let totalGram = 0;

    // 1. その年に使い切ったお米
    const finishedInYear = stocks.filter(s => s.isFinished && s.finishedDate.startsWith(targetYearStr));
    finishedInYear.forEach(rice => {
      const consumed = (rice.weightKg * 1000) - (rice.finishReason === 'discarded' ? (rice.remainingAtFinishGram || 0) : 0);
      totalGram += consumed;
    });

    // 2. その年に使用中の（まだ使い切っていない）お米から、今年消費された炊飯ログ分
    const activeStocks = stocks.filter(s => s.isOpen && !s.isFinished);
    activeStocks.forEach(rice => {
      const riceLogs = logs.filter(log => log.date >= rice.openDate && log.date.startsWith(targetYearStr));
      const consumedCups = riceLogs.reduce((sum, log) => sum + log.cups, 0);
      totalGram += (consumedCups * cupsPerGram);
    });

    return totalGram / 1000;
  }

  /**
   * 月間ログを週別（1〜7日、8〜14日、15〜21日、22〜28日、29日〜月末）に分類・集計する
   */
  function groupByWeek(logs) {
    const weeklyCups = [0, 0, 0, 0, 0]; // 1〜5週

    logs.forEach(log => {
      const dateObj = new Date(log.date);
      const day = dateObj.getDate();

      if (day <= 7) {
        weeklyCups[0] += log.cups;
      } else if (day <= 14) {
        weeklyCups[1] += log.cups;
      } else if (day <= 21) {
        weeklyCups[2] += log.cups;
      } else if (day <= 28) {
        weeklyCups[3] += log.cups;
      } else {
        weeklyCups[4] += log.cups;
      }
    });

    return weeklyCups;
  }

  /**
   * 月間統計の描画
   */
  function renderMonthlyStats(year, month) {
    const logs = Store.getCookingLogsByMonth(year, month);
    const settings = Store.getSettings();
    const theme = settings.theme || 'light';
    const cupsPerGram = settings.cupsPerGram || 150;

    const canvas = document.getElementById('stats-chart-canvas');
    if (canvas) {
      // レザリナ対応
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.getContext('2d').scale(dpr, dpr);

      const weeklyCups = groupByWeek(logs);
      const weeklyKg = weeklyCups.map(cups => (cups * cupsPerGram) / 1000);
      const labels = ['1週', '2週', '3週', '4週', '5週'];
      
      ChartUtil.drawBarChart(canvas, labels, weeklyKg, theme, 'kg');
    }

    // サマリー数値の計算
    const daysInMonth = new Date(year, month, 0).getDate();
    const cookedDays = [...new Set(logs.map(log => log.date))].length;
    const totalCups = logs.reduce((sum, log) => sum + log.cups, 0);
    const totalKg = getActualConsumptionKg(year, month);

    const avgDailyCups = totalCups / daysInMonth;
    const avgCookedDailyCups = cookedDays > 0 ? (totalCups / cookedDays) : 0;
    const modeCups = getModeCups(logs);

    // HTMLの更新
    const detailEl = document.getElementById('stats-detail-card');
    if (detailEl) {
      detailEl.innerHTML = `
        <div class="card-title">📋 今月のサマリー</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-item-label">今月の炊飯量</div>
            <div class="summary-item-value number-display">${totalCups.toFixed(1)}合 <span style="font-size:0.85rem; font-weight:500;">(${totalKg.toFixed(1)}kg)</span></div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">炊飯した日数</div>
            <div class="summary-item-value number-display">${cookedDays}日 <span style="font-size:0.75rem; font-weight:500; color:var(--color-text-sub);">/ ${daysInMonth}日中</span></div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">1日平均（全日）</div>
            <div class="summary-item-value number-display">${avgDailyCups.toFixed(1)}合</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">炊いた日平均</div>
            <div class="summary-item-value number-display">${avgCookedDailyCups.toFixed(1)}合</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">最も多い合数</div>
            <div class="summary-item-value number-display">${modeCups > 0 ? modeCups + '合' : '記録なし'}</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">お米の消費量</div>
            <div class="summary-item-value number-display">${totalKg.toFixed(1)} kg</div>
          </div>
        </div>
      `;
    }
  }

  /**
   * 年間統計の描画
   */
  function renderYearlyStats(year) {
    const logs = Store.getCookingLogsByYear(year);
    const settings = Store.getSettings();
    const theme = settings.theme || 'light';
    const cupsPerGram = settings.cupsPerGram || 150;

    const monthlyTotalCups = Array(12).fill(0);
    logs.forEach(log => {
      const monthIndex = new Date(log.date).getMonth(); // 0 ~ 11
      monthlyTotalCups[monthIndex] += log.cups;
    });

    const canvas = document.getElementById('stats-chart-canvas');
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.getContext('2d').scale(dpr, dpr);

      const monthlyTotalKg = monthlyTotalCups.map(cups => (cups * cupsPerGram) / 1000);
      const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(m => m + '月');
      ChartUtil.drawLineChart(canvas, labels, monthlyTotalKg, theme, 'kg');
    }

    // サマリー数値の計算
    const totalCups = logs.reduce((sum, log) => sum + log.cups, 0);
    const totalKg = getActualConsumptionYearlyKg(year);
    
    // データのある月のみ、または12ヶ月で割る
    const activeMonths = monthlyTotalCups.filter(c => c > 0).length || 1;
    const avgMonthlyKg = totalKg / activeMonths;

    // 最大消費月を求める
    let maxCups = 0;
    let maxMonthIndex = -1;
    monthlyTotalCups.forEach((c, idx) => {
      if (c > maxCups) {
        maxCups = c;
        maxMonthIndex = idx;
      }
    });

    const maxMonthStr = maxMonthIndex !== -1 ? `${maxMonthIndex + 1}月` : '記録なし';
    const bagsCount = totalKg / 5; // 5kg袋換算

    // HTMLの更新
    const detailEl = document.getElementById('stats-detail-card');
    if (detailEl) {
      detailEl.innerHTML = `
        <div class="card-title">📋 年間のサマリー</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-item-label">年間合計炊飯量</div>
            <div class="summary-item-value number-display">${totalCups.toFixed(0)}合 <span style="font-size:0.85rem; font-weight:500;">(${totalKg.toFixed(1)}kg)</span></div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">月平均消費量</div>
            <div class="summary-item-value number-display">${avgMonthlyKg.toFixed(1)} kg</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">最も食べた月</div>
            <div class="summary-item-value number-display">${maxMonthStr}</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">5kgお米袋換算</div>
            <div class="summary-item-value number-display">約 ${bagsCount.toFixed(1)} 袋分</div>
          </div>
        </div>
      `;
    }
  }

  return {
    initStats,
    renderStats
  };
})();
