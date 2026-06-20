const ChartUtil = (() => {
  // アニメーション中のタイマー/フレームIDを管理するオブジェクト
  const activeAnimations = {};

  // イージング関数: Ease Out Quad
  function easeOutQuad(t) {
    return t * (2 - t);
  }

  // --- 米びつ描画 ---
  function drawRiceJarFrame(ctx, width, height, theme) {
    const isDark = theme === 'dark';
    ctx.strokeStyle = isDark ? '#3D3A34' : '#E5DFD6';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // ガラス瓶/米びつの外枠を描画
    const padX = 15;
    const padY = 15;
    const jarW = width - padX * 2;
    const jarH = height - padY * 2 - 10; // 下部のスペース確保
    
    // 瓶の肩の丸み、口の部分を手描き風に描画
    ctx.beginPath();
    // 左口
    ctx.moveTo(width / 2 - 25, padY);
    // 左肩へ
    ctx.lineTo(padX + 15, padY + 12);
    // 左側面を下へ
    ctx.quadraticCurveTo(padX, padY + 20, padX, padY + 40);
    ctx.lineTo(padX, padY + jarH - 15);
    // 底（丸い角）
    ctx.quadraticCurveTo(padX, padY + jarH, padX + 15, padY + jarH);
    ctx.lineTo(width - padX - 15, padY + jarH);
    ctx.quadraticCurveTo(width - padX, padY + jarH, width - padX, padY + jarH - 15);
    // 右側面を上へ
    ctx.lineTo(width - padX, padY + 40);
    ctx.quadraticCurveTo(width - padX, padY + 20, width - padX - 15, padY + 12);
    // 右口
    ctx.lineTo(width / 2 + 25, padY);
    ctx.stroke();

    // 瓶のふた（木製プレート風）
    ctx.fillStyle = isDark ? '#DEB97A' : '#D4A76A';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 32, padY - 8, 64, 12, 4);
    ctx.fill();
    ctx.stroke();
  }

  return {
    /**
     * 米びつキャンバスを描画する（高さアニメーション付き）
     */
    animateRiceJar(canvas, percent, theme = 'light') {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      // すでに動いているアニメーションがあれば停止
      if (activeAnimations[canvas.id]) {
        cancelAnimationFrame(activeAnimations[canvas.id]);
      }

      // 前回のパーセンテージを保持（なければ0からスタート）
      const startPercent = canvas.dataset.lastPercent !== undefined ? parseFloat(canvas.dataset.lastPercent) : 0;
      canvas.dataset.lastPercent = percent;

      const duration = 60; // 60フレーム (約1秒)
      let frame = 0;

      // 米粒の配置用ランダムデータ (毎回変わらないようにシードを固定)
      const riceSeeds = [];
      for (let i = 0; i < 150; i++) {
        riceSeeds.push({
          x: 0.15 + Math.random() * 0.7,
          y: Math.random(),
          r: 1.5 + Math.random() * 1.5,
          angle: Math.random() * Math.PI
        });
      }

      function renderFrame() {
        frame++;
        const progress = Math.min(frame / duration, 1);
        const ease = easeOutQuad(progress);
        const currentPercent = startPercent + (percent - startPercent) * ease;

        ctx.clearRect(0, 0, width, height);

        // 1. 米びつの外枠を描画
        drawRiceJarFrame(ctx, width, height, theme);

        // 2. お米の中身を描画 (残量がある場合)
        if (currentPercent > 0) {
          ctx.save();
          // クリップ領域を作成して瓶の中にだけ米を描画
          const padX = 15;
          const padY = 15;
          const jarW = width - padX * 2;
          const jarH = height - padY * 2 - 10;

          ctx.beginPath();
          ctx.moveTo(padX + 3, padY + 45);
          ctx.lineTo(padX + 3, padY + jarH - 12);
          ctx.quadraticCurveTo(padX + 3, padY + jarH - 3, padX + 15, padY + jarH - 3);
          ctx.lineTo(width - padX - 15, padY + jarH - 3);
          ctx.quadraticCurveTo(width - padX - 3, padY + jarH - 3, width - padX - 3, padY + jarH - 12);
          ctx.lineTo(width - padX - 3, padY + 45);
          ctx.closePath();
          ctx.clip();

          // お米の高さ（底からどれだけ上に行くか）
          // 瓶の底 y: padY + jarH - 3, 高さは最大で jarH - 55 程度
          const maxRiceH = jarH - 45;
          const riceH = maxRiceH * (currentPercent / 100);
          const topY = (padY + jarH - 3) - riceH;

          // 色の決定 (70%以上: 緑系, 30%-70%: ゴールド系, 30%未満: 赤系)
          let colorStart, colorEnd, seedColor;
          const isDark = theme === 'dark';
          
          if (currentPercent >= 70) {
            colorStart = isDark ? '#8FB67D' : '#7B9E6B'; // 抹茶グリーン
            colorEnd = isDark ? '#B3D4A3' : '#A2C293';
            seedColor = isDark ? '#DCEAD5' : '#EAF2E6';
          } else if (currentPercent >= 30) {
            colorStart = isDark ? '#DEB97A' : '#D4A76A'; // 稲穂ゴールド
            colorEnd = isDark ? '#ECD2A5' : '#E6CEAA';
            seedColor = isDark ? '#FAEFDD' : '#FAF6ED';
          } else {
            colorStart = isDark ? '#D47070' : '#C75C5C'; // 警告赤
            colorEnd = isDark ? '#E59898' : '#DB8888';
            seedColor = isDark ? '#FCECEC' : '#FAF0F0';
            
            // 残量少ない場合に赤くパルス点滅
            const pulse = 0.85 + Math.sin(Date.now() / 200) * 0.15;
            ctx.globalAlpha = pulse;
          }

          // 米グラデーションの適用
          const grad = ctx.createLinearGradient(0, topY, 0, padY + jarH);
          grad.addColorStop(0, colorEnd);
          grad.addColorStop(1, colorStart);
          ctx.fillStyle = grad;

          // 米の本体を四角で塗る
          ctx.fillRect(padX, topY, jarW, padY + jarH - topY);

          // 米の表面に少し波（手描き感）をつける
          ctx.fillStyle = colorEnd;
          ctx.beginPath();
          ctx.ellipse(width / 2, topY, jarW / 2 + 5, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // 3. 米粒テクスチャの描画
          ctx.fillStyle = seedColor;
          ctx.globalAlpha = ctx.globalAlpha * 0.6; // 少し透過させる
          riceSeeds.forEach(seed => {
            // お米の高さより下にあるものだけ描く
            const seedY = topY + seed.y * riceH;
            if (seedY > topY + 4 && seedY < padY + jarH - 10) {
              const seedX = padX + seed.x * jarW;
              ctx.save();
              ctx.translate(seedX, seedY);
              ctx.rotate(seed.angle);
              ctx.beginPath();
              ctx.ellipse(0, 0, seed.r * 1.5, seed.r, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          });

          ctx.restore();
          ctx.globalAlpha = 1.0;
        }

        // 残量%の文字表示
        ctx.fillStyle = theme === 'dark' ? '#E8E2D9' : '#3E3A35';
        ctx.font = 'bold 15px "Outfit"';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(currentPercent)}%`, width / 2, height - 10);

        if (frame < duration) {
          activeAnimations[canvas.id] = requestAnimationFrame(renderFrame);
        } else if (percent < 30 && percent > 0) {
          // 残量が少ない場合のパルスループ（アニメーションフレームが終了しても、パルス用に再描画し続ける）
          function pulseLoop() {
            if (activeAnimations[canvas.id] !== 'pulse') return;
            ctx.clearRect(0, 0, width, height);
            drawRiceJarFrame(ctx, width, height, theme);
            
            ctx.save();
            const padX = 15;
            const padY = 15;
            const jarW = width - padX * 2;
            const jarH = height - padY * 2 - 10;

            ctx.beginPath();
            ctx.moveTo(padX + 3, padY + 45);
            ctx.lineTo(padX + 3, padY + jarH - 12);
            ctx.quadraticCurveTo(padX + 3, padY + jarH - 3, padX + 15, padY + jarH - 3);
            ctx.lineTo(width - padX - 15, padY + jarH - 3);
            ctx.quadraticCurveTo(width - padX - 3, padY + jarH - 3, width - padX - 3, padY + jarH - 12);
            ctx.lineTo(width - padX - 3, padY + 45);
            ctx.closePath();
            ctx.clip();

            const maxRiceH = jarH - 45;
            const riceH = maxRiceH * (percent / 100);
            const topY = (padY + jarH - 3) - riceH;

            const isDark = theme === 'dark';
            const colorStart = isDark ? '#D47070' : '#C75C5C';
            const colorEnd = isDark ? '#E59898' : '#DB8888';
            const seedColor = isDark ? '#FCECEC' : '#FAF0F0';

            const pulse = 0.8 + Math.sin(Date.now() / 250) * 0.15;
            ctx.globalAlpha = pulse;

            const grad = ctx.createLinearGradient(0, topY, 0, padY + jarH);
            grad.addColorStop(0, colorEnd);
            grad.addColorStop(1, colorStart);
            ctx.fillStyle = grad;
            ctx.fillRect(padX, topY, jarW, padY + jarH - topY);

            ctx.fillStyle = colorEnd;
            ctx.beginPath();
            ctx.ellipse(width / 2, topY, jarW / 2 + 5, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = seedColor;
            ctx.globalAlpha = pulse * 0.6;
            riceSeeds.forEach(seed => {
              const seedY = topY + seed.y * riceH;
              if (seedY > topY + 4 && seedY < padY + jarH - 10) {
                const seedX = padX + seed.x * jarW;
                ctx.save();
                ctx.translate(seedX, seedY);
                ctx.rotate(seed.angle);
                ctx.beginPath();
                ctx.ellipse(0, 0, seed.r * 1.5, seed.r, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }
            });
            ctx.restore();
            ctx.globalAlpha = 1.0;

            ctx.fillStyle = theme === 'dark' ? '#E8E2D9' : '#3E3A35';
            ctx.font = 'bold 15px "Outfit"';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(percent)}%`, width / 2, height - 10);

            requestAnimationFrame(pulseLoop);
          }
          activeAnimations[canvas.id] = 'pulse';
          requestAnimationFrame(pulseLoop);
        }
      }

      activeAnimations[canvas.id] = requestAnimationFrame(renderFrame);
    },

    /**
     * 統計用週別棒グラフを描画する（下から上に伸びるアニメーション付き）
     */
    drawBarChart(canvas, labels, values, theme = 'light') {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const isDark = theme === 'dark';

      if (activeAnimations[canvas.id]) {
        cancelAnimationFrame(activeAnimations[canvas.id]);
      }

      const duration = 45;
      let frame = 0;

      const maxValue = Math.max(...values, 5); // 最低スケールを5合とする
      const scaleMax = Math.ceil(maxValue / 5) * 5; // 5合単位でグリッドを合わせる

      const paddingLeft = 30;
      const paddingRight = 10;
      const paddingTop = 20;
      const paddingBottom = 25;

      const chartW = width - paddingLeft - paddingRight;
      const chartH = height - paddingTop - paddingBottom;

      function renderFrame() {
        frame++;
        const progress = Math.min(frame / duration, 1);
        const ease = easeOutQuad(progress);

        ctx.clearRect(0, 0, width, height);

        // 背景グリッドと目盛り
        ctx.strokeStyle = isDark ? '#3D3A34' : '#E5DFD6';
        ctx.lineWidth = 1;
        ctx.fillStyle = isDark ? '#9C968D' : '#8C8478';
        ctx.font = '10px "Outfit"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const gridLines = 4;
        for (let i = 0; i <= gridLines; i++) {
          const val = (scaleMax / gridLines) * i;
          const y = paddingTop + chartH - (chartH * (i / gridLines));
          
          ctx.beginPath();
          ctx.moveTo(paddingLeft, y);
          ctx.lineTo(width - paddingRight, y);
          ctx.stroke();

          // Y軸ラベル（合）
          ctx.fillText(`${val}`, paddingLeft - 6, y);
        }

        // 棒グラフ本体の描画
        const barCount = values.length;
        const gap = 14;
        const totalGap = gap * (barCount - 1);
        const barW = (chartW - totalGap) / barCount;

        labels.forEach((label, i) => {
          const val = values[i];
          const currentVal = val * ease;
          const barH = chartH * (currentVal / scaleMax);
          const x = paddingLeft + i * (barW + gap);
          const y = paddingTop + chartH - barH;

          // 棒の描画
          if (barH > 0) {
            ctx.fillStyle = isDark ? '#8FB67D' : '#7B9E6B'; // 抹茶グリーン
            ctx.beginPath();
            // 上部の角を少し丸くする
            ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
            ctx.fill();

            // 値の表示
            ctx.fillStyle = isDark ? '#E8E2D9' : '#3E3A35';
            ctx.font = 'bold 11px "Outfit"';
            ctx.textAlign = 'center';
            ctx.fillText(`${val.toFixed(1)}`, x + barW / 2, y - 8);
          }

          // X軸ラベル
          ctx.fillStyle = isDark ? '#9C968D' : '#8C8478';
          ctx.font = '11px "Zen Maru Gothic"';
          ctx.textAlign = 'center';
          ctx.fillText(label, x + barW / 2, height - paddingBottom + 16);
        });

        if (frame < duration) {
          activeAnimations[canvas.id] = requestAnimationFrame(renderFrame);
        }
      }

      activeAnimations[canvas.id] = requestAnimationFrame(renderFrame);
    },

    /**
     * 統計用月別折れ線グラフを描画する（左から右に伸びる線アニメーション付き）
     */
    drawLineChart(canvas, labels, values, theme = 'light') {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      const isDark = theme === 'dark';

      if (activeAnimations[canvas.id]) {
        cancelAnimationFrame(activeAnimations[canvas.id]);
      }

      const duration = 60;
      let frame = 0;

      const maxValue = Math.max(...values, 20); // 最低スケールを20合
      const scaleMax = Math.ceil(maxValue / 20) * 20;

      const paddingLeft = 30;
      const paddingRight = 15;
      const paddingTop = 20;
      const paddingBottom = 25;

      const chartW = width - paddingLeft - paddingRight;
      const chartH = height - paddingTop - paddingBottom;

      function renderFrame() {
        frame++;
        const progress = Math.min(frame / duration, 1);
        const ease = easeOutQuad(progress);

        ctx.clearRect(0, 0, width, height);

        // 背景グリッドと目盛り
        ctx.strokeStyle = isDark ? '#3D3A34' : '#E5DFD6';
        ctx.lineWidth = 1;
        ctx.fillStyle = isDark ? '#9C968D' : '#8C8478';
        ctx.font = '10px "Outfit"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const gridLines = 4;
        for (let i = 0; i <= gridLines; i++) {
          const val = (scaleMax / gridLines) * i;
          const y = paddingTop + chartH - (chartH * (i / gridLines));
          
          ctx.beginPath();
          ctx.moveTo(paddingLeft, y);
          ctx.lineTo(width - paddingRight, y);
          ctx.stroke();

          // Y軸ラベル（合）
          ctx.fillText(`${val}`, paddingLeft - 6, y);
        }

        // 描画用の座標計算
        const points = [];
        const stepX = chartW / (values.length - 1 || 1);

        values.forEach((val, i) => {
          const x = paddingLeft + i * stepX;
          const y = paddingTop + chartH - (chartH * (val / scaleMax));
          points.push({ x, y });
        });

        // アニメーション進捗に応じた線の切り取り
        const currentW = chartW * ease;
        const activePoints = points.filter(p => p.x <= paddingLeft + currentW);

        // 途中の点が存在し、かつ最終地点まで届いていない場合、次の点への補間を追加
        if (activePoints.length < points.length && ease < 1) {
          const lastPoint = points[activePoints.length - 1];
          const nextPoint = points[activePoints.length];
          const currentEndX = paddingLeft + currentW;
          const t = (currentEndX - lastPoint.x) / (nextPoint.x - lastPoint.x);
          const interpY = lastPoint.y + (nextPoint.y - lastPoint.y) * t;
          activePoints.push({ x: currentEndX, y: interpY });
        }

        // 下部グラデーション塗りつぶし
        if (activePoints.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(activePoints[0].x, paddingTop + chartH);
          activePoints.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.lineTo(activePoints[activePoints.length - 1].x, paddingTop + chartH);
          ctx.closePath();

          const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
          fillGrad.addColorStop(0, isDark ? 'rgba(143, 182, 125, 0.25)' : 'rgba(123, 158, 107, 0.2)');
          fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = fillGrad;
          ctx.fill();
          ctx.restore();
        }

        // 折れ線の描画
        if (activePoints.length > 0) {
          ctx.strokeStyle = isDark ? '#8FB67D' : '#7B9E6B'; // 抹茶グリーン
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(activePoints[0].x, activePoints[0].y);
          for (let i = 1; i < activePoints.length; i++) {
            ctx.lineTo(activePoints[i].x, activePoints[i].y);
          }
          ctx.stroke();
        }

        // ドットの描画（実データポイントのみ）
        points.forEach((p, i) => {
          // アニメーション範囲内に入ったドットだけ描画
          if (p.x <= paddingLeft + currentW + 1) {
            ctx.fillStyle = isDark ? '#DEB97A' : '#D4A76A'; // 稲穂ゴールド
            ctx.strokeStyle = isDark ? '#2A2925' : '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 値の表示（ピーク時や一部だけ表示すると見やすいが、年間は全月表示）
            if (values[i] > 0) {
              ctx.fillStyle = isDark ? '#E8E2D9' : '#3E3A35';
              ctx.font = 'bold 10px "Outfit"';
              ctx.textAlign = 'center';
              ctx.fillText(`${values[i].toFixed(0)}`, p.x, p.y - 10);
            }
          }

          // X軸ラベル（年間は数ヶ月おき、もしくは短縮表示）
          ctx.fillStyle = isDark ? '#9C968D' : '#8C8478';
          ctx.font = '10px "Outfit"';
          ctx.textAlign = 'center';
          ctx.fillText(labels[i], p.x, height - paddingBottom + 15);
        });

        if (frame < duration) {
          activeAnimations[canvas.id] = requestAnimationFrame(renderFrame);
        }
      }

      activeAnimations[canvas.id] = requestAnimationFrame(renderFrame);
    }
  };
})();
