const ExportView = (() => {

  /**
   * データエクスポート
   */
  function exportData() {
    const jsonString = Store.exportAll();
    const todayStr = new Date().toISOString().split('T')[0];
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `こめログ_backup_${todayStr}.json`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    App.showToast('データを書き出しました');
  }

  /**
   * データインポート
   */
  function importData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const content = e.target.result;
      
      if (confirm('インポートを実行すると、現在アプリに保存されているデータはすべて上書きされます。よろしいですか？')) {
        const success = Store.importAll(content);
        if (success) {
          App.showToast('データを復元しました');
          // ファイルインプットの値をリセット
          const fileInput = document.getElementById('settings-import-file');
          if (fileInput) fileInput.value = '';
        } else {
          alert('ファイルの形式が正しくないか、データが破損しています');
        }
      } else {
        // キャンセル時はインプットをリセット
        const fileInput = document.getElementById('settings-import-file');
        if (fileInput) fileInput.value = '';
      }
    };
    reader.readAsText(file);
  }

  /**
   * 全データ削除ボタンの長押し（3秒）制御のセットアップ
   */
  function setupClearDataButton() {
    const btn = document.getElementById('settings-btn-clear');
    if (!btn) return;

    // プログレスバー用のDOM要素をボタン内部に追加
    let progressEl = btn.querySelector('.btn-hold-progress');
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.className = 'btn-hold-progress';
      btn.appendChild(progressEl);
    }

    let holdTimer = null;
    let holdInterval = null;
    let progress = 0;
    const requiredHoldTimeMs = 3000;
    const updateIntervalMs = 50;

    function startHold(e) {
      e.preventDefault();
      
      progress = 0;
      progressEl.style.width = '0%';
      btn.classList.add('holding');

      holdInterval = setInterval(() => {
        progress += (updateIntervalMs / requiredHoldTimeMs) * 100;
        progressEl.style.width = `${Math.min(progress, 100)}%`;

        if (progress >= 100) {
          clearHold();
          executeClear();
        }
      }, updateIntervalMs);
    }

    function clearHold() {
      if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
      }
      progress = 0;
      progressEl.style.width = '0%';
      btn.classList.remove('holding');
    }

    function executeClear() {
      if (confirm('本当に「こめログ」のすべてのデータを完全に削除しますか？\nこの操作は取り消せません。')) {
        Store.clearAll();
        App.showToast('すべてのデータを初期化しました');
      }
    }

    // イベントバインディング (PC & モバイル対応)
    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', clearHold);
    btn.addEventListener('mouseleave', clearHold);

    btn.addEventListener('touchstart', startHold, { passive: false });
    btn.addEventListener('touchend', clearHold);
    btn.addEventListener('touchcancel', clearHold);
  }

  return {
    exportData,
    importData,
    setupClearDataButton
  };
})();
