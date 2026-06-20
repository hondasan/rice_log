const Stock = (() => {
  
  // 銘柄のキー名から表示名への変換マップ
  const BRAND_NAMES = {
    koshihikari: 'コシヒカリ',
    akitakomachi: 'あきたこまち',
    hitomebore: 'ひとめぼれ',
    nanatsuboshi: 'ななつぼし',
    yumepirika: 'ゆめぴりか',
    tsuyahime: 'つや姫',
    milky_queen: 'ミルキークイーン',
    sasanishiki: 'ササニシキ',
    haenuki: 'はえぬき',
    kinuhikari: 'きぬひかり',
    other: 'その他',
    none: '未設定'
  };

  /**
   * 残量および消費予測の計算
   */
  function calculateRemaining() {
    const settings = Store.getSettings();
    const stocks = Store.getRiceStocks();
    const logs = Store.getCookingLogs();

    const cupsPerGram = settings.cupsPerGram || 150;

    // 1. 開封中で使い切っていないお米
    const openStocks = stocks.filter(s => s.isOpen && !s.isFinished);
    
    // 2. 未開封のストックお米
    const unopenStocks = stocks.filter(s => !s.isOpen && !s.isFinished);
    const stockTotalGram = unopenStocks.reduce((sum, s) => sum + (s.weightKg * 1000), 0);

    if (openStocks.length === 0) {
      return {
        hasOpenRice: false,
        remainingGram: 0,
        remainingPercent: 0,
        remainingDays: 0,
        stockGram: stockTotalGram,
        avgDailyGram: 0
      };
    }

    // 計算の単純化と堅牢性の担保：
    // 開封中の米ごとに、その米の openDate 以降の炊飯ログを合計して消費量とする。
    // （複数同時に開いている場合は、日付で割り振るか、単純に openDate 以降の全炊飯ログを合計する）
    let totalOpenGram = 0;
    let totalConsumedGram = 0;

    openStocks.forEach(rice => {
      totalOpenGram += (rice.weightKg * 1000);
      
      // 開封日以降のログを抽出
      const riceLogs = logs.filter(log => log.date >= rice.openDate);
      const consumedCups = riceLogs.reduce((sum, log) => sum + log.cups, 0);
      totalConsumedGram += (consumedCups * cupsPerGram);
    });

    let remainingGram = totalOpenGram - totalConsumedGram;
    if (remainingGram < 0) remainingGram = 0;

    const remainingPercent = totalOpenGram > 0 ? (remainingGram / totalOpenGram) * 100 : 0;

    // 3. 1日平均消費量の計算（直近7日間のログから算出）
    let avgDailyGram = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 直近7日前の日付を求める
    const past7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      past7Days.push(d.toISOString().split('T')[0]);
    }
    const sevenDaysAgoStr = past7Days[6];

    const last7DaysLogs = logs.filter(log => log.date >= sevenDaysAgoStr && log.date <= todayStr);
    
    if (last7DaysLogs.length > 0) {
      const sumCups = last7DaysLogs.reduce((sum, log) => sum + log.cups, 0);
      
      // 直近7日間の最古の記録日を見つけ、今日までの経過日数を分母にする（経過日数 1〜7日）
      const logDates = last7DaysLogs.map(log => log.date).sort();
      const oldestDateStr = logDates[0];
      const msDiff = new Date(todayStr) - new Date(oldestDateStr);
      const daysCount = Math.min(7, Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)) + 1));
      
      avgDailyGram = (sumCups * cupsPerGram) / daysCount;
    }

    // 直近7日間の記録がまったくない、または0の場合のフォールバック
    if (avgDailyGram === 0) {
      if (logs.length > 0) {
        // 全記録の平均をとる
        // ユニークな記録日の数で割る
        const uniqueDates = [...new Set(logs.map(log => log.date))];
        const sumCups = logs.reduce((sum, log) => sum + log.cups, 0);
        const daysCount = uniqueDates.length || 1;
        avgDailyGram = (sumCups * cupsPerGram) / daysCount;
      } else {
        // 設定のデフォルト合数を基準にする
        avgDailyGram = (settings.defaultCups || 2) * cupsPerGram;
      }
    }

    // あと何日もつか
    const remainingDays = avgDailyGram > 0 ? Math.round(remainingGram / avgDailyGram) : 0;

    return {
      hasOpenRice: true,
      remainingGram,
      remainingPercent,
      remainingDays,
      stockGram: stockTotalGram,
      avgDailyGram
    };
  }

  /**
   * ホーム（ダッシュボード）のレンダリング
   */
  function renderDashboard() {
    const data = calculateRemaining();
    const settings = Store.getSettings();
    const theme = settings.theme || 'light';

    // 1. 残量テキストの更新
    const amountEl = document.getElementById('dash-remaining-amount');
    const daysEl = document.getElementById('dash-remaining-days');
    const subtitleEl = document.getElementById('dash-remaining-subtitle');

    if (amountEl && daysEl) {
      if (data.hasOpenRice) {
        amountEl.textContent = `残り 約 ${(data.remainingGram / 1000).toFixed(1)} kg`;
        daysEl.textContent = `あと約 ${data.remainingDays}日分 🍚`;
        
        // 残り3日以下で警告クラス
        if (data.remainingDays <= 3) {
          daysEl.className = 'remaining-days low';
        } else {
          daysEl.className = 'remaining-days';
        }

        // ストックがあれば補足表示
        if (subtitleEl) {
          if (data.stockGram > 0) {
            const stockKg = (data.stockGram / 1000).toFixed(0);
            const stockDays = data.avgDailyGram > 0 ? Math.round(data.stockGram / data.avgDailyGram) : 0;
            subtitleEl.textContent = `ストック含め残り約 ${( (data.remainingGram + data.stockGram) / 1000 ).toFixed(1)}kg (約${data.remainingDays + stockDays}日分)`;
          } else {
            subtitleEl.textContent = '';
          }
        }
      } else {
        amountEl.textContent = 'お米を登録してね 🍚';
        daysEl.textContent = 'あと 0 日分';
        daysEl.className = 'remaining-days';
        if (subtitleEl) subtitleEl.textContent = '「お米」タブから追加・開封できます';
      }
    }

    // 2. 米びつCanvasの描画
    const canvas = document.getElementById('rice-jar-canvas');
    if (canvas) {
      // 高画質対応（Retina）
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // アニメーション付きで再描画
      ChartUtil.animateRiceJar(canvas, data.hasOpenRice ? data.remainingPercent : 0, theme);
    }

    // 2.5 ワンタップ炊飯ボタンのテキスト更新とバインド
    const oneTapCupsEl = document.getElementById('dash-one-tap-cups');
    const oneTapBtn = document.getElementById('dash-one-tap-btn');
    if (oneTapCupsEl && oneTapBtn) {
      oneTapCupsEl.textContent = `${settings.defaultCups}合`;
      oneTapBtn.onclick = () => {
        // バウンスアニメーション
        oneTapBtn.classList.remove('bounce');
        void oneTapBtn.offsetWidth; // リフロー発生
        oneTapBtn.classList.add('bounce');
        
        const todayStr = new Date().toISOString().split('T')[0];
        Store.addCookingLog({ date: todayStr, cups: settings.defaultCups });
        App.showToast(`${settings.defaultCups}合 記録しました ✓`);
      };
    }

    // よく使う合数ボタンの生成
    const freqContainer = document.getElementById('dash-frequent-buttons');
    if (freqContainer) {
      const presets = settings.frequentCups || [1, 1.5, 2, 3];
      // defaultCupsと重複しないものだけを表示する仕様
      const filteredPresets = presets.filter(p => p !== settings.defaultCups);
      
      if (filteredPresets.length === 0) {
        freqContainer.innerHTML = '';
      } else {
        freqContainer.innerHTML = filteredPresets.map(cups => {
          return `<button class="freq-btn number-display" onclick="Stock.addFreqCookingLog(${cups})">${cups}</button>`;
        }).join('');
      }
    }

    // 3. アラートバナーの制御
    const alertBanner = document.getElementById('dash-alert-banner');
    if (alertBanner) {
      // 米不足（残量ゼロ、もしくは残日数3日以下かつ未開封ストックなしの場合）
      if (data.hasOpenRice && data.remainingDays <= 3 && data.stockGram === 0) {
        alertBanner.classList.remove('hidden');
        // アフィリエイトリンクの銘柄カスタマイズ
        const openRice = Store.getRiceStocks().find(s => s.isOpen && !s.isFinished);
        const brandLabel = openRice ? BRAND_NAMES[openRice.brand] : 'お米';
        const linkEl = document.getElementById('dash-alert-link');
        if (linkEl) {
          linkEl.textContent = `Amazonで「${brandLabel}」を買い足す 🛒`;
          linkEl.onclick = () => {
            const query = encodeURIComponent(brandLabel + ' 5kg');
            window.open(`https://www.amazon.co.jp/s?k=${query}&tag=ricestockapp-22`, '_blank');
          };
        }
      } else {
        alertBanner.classList.add('hidden');
      }
    }

    // 4. 最近の記録リストの更新
    const recentListEl = document.getElementById('dash-recent-list');
    if (recentListEl) {
      const logs = Store.getCookingLogs().slice(0, 5); // 直近5件
      
      if (logs.length === 0) {
        recentListEl.innerHTML = '<div class="day-detail-empty">炊飯記録がまだありません</div>';
        return;
      }

      recentListEl.innerHTML = logs.map(log => {
        // 曜日付きの日付文字列を作成 (例: 6/19(木))
        const dateObj = new Date(log.date);
        const month = dateObj.getMonth() + 1;
        const date = dateObj.getDate();
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const dayStr = days[dateObj.getDay()];

        // ドットの生成 (0.5合=半円, 1合=●1個, 2合=●2個... 最大5個)
        let dotsHtml = '';
        const roundedCups = Math.floor(log.cups);
        const hasHalf = log.cups % 1 !== 0;

        for (let i = 0; i < Math.min(roundedCups, 5); i++) {
          dotsHtml += '●';
        }
        if (hasHalf && roundedCups < 5) {
          dotsHtml += '◐';
        }
        if (log.cups > 5) {
          dotsHtml = `●×${log.cups}`;
        }

        return `
          <div class="swipe-delete-container" data-log-id="${log.id}">
            <div class="swipe-delete-wrapper">
              <div class="swipe-content" onclick="Stock.editLogCupsInline('${log.id}', '${log.date}', ${log.cups})">
                <div class="log-item-left">
                  <span class="log-date">${month}/${date}(${dayStr})</span>
                  <span class="log-dots">${dotsHtml}</span>
                </div>
                <span class="log-cups number-display">${log.cups}合</span>
              </div>
              <div class="swipe-delete-btn" onclick="Stock.deleteLogFromDashboard('${log.id}')">削除</div>
            </div>
          </div>
        `;
      }).join('');

      // スワイプ削除イベントのバインド
      bindSwipeEvents(recentListEl);
    }
  }

  /**
   * スワイプイベントのバインド処理（共通）
   */
  function bindSwipeEvents(container) {
    const wrappers = container.querySelectorAll('.swipe-delete-wrapper');
    
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
        
        // 左方向へのスワイプのみ許容（最大-70pxまで）
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
        
        // 35px以上スワイプしたら削除ボタンを露出
        if (diffX < -35) {
          wrapper.style.transform = 'translateX(-70px)';
        } else {
          wrapper.style.transform = 'translateX(0px)';
        }
        // タッチ座標リセット
        startX = 0;
        currentX = 0;
      });
    });
  }

  /**
   * ダッシュボードから直接記録を削除
   */
  function deleteLogFromDashboard(id) {
    if (confirm('この炊飯記録を削除しますか？')) {
      Store.deleteCookingLog(id);
      App.showToast('記録を削除しました');
    } else {
      // キャンセル時はスワイプ位置を戻す
      renderDashboard();
    }
  }

  /**
   * ダッシュボードからインラインで合数を変更するモーダル
   */
  function editLogCupsInline(id, date, currentCups) {
    // 実際にはカレンダータブのインライン編集と同様だが、
    // ここでは簡易的な合数変更ダイアログ/モーダルを立ち上げる
    const settings = Store.getSettings();
    const presets = settings.frequentCups || [1, 2, 3];
    
    let html = `
      <div class="modal-header">
        <div class="modal-title">合数の変更</div>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group text-center">
          <div class="form-label" style="margin-bottom:12px;">${date} の炊飯量</div>
          <div class="stepper mb-12">
            <button class="stepper-btn" onclick="document.getElementById('edit-cups-val').innerText = Math.max(0.5, parseFloat(document.getElementById('edit-cups-val').innerText) - 0.5)">-</button>
            <span class="stepper-value number-display" id="edit-cups-val">${currentCups}</span>
            <button class="stepper-btn" onclick="document.getElementById('edit-cups-val').innerText = parseFloat(document.getElementById('edit-cups-val').innerText) + 0.5">+</button>
          </div>
          
          <div class="preset-grid">
    `;

    presets.forEach(p => {
      html += `<button class="preset-btn ${p === currentCups ? 'active' : ''}" onclick="document.getElementById('edit-cups-val').innerText = '${p}'">${p}合</button>`;
    });

    html += `
          </div>
        </div>
        <div class="flex-row mt-12">
          <button class="btn btn-secondary flex-1" onclick="App.closeModal()">キャンセル</button>
          <button class="btn btn-primary flex-1" onclick="Stock.saveLogCupsInline('${id}')">保存する</button>
        </div>
      </div>
    `;

    App.openModal(html);
  }

  function saveLogCupsInline(id) {
    const newCups = parseFloat(document.getElementById('edit-cups-val').innerText);
    Store.updateCookingLog(id, { cups: newCups });
    App.closeModal();
    App.showToast('記録を更新しました');
  }

  /**
   * 在庫管理タブのレンダリング
   */
  function renderStockList() {
    const stocks = Store.getRiceStocks();
    const data = calculateRemaining();

    // 1. 使用中のお米
    const activeSection = document.getElementById('stock-active-section');
    const openRice = stocks.find(s => s.isOpen && !s.isFinished);

    if (activeSection) {
      if (openRice) {
        const brandName = BRAND_NAMES[openRice.brand] || openRice.brand;
        const progress = Math.round(data.remainingPercent);
        const weightKg = openRice.weightKg;
        const remainKg = (data.remainingGram / 1000).toFixed(1);

        // 進捗バーの色
        let barColor = 'var(--color-primary)';
        if (progress < 30) {
          barColor = 'var(--color-danger)';
        } else if (progress < 70) {
          barColor = 'var(--color-accent)';
        }

        activeSection.innerHTML = `
          <div class="card" id="active-rice-card">
            <span class="stock-badge active">🟢 使用中</span>
            <div class="card-title">🍚 ${brandName} (${weightKg}kg)</div>
            <div class="log-date" style="margin-bottom: 6px;">開封日: ${openRice.openDate}</div>
            <div style="font-weight:700; margin-bottom:8px;">残り 約 <span class="number-display" style="font-size:1.2rem; color:${barColor};">${remainKg}</span> kg (約${progress}%)</div>
            <div class="stock-progress">
              <div class="stock-progress-bar" style="width: ${progress}%; background-color: ${barColor};"></div>
            </div>
            <div class="stock-actions" id="active-card-actions">
              <button class="btn btn-secondary btn-block" onclick="Stock.showFinishFlow('${openRice.id}')">おしまいにする</button>
            </div>
            <div class="inline-action-panel hidden" id="finish-flow-panel">
              <!-- 使い切りフローがここに展開されます -->
            </div>
          </div>
        `;
      } else {
        activeSection.innerHTML = `
          <div class="card text-center" style="border-style: dashed; padding: 30px 20px;">
            <div class="card-title" style="justify-content:center; margin-bottom:8px;">使用中のお米はありません</div>
            <p style="font-size:0.85rem; color:var(--color-text-sub); margin-bottom:16px;">
              ストックのお米を「開封する」か、新しいお米を追加してください。
            </p>
          </div>
        `;
      }
    }

    // 2. ストック（未開封）
    const stockSection = document.getElementById('stock-unopen-section');
    if (stockSection) {
      const unopenStocks = stocks.filter(s => !s.isOpen && !s.isFinished);
      
      if (unopenStocks.length === 0) {
        stockSection.innerHTML = `
          <div class="card text-center" style="border-style: dashed; padding: 20px; color:var(--color-text-sub); font-size:0.85rem;">
            ストックはありません
          </div>
        `;
      } else {
        stockSection.innerHTML = unopenStocks.map(rice => {
          const brandName = BRAND_NAMES[rice.brand] || rice.brand;
          return `
            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <span class="stock-badge stock">📦 ストック</span>
                  <div class="card-title" style="margin-bottom:0;">${brandName} (${rice.weightKg}kg)</div>
                  <div class="log-date" style="margin-top:4px;">購入日: ${rice.purchaseDate}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="Stock.openStockRice('${rice.id}')">開封する</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 3. 使い切り済み（履歴）
    const historyList = document.getElementById('stock-history-list');
    if (historyList) {
      const finishedStocks = stocks.filter(s => s.isFinished).sort((a, b) => b.finishedDate.localeCompare(a.finishedDate));
      
      // 履歴件数バッジの更新
      const historyBadge = document.getElementById('stock-history-count');
      if (historyBadge) {
        historyBadge.textContent = `（${finishedStocks.length}件）`;
      }

      if (finishedStocks.length === 0) {
        historyList.innerHTML = '<div class="day-detail-empty">使い切ったお米の履歴はありません</div>';
      } else {
        historyList.innerHTML = finishedStocks.map(rice => {
          const brandName = BRAND_NAMES[rice.brand] || rice.brand;
          const openStr = rice.openDate || '未開封';
          const reasonText = rice.finishReason === 'ate' ? '🍚食べきった' : `🗑 約${(rice.remainingAtFinishGram / 1000).toFixed(1)}kg廃棄`;
          return `
            <div class="history-item">
              <div class="history-item-top">
                <span>${brandName} (${rice.weightKg}kg)</span>
                <span>${reasonText}</span>
              </div>
              <div class="history-item-sub">
                期間: ${openStr} 〜 ${rice.finishedDate}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  /**
   * おしまいにする使い切りフローをインライン展開
   */
  function showFinishFlow(id) {
    const actionsEl = document.getElementById('active-card-actions');
    const panelEl = document.getElementById('finish-flow-panel');
    const data = calculateRemaining();

    if (actionsEl && panelEl) {
      actionsEl.classList.add('hidden');
      panelEl.classList.remove('hidden');

      const remainKg = (data.remainingGram / 1000).toFixed(1);

      panelEl.innerHTML = `
        <div class="inline-action-title">残り約${remainKg}kgはどうした？</div>
        <div class="inline-action-buttons">
          <button class="btn btn-primary" onclick="Stock.finishRice('${id}', 'ate')">🍚 残りは全部食べきった！</button>
          <button class="btn btn-danger" onclick="Stock.finishRice('${id}', 'discarded')">🗑 残りは廃棄した</button>
          <button class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="Stock.cancelFinishFlow()">やっぱりやめる</button>
        </div>
      `;
    }
  }

  function cancelFinishFlow() {
    const actionsEl = document.getElementById('active-card-actions');
    const panelEl = document.getElementById('finish-flow-panel');
    if (actionsEl && panelEl) {
      actionsEl.classList.remove('hidden');
      panelEl.classList.add('hidden');
    }
  }

  /**
   * お米を使い切る処理を実行
   */
  function finishRice(id, reason) {
    const data = calculateRemaining();
    const todayStr = new Date().toISOString().split('T')[0];

    Store.updateRiceStock(id, {
      isFinished: true,
      finishedDate: todayStr,
      finishReason: reason,
      remainingAtFinishGram: data.remainingGram
    });

    App.showToast(reason === 'ate' ? 'お米を食べきりました！お疲れ様でした🍚' : 'お米の廃棄を記録しました');

    // 未開封ストックがある場合、即時開封するかどうかを提案
    const stocks = Store.getRiceStocks();
    const nextStock = stocks.find(s => !s.isOpen && !s.isFinished);

    if (nextStock) {
      const brandName = BRAND_NAMES[nextStock.brand] || nextStock.brand;
      
      // 提案ダイアログをトースト通知後にインラインで表示するか、簡易モーダルで促す
      setTimeout(() => {
        const html = `
          <div class="modal-header">
            <div class="modal-title">次のお米を開封しますか？</div>
            <button class="modal-close" onclick="App.closeModal()">✕</button>
          </div>
          <div class="modal-body text-center">
            <p style="margin-bottom:20px; font-weight:500;">
              ストックに「<strong>${brandName} (${nextStock.weightKg}kg)</strong>」があります。今すぐ開封しますか？
            </p>
            <div class="flex-row">
              <button class="btn btn-secondary flex-1" onclick="App.closeModal()">あとで手動で</button>
              <button class="btn btn-primary flex-1" onclick="Stock.openStockRiceFromModal('${nextStock.id}')">開封する</button>
            </div>
          </div>
        `;
        App.openModal(html);
      }, 800);
    } else {
      // ストックがない場合は、買い足し案内
      setTimeout(() => {
        const html = `
          <div class="modal-header">
            <div class="modal-title">お米の買い足し</div>
            <button class="modal-close" onclick="App.closeModal()">✕</button>
          </div>
          <div class="modal-body text-center">
            <p style="margin-bottom:20px; font-weight:500;">
              お米のストックがなくなりました。買い足しますか？
            </p>
            <div class="flex-row">
              <button class="btn btn-secondary flex-1" onclick="App.closeModal()">閉じる</button>
              <button class="btn btn-accent flex-1" onclick="window.open('https://www.amazon.co.jp/s?k=%E3%81%8A%E7%B1%B3+5kg&tag=ricestockapp-22', '_blank'); App.closeModal();">Amazonで購入 🛒</button>
            </div>
          </div>
        `;
        App.openModal(html);
      }, 800);
    }
  }

  /**
   * ストックお米を開封する
   */
  function openStockRice(id) {
    const todayStr = new Date().toISOString().split('T')[0];
    Store.updateRiceStock(id, {
      isOpen: true,
      openDate: todayStr
    });
    App.showToast('お米を開封しました！記録を開始します🍚');
  }

  function openStockRiceFromModal(id) {
    openStockRice(id);
    App.closeModal();
  }

  /**
   * お米追加モーダルの表示
   */
  function showAddRiceModal() {
    let html = `
      <div class="modal-header">
        <div class="modal-title">お米を追加</div>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        
        <!-- 重量の選択 -->
        <div class="form-group text-center">
          <label class="form-label">重さ (kg)</label>
          <div class="stepper mb-12">
            <button class="stepper-btn" onclick="Stock.adjustWeight(-0.5)">-</button>
            <span class="stepper-value number-display" id="add-weight-val">5.0</span>
            <button class="stepper-btn" onclick="Stock.adjustWeight(0.5)">+</button>
          </div>
          <div class="preset-grid" style="grid-template-columns: repeat(3, 1fr);">
            <button class="preset-btn" onclick="Stock.setWeight(2)">2kg</button>
            <button class="preset-btn active" id="btn-weight-5" onclick="Stock.setWeight(5)">5kg</button>
            <button class="preset-btn" onclick="Stock.setWeight(10)">10kg</button>
          </div>
        </div>

        <!-- 銘柄の選択 -->
        <div class="form-group">
          <label class="form-label">銘柄</label>
          <div class="preset-grid" style="grid-template-columns: repeat(3, 1fr); max-height: 180px; overflow-y: auto; padding: 4px;">
    `;

    // 銘柄リストをループ
    Object.keys(BRAND_NAMES).forEach(key => {
      const isActive = key === 'none'; // デフォルトは「未設定」
      html += `
        <button class="preset-btn ${isActive ? 'active' : ''} brand-select-btn" 
                data-brand="${key}" 
                onclick="Stock.selectBrand(this)">
          ${BRAND_NAMES[key]}
        </button>
      `;
    });

    const todayStr = new Date().toISOString().split('T')[0];

    html += `
          </div>
        </div>

        <!-- 購入日 -->
        <div class="form-group">
          <label class="form-label">購入日</label>
          <!-- テキスト入力を防ぐため、ネイティブ日付ピッカーだが読み取り専用っぽく見せタップで入力 -->
          <input type="date" id="add-purchase-date" class="preset-btn" style="width:100%; text-align:left; font-family:inherit; padding:10px 14px;" value="${todayStr}">
        </div>

        <!-- 開封スイッチ -->
        <div class="form-group settings-item-row">
          <div>
            <label class="form-label" style="margin-bottom:2px;">今すぐ開封する</label>
            <div class="settings-label-desc">使用中に設定し残量計算に含めます</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="add-is-open" checked>
            <span class="slider"></span>
          </label>
        </div>

        <button class="btn btn-primary btn-block mt-12" onclick="Stock.saveNewRice()">追加する 🍚</button>
      </div>
    `;

    App.openModal(html);
  }

  // 重量の増減
  function adjustWeight(diff) {
    const valEl = document.getElementById('add-weight-val');
    if (valEl) {
      let current = parseFloat(valEl.innerText);
      current = Math.max(0.5, current + diff);
      valEl.innerText = current.toFixed(1);

      // プリセットボタンの選択状態をクリア
      const presets = valEl.parentElement.nextElementSibling.querySelectorAll('.preset-btn');
      presets.forEach(p => {
        const pVal = parseFloat(p.innerText);
        if (pVal === current) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
    }
  }

  // 重量のプリセットセット
  function setWeight(w) {
    const valEl = document.getElementById('add-weight-val');
    if (valEl) {
      valEl.innerText = w.toFixed(1);
      
      // 押されたボタンをアクティブに
      const presets = valEl.parentElement.nextElementSibling.querySelectorAll('.preset-btn');
      presets.forEach(p => {
        const pVal = parseFloat(p.innerText);
        if (pVal === w) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
    }
  }

  // 銘柄の選択
  function selectBrand(btn) {
    const btns = btn.parentElement.querySelectorAll('.brand-select-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  // 新規追加保存
  function saveNewRice() {
    const weight = parseFloat(document.getElementById('add-weight-val').innerText);
    
    // アクティブな銘柄ボタンを取得
    const activeBrandBtn = document.querySelector('.brand-select-btn.active');
    const brand = activeBrandBtn ? activeBrandBtn.dataset.brand : 'none';

    const purchaseDate = document.getElementById('add-purchase-date').value;
    const isOpen = document.getElementById('add-is-open').checked;

    Store.addRiceStock({
      weightKg: weight,
      brand: brand,
      purchaseDate: purchaseDate,
      isOpen: isOpen,
      openDate: isOpen ? purchaseDate : null
    });

    App.closeModal();
    App.showToast(isOpen ? '新しいお米を開封しました！' : 'ストックにお米を追加しました');
  }

  function addFreqCookingLog(cups) {
    const todayStr = new Date().toISOString().split('T')[0];
    Store.addCookingLog({ date: todayStr, cups: cups });
    App.showToast(`${cups}合 記録しました ✓`);
  }

  return {
    addFreqCookingLog,
    calculateRemaining,
    renderDashboard,
    deleteLogFromDashboard,
    editLogCupsInline,
    saveLogCupsInline,
    renderStockList,
    showFinishFlow,
    cancelFinishFlow,
    finishRice,
    openStockRice,
    openStockRiceFromModal,
    showAddRiceModal,
    adjustWeight,
    setWeight,
    selectBrand,
    saveNewRice,
    toggleHistory() {
      // 履歴リストのアコーディオン開閉
      const list = document.getElementById('stock-history-list');
      const arrow = document.getElementById('stock-history-arrow');
      if (list && arrow) {
        const isCollapsed = list.classList.toggle('collapsed');
        arrow.textContent = isCollapsed ? '▼' : '▲';
      }
    }
  };
})();
