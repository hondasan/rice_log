const App = (() => {
  
  /**
   * アプリ初期化
   */
  function init() {
    setupRouting();
    setupEventListeners();
    setupTheme();
    
    // 最初の画面描画
    handleRoute();

    // 初回起動チェック
    checkFirstLaunch();
  }

  /**
   * URLハッシュベースのSPAルーティング
   */
  function setupRouting() {
    window.addEventListener('hashchange', handleRoute);
    
    // ナビゲーションボタンのイベントバインド
    const navButtons = document.querySelectorAll('.bottom-nav .nav-btn');
    navButtons.forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        window.location.hash = `#${tab}`;
      };
    });
  }

  function handleRoute() {
    let hash = window.location.hash.slice(1) || 'home';
    const validTabs = ['home', 'calendar', 'stock', 'stats', 'settings'];
    
    if (!validTabs.includes(hash)) {
      hash = 'home';
      window.location.hash = '#home';
    }

    // タブコンテンツの表示切り替え
    const sections = document.querySelectorAll('.tab-content');
    sections.forEach(sec => {
      if (sec.id === `tab-${hash}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    // ボトムナビのアクティブクラス更新
    const navButtons = document.querySelectorAll('.bottom-nav .nav-btn');
    navButtons.forEach(btn => {
      if (btn.dataset.tab === hash) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 各タブに応じたレンダリング
    triggerTabRender(hash);
  }

  /**
   * 各タブ表示時の描画呼び出し
   */
  function triggerTabRender(tabName) {
    switch (tabName) {
      case 'home':
        Stock.renderDashboard();
        break;
      case 'calendar':
        CalendarView.initCalendar();
        break;
      case 'stock':
        Stock.renderStockList();
        break;
      case 'stats':
        StatsView.initStats();
        break;
      case 'settings':
        renderSettings();
        break;
    }
  }

  /**
   * 全体的なイベントリスナーの設定
   */
  function setupEventListeners() {
    // データの変更イベントを購読して自動再描画
    window.addEventListener('store:changed', (e) => {
      // 現在アクティブなタブを再描画
      const currentTab = window.location.hash.slice(1) || 'home';
      triggerTabRender(currentTab);

      // 設定やインポートによるテーマ変更の即時反映
      if (e.detail && (e.detail.key === 'riceApp_settings' || e.detail.key === 'all')) {
        setupTheme();
      }
    });

    // モーダルの外側（オーバーレイ）タップで閉じる
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          closeModal();
        }
      };
    }
  }

  /**
   * テーマの設定・切替
   */
  function setupTheme() {
    const settings = Store.getSettings();
    const html = document.documentElement;
    html.setAttribute('data-theme', settings.theme || 'light');
  }

  /**
   * 初回起動チェック
   */
  function checkFirstLaunch() {
    const stocks = Store.getRiceStocks();
    // お米の登録が一度もない場合は初回とみなす
    if (stocks.length === 0) {
      setTimeout(() => {
        const html = `
          <div class="modal-header">
            <div class="modal-title">🍚 こめログへようこそ！</div>
          </div>
          <div class="modal-body text-center">
            <p style="margin-bottom:16px; font-weight:700;">
              お米の在庫と残りの日数が一目でわかるアプリです。
            </p>
            <p style="margin-bottom:20px; font-size:0.85rem; color:var(--color-text-sub); line-height:1.7;">
              まずは、いま自宅にあるお米を登録・開封しましょう！<br>
              ※入力はすべてタップのみで、キーボード入力は必要ありません。
            </p>
            <button class="btn btn-primary btn-block" onclick="App.closeModal(); Stock.showAddRiceModal();">
              お米を登録する 🍚
            </button>
          </div>
        `;
        openModal(html);
      }, 500);
    }
  }

  // --- 設定画面 (Settings Tab) レンダリング＆制御 ---

  function renderSettings() {
    const settings = Store.getSettings();
    const settingsTab = document.getElementById('tab-settings');
    if (!settingsTab) return;

    // 設定画面の中身を構築
    settingsTab.innerHTML = `
      <div class="card">
        <div class="card-title">⚙️ 設定</div>
        <div class="settings-list">
          
          <!-- ワンタップ炊飯量 -->
          <div class="settings-item">
            <div class="settings-item-row">
              <div>
                <label class="form-label" style="margin-bottom:2px;">ワンタップの炊飯量</label>
                <div class="settings-label-desc">ホーム画面のメインボタンで記録する合数</div>
              </div>
              <div class="stepper">
                <button class="stepper-btn" onclick="App.adjustDefaultCups(-0.5)">-</button>
                <span class="stepper-value number-display" id="settings-default-cups">${settings.defaultCups}</span>
                <button class="stepper-btn" onclick="App.adjustDefaultCups(0.5)">+</button>
              </div>
            </div>
          </div>

          <!-- よく使う合数のカスタマイズ -->
          <div class="settings-item" style="border-top: 1px solid var(--color-border); padding-top:16px;">
            <label class="form-label">よく使う合数（最大5つ）</label>
            <div class="settings-label-desc" style="margin-bottom:10px;">カレンダーのクイック入力やまとめて入力に表示されます</div>
            <div class="preset-grid" style="grid-template-columns: repeat(4, 1fr);">
              ${[0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(cups => {
                const isActive = settings.frequentCups.includes(cups);
                return `
                  <button class="preset-btn ${isActive ? 'active' : ''}" 
                          data-cups="${cups}" 
                          onclick="App.toggleFrequentCups(this)">
                    ${cups}合
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 1合あたりの重さ -->
          <div class="settings-item" style="border-top: 1px solid var(--color-border); padding-top:16px;">
            <div class="settings-item-row">
              <div>
                <label class="form-label" style="margin-bottom:2px;">1合あたりのグラム数</label>
                <div class="settings-label-desc">お米の残量計算基準（一般的には150g）</div>
              </div>
              <div class="stepper">
                <button class="stepper-btn" onclick="App.adjustCupsPerGram(-5)">-</button>
                <span class="stepper-value number-display" id="settings-cups-gram">${settings.cupsPerGram}</span>
                <button class="stepper-btn" onclick="App.adjustCupsPerGram(5)">+</button>
              </div>
            </div>
          </div>

          <!-- テーマ切り替え -->
          <div class="settings-item" style="border-top: 1px solid var(--color-border); padding-top:16px;">
            <div class="settings-item-row">
              <div>
                <label class="form-label" style="margin-bottom:2px;">ダークテーマ</label>
                <div class="settings-label-desc">夜間のキッチンでも見やすくします</div>
              </div>
              <label class="switch">
                <input type="checkbox" id="settings-theme-toggle" ${settings.theme === 'dark' ? 'checked' : ''} onchange="App.toggleTheme(this)">
                <span class="slider"></span>
              </label>
            </div>
          </div>

        </div>
      </div>

      <!-- データ管理カード -->
      <div class="card">
        <div class="card-title">💾 データ管理</div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <button class="btn btn-secondary" onclick="ExportView.exportData()">📤 バックアップ（書き出し）</button>
          
          <div style="position:relative;">
            <button class="btn btn-secondary btn-block" onclick="document.getElementById('settings-import-file').click()">📥 バックアップの読込（復元）</button>
            <input type="file" id="settings-import-file" style="display:none;" accept=".json" onchange="ExportView.importData(this.files[0])">
          </div>

          <button class="btn btn-danger btn-block btn-hold" id="settings-btn-clear" style="margin-top:10px;">
            ⚠️ すべてのデータを削除（3秒長押し）
          </button>
        </div>
      </div>
    `;

    // 削除長押しボタンのセットアップ
    ExportView.setupClearDataButton();
  }

  // 設定：デフォルト合数の調整
  function adjustDefaultCups(diff) {
    const settings = Store.getSettings();
    let val = settings.defaultCups || 2;
    val = Math.max(0.5, val + diff);
    Store.updateSettings({ defaultCups: val });
  }

  // 設定：よく使う合数のトグル選択
  function toggleFrequentCups(btn) {
    const settings = Store.getSettings();
    const clickedCups = parseFloat(btn.dataset.cups);
    let list = [...settings.frequentCups];

    if (list.includes(clickedCups)) {
      // 選択解除 (最低1つは残す)
      if (list.length > 1) {
        list = list.filter(c => c !== clickedCups);
      } else {
        showToast('よく使う合数は最低1つ選択してください');
        return;
      }
    } else {
      // 選択追加 (最大5つまで)
      if (list.length < 5) {
        list.push(clickedCups);
      } else {
        showToast('よく使う合数は最大5つまでです');
        return;
      }
    }

    list.sort((a, b) => a - b);
    Store.updateSettings({ frequentCups: list });
  }

  // 設定：1合あたりg数の調整
  function adjustCupsPerGram(diff) {
    const settings = Store.getSettings();
    let val = settings.cupsPerGram || 150;
    val = Math.max(120, Math.min(180, val + diff));
    Store.updateSettings({ cupsPerGram: val });
  }

  // 設定：テーマ切り替え
  function toggleTheme(checkbox) {
    const theme = checkbox.checked ? 'dark' : 'light';
    Store.updateSettings({ theme });
  }

  // --- トースト＆モーダル制御（公開用） ---

  let toastTimer = null;

  function showToast(message, durationMs = 3000, undoCallback = null) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (undoCallback) {
      toast.innerHTML = `<span>${message}</span><button id="toast-undo-btn" style="background:none; border:none; color:var(--color-accent); font-weight:700; text-decoration:underline; cursor:pointer; margin-left:12px; font-family:inherit; font-size:0.9rem;">元に戻す</button>`;
      const undoBtn = toast.querySelector('#toast-undo-btn');
      if (undoBtn) {
        undoBtn.onclick = (e) => {
          e.stopPropagation();
          undoCallback();
          toast.textContent = '取り消しました';
          if (toastTimer) clearTimeout(toastTimer);
          toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
              if (!toast.classList.contains('show')) {
                toast.classList.add('hidden');
              }
            }, 300);
          }, 1000);
        };
      }
    } else {
      toast.textContent = message;
    }

    toast.classList.add('show');
    toast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      // アニメーション完了後に完全に隠す
      setTimeout(() => {
        if (!toast.classList.contains('show')) {
          toast.classList.add('hidden');
        }
      }, 300);
    }, durationMs);
  }

  function openModal(contentHtml) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    
    if (overlay && content) {
      content.innerHTML = contentHtml;
      overlay.classList.remove('hidden');
      // 少しラグを置いてアニメーションクラスを付与
      setTimeout(() => {
        overlay.classList.add('show');
      }, 20);
    }
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => {
        if (!overlay.classList.contains('show')) {
          overlay.classList.add('hidden');
        }
      }, 300);
    }
  }

  return {
    init,
    showToast,
    openModal,
    closeModal,
    adjustDefaultCups,
    toggleFrequentCups,
    adjustCupsPerGram,
    toggleTheme
  };
})();

// DOMContentLoaded で初期化
document.addEventListener('DOMContentLoaded', App.init);
