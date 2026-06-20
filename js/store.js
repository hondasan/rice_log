const Store = (() => {
  // ローカルストレージキーの定義
  const KEYS = {
    COOKING_LOGS: 'riceApp_cookingLogs',
    RICE_STOCKS: 'riceApp_riceStocks',
    SETTINGS: 'riceApp_settings'
  };

  // デフォルト設定
  const DEFAULT_SETTINGS = {
    defaultCups: 2,
    frequentCups: [1, 1.5, 2, 3],
    cupsPerGram: 150,
    theme: 'light'
  };

  // 補助関数: UUIDの生成 (ブラウザ互換性対応)
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 補助関数: localStorageの読み込み
  function read(key, defaultValue = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage`, e);
      return defaultValue;
    }
  }

  // 補助関数: localStorageへの保存とイベント通知
  function write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      // 変更を通知するためのカスタムイベントをディスパッチ
      window.dispatchEvent(new CustomEvent('store:changed', { detail: { key } }));
    } catch (e) {
      console.error(`Error writing ${key} to localStorage`, e);
    }
  }

  return {
    // --- 炊飯記録 (CookingLogs) API ---
    getCookingLogs() {
      // 日付降順・時間降順（あれば）でソート
      return read(KEYS.COOKING_LOGS, []).sort((a, b) => b.date.localeCompare(a.date));
    },

    getCookingLogsByDate(date) {
      return this.getCookingLogs().filter(log => log.date === date);
    },

    getCookingLogsByMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return this.getCookingLogs().filter(log => log.date.startsWith(prefix));
    },

    getCookingLogsByYear(year) {
      const prefix = `${year}-`;
      return this.getCookingLogs().filter(log => log.date.startsWith(prefix));
    },

    addCookingLog(log) {
      const logs = read(KEYS.COOKING_LOGS, []);
      const newLog = {
        id: generateUUID(),
        date: log.date,
        cups: parseFloat(log.cups) || 0
      };
      logs.push(newLog);
      write(KEYS.COOKING_LOGS, logs);
    },

    addCookingLogsBatch(newLogs) {
      const logs = read(KEYS.COOKING_LOGS, []);
      newLogs.forEach(log => {
        logs.push({
          id: generateUUID(),
          date: log.date,
          cups: parseFloat(log.cups) || 0
        });
      });
      write(KEYS.COOKING_LOGS, logs);
    },

    updateCookingLog(id, updatedFields) {
      const logs = read(KEYS.COOKING_LOGS, []);
      const index = logs.findIndex(log => log.id === id);
      if (index !== -1) {
        logs[index] = {
          ...logs[index],
          ...updatedFields,
          cups: parseFloat(updatedFields.cups) !== undefined ? parseFloat(updatedFields.cups) : logs[index].cups
        };
        write(KEYS.COOKING_LOGS, logs);
      }
    },

    deleteCookingLog(id) {
      let logs = read(KEYS.COOKING_LOGS, []);
      logs = logs.filter(log => log.id !== id);
      write(KEYS.COOKING_LOGS, logs);
    },


    // --- 在庫管理 (RiceStocks) API ---
    getRiceStocks() {
      // 基本は購入日昇順、使用中・ストック状態によって整理しやすくするためそのまま返す
      return read(KEYS.RICE_STOCKS, []);
    },

    addRiceStock(stock) {
      const stocks = read(KEYS.RICE_STOCKS, []);
      const newStock = {
        id: generateUUID(),
        purchaseDate: stock.purchaseDate || new Date().toISOString().split('T')[0],
        openDate: stock.isOpen ? (stock.openDate || new Date().toISOString().split('T')[0]) : null,
        weightKg: parseFloat(stock.weightKg) || 5,
        brand: stock.brand || 'none',
        isOpen: !!stock.isOpen,
        isFinished: false,
        finishedDate: null,
        finishReason: null,
        remainingAtFinishGram: null
      };
      stocks.push(newStock);
      write(KEYS.RICE_STOCKS, stocks);
    },

    updateRiceStock(id, updatedFields) {
      const stocks = read(KEYS.RICE_STOCKS, []);
      const index = stocks.findIndex(s => s.id === id);
      if (index !== -1) {
        stocks[index] = { ...stocks[index], ...updatedFields };
        write(KEYS.RICE_STOCKS, stocks);
      }
    },

    deleteRiceStock(id) {
      let stocks = read(KEYS.RICE_STOCKS, []);
      stocks = stocks.filter(s => s.id !== id);
      write(KEYS.RICE_STOCKS, stocks);
    },


    // --- ユーザー設定 (Settings) API ---
    getSettings() {
      // settingsはオブジェクトなのでreadのデフォルト値をDEFAULT_SETTINGSにする
      const settings = localStorage.getItem(KEYS.SETTINGS);
      if (!settings) {
        // 初期時に書き込んでおく
        write(KEYS.SETTINGS, DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
      }
      try {
        // 不足しているキーがある場合のフォールバックを考慮
        return { ...DEFAULT_SETTINGS, ...JSON.parse(settings) };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    },

    updateSettings(updatedFields) {
      const current = this.getSettings();
      const next = { ...current, ...updatedFields };
      write(KEYS.SETTINGS, next);
    },


    // --- データインポート・エクスポート・全削除 ---
    exportAll() {
      const data = {
        cookingLogs: read(KEYS.COOKING_LOGS, []),
        riceStocks: read(KEYS.RICE_STOCKS, []),
        settings: this.getSettings()
      };
      return JSON.stringify(data, null, 2);
    },

    importAll(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        // 簡単なバリデーション
        if (data && typeof data === 'object') {
          if (Array.isArray(data.cookingLogs)) {
            localStorage.setItem(KEYS.COOKING_LOGS, JSON.stringify(data.cookingLogs));
          }
          if (Array.isArray(data.riceStocks)) {
            localStorage.setItem(KEYS.RICE_STOCKS, JSON.stringify(data.riceStocks));
          }
          if (data.settings && typeof data.settings === 'object') {
            localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
          }
          
          // 変更通知 (settingsキーをターゲットとしてイベント発火させ全体再描画を促す)
          window.dispatchEvent(new CustomEvent('store:changed', { detail: { key: 'all' } }));
          return true;
        }
        return false;
      } catch (e) {
        console.error("Failed to import data:", e);
        return false;
      }
    },

    clearAll() {
      localStorage.removeItem(KEYS.COOKING_LOGS);
      localStorage.removeItem(KEYS.RICE_STOCKS);
      localStorage.removeItem(KEYS.SETTINGS);
      window.dispatchEvent(new CustomEvent('store:changed', { detail: { key: 'all' } }));
    }
  };
})();
