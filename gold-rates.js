(() => {
  const RUPEE = '\u20B9';
  const METAL_ORDER = ['gold', 'silver', 'platinum', 'diamond'];
  const FALLBACK_COLORS = {
    gold: '#ffd76a',
    silver: '#d8e3f2',
    platinum: '#8fe9ff',
    diamond: '#ff5fd2'
  };
  let liveRateTimer = null;
  let liveClockTimer = null;
  let lastPreciousItems = [];
  let lastErrorMessage = '';
  let lastStepMs = 1000;
  const LIVE_PRECIOUS_SYNC_MS = 1000;

  const formatRate = (value) => `${RUPEE}${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / g`;
  const formatSignedRate = (value) => `${value < 0 ? '-' : '+'}${RUPEE}${Math.abs(Number(value || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (value) => `${value < 0 ? '-' : '+'}${Math.abs(Number(value || 0)).toFixed(2)}%`;
  const safeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const formatDateTime = (value = new Date()) => new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const renderClock = () => {
    const node = document.getElementById('precious-live-time');
    if (node) node.textContent = `Current date and time: ${formatDateTime(new Date())}`;
  };

  const renderCards = (items = []) => {
    const grid = document.getElementById('precious-rate-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `
        <article class="metal-rate-card">
          <div class="metal-rate-top">
            <span class="metal-rate-badge">No Data</span>
            <span class="metal-rate-trend flat">WAIT</span>
          </div>
          <h3 class="metal-rate-name">Precious Metals</h3>
          <div class="metal-rate-value">${RUPEE}0 / g</div>
          <div class="metal-rate-change">Live MongoDB rate feed is unavailable right now.</div>
          <div class="metal-rate-updated">Please retry in a moment</div>
        </article>
      `;
      return;
    }
    grid.innerHTML = items.map((item) => {
      const trend = String(item.trend || 'flat').toLowerCase();
      const trendLabel = trend === 'up' ? 'UP' : trend === 'down' ? 'DOWN' : 'FLAT';
      const remarks = Array.isArray(item.remarks) ? item.remarks.slice(0, 2).join(' ') : '';
      return `
        <article class="metal-rate-card metal-rate-${safeHtml(item.metal)}" style="--metal-color:${safeHtml(item.color || FALLBACK_COLORS[item.metal] || '#67e3ff')};">
          <div class="metal-rate-top">
            <span class="metal-rate-badge">${safeHtml(item.displayName || item.metal || 'Metal')}</span>
            <span class="metal-rate-trend ${safeHtml(trend)}">${safeHtml(trendLabel)}</span>
          </div>
          <h3 class="metal-rate-name">${safeHtml(item.displayName || item.metal || 'Metal')}</h3>
          <div class="metal-rate-value">${safeHtml(formatRate(item.currentRate))}</div>
          <div class="metal-rate-change">${safeHtml(formatSignedRate(item.changeValue || 0))} | ${safeHtml(formatPercent(item.changePercent || 0))}</div>
          <div class="metal-rate-note">${safeHtml(remarks || 'Live rate synced from MongoDB history.')}</div>
          <div class="metal-rate-updated">Updated ${safeHtml(formatDateTime(item.lastUpdatedAt || new Date()))}</div>
        </article>
      `;
    }).join('');
  };

  const resizePreciousCanvas = (canvas, preferredHeight = null) => {
    const wrapper = canvas?.parentElement;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.max((wrapper?.clientWidth || canvas?.clientWidth || 1100) - 2, 320);
    const height = preferredHeight || (window.innerWidth < 720 ? 260 : 420);
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  };

  const renderLegend = (items = []) => {
    const node = document.getElementById('precious-rates-legend');
    if (!node) return;
    node.innerHTML = items.map((item) => `
      <div class="precious-legend-item">
        <span class="precious-legend-swatch" style="background:${safeHtml(item.color || FALLBACK_COLORS[item.metal] || '#67e3ff')}"></span>
        <span>${safeHtml(item.displayName || item.metal || 'Metal')}</span>
        <strong>${safeHtml(formatRate(item.currentRate || 0))}</strong>
      </div>
    `).join('');
  };

  const metalLabel = (metal = '') => {
    const clean = String(metal || '').trim().toLowerCase();
    if (!clean) return 'Metal';
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const buildMetalLookup = (items = []) => METAL_ORDER.reduce((map, metal) => {
    map[metal] = items.find((item) => String(item?.metal || '').toLowerCase() === metal) || null;
    return map;
  }, {});

  const drawSingleMetalChart = (metal, item = null) => {
    const canvas = document.getElementById(`${metal}-rate-chart`);
    if (!canvas || !canvas.getContext) return;
    const { ctx, width, height } = resizePreciousCanvas(canvas, window.innerWidth < 720 ? 220 : 280);
    const padding = { top: 40, right: 24, bottom: 36, left: 66 };
    const color = item?.color || FALLBACK_COLORS[metal] || '#67e3ff';
    const label = item?.displayName || metalLabel(metal);
    const history = (Array.isArray(item?.history) ? item.history : [])
      .map((point) => Number(point || 0))
      .filter((point) => point > 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(7, 14, 28, 0.98)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(242, 248, 255, 0.96)';
    ctx.font = '700 20px Rajdhani';
    ctx.fillText(`${label.toUpperCase()} RATE GRAPH`, padding.left, 26);
    ctx.font = '600 12px Rajdhani';
    ctx.fillStyle = 'rgba(182, 205, 228, 0.86)';
    ctx.fillText(`Landscape live history | ${Math.max(Math.round(lastStepMs / 1000), 1)} sec`, padding.left, height - 12);

    if (!history.length) {
      ctx.fillStyle = 'rgba(180, 204, 228, 0.9)';
      ctx.font = '600 14px Rajdhani';
      ctx.fillText('No live MongoDB rate history is available for this metal yet.', padding.left, padding.top + 18);
      return;
    }

    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = Math.max(max - min, max * 0.015, 1);
    const pointX = (index) => padding.left + ((width - padding.left - padding.right) / Math.max(history.length - 1, 1)) * index;
    const pointY = (value) => {
      const ratio = (value - min) / range;
      return height - padding.bottom - (ratio * (height - padding.top - padding.bottom));
    };

    for (let index = 0; index < 4; index += 1) {
      const y = padding.top + ((height - padding.top - padding.bottom) / 3) * index;
      ctx.strokeStyle = 'rgba(113, 159, 205, 0.14)';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const labelValue = max - ((range * index) / 3);
      ctx.fillStyle = 'rgba(180, 208, 232, 0.82)';
      ctx.font = '600 11px Rajdhani';
      ctx.fillText(`${RUPEE}${labelValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 10, y + 4);
    }

    const points = history.map((value, index) => ({ x: pointX(index), y: pointY(value), value }));
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.lineTo(points[0].x, height - padding.bottom);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, `${color}55`);
    gradient.addColorStop(1, `${color}08`);
    ctx.fillStyle = gradient;
    ctx.fill();

    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = color;
    ctx.font = '700 12px Rajdhani';
    ctx.fillText(formatRate(item?.currentRate || lastPoint.value), Math.max(padding.left, Math.min(lastPoint.x - 34, width - 190)), Math.max(padding.top + 10, lastPoint.y - 12));
  };

  const renderSeparateCharts = (items = []) => {
    const lookup = buildMetalLookup(items);
    METAL_ORDER.forEach((metal) => {
      const item = lookup[metal];
      const currentNode = document.getElementById(`${metal}-rate-current`);
      const summaryNode = document.getElementById(`${metal}-rate-summary`);
      const card = document.querySelector(`[data-metal-card="${metal}"]`);
      const changeLabel = item
        ? `${formatSignedRate(item.changeValue || 0)} | ${formatPercent(item.changePercent || 0)}`
        : 'Waiting for live rate history.';
      if (card) card.style.setProperty('--metal-color', item?.color || FALLBACK_COLORS[metal] || '#67e3ff');
      if (currentNode) currentNode.textContent = item ? formatRate(item.currentRate || 0) : `${RUPEE}0.00 / g`;
      if (summaryNode) summaryNode.textContent = changeLabel;
      drawSingleMetalChart(metal, item);
    });
  };

  const drawChart = (items = []) => {
    const canvas = document.getElementById('precious-rates-chart');
    const statusNode = document.getElementById('precious-chart-status');
    const summaryNode = document.getElementById('precious-chart-summary');
    if (!canvas || !canvas.getContext) return;
    const { ctx, width, height } = resizePreciousCanvas(canvas);
    const padding = { top: 48, right: 38, bottom: 46, left: 82 };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(7, 14, 28, 0.98)';
    ctx.fillRect(0, 0, width, height);

    if (!items.length) {
      ctx.fillStyle = 'rgba(226, 240, 255, 0.94)';
      ctx.font = '700 24px Rajdhani';
      ctx.fillText('PRECIOUS METAL RATE GRAPH', padding.left, padding.top);
      ctx.font = '600 15px Rajdhani';
      ctx.fillStyle = 'rgba(180, 204, 228, 0.9)';
      ctx.fillText('No live MongoDB metal rates are available right now.', padding.left, padding.top + 30);
      if (statusNode) statusNode.textContent = 'No Data';
      if (summaryNode) summaryNode.textContent = 'Waiting for the live rate feed.';
      renderLegend([]);
      return;
    }

    const series = items.map((item) => ({
      ...item,
      history: (Array.isArray(item.history) ? item.history : []).map((point) => Number(point || 0)).filter((point) => point > 0)
    }));
    const allPoints = series.flatMap((item) => item.history);
    const max = Math.max(...allPoints);
    const min = Math.min(...allPoints);
    const safeRange = Math.max(max - min, max * 0.02, 1);
    const historyLength = Math.max(...series.map((item) => item.history.length), 2);

    for (let index = 0; index < 5; index += 1) {
      const y = padding.top + ((height - padding.top - padding.bottom) / 4) * index;
      ctx.strokeStyle = 'rgba(113, 159, 205, 0.16)';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const labelValue = max - ((safeRange * index) / 4);
      ctx.fillStyle = 'rgba(180, 208, 232, 0.82)';
      ctx.font = '600 12px Rajdhani';
      ctx.fillText(`${RUPEE}${labelValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 12, y + 4);
    }

    for (let index = 0; index < Math.min(historyLength, 8); index += 1) {
      const x = padding.left + ((width - padding.left - padding.right) / Math.max(Math.min(historyLength, 8) - 1, 1)) * index;
      ctx.strokeStyle = 'rgba(113, 159, 205, 0.09)';
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    const pointX = (index) => padding.left + ((width - padding.left - padding.right) / Math.max(historyLength - 1, 1)) * index;
    const pointY = (value) => {
      const ratio = (value - min) / safeRange;
      return height - padding.bottom - (ratio * (height - padding.top - padding.bottom));
    };

    series.forEach((item) => {
      if (!item.history.length) return;
      const color = item.color || FALLBACK_COLORS[item.metal] || '#67e3ff';
      ctx.beginPath();
      item.history.forEach((point, index) => {
        const x = pointX(index);
        const y = pointY(point);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const lastIndex = item.history.length - 1;
      const lastX = pointX(lastIndex);
      const lastY = pointY(item.history[lastIndex]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = color;
      ctx.font = '700 12px Rajdhani';
      ctx.fillText(`${item.displayName}: ${formatRate(item.currentRate)}`, Math.min(lastX + 10, width - 240), Math.max(lastY - 10, padding.top + 12));
    });

    ctx.fillStyle = 'rgba(242, 248, 255, 0.96)';
    ctx.font = '700 24px Rajdhani';
    ctx.fillText('PRECIOUS METAL RATE GRAPH', padding.left, 28);
    ctx.font = '600 14px Rajdhani';
    ctx.fillStyle = 'rgba(182, 205, 228, 0.92)';
    ctx.fillText('Landscape live history for gold, silver, platinum, and diamond per gram in rupees.', padding.left, 46);
    ctx.fillStyle = 'rgba(182, 205, 228, 0.78)';
    ctx.fillText(`Last ${historyLength} live points | Refresh ${Math.max(Math.round(lastStepMs / 1000), 1)} sec`, padding.left, height - 14);

    const topMover = [...series].sort((left, right) => Math.abs(Number(right.changePercent || 0)) - Math.abs(Number(left.changePercent || 0)))[0];
    if (statusNode) statusNode.textContent = 'Live';
    if (summaryNode) {
      summaryNode.textContent = topMover
        ? `${topMover.displayName} is the most active at ${formatPercent(topMover.changePercent || 0)}.`
        : 'Live MongoDB rate history is active.';
    }
    renderLegend(series);
  };

  const loadPreciousRates = async () => {
    const refreshNode = document.getElementById('precious-refresh-pill');
    try {
      if (refreshNode) refreshNode.textContent = 'Refreshing every 1 second';
      const response = await fetch('/api/precious-metals?limit=60', { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Unable to fetch live precious metal rates.');
      const items = METAL_ORDER.map((metal) => (Array.isArray(data.items) ? data.items.find((item) => String(item?.metal || '').toLowerCase() === metal) : null)).filter(Boolean);
      lastPreciousItems = items;
      lastStepMs = Number(data.stepMs || LIVE_PRECIOUS_SYNC_MS) || LIVE_PRECIOUS_SYNC_MS;
      lastErrorMessage = '';
      renderCards(items);
      drawChart(items);
      renderSeparateCharts(items);
      if (refreshNode) refreshNode.textContent = `Live refresh active | ${Math.max(Math.round(lastStepMs / 1000), 1)} sec`;
    } catch (error) {
      const safeError = error.message || 'Unable to fetch live precious metal rates.';
      if (refreshNode) refreshNode.textContent = 'Live feed unavailable';
      renderCards(lastPreciousItems);
      drawChart(lastPreciousItems);
      renderSeparateCharts(lastPreciousItems);
      if (safeError !== lastErrorMessage && typeof window.showToast === 'function') {
        window.showToast(safeError, 'error');
      }
      lastErrorMessage = safeError;
    }
  };

  const initPreciousRatesPage = () => {
    renderClock();
    loadPreciousRates();
    if (liveRateTimer) clearInterval(liveRateTimer);
    if (liveClockTimer) clearInterval(liveClockTimer);
    liveRateTimer = setInterval(() => {
      if (document.hidden) return;
      loadPreciousRates();
    }, LIVE_PRECIOUS_SYNC_MS);
    liveClockTimer = setInterval(renderClock, 1000);
    window.addEventListener('resize', () => {
      drawChart(lastPreciousItems);
      renderSeparateCharts(lastPreciousItems);
    });
  };

  window.addEventListener('DOMContentLoaded', initPreciousRatesPage);
})();
