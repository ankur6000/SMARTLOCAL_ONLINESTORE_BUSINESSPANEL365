
function showRegister() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('register-section').style.display = 'block';
}

function showLogin() {
  document.getElementById('register-section').style.display = 'none';
  document.getElementById('login-section').style.display = 'block';
}

function logout() {
  localStorage.removeItem('currentUser');
  location.reload();
}

let adminLoginInFlight = false;

document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (adminLoginInFlight) return;
  const userid = document.getElementById('login-userid').value.trim();
  const password = document.getElementById('login-password').value;
  const captchaInput = document.getElementById('captcha-input').value;
  const captchaDisplay = document.getElementById('captcha-display').textContent;
  const submitButton = document.querySelector('#login-form button[type="submit"]');
  // Check CAPTCHA
  if (captchaInput.toUpperCase() !== captchaDisplay) {
    showToast('Invalid security code! Please try again.', 'error');
    generateCaptcha(); // Generate new CAPTCHA
    return;
  }

  adminLoginInFlight = true;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Accessing...';
  }

  try {
    const rememberBox = document.getElementById('remember-login');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid, password, rememberLogin: Boolean(rememberBox?.checked) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Invalid credentials.');
    }
    const user = data?.user;
    if (!user) throw new Error('Unable to load the business account.');

    updateCurrentUserCache(user);
    applyBusinessSettings(user.settings || {}, { silent: true });

    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    updateNavAuthButton();
    const welcomeName = user.business?.name || user.name || 'Business Owner';
    showToast(`Welcome back, ${welcomeName}!`, 'success');
    if (typeof playLoginTone === 'function') playLoginTone();
    try {
      await refreshCommandCenterData({ silent: true, source: 'login', refreshRates: true, syncPortalState: true });
      startPortfolioTicker();
    } catch (dashboardError) {
      console.error('Dashboard sync failed after successful login:', dashboardError);
    }
  } catch (err) {
    const message = /invalid credentials/i.test(String(err?.message || ''))
      ? 'Invalid credentials! Please use the User ID and Password from Business Registration.'
      : (err?.message || 'Unable to log in right now.');
    showToast(message, 'error');
    generateCaptcha(); // Generate new CAPTCHA on failed login
  } finally {
    adminLoginInFlight = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Access Dashboard';
    }
  }
});

document.getElementById('register-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  window.location.href = 'business-register.html';
});

function showTab(event) {
  const tabBtn = event.target.closest('.tab-btn');
  if (!tabBtn) return;
  
  const tabName = tabBtn.getAttribute('data-tab');
  
  // Remove active from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Remove active from all content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Add active to clicked button
  tabBtn.classList.add('active');
  
  // Show content for this tab
  const tabContent = document.getElementById(`tab-${tabName}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }

  if (tabName === 'market' && getSafeCurrentUser()) {
    loadPortfolioDashboard();
    startPortfolioTicker();
    updateMarketClock();
  }
  if (getSafeCurrentUser()) {
    setTimeout(() => {
      refreshCommandCenterData({ silent: true, source: `tab:${tabName}` });
    }, 0);
  }
  
  // Update metadata
  const now = new Date();
  const timeStr = formatStableAdminTime(now);
  const metaEl = document.getElementById('command-center-meta');
  if (metaEl) metaEl.textContent = `Last accessed: ${timeStr}`;
}

// CAPTCHA Generation Function
function generateCaptcha() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let captcha = '';
  for (let i = 0; i < 6; i++) {
    captcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById('captcha-display').textContent = captcha;
}

function formatStableAdminTime(value = new Date()) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toUpperCase();
}

function handleNavAuth() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (currentUser) {
    logout();
  } else {
    window.location.href = 'admin.html';
  }
}

function updateNavAuthButton() {
  const authBtn = document.getElementById('nav-auth-btn');
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!authBtn) return;
  if (currentUser) {
    authBtn.textContent = 'Logout';
    authBtn.onclick = logout;
  } else {
    authBtn.textContent = 'Login';
    authBtn.onclick = () => window.location.href = 'admin.html';
  }
}

function getBusinessLogo(type) {
  const map = {
    salon: 'SAL',
    gym: 'GYM',
    restaurant: 'RST',
    clinic: 'CLN',
    grocery: 'GRC',
    tuition: 'TUI',
    retail: 'RTL',
    consulting: 'CNS',
    other: 'BIZ',
    platform: 'SL'
  };
  return map[type] || 'BIZ';
}

function getOwnerPrefix(gender) {
  if (gender === 'male') return 'Mr.';
  if (gender === 'female') return 'Ms.';
  return '';
}

function getSafeCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
  } catch (error) {
    return null;
  }
}

const DEFAULT_COURIER_RATE_CONFIG = {
  baseRate: 80,
  weightRate: 25,
  valueRate: 0.02,
  serviceMultipliers: {
    standard: 1,
    express: 1.5,
    'same-day': 2.2
  }
};

function normalizeCourierRateConfig(raw = {}) {
  return {
    baseRate: Number(raw?.baseRate ?? DEFAULT_COURIER_RATE_CONFIG.baseRate) || DEFAULT_COURIER_RATE_CONFIG.baseRate,
    weightRate: Number(raw?.weightRate ?? DEFAULT_COURIER_RATE_CONFIG.weightRate) || DEFAULT_COURIER_RATE_CONFIG.weightRate,
    valueRate: Number(raw?.valueRate ?? DEFAULT_COURIER_RATE_CONFIG.valueRate) || DEFAULT_COURIER_RATE_CONFIG.valueRate,
    serviceMultipliers: {
      standard: Number(raw?.serviceMultipliers?.standard ?? DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers.standard) || DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers.standard,
      express: Number(raw?.serviceMultipliers?.express ?? DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers.express) || DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers.express,
      'same-day': Number(raw?.serviceMultipliers?.['same-day'] ?? DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers['same-day']) || DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers['same-day']
    }
  };
}

function normalizePortalState(raw = {}) {
  const provider = String(raw?.lastAdminCourierProvider || '').trim().toLowerCase();
  return {
    soundEnabled: raw?.soundEnabled !== false,
    rememberLogin: Boolean(raw?.rememberLogin),
    courierRateConfig: normalizeCourierRateConfig(raw?.courierRateConfig),
    lastAdminCourierProvider: ['bluedart', 'indiapost', 'delhivery', 'smartlocal'].includes(provider) ? provider : '',
    robertHistory: Array.isArray(raw?.robertHistory) ? raw.robertHistory.slice(-20) : [],
    robertGreeted: Boolean(raw?.robertGreeted),
    robertSessionId: String(raw?.robertSessionId || '').trim()
  };
}

function updateCurrentUserCache(nextUser) {
  if (!nextUser) return null;
  const user = {
    ...nextUser,
    portalState: normalizePortalState(nextUser.portalState || {})
  };
  localStorage.setItem('currentUser', JSON.stringify(user));
  return user;
}

function currentPortalState() {
  return normalizePortalState(getSafeCurrentUser()?.portalState || {});
}

async function saveBusinessPortalState(patch = {}, options = {}) {
  const currentUser = getSafeCurrentUser();
  if (!currentUser?.userid) return currentPortalState();
  const payload = {
    ...currentPortalState(),
    ...(patch || {})
  };
  updateCurrentUserCache({ ...currentUser, portalState: payload });
  const response = await fetch(`/api/businesses/${encodeURIComponent(currentUser.userid)}/portal-state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to save live admin portal state.');
  }
  if (data?.user) updateCurrentUserCache({ ...currentUser, ...data.user });
  if (!options.silent) {
    window.dispatchEvent(new CustomEvent('smartlocal:portal-state', { detail: currentPortalState() }));
  }
  return currentPortalState();
}

async function syncAdminPortalState() {
  const currentUser = getSafeCurrentUser();
  if (!currentUser?.userid) return null;
  const response = await fetch(`/api/businesses/${encodeURIComponent(currentUser.userid)}/portal-state`, {
    headers: { Accept: 'application/json' }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.user) {
    throw new Error(data?.error || 'Unable to sync live portal state.');
  }
  const updatedUser = updateCurrentUserCache({ ...currentUser, ...data.user });
  applyBusinessSettings(updatedUser?.settings || {}, { silent: true });
  return updatedUser;
}

const ROBERT_LANGUAGE_LABELS = {
  'en-US': 'English',
  'hi-IN': 'Hindi',
  'bn-IN': 'Bengali',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati',
  'pa-IN': 'Punjabi',
  'ur-IN': 'Urdu'
};

function normalizeRobertLanguage(value) {
  const lang = String(value || '').trim();
  return ROBERT_LANGUAGE_LABELS[lang] ? lang : 'en-US';
}

function normalizeBusinessSettings(raw = {}) {
  const cutoff = /^\d{2}:\d{2}$/.test(String(raw?.bookingCutoff || '').trim())
    ? String(raw.bookingCutoff).trim()
    : '18:00';
  const rovertLanguage = normalizeRobertLanguage(raw?.rovertLanguage);
  return { bookingCutoff: cutoff, rovertLanguage };
}

function formatCutoffLabel(value) {
  const safeValue = /^\d{2}:\d{2}$/.test(String(value || '').trim()) ? value : '18:00';
  const [hourText, minuteText] = safeValue.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const hour12 = ((hour + 11) % 12) + 1;
  return `${hour12}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

const ADMIN_SETTINGS_SYNC_LOCK_IDS = ['admin-booking-cutoff-input', 'admin-robert-language-setting'];

function markAdminSettingsSyncLock(input) {
  if (input) input.dataset.syncLock = 'true';
}

function clearAdminSettingsSyncLocks() {
  ADMIN_SETTINGS_SYNC_LOCK_IDS.forEach((id) => {
    const input = document.getElementById(id);
    if (input) delete input.dataset.syncLock;
  });
}

function isAdminSettingsInputLocked(input) {
  return Boolean(input && (input.dataset.syncLock === 'true' || input === document.activeElement));
}

function setAdminSettingsInputValue(input, value) {
  if (!input || isAdminSettingsInputLocked(input)) return;
  input.value = value;
}

function initAdminSettingsInputLocks() {
  ADMIN_SETTINGS_SYNC_LOCK_IDS.forEach((id) => {
    const input = document.getElementById(id);
    if (!input || input.dataset.lockReady === 'true') return;
    input.dataset.lockReady = 'true';
    input.addEventListener('focus', () => markAdminSettingsSyncLock(input));
    input.addEventListener('input', () => markAdminSettingsSyncLock(input));
    input.addEventListener('change', () => markAdminSettingsSyncLock(input));
    input.addEventListener('blur', () => { delete input.dataset.syncLock; });
  });
}

function applyBusinessSettings(settingsInput = {}, options = {}) {
  const settings = normalizeBusinessSettings(settingsInput);
  const cutoffEl = document.getElementById('booking-cutoff');
  const cutoffInput = document.getElementById('admin-booking-cutoff-input');
  const languageSelect = document.getElementById('admin-robert-language-setting');
  const statusEl = document.getElementById('admin-settings-status');

  if (cutoffEl) cutoffEl.textContent = formatCutoffLabel(settings.bookingCutoff);
  if (cutoffInput) setAdminSettingsInputValue(cutoffInput, settings.bookingCutoff);
  if (languageSelect) setAdminSettingsInputValue(languageSelect, settings.rovertLanguage);
  if (!options.silent && statusEl) {
    statusEl.textContent = `Cutoff ${formatCutoffLabel(settings.bookingCutoff)} and Robert language ${ROBERT_LANGUAGE_LABELS[settings.rovertLanguage]} are active.`;
  }

  const currentUser = getSafeCurrentUser();
  if (currentUser?.userid) {
    updateCurrentUserCache({
      ...currentUser,
      settings
    });
  }
  window.dispatchEvent(new CustomEvent('smartlocal:robert-settings', { detail: settings }));
  updateOrderCutoffNote(settings);
  return settings;
}

function currentBusinessSettings() {
  const currentUser = getSafeCurrentUser();
  return normalizeBusinessSettings(currentUser?.settings || {});
}

function isAfterBookingCutoff(settingsInput = currentBusinessSettings()) {
  const settings = normalizeBusinessSettings(settingsInput);
  const [hourText, minuteText] = settings.bookingCutoff.split(':');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  const nowMinutes = (Number(parts.hour || 0) * 60) + Number(parts.minute || 0);
  const cutoffMinutes = (Number(hourText) * 60) + Number(minuteText);
  return nowMinutes >= cutoffMinutes;
}

function updateOrderCutoffNote(settingsInput = currentBusinessSettings()) {
  const settings = normalizeBusinessSettings(settingsInput);
  const note = document.getElementById('order-cutoff-note');
  if (!note) return;
  note.textContent = isAfterBookingCutoff(settings)
    ? `Cutoff ${formatCutoffLabel(settings.bookingCutoff)} has passed. New orders are locked and pending orders are auto-dispatched to courier.`
    : `Orders are accepted until cutoff ${formatCutoffLabel(settings.bookingCutoff)}. Pending orders auto-dispatch to courier after cutoff.`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOrderCourierLabel(order = {}) {
  if (order?.courierColumn) return order.courierColumn;
  const provider = order?.courier?.provider ? formatProviderLabel(order.courier.provider) : 'Courier Queue';
  const awb = String(order?.courier?.awb || '').trim();
  const status = order?.courier?.status || (String(order?.status || '').toLowerCase() === 'dispatched' ? 'Dispatched' : 'Pending Dispatch');
  return awb ? `${provider} | ${awb} | ${status}` : `${provider} | ${status}`;
}

const LANDSCAPE_PIE_PALETTE = ['#67e3ff', '#8b5cf6', '#ffd86b', '#00ff9d', '#ff7db8', '#f97316', '#60a5fa', '#a78bfa'];
let customerPieSource = [];
let chartResizeTimer = null;

function normalizeAdminPaymentMode(value = '') {
  const raw = String(value || '').trim();
  const paymentText = raw.toLowerCase();
  if (paymentText.includes('credit')) return 'Credit';
  if (paymentText.includes('debit')) return 'Debit';
  if (paymentText === 'upi' || paymentText.includes('upi')) return 'UPI';
  if (paymentText.includes('net')) return 'Netbanking';
  if (paymentText.includes('wallet')) return 'E-Wallet';
  if (paymentText.includes('auto')) return 'Autopay';
  return raw || 'UPI';
}

function formatCategoryLabel(value = '') {
  const text = String(value || 'Other').replace(/[-_]+/g, ' ').trim();
  if (!text) return 'Other';
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactLandscapePieSegments(segmentsInput = [], limit = 6, otherLabel = 'Other') {
  const sorted = segmentsInput
    .map((segment) => ({
      label: String(segment?.label || '').trim() || 'Other',
      value: Math.max(Number(segment?.value) || 0, 0)
    }))
    .filter((segment) => segment.value > 0)
    .sort((first, second) => second.value - first.value);

  if (sorted.length <= limit) return sorted;
  const visibleCount = Math.max(limit - 1, 1);
  const top = sorted.slice(0, visibleCount);
  const otherValue = sorted.slice(visibleCount).reduce((sum, segment) => sum + segment.value, 0);
  if (otherValue > 0) top.push({ label: otherLabel, value: otherValue });
  return top;
}

function resizeLandscapePieCanvas(canvas) {
  const shell = canvas?.closest('.landscape-pie-canvas-shell') || canvas?.parentElement;
  const fallbackWidth = Number(canvas?.getAttribute('width') || 720) || 720;
  const width = Math.max((shell?.clientWidth || canvas?.clientWidth || fallbackWidth) - 2, 280);
  const height = Math.max(Math.min(Math.round(width * 0.5), 320), 220);
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const targetWidth = Math.round(width * dpr);
  const targetHeight = Math.round(height * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function renderLandscapePieLegend(legendId, segments, total, options = {}) {
  const legend = document.getElementById(legendId);
  if (!legend) return;
  const valueFormatter = options.valueFormatter || ((value) => String(value));
  if (!segments.length || !total) {
    legend.innerHTML = `<div class="landscape-pie-empty">${escapeHtml(options.emptyText || 'No live data available yet.')}</div>`;
    return;
  }
  legend.innerHTML = segments.map((segment) => {
    const share = total > 0 ? ((segment.value / total) * 100).toFixed(1) : '0.0';
    return `
      <div class="landscape-pie-legend-item">
        <span class="landscape-pie-legend-swatch" style="background:${segment.color}"></span>
        <div class="landscape-pie-legend-copy">
          <strong>${escapeHtml(segment.label)}</strong>
          <span>${escapeHtml(valueFormatter(segment.value))}</span>
        </div>
        <span class="landscape-pie-legend-share">${share}%</span>
      </div>
    `;
  }).join('');
}

function drawLandscapePieChart(canvasId, segmentsInput, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;
  const totalEl = options.totalId ? document.getElementById(options.totalId) : null;
  const totalFormatter = options.totalFormatter || ((value) => String(value));
  const centerFormatter = options.centerFormatter || totalFormatter;
  const segments = compactLandscapePieSegments(segmentsInput, options.maxSegments || 6, options.otherLabel || 'Other')
    .map((segment, index) => ({
      ...segment,
      color: segment.color || LANDSCAPE_PIE_PALETTE[index % LANDSCAPE_PIE_PALETTE.length]
    }));
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (totalEl) totalEl.textContent = totalFormatter(total);
  renderLandscapePieLegend(options.legendId, segments, total, {
    valueFormatter: options.valueFormatter,
    emptyText: options.emptyText
  });

  const { ctx, width, height } = resizeLandscapePieCanvas(canvas);
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, 'rgba(7,16,25,0.94)');
  background.addColorStop(1, 'rgba(12,26,46,0.92)');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  if (!segments.length || total <= 0) {
    ctx.fillStyle = '#d8e8ff';
    ctx.font = '600 15px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(options.emptyText || 'No live data available yet.', width / 2, height / 2);
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(Math.min(width, height) * 0.28, 72);
  const innerRadius = radius * 0.56;
  let startAngle = -Math.PI / 2;

  segments.forEach((segment) => {
    const sweep = (segment.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sweep);
    ctx.closePath();
    ctx.fillStyle = segment.color;
    ctx.shadowColor = `${segment.color}55`;
    ctx.shadowBlur = 22;
    ctx.fill();
    startAngle += sweep;
  });

  ctx.shadowBlur = 0;
  startAngle = -Math.PI / 2;
  ctx.strokeStyle = 'rgba(4,6,15,0.95)';
  ctx.lineWidth = 2;
  segments.forEach((segment) => {
    const sweep = (segment.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sweep);
    ctx.closePath();
    ctx.stroke();
    startAngle += sweep;
  });

  ctx.beginPath();
  ctx.fillStyle = 'rgba(6,14,26,0.96)';
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#9ccdf6';
  ctx.font = '700 11px Rajdhani';
  ctx.textAlign = 'center';
  ctx.fillText(options.centerLabel || 'Total', centerX, centerY - 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = width > 420 ? '800 17px Orbitron' : '700 13px Orbitron';
  ctx.fillText(String(centerFormatter(total)).slice(0, 16), centerX, centerY + 12);
}

function classifyBookingStatus(order = {}) {
  const status = String(order?.status || order?.courier?.status || '').toLowerCase();
  if (status.includes('cancel')) return 'Cancelled';
  if (status.includes('deliver') || status.includes('complete')) return 'Delivered';
  if (status.includes('dispatch') || status.includes('ship') || status.includes('transit') || status.includes('out for')) return 'In Dispatch';
  return 'Pending';
}

function classifySettlementStatus(order = {}) {
  const status = String(order?.status || order?.courier?.status || '').toLowerCase();
  if (status.includes('cancel')) return 'Cancelled';
  if (status.includes('deliver') || status.includes('complete')) return 'Ready to Settle';
  if (status.includes('dispatch') || status.includes('ship') || status.includes('transit') || status.includes('out for')) return 'In Transit';
  return 'Pending Verification';
}

function renderBookingsPieChart(ordersInput) {
  const orders = Array.isArray(ordersInput) ? ordersInput : getLocalOrders();
  const bucketMap = new Map([
    ['Pending', 0],
    ['In Dispatch', 0],
    ['Delivered', 0],
    ['Cancelled', 0]
  ]);
  orders.forEach((order) => {
    const bucket = classifyBookingStatus(order);
    bucketMap.set(bucket, (bucketMap.get(bucket) || 0) + 1);
  });
  drawLandscapePieChart('bookings-pie-chart', Array.from(bucketMap, ([label, value]) => ({ label, value })), {
    legendId: 'bookings-pie-legend',
    totalId: 'bookings-pie-total',
    totalFormatter: (value) => `${value} orders`,
    valueFormatter: (value) => `${value} orders`,
    centerLabel: 'Bookings',
    centerFormatter: (value) => `${value}`,
    emptyText: 'No bookings available yet.'
  });
}

function renderRevenuePieChart(ordersInput) {
  const orders = Array.isArray(ordersInput) ? ordersInput : getLocalOrders();
  const paymentMap = new Map();
  orders.forEach((order) => {
    const payment = normalizeAdminPaymentMode(order?.payment);
    const amount = Math.max(Number(order?.amount || order?.total || 0) || 0, 0);
    paymentMap.set(payment, (paymentMap.get(payment) || 0) + amount);
  });
  if (portfolioTransferTotal > 0) {
    paymentMap.set('Market Transfer', (paymentMap.get('Market Transfer') || 0) + portfolioTransferTotal);
  }
  drawLandscapePieChart('revenue-pie-chart', Array.from(paymentMap, ([label, value]) => ({ label, value })), {
    legendId: 'revenue-pie-legend',
    totalId: 'revenue-pie-total',
    totalFormatter: (value) => formatRupees(value),
    valueFormatter: (value) => formatRupees(value),
    centerLabel: 'Revenue',
    centerFormatter: (value) => formatCompactRupees(value),
    emptyText: 'No revenue split available yet.'
  });
}

function renderCustomerTypePieChart(usersInput) {
  const users = Array.isArray(usersInput) && usersInput.length
    ? usersInput
    : customerPieSource;
  customerPieSource = Array.isArray(users) ? users : [];
  const typeMap = new Map();
  customerPieSource.forEach((user) => {
    const type = formatCategoryLabel(user?.business?.type || 'Other');
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  });
  drawLandscapePieChart('customers-pie-chart', Array.from(typeMap, ([label, value]) => ({ label, value })), {
    legendId: 'customers-pie-legend',
    totalId: 'customers-pie-total',
    totalFormatter: (value) => `${value} accounts`,
    valueFormatter: (value) => `${value} accounts`,
    centerLabel: 'Customers',
    centerFormatter: (value) => `${value}`,
    emptyText: 'No customer registrations yet.'
  });
}

function renderOrdersPaymentPieChart(ordersInput) {
  const orders = Array.isArray(ordersInput) ? ordersInput : getLocalOrders();
  const paymentMap = new Map();
  orders.forEach((order) => {
    const payment = normalizeAdminPaymentMode(order?.payment);
    paymentMap.set(payment, (paymentMap.get(payment) || 0) + 1);
  });
  drawLandscapePieChart('orders-pie-chart', Array.from(paymentMap, ([label, value]) => ({ label, value })), {
    legendId: 'orders-pie-legend',
    totalId: 'orders-pie-total',
    totalFormatter: (value) => `${value} orders`,
    valueFormatter: (value) => `${value} orders`,
    centerLabel: 'Orders',
    centerFormatter: (value) => `${value}`,
    emptyText: 'No order payment data yet.'
  });
}

function renderInventoryPieChart(itemsInput) {
  const items = Array.isArray(itemsInput) ? itemsInput : getLocalInventory();
  const normalized = items.map((item) => ({
    ...item,
    status: inventoryStatus(item)
  }));
  const statusMap = new Map([
    ['In Stock', 0],
    ['Low Stock', 0],
    ['Out of Stock', 0]
  ]);
  normalized.forEach((item) => {
    statusMap.set(item.status, (statusMap.get(item.status) || 0) + 1);
  });
  drawLandscapePieChart('inventory-pie-chart', Array.from(statusMap, ([label, value]) => ({ label, value })), {
    legendId: 'inventory-pie-legend',
    totalId: 'inventory-pie-total',
    totalFormatter: (value) => `${value} items`,
    valueFormatter: (value) => `${value} items`,
    centerLabel: 'Inventory',
    centerFormatter: (value) => `${value}`,
    emptyText: 'No inventory items yet.'
  });
}

function renderAnalyticsProductPieChart(productsInput) {
  const products = Array.isArray(productsInput) ? productsInput : aggregateTopProducts(getLocalOrders());
  drawLandscapePieChart('analytics-product-chart', products.map((item) => ({
    label: item.name,
    value: Number(item.revenue || 0) || 0
  })), {
    legendId: 'analytics-product-legend',
    totalId: 'analytics-product-total',
    totalFormatter: (value) => formatRupees(value),
    valueFormatter: (value) => formatRupees(value),
    centerLabel: 'Products',
    centerFormatter: (value) => formatCompactRupees(value),
    maxSegments: 5,
    emptyText: 'No product mix available yet.'
  });
}

function renderComplaintCategoryPieChart(complaintsInput) {
  const complaints = Array.isArray(complaintsInput) ? complaintsInput : getLocalComplaints();
  const categoryMap = new Map();
  complaints.forEach((item) => {
    const category = formatCategoryLabel(item?.category || 'Other');
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  });
  drawLandscapePieChart('complaint-pie-chart', Array.from(categoryMap, ([label, value]) => ({ label, value })), {
    legendId: 'complaint-pie-legend',
    totalId: 'complaint-pie-total',
    totalFormatter: (value) => `${value} complaints`,
    valueFormatter: (value) => `${value} complaints`,
    centerLabel: 'Complaints',
    centerFormatter: (value) => `${value}`,
    emptyText: 'No complaint data available yet.'
  });
}

function renderBankSettlementPieChart(ordersInput) {
  const orders = Array.isArray(ordersInput) ? ordersInput : getLocalOrders();
  const settlementMap = new Map();
  orders.forEach((order) => {
    const bucket = classifySettlementStatus(order);
    const amount = Math.max(Number(order?.amount || order?.total || 0) || 0, 0);
    settlementMap.set(bucket, (settlementMap.get(bucket) || 0) + amount);
  });
  drawLandscapePieChart('bank-pie-chart', Array.from(settlementMap, ([label, value]) => ({ label, value })), {
    legendId: 'bank-pie-legend',
    totalId: 'bank-pie-total',
    totalFormatter: (value) => formatRupees(value),
    valueFormatter: (value) => formatRupees(value),
    centerLabel: 'Settlement',
    centerFormatter: (value) => formatCompactRupees(value),
    emptyText: 'No settlement readiness data yet.'
  });
}

async function saveAdminControls() {
  const currentUser = getSafeCurrentUser();
  if (!currentUser?.userid) {
    showToast('Please log in to save business settings.', 'error');
    return;
  }

  const payload = normalizeBusinessSettings({
    bookingCutoff: document.getElementById('admin-booking-cutoff-input')?.value,
    rovertLanguage: document.getElementById('admin-robert-language-setting')?.value
  });

  const statusEl = document.getElementById('admin-settings-status');
  if (statusEl) statusEl.textContent = 'Saving business settings...';

  try {
    const response = await fetch(`/api/businesses/${encodeURIComponent(currentUser.userid)}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.user) {
      throw new Error(data?.error || 'save-failed');
    }

    const updatedUser = updateCurrentUserCache({ ...currentUser, ...data.user, settings: normalizeBusinessSettings(data.user.settings) });
    clearAdminSettingsSyncLocks();
    applyBusinessSettings(updatedUser.settings);
    showToast('Business settings saved successfully.', 'success');
  } catch (error) {
    if (statusEl) statusEl.textContent = 'Could not save settings right now.';
    showToast('Unable to save admin settings right now.', 'error');
  }
}

function isValidCurrentUser(user) {
  return Boolean(user && typeof user === 'object' && user.userid && (user._id || user.id) && (user.business?.name || user.name));
}

function normalizeDashboardOrderItems(itemsInput) {
  return (Array.isArray(itemsInput) ? itemsInput : [])
    .map((item) => ({
      name: String(item?.name || '').trim(),
      qty: Math.max(Number(item?.qty || 0) || 0, 0),
      price: roundPortalAmount(item?.price || 0),
      hsn: String(item?.hsn || '').trim()
    }))
    .filter((item) => item.name && item.qty > 0);
}

function buildOrderItemsLabel(itemsInput) {
  const items = normalizeDashboardOrderItems(itemsInput);
  if (!items.length) return 'No items';
  const preview = items.slice(0, 3).map((item) => `${item.name} x${item.qty}`);
  return `${preview.join(', ')}${items.length > 3 ? ` +${items.length - 3} more` : ''}`;
}

function normalizeDashboardOrder(order) {
  const items = normalizeDashboardOrderItems(order?.items);
  const hasAwb = Boolean(String(order?.courier?.awb || '').trim());
  const rawCourierStatus = String(order?.courier?.status || '').trim();
  const rawStatus = String(order?.status || '').trim();
  const normalizedCourierStatus = /deliver/i.test(rawCourierStatus)
    ? 'Delivered'
    : /out\s*for\s*delivery/i.test(rawCourierStatus)
      ? 'Out for Delivery'
      : /transit/i.test(rawCourierStatus)
        ? 'In Transit'
        : /ship/i.test(rawCourierStatus)
          ? 'Shipped'
          : /dispatch/i.test(rawCourierStatus)
            ? 'Dispatched'
            : /pickup/i.test(rawCourierStatus)
              ? 'Pickup Scheduled'
              : /booked/i.test(rawCourierStatus)
                ? 'Booked'
                : 'Pending Dispatch';
  const normalizedStatus = /cancel/i.test(rawStatus)
    ? 'Cancelled'
    : (/deliver|complete/i.test(rawStatus) || normalizedCourierStatus === 'Delivered')
      ? 'Delivered'
      : (hasAwb && (/(dispatch|ship|transit|out for)/i.test(rawStatus) || ['Dispatched', 'Shipped', 'In Transit', 'Out for Delivery'].includes(normalizedCourierStatus)))
        ? 'Dispatched'
        : (/packed/i.test(rawStatus) ? 'Packed' : 'In Progress');
  const normalized = {
    ...order,
    amount: Number(order?.amount ?? order?.total ?? 0) || 0,
    status: normalizedStatus,
    payment: normalizeAdminPaymentMode(order?.payment),
    date: order?.date || new Date().toISOString(),
    items,
    itemSummary: buildOrderItemsLabel(items)
  };
  normalized.courier = {
    ...(order?.courier || {}),
    status: normalizedCourierStatus
  };
  normalized.dispatchStatus = normalizedStatus === 'Delivered'
    ? 'Delivered'
    : (hasAwb && normalizedStatus === 'Dispatched' ? 'Dispatched' : 'Pending Dispatch');
  normalized.courierColumn = order?.courierColumn || buildOrderCourierLabel(normalized);
  normalized.automatedRemarks = Array.isArray(order?.automatedRemarks) ? order.automatedRemarks : [];
  return normalized;
}

function normalizeDashboardCourier(courier = {}) {
  const baseDate = courier?.lastUpdatedAt || courier?.updatedAt || courier?.date || new Date().toISOString();
  const rawStatus = String(courier?.status || '').trim();
  const normalizedStatus = /deliver/i.test(rawStatus)
    ? 'Delivered'
    : /out\s*for\s*delivery/i.test(rawStatus)
      ? 'Out for Delivery'
      : /transit/i.test(rawStatus)
        ? 'In Transit'
        : /ship/i.test(rawStatus)
          ? 'Shipped'
          : /dispatch/i.test(rawStatus)
            ? 'Dispatched'
            : /pickup/i.test(rawStatus)
              ? 'Pickup Scheduled'
              : /booked/i.test(rawStatus)
                ? 'Booked'
                : 'Pending Dispatch';
  return {
    ...courier,
    orderId: String(courier?.orderId || '').trim(),
    awb: String(courier?.awb || '').trim(),
    provider: String(courier?.provider || 'smartlocal').trim() || 'smartlocal',
    originPincode: String(courier?.originPincode || courier?.origin || '').trim(),
    destinationPincode: String(courier?.destinationPincode || courier?.destination || '').trim(),
    service: String(courier?.service || 'standard').trim() || 'standard',
    status: normalizedStatus,
    cost: roundPortalAmount(courier?.cost || 0),
    date: String(courier?.date || baseDate).trim() || baseDate,
    lastUpdatedAt: String(courier?.lastUpdatedAt || baseDate).trim() || baseDate,
    courierColumn: String(courier?.courierColumn || '').trim(),
    automatedRemarks: Array.isArray(courier?.automatedRemarks) ? courier.automatedRemarks : []
  };
}

function buildCourierRecordFromOrder(order = {}) {
  const normalizedOrder = normalizeDashboardOrder(order);
  const courier = normalizedOrder?.courier || {};
  const dispatchStatus = String(normalizedOrder?.dispatchStatus || '').trim();
  const courierStatus = String(courier?.status || normalizedOrder?.status || '').trim();
  const courierColumn = String(normalizedOrder?.courierColumn || '').trim();
  const isDispatchLive = Boolean(String(courier?.awb || '').trim())
    || /dispatched/i.test(dispatchStatus)
    || /dispatched/i.test(courierStatus)
    || /dispatched/i.test(courierColumn);
  if (!isDispatchLive) return null;
  return normalizeDashboardCourier({
    ...courier,
    orderId: normalizedOrder.orderId,
    businessUserId: normalizedOrder.businessUserId || courier?.businessUserId || '',
    businessName: normalizedOrder.businessName || courier?.businessName || '',
    originPincode: courier?.originPincode || normalizedOrder?.courier?.originPincode || '',
    destinationPincode: courier?.destinationPincode || normalizedOrder?.courier?.destinationPincode || '',
    cost: courier?.cost || 0,
    value: courier?.value || normalizedOrder.amount || 0,
    date: courier?.date || normalizedOrder.date || new Date().toISOString(),
    lastUpdatedAt: courier?.lastUpdatedAt || normalizedOrder.lastUpdatedAt || normalizedOrder.date || new Date().toISOString(),
    courierColumn: normalizedOrder.courierColumn || courier?.courierColumn || '',
    automatedRemarks: Array.isArray(normalizedOrder?.automatedRemarks) ? normalizedOrder.automatedRemarks : []
  });
}

function sortAdminCourierRows(rows = []) {
  return rows.slice().sort((left, right) => {
    const rightTime = new Date(right?.lastUpdatedAt || right?.date || 0).getTime() || 0;
    const leftTime = new Date(left?.lastUpdatedAt || left?.date || 0).getTime() || 0;
    return rightTime - leftTime;
  });
}

function isStoredCourierRow(courier = {}) {
  return Boolean(String(courier?._id || '').trim())
    || Boolean(String(courier?.createdAt || '').trim())
    || Boolean(String(courier?.updatedAt || '').trim())
    || Boolean(String(courier?.lastUpdatedAt || '').trim())
    || Boolean(String(courier?.businessUserId || '').trim());
}

function filterVisibleCourierRows(rows = [], ordersInput = []) {
  const orders = Array.isArray(ordersInput) ? ordersInput.map(normalizeDashboardOrder) : [];
  return (Array.isArray(rows) ? rows : []).filter((courier) => {
    const liveAwb = String(courier?.awb || '').trim();
    if (isStoredCourierRow(courier) && liveAwb) {
      return true;
    }
    const isAutoCourier = courier?.autoDispatch === true || String(courier?.dispatchMode || '').toLowerCase() === 'auto';
    if (!isAutoCourier) return true;
    const linkedOrder = orders.find((order) => {
      const orderAwb = String(order?.courier?.awb || '').trim();
      return (courier?.orderId && order?.orderId === courier.orderId)
        || (courier?.awb && orderAwb && orderAwb === courier.awb);
    });
    if (!linkedOrder) return Boolean(String(courier?.awb || '').trim());
    return Boolean(String(linkedOrder?.courier?.awb || '').trim()) && ['Dispatched', 'Delivered'].includes(String(linkedOrder?.status || ''));
  });
}

function mergeCourierCollections(couriersInput = [], ordersInput = []) {
  const merged = new Map();
  (Array.isArray(couriersInput) ? couriersInput : []).map(normalizeDashboardCourier).forEach((courier, index) => {
    const key = courier.awb || courier.orderId || `courier-${index}`;
    merged.set(key, courier);
  });
  (Array.isArray(ordersInput) ? ordersInput : []).forEach((order, index) => {
    const derivedCourier = buildCourierRecordFromOrder(order);
    if (!derivedCourier) return;
    const key = derivedCourier.awb || derivedCourier.orderId || `derived-${index}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, derivedCourier);
      return;
    }
    const existingRemarks = Array.isArray(existing.automatedRemarks) ? existing.automatedRemarks : [];
    const derivedRemarks = Array.isArray(derivedCourier.automatedRemarks) ? derivedCourier.automatedRemarks : [];
    const mergedRemarks = Array.from(new Set([...existingRemarks, ...derivedRemarks])).filter(Boolean);
    const existingTime = new Date(existing?.lastUpdatedAt || existing?.date || 0).getTime() || 0;
    const derivedTime = new Date(derivedCourier?.lastUpdatedAt || derivedCourier?.date || 0).getTime() || 0;
    const latestBase = existingTime >= derivedTime ? existing : derivedCourier;
    const fallbackBase = existingTime >= derivedTime ? derivedCourier : existing;
    merged.set(key, normalizeDashboardCourier({
      ...fallbackBase,
      ...latestBase,
      automatedRemarks: mergedRemarks
    }));
  });
  return sortAdminCourierRows(filterVisibleCourierRows(Array.from(merged.values()), ordersInput)).slice(0, 200);
}

const dashboardLiveData = {
  orders: [],
  couriers: [],
  complaints: [],
  inventory: []
};

function getLiveCollectionKey(storageKey = '') {
  const map = {
    orders: 'orders',
    courierOrders: 'couriers',
    complaints: 'complaints',
    inventoryItems: 'inventory'
  };
  return map[storageKey] || '';
}

function setLiveCollection(storageKey, items) {
  const key = getLiveCollectionKey(storageKey);
  if (!key) return Array.isArray(items) ? items : [];
  if (key === 'orders') {
    dashboardLiveData.orders = (Array.isArray(items) ? items : []).map(normalizeDashboardOrder);
    return dashboardLiveData.orders;
  }
  if (key === 'couriers') {
    dashboardLiveData.couriers = (Array.isArray(items) ? items : []).map(normalizeDashboardCourier);
    return dashboardLiveData.couriers;
  }
  dashboardLiveData[key] = Array.isArray(items) ? items.slice() : [];
  return dashboardLiveData[key];
}

function percentageDelta(current, previous) {
  const safeCurrent = Number(current) || 0;
  const safePrevious = Number(previous) || 0;
  if (safePrevious <= 0) {
    return safeCurrent > 0 ? 100 : 0;
  }
  return Math.round(((safeCurrent - safePrevious) / safePrevious) * 100);
}

function formatDeltaText(current, previous) {
  const delta = percentageDelta(current, previous);
  return `${delta > 0 ? '+' : ''}${delta}%`;
}

function getMonthWindow(dateValue = new Date(), offset = 0) {
  const base = new Date(dateValue.getFullYear(), dateValue.getMonth() + offset, 1);
  return {
    start: base,
    end: new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999)
  };
}

function orderMetricsForMonth(orders = [], offset = 0) {
  const { start, end } = getMonthWindow(new Date(), offset);
  const monthOrders = (Array.isArray(orders) ? orders : []).filter((order) => {
    const date = order?.date ? new Date(order.date) : null;
    return date && !Number.isNaN(date.getTime()) && date >= start && date <= end;
  });
  const revenue = monthOrders.reduce((sum, order) => sum + (Number(order?.amount || order?.total || 0) || 0), 0);
  return {
    orders: monthOrders,
    count: monthOrders.length,
    revenue,
    averageOrderValue: monthOrders.length ? Math.round(revenue / monthOrders.length) : 0
  };
}

function registrationMetricsForMonth(registrations = [], offset = 0) {
  const { start, end } = getMonthWindow(new Date(), offset);
  return (Array.isArray(registrations) ? registrations : []).filter((item) => {
    const date = new Date(item?.createdAt || item?.registrationDate || 0);
    return !Number.isNaN(date.getTime()) && date >= start && date <= end;
  }).length;
}

function countReturningCustomers(orders = []) {
  const counts = new Map();
  (Array.isArray(orders) ? orders : []).forEach((order) => {
    const phone = String(order?.customer?.phone || '').trim();
    if (!phone) return;
    counts.set(phone, (counts.get(phone) || 0) + 1);
  });
  return Array.from(counts.values()).filter((count) => count > 1).length;
}

async function fetchDashboardOrders(limit = 50) {
  const currentUser = getSafeCurrentUser();
  const userQuery = currentUser?.userid ? `&userid=${encodeURIComponent(currentUser.userid)}` : '';

  try {
    const response = await fetch(`/api/orders?limit=${limit}${userQuery}`);
    if (!response.ok) throw new Error('orders');
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items.map(normalizeDashboardOrder) : [];
    return setLiveCollection('orders', items);
  } catch (error) {
    return getLocalOrders();
  }
}

async function fetchDashboardCollection(endpoint, storageKey, limit = 50) {
  const currentUser = getSafeCurrentUser();
  const userQuery = currentUser?.userid ? `&userid=${encodeURIComponent(currentUser.userid)}` : '';

  try {
    const response = await fetch(`${endpoint}?limit=${limit}${userQuery}`);
    if (!response.ok) throw new Error(storageKey);
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    return setLiveCollection(storageKey, items);
  } catch (error) {
    const key = getLiveCollectionKey(storageKey);
    return key ? dashboardLiveData[key] : [];
  }
}

function populateYearStatement(orders) {
  const tbody = document.querySelector('#year-statement-table tbody');
  if (!tbody) return;
  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.date}</td>
      <td>${order.orderId}</td>
      <td>${formatRupees(order.amount)}</td>
      <td class="${order.status.toLowerCase()}">${order.status}</td>
      <td>${order.payment}</td>
    </tr>
  `).join('');
}

function formatStatementRangeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'No entries';
}

function fallbackStatementSummary(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const transferRows = safeRows.filter((row) => String(row?.type || '').toLowerCase() === 'market transfer');
  return {
    count: safeRows.length,
    totalAmount: safeRows.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0),
    transferAmount: transferRows.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0),
    transferCount: transferRows.length,
    latestDate: safeRows[0]?.sortDate || '',
    earliestDate: safeRows[safeRows.length - 1]?.sortDate || ''
  };
}

function buildStatementRowsForAdmin(orders = getLocalOrders(), portfolioItems = portfolioHistoryCache) {
  const builder = window.smartlocalBuildStatementRows;
  const rows = typeof builder === 'function' ? builder(orders, portfolioItems) : [];
  statementExportCache = Array.isArray(rows) ? rows.slice() : [];
  return statementExportCache;
}

function renderStatementsTab(orders = getLocalOrders(), portfolioItems = portfolioHistoryCache) {
  const rows = buildStatementRowsForAdmin(orders, portfolioItems);
  const summary = typeof window.smartlocalStatementSummary === 'function'
    ? window.smartlocalStatementSummary(rows)
    : fallbackStatementSummary(rows);
  const tbody = document.querySelector('#statement-table tbody');
  const countEl = document.getElementById('statement-entry-count');
  const totalEl = document.getElementById('statement-total-amount');
  const transferEl = document.getElementById('statement-transfer-amount');
  const rangeEl = document.getElementById('statement-range');
  const syncStatusEl = document.getElementById('statement-sync-status');
  const syncNoteEl = document.getElementById('statement-sync-note');
  const rangeNoteEl = document.getElementById('statement-range-note');

  if (countEl) countEl.textContent = summary.count;
  if (totalEl) totalEl.textContent = formatRupees(summary.totalAmount || 0);
  if (transferEl) transferEl.textContent = formatRupees(summary.transferAmount || 0);
  if (rangeEl) {
    rangeEl.textContent = summary.count
      ? `${formatStatementRangeDate(summary.earliestDate)} - ${formatStatementRangeDate(summary.latestDate)}`
      : 'No entries';
  }
  if (syncStatusEl) syncStatusEl.textContent = summary.count ? 'Live ready' : 'Waiting for live data';
  if (syncNoteEl) syncNoteEl.textContent = summary.count
    ? `${summary.count} live statement entries found, including ${summary.transferCount || 0} protected market transfer${summary.transferCount === 1 ? '' : 's'}.`
    : 'Orders and protected market transfers will appear here live.';
  if (rangeNoteEl) rangeNoteEl.textContent = summary.count
    ? `Statement total ${formatRupees(summary.totalAmount || 0)} across the current live range.`
    : 'The latest live date range will appear after sync.';

  if (!tbody) return;
  tbody.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td class="statement-date-cell">${escapeHtml(row.dateLabel || '-')}</td>
        <td><span class="statement-entry-tag">${escapeHtml(row.type || '-')}</span></td>
        <td>${escapeHtml(row.reference || '-')}</td>
        <td class="statement-particulars">${escapeHtml(row.particulars || row.party || row.note || '-')}</td>
        <td>${escapeHtml(row.mode || '-')}</td>
        <td class="statement-ledger-amount debit">${formatRupees(row.debit || 0)}</td>
        <td class="statement-ledger-amount credit">${formatRupees(row.credit || 0)}</td>
        <td class="statement-ledger-balance">${formatRupees(row.balance || 0)}</td>
        <td>${escapeHtml(row.status || '-')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="9">No live statement entries found.</td></tr>';
}

async function handleStatementExport(format = 'pdf') {
  if (typeof window.smartlocalDownloadStatement !== 'function') {
    showToast('Statement export is unavailable right now.', 'error');
    return;
  }
  const currentUser = currentBusinessUser();
  if (!currentUser?.userid) {
    showToast('Please log in before downloading the statement.', 'error');
    return;
  }
  try {
    const rows = statementExportCache.length ? statementExportCache.slice() : buildStatementRowsForAdmin(getLocalOrders(), portfolioHistoryCache);
    const result = await window.smartlocalDownloadStatement(format, {
      rows,
      businessName: currentUser.business?.name || currentUser.name || 'SmartLocal Business',
      title: `${currentUser.business?.name || currentUser.name || 'SmartLocal'} Live Bank Statement`
    });
    showToast(result?.message || `Statement ${String(format).toUpperCase()} downloaded.`, 'success');
  } catch (error) {
    showToast(error.message || 'Statement download failed.', 'error');
  }
}

function renderOverviewLiveFeed(orders) {
  const feed = document.getElementById('dashboard-live-feed');
  if (!feed) return;
  const courierOrders = getLocalCouriers();
  const complaints = getLocalComplaints();
  const events = [
    ...orders.slice(-3).reverse().map(order => `Order ${order.orderId} for ${formatRupees(order.amount)} is ${order.status}`),
    ...courierOrders.slice(0, 2).map(order => `AWB ${order.awb} ${order.status}`),
    ...complaints.slice(0, 2).map(item => `Complaint ${item.id || '-'} is ${item.status || 'Open'}`)
  ].filter(Boolean).slice(0, 6);
  feed.innerHTML = events.length ? events.map(event => `<li class="activity-feed-item">${event}</li>`).join('') : '<li class="activity-feed-item">No live events yet.</li>';
}

function renderBookingsTab(orders) {
  const tbody = document.querySelector('#bookings-table tbody');
  const pendingCount = orders.filter(order => !['Delivered', 'Cancelled'].includes(String(order.status || ''))).length;
  const totalCountEl = document.getElementById('booking-total-count');
  const pendingCountEl = document.getElementById('booking-pending-count');
  if (totalCountEl) totalCountEl.textContent = orders.length;
  if (pendingCountEl) pendingCountEl.textContent = pendingCount;
  renderBookingsPieChart(orders);
  if (!tbody) return;
  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.orderId}</td>
      <td>${formatAdminDate(order.date)}</td>
      <td>${formatRupees(order.amount)}</td>
      <td class="${String(order.status || '').toLowerCase().replace(/\s+/g, '-')}">${order.status}</td>
      <td>${order.payment}</td>
    </tr>
  `).join('');
}

async function fetchRegistrations(limit = 100) {
  try {
    const response = await fetch(`/api/businesses?limit=${limit}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function renderCustomersTab(registrationData = null) {
  const tbody = document.querySelector('#customers-table tbody');
  const remote = registrationData || await fetchRegistrations(100);
  const customerCountEl = document.getElementById('customer-count');
  const customerGrowthEl = document.getElementById('customer-growth');
  const returningCustomersEl = document.getElementById('returning-customers');
  if (remote && Array.isArray(remote.items)) {
    customerPieSource = remote.items;
    const count = remote.total || remote.items.length;
    const currentMonthRegistrations = registrationMetricsForMonth(remote.items, 0);
    const previousMonthRegistrations = registrationMetricsForMonth(remote.items, -1);
    if (customerCountEl) customerCountEl.textContent = count;
    if (customerGrowthEl) customerGrowthEl.textContent = formatDeltaText(currentMonthRegistrations, previousMonthRegistrations);
    if (returningCustomersEl) returningCustomersEl.textContent = countReturningCustomers(getLocalOrders());
    renderCustomerTypePieChart(remote.items);
    if (!tbody) return;
    tbody.innerHTML = remote.items.map(user => `
      <tr>
        <td>${user.name || 'N/A'}</td>
        <td>${user.email || '-'}</td>
        <td>${user.business?.name || 'N/A'}</td>
        <td>${user.business?.type || 'N/A'}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No registered customers yet.</td></tr>';
    return;
  }

  customerPieSource = [];
  if (customerCountEl) customerCountEl.textContent = 0;
  if (customerGrowthEl) customerGrowthEl.textContent = '0%';
  if (returningCustomersEl) returningCustomersEl.textContent = 0;
  renderCustomerTypePieChart([]);
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">No live customer registrations found.</td></tr>';
}

function renderCourierSummary() {
  const courierOrders = getLocalCouriers();
  const count = courierOrders.length;
  const active = courierOrders.filter(order => order.status !== 'Delivered').length;
  const label = document.getElementById('courier-active-count');
  const livePickups = document.getElementById('live-pickups');
  if (label) label.textContent = count || 0;
  if (livePickups) livePickups.textContent = active || 0;
}

function renderRevenueSummary(totalRevenue, orders = getLocalOrders(), marketTransfer = portfolioTransferTotal) {
  const revenueTotal = document.getElementById('revenue-total');
  const revenueMom = document.getElementById('revenue-mom');
  const transferEl = document.getElementById('market-transfer-total');
  const transferStatus = document.getElementById('market-protection-status');
  const transferNote = document.getElementById('market-transfer-note');
  const currentMonth = orderMetricsForMonth(orders, 0);
  const previousMonth = orderMetricsForMonth(orders, -1);
  if (revenueTotal) revenueTotal.textContent = formatRupees(totalRevenue);
  if (revenueMom) revenueMom.textContent = formatDeltaText(currentMonth.revenue, previousMonth.revenue);
  if (transferEl) transferEl.textContent = formatRupees(marketTransfer);
  if (transferStatus) transferStatus.textContent = marketTransfer > 0 ? 'Protected transfer live' : 'No transfer';
  if (transferNote) transferNote.textContent = marketTransfer > 0
    ? `${formatRupees(marketTransfer)} has been moved from market protection into revenue.`
    : 'Protected portfolio exits will move here automatically.';
}

async function getOverviewCustomerCount(registrationData = null) {
  const remote = registrationData || await fetchRegistrations(100);
  if (remote && Array.isArray(remote.items)) {
    return remote.total || remote.items.length || 0;
  }
  return customerPieSource.length;
}

async function syncOverviewPortal(orders, totalRevenue, totalOrders, yearOrders, averageOrder, currentUser, planLabel, registrationData = null) {
  const courierOrders = getLocalCouriers();
  const complaints = getLocalComplaints();
  const customers = await getOverviewCustomerCount(registrationData);
  const portfolioItems = await fetchPortfolioInvestments(100);
  const latestPortfolio = Array.isArray(portfolioItems) && portfolioItems.length ? portfolioItems[0] : null;
  const marketTransferRevenue = getPortfolioRevenueTransferTotal(portfolioItems);
  const latestAwb = courierOrders[0]?.awb || 'N/A';
  const marketReturn = Number(latestPortfolio?.returnPercent || 0);
  const businessName = currentUser.business?.name || currentUser.name || 'your business';

  const summaryRevenue = document.getElementById('summary-revenue');
  const summaryAverage = document.getElementById('summary-average-order');
  const summaryCouriers = document.getElementById('summary-couriers');
  const summaryComplaints = document.getElementById('summary-complaints');
  const summaryMarketReturn = document.getElementById('summary-market-return');
  const summaryLatestAwb = document.getElementById('summary-latest-awb');
  const overviewCopy = document.getElementById('overview-copy');
  const dashboardMeta = document.getElementById('dashboard-meta');
  const commandCenterMeta = document.getElementById('command-center-meta');

  if (summaryRevenue) summaryRevenue.textContent = formatRupees(totalRevenue);
  if (summaryAverage) summaryAverage.textContent = formatRupees(averageOrder);
  if (summaryCouriers) summaryCouriers.textContent = courierOrders.length;
  if (summaryComplaints) summaryComplaints.textContent = complaints.length;
  if (summaryMarketReturn) {
    summaryMarketReturn.textContent = `${marketReturn.toFixed(1)}%`;
    summaryMarketReturn.style.color = marketReturn < 0 ? '#ff6a7f' : '#ffd86b';
  }
  if (summaryLatestAwb) summaryLatestAwb.textContent = latestAwb;

  if (overviewCopy) {
    overviewCopy.textContent = `${businessName} overview is synchronized with ${totalOrders} orders, ${courierOrders.length} courier bookings, ${complaints.length} complaints, ${customers} customers, a ${marketReturn.toFixed(1)}% market return snapshot, and ${formatRupees(marketTransferRevenue)} transferred from protected market exits.`;
  }

  if (dashboardMeta) {
    dashboardMeta.textContent = `Plan: ${planLabel} | Customers: ${customers} | Latest AWB: ${latestAwb} | Updated: ${formatStableAdminTime(new Date())}`;
  }

  if (commandCenterMeta) {
    commandCenterMeta.textContent = `Last updated: ${formatStableAdminTime(new Date())} | Revenue ${formatRupees(totalRevenue)} | Yearly sales ${yearOrders}`;
  }

  renderOverviewLiveFeed(orders);
}

async function updateLiveRevenueRates(totalRevenue) {
  const usd = document.getElementById('live-usd');
  const gbp = document.getElementById('live-gbp');
  const eur = document.getElementById('live-eur');
  if (!usd && !gbp && !eur) return;
  const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
  try {
    const response = await fetch('https://api.exchangerate.host/latest?base=INR&symbols=USD,GBP,EUR');
    const data = await response.json();
    const rates = data.rates;
    if (usd) usd.textContent = (totalRevenue * rates.USD).toFixed(2);
    if (gbp) gbp.textContent = (totalRevenue * rates.GBP).toFixed(2);
    if (eur) eur.textContent = (totalRevenue * rates.EUR).toFixed(2);
    const planInfo = getRegisteredPlanPresentation(currentUser);
    const dashboardMeta = document.getElementById('dashboard-meta');
    if (dashboardMeta && !dashboardMeta.textContent.includes(`Plan: ${planInfo.label}`)) {
      dashboardMeta.textContent = `Plan: ${planInfo.label} | Updated: ${formatStableAdminTime(new Date())}`;
    }
  } catch (err) {
    console.error('Currency update failed', err);
    if (usd) usd.textContent = 'N/A';
    if (gbp) gbp.textContent = 'N/A';
    if (eur) eur.textContent = 'N/A';
  }
}

async function refreshCurrencyRates() {
  const revenue = parseFloat((document.getElementById('summary-revenue').textContent || '').replace(/[^0-9.-]/g, '')) || 0;
  await updateLiveRevenueRates(revenue);
  showToast('Currency rates refreshed.', 'success');
}

function formatMarketDateTime(dateValue = new Date()) {
  const date = new Date(dateValue);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

let portfolioLiveState = null;
let portfolioLiveTimer = null;
let portfolioClockTimer = null;
let portfolioTickInFlight = false;
let portfolioHistoryCache = [];
let portfolioTransferTotal = 0;
let statementExportCache = [];
let adminLiveSyncTimer = null;
const LIVE_MONGO_SYNC_MS = 1000;

function getPortfolioRevenueTransferTotal(items = portfolioHistoryCache) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Math.max(Number(item?.revenueTransferredAmount || 0) || 0, 0), 0);
}

function syncPortfolioRevenueState(items = []) {
  portfolioHistoryCache = Array.isArray(items) ? items.slice() : [];
  portfolioTransferTotal = getPortfolioRevenueTransferTotal(portfolioHistoryCache);
  return portfolioTransferTotal;
}

function updateMarketClock(dateValue = new Date()) {
  const dateTimeEl = document.getElementById('market-current-datetime');
  if (dateTimeEl) {
    dateTimeEl.textContent = `Current date and time: ${formatMarketDateTime(dateValue)}`;
  }
}

function isPortfolioRecordActive(record = {}) {
  const amountInvested = Math.max(Number(record?.amountInvested) || 0, 0);
  if (amountInvested <= 0) return false;
  if (String(record?.fundStatus || '').toLowerCase() === 'stopped') return false;
  if (record?.autoWithdrawTriggered === true || String(record?.autoWithdrawTriggered || '').toLowerCase() === 'true') return false;
  return true;
}

function getPortfolioBounds(amount) {
  const invested = Math.max(Number(amount) || 0, 0);
  if (invested <= 0) {
    return {
      invested: 0,
      floor: 0,
      ceiling: 0
    };
  }
  return {
    invested,
    floor: Math.round(invested * 0.55),
    ceiling: Math.round(invested * 6)
  };
}

function clampPortfolioValue(value, amount) {
  const { floor, ceiling, invested } = getPortfolioBounds(amount);
  if (invested <= 0) return 0;
  const numericValue = Number(value);
  const baseValue = Number.isFinite(numericValue) ? numericValue : invested;
  return Math.round(Math.min(ceiling, Math.max(floor, baseValue)));
}

function formatSignedRupees(amount) {
  const safeAmount = Number(amount) || 0;
  return `${safeAmount < 0 ? '-' : '+'}${formatRupees(Math.abs(safeAmount))}`;
}

function formatCompactRupees(amount) {
  const safeAmount = Number(amount) || 0;
  if (safeAmount >= 10000000) return `₹${(safeAmount / 10000000).toFixed(1)}Cr`;
  if (safeAmount >= 100000) return `₹${(safeAmount / 100000).toFixed(1)}L`;
  if (safeAmount >= 1000) return `₹${(safeAmount / 1000).toFixed(1)}K`;
  return formatRupees(safeAmount);
}

function generatePortfolioGraphPoints(amount, endValue = null, pointCount = 30) {
  const { invested } = getPortfolioBounds(amount);
  if (invested <= 0) return [];
  const count = Math.max(Number(pointCount) || 0, 2);
  const finalValue = clampPortfolioValue(endValue ?? invested, invested);
  if (count === 2) return [invested, finalValue];
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    return Math.round(invested + ((finalValue - invested) * progress));
  });
}

function normalizePortfolioRecord(record = {}) {
  const invested = Math.max(Number(record.amountInvested) || 0, 0);
  const currentValue = invested > 0 ? clampPortfolioValue(record.currentValue ?? invested, invested) : 0;
  const profitLoss = currentValue - invested;
  const returnPercent = invested > 0 ? Number((((currentValue - invested) / invested) * 100).toFixed(1)) : 0;
  const revenueTransferredAmount = Math.max(Number(record.revenueTransferredAmount || 0) || 0, 0);
  const stopLossValue = Math.max(Number(record.stopLossValue || 0) || 0, 0);
  const takeProfitValue = Math.max(Number(record.takeProfitValue || 0) || 0, 0);
  const autoWithdrawEnabled = String(record.autoWithdrawEnabled).toLowerCase() === 'true' || record.autoWithdrawEnabled === true;
  const autoWithdrawTriggered = String(record.autoWithdrawTriggered).toLowerCase() === 'true' || record.autoWithdrawTriggered === true;
  const protectionReason = String(record.protectionReason || '').trim();
  const lastProtectedValue = Math.max(Number(record.lastProtectedValue || 0) || 0, 0);
  const realizedProfitLoss = Number(record.realizedProfitLoss || 0) || 0;
  const realizedReturnPercent = Number(record.realizedReturnPercent || 0) || 0;
  const fundStatus = String(record.fundStatus || (invested > 0 ? 'Active' : 'Stopped')).trim() || (invested > 0 ? 'Active' : 'Stopped');
  const trend = profitLoss < 0 ? 'loss' : 'profit';
  const points = invested > 0 ? (Array.isArray(record.points) && record.points.length
    ? record.points.slice(-30).map((point) => clampPortfolioValue(point, invested))
    : generatePortfolioGraphPoints(invested, currentValue)) : [];

  if (points.length) {
    points[points.length - 1] = currentValue;
  }

  return {
    investmentId: record.investmentId || `INV-${Date.now().toString().slice(-6)}`,
    portfolioName: record.portfolioName || 'SmartLocal Live Market',
    amountInvested: invested,
    currentValue,
    returnPercent: Math.max(-45, Math.min(500, returnPercent)),
    profitLoss,
    trend,
    points,
    color: trend === 'loss' ? '#ff4d67' : '#00ff9d',
    lastUpdatedAt: new Date(record.lastUpdatedAt || record.updatedAt || record.createdAt || Date.now()).toISOString(),
    businessUserId: record.businessUserId || '',
    businessName: record.businessName || '',
    marketSummary: record.marketSummary || (invested > 0 ? `${trend === 'loss' ? 'Loss' : 'Profit'} wave active` : 'No market position recorded'),
    marketSession: record.marketSession || 'Market watch',
    marketSentiment: record.marketSentiment || (trend === 'loss' ? 'Weak' : 'Positive'),
    momentum: record.momentum || (trend === 'loss' ? 'Bearish' : 'Bullish'),
    riskBand: record.riskBand || (revenueTransferredAmount > 0 ? 'Protected' : (invested > 0 ? 'Medium' : 'Low')),
    actionSignal: record.actionSignal || (revenueTransferredAmount > 0 ? 'Reinvest to restart market' : (invested > 0 ? 'Hold and monitor' : 'No allocation')),
    volatilityScore: Number(record.volatilityScore || 0) || 0,
    stopLossValue,
    takeProfitValue,
    autoWithdrawEnabled,
    transferToRevenue: record.transferToRevenue !== false,
    fundStatus,
    autoWithdrawTriggered,
    revenueTransferredAmount,
    revenueTransferredAt: String(record.revenueTransferredAt || '').trim(),
    protectionReason,
    protectionTriggeredAt: String(record.protectionTriggeredAt || '').trim(),
    lastProtectedValue,
    realizedProfitLoss,
    realizedReturnPercent,
    lastInvestedAmount: Math.max(Number(record.lastInvestedAmount || invested) || 0, 0),
    automatedRemarks: Array.isArray(record.automatedRemarks) && record.automatedRemarks.length
      ? record.automatedRemarks
      : (invested > 0
        ? [
            `Market session: ${record.marketSession || 'Market watch'}.`,
            `Momentum is ${(record.momentum || (trend === 'loss' ? 'Bearish' : 'Bullish')).toLowerCase()} with ${record.riskBand || 'medium'} risk.`,
            `Action signal: ${record.actionSignal || 'Hold and monitor'}.`
          ]
        : (revenueTransferredAmount > 0
          ? [
              `${protectionReason || 'Protected exit'} moved ${formatRupees(revenueTransferredAmount)} into revenue.`,
              `Realized ${realizedProfitLoss >= 0 ? 'profit' : 'loss'} was ${formatSignedRupees(realizedProfitLoss)} with return ${realizedReturnPercent.toFixed(1)}%.`,
              'Market is stopped because no fund is left. Add a new fund to restart.'
            ]
          : ['Add an investment to unlock automated remarks.']))
  };
}

function resizePortfolioCanvas(canvas) {
  const wrapper = canvas?.parentElement;
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const width = Math.max((wrapper?.clientWidth || canvas.clientWidth || 960) - 2, 320);
  const height = window.innerWidth < 640 ? 230 : window.innerWidth < 980 ? 290 : 340;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  const targetWidth = Math.floor(width * dpr);
  const targetHeight = Math.floor(height * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function drawPortfolioGraph(points, trend, investedAmount = 0, currentValue = 0) {
  const canvas = document.getElementById('portfolio-graph');
  if (!canvas || !canvas.getContext || !Array.isArray(points)) return;
  const isEmpty = !(Number(investedAmount) > 0) || !points.length;

  const { ctx, width, height } = resizePortfolioCanvas(canvas);
  const padding = { top: 58, right: 28, bottom: 44, left: 72 };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(7, 12, 28, 0.96)';
  ctx.fillRect(0, 0, width, height);

  if (isEmpty) {
    const protectedExit = portfolioLiveState?.revenueTransferredAmount > 0;
    ctx.strokeStyle = 'rgba(103,227,255,0.08)';
    for (let i = 0; i < 6; i += 1) {
      const y = padding.top + (i * (height - padding.top - padding.bottom)) / 5;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    for (let i = 0; i < 7; i += 1) {
      const x = padding.left + (i * (width - padding.left - padding.right)) / 6;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(226, 240, 255, 0.94)';
    ctx.font = "700 22px Rajdhani";
    ctx.fillText('LIVE MARKET GRAPH', padding.left, padding.top - 18);
    ctx.font = "600 14px Rajdhani";
    ctx.fillStyle = 'rgba(155, 195, 235, 0.9)';
    ctx.fillText(protectedExit ? 'Live market switch is OFF because the protected exit stopped the fund.' : 'Live market switch is OFF. Add an investment to start live MongoDB movement.', padding.left, padding.top - 2);
    ctx.font = "700 20px Rajdhani";
    ctx.fillStyle = protectedExit ? 'rgba(255,216,107,0.96)' : 'rgba(103,227,255,0.92)';
    ctx.fillText(protectedExit ? (portfolioLiveState?.protectionReason || 'Protected Exit') : 'Market is currently OFF', padding.left, (height / 2) - 8);
    ctx.font = "600 14px Rajdhani";
    ctx.fillStyle = 'rgba(186, 208, 232, 0.88)';
    ctx.fillText(protectedExit ? `Transferred ${formatRupees(portfolioLiveState?.revenueTransferredAmount || 0)} to Revenue. Add a new fund to turn market ON again.` : 'Current value, profit/loss, and graph movement will begin after the first investment.', padding.left, (height / 2) + 20);
    return;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const color = trend === 'loss' ? '#ff4d67' : '#00ff9d';

  for (let i = 0; i < 5; i += 1) {
    const y = padding.top + (i * (height - padding.top - padding.bottom)) / 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const labelValue = max - ((max - min) * i) / 4;
    ctx.fillStyle = 'rgba(150, 185, 225, 0.78)';
    ctx.font = "600 12px Rajdhani";
    ctx.fillText(formatCompactRupees(labelValue), 12, y + 4);
  }

  for (let i = 0; i < 7; i += 1) {
    const x = padding.left + (i * (width - padding.left - padding.right)) / 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(226, 240, 255, 0.94)';
  ctx.font = "700 22px Rajdhani";
  ctx.fillText('LIVE MARKET GRAPH', padding.left, padding.top - 18);
  ctx.font = "600 14px Rajdhani";
  ctx.fillStyle = 'rgba(155, 195, 235, 0.9)';
  const graphMeta = width < 520
    ? `${trend === 'loss' ? 'Loss' : 'Profit'} | Cur ${formatCompactRupees(currentValue)}`
    : `${trend === 'loss' ? 'Loss wave active' : 'Profit wave active'} | Invested ${formatCompactRupees(investedAmount)} | Current ${formatCompactRupees(currentValue)}`;
  ctx.fillText(graphMeta, padding.left, padding.top - 2);

  const toX = (index) => padding.left + (index * (width - padding.left - padding.right)) / Math.max(points.length - 1, 1);
  const toY = (value) => {
    const ratio = (value - min) / Math.max(max - min, 1);
    return height - padding.bottom - ratio * (height - padding.top - padding.bottom);
  };

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(points[0]));
  points.forEach((value, index) => {
    ctx.lineTo(toX(index), toY(value));
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const lastX = toX(points.length - 1);
  const lastY = toY(points[points.length - 1]);

  ctx.lineTo(lastX, height - padding.bottom);
  ctx.lineTo(toX(0), height - padding.bottom);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  if (trend === 'loss') {
    gradient.addColorStop(0, 'rgba(255,77,103,0.32)');
    gradient.addColorStop(1, 'rgba(255,77,103,0.03)');
  } else {
    gradient.addColorStop(0, 'rgba(0,255,157,0.3)');
    gradient.addColorStop(1, 'rgba(0,255,157,0.03)');
  }
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(166, 202, 240, 0.82)';
  ctx.font = "600 12px Rajdhani";
  ctx.fillText('Last 30 market movements', padding.left, height - 16);
}

async function fetchPortfolioInvestments(limit = 20) {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!currentUser?.userid) return [];
    const userQuery = `&userid=${encodeURIComponent(currentUser.userid)}`;
    const response = await fetch(`/api/portfolio?limit=${limit}${userQuery}`);
    if (!response.ok) return [];
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    syncPortfolioRevenueState(items);
    return items;
  } catch (error) {
    return [];
  }
}

async function savePortfolioInvestment(record) {
  const response = await fetch('/api/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to save investment.');
  }
  return data.record || record;
}

async function fetchLatestPortfolioInvestment() {
  const items = await fetchPortfolioInvestments(12);
  if (!Array.isArray(items) || !items.length) return null;
  return items.find((item) => isPortfolioRecordActive(item)) || items[0] || null;
}

function buildEmptyPortfolioState() {
  return normalizePortfolioRecord({
    portfolioName: 'SmartLocal Live Market',
    amountInvested: 0,
    currentValue: 0,
    trend: 'profit',
    stopLossValue: 0,
    takeProfitValue: 0,
    autoWithdrawEnabled: false,
    transferToRevenue: true,
    fundStatus: 'Stopped',
    revenueTransferredAmount: 0,
    lastUpdatedAt: new Date().toISOString(),
    points: []
  });
}

const PORTFOLIO_SYNC_LOCK_IDS = ['portfolio-stop-loss', 'portfolio-take-profit', 'portfolio-auto-protect'];

function markPortfolioSyncLock(input) {
  if (input) input.dataset.syncLock = 'true';
}

function clearPortfolioSyncLocks() {
  PORTFOLIO_SYNC_LOCK_IDS.forEach((id) => {
    const input = document.getElementById(id);
    if (input) delete input.dataset.syncLock;
  });
}

function isPortfolioInputLocked(input) {
  return Boolean(input && (input.dataset.syncLock === 'true' || input === document.activeElement));
}

function formatPortfolioInputAmount(value) {
  const amount = roundPortalAmount(value || 0);
  if (!(amount > 0)) return '';
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function setPortfolioInputValue(input, value) {
  if (!input || isPortfolioInputLocked(input)) return;
  input.value = value;
}

function initPortfolioInputLocks() {
  PORTFOLIO_SYNC_LOCK_IDS.forEach((id) => {
    const input = document.getElementById(id);
    if (!input || input.dataset.lockReady === 'true') return;
    input.dataset.lockReady = 'true';
    input.addEventListener('focus', () => markPortfolioSyncLock(input));
    input.addEventListener('input', () => markPortfolioSyncLock(input));
    input.addEventListener('change', () => markPortfolioSyncLock(input));
  });
}

async function syncLatestPortfolioFromMongo() {
  const latestRecord = await fetchLatestPortfolioInvestment();
  if (!latestRecord) {
    updatePortfolioSummary(buildEmptyPortfolioState());
    return null;
  }
  const normalized = normalizePortfolioRecord(latestRecord);
  updatePortfolioSummary(normalized);
  return normalized;
}

function updatePortfolioSummary(record) {
  const normalizedRecord = normalizePortfolioRecord(record);
  portfolioLiveState = normalizedRecord;
  const isEmpty = !(normalizedRecord.amountInvested > 0);
  const isProtectedStop = isEmpty && normalizedRecord.revenueTransferredAmount > 0;

  const investedEl = document.getElementById('portfolio-invested');
  const currentEl = document.getElementById('portfolio-current');
  const returnEl = document.getElementById('portfolio-return');
  const profitLossEl = document.getElementById('portfolio-profit-loss');
  const noteEl = document.getElementById('portfolio-note');
  const investedLiveEl = document.getElementById('market-investment-live');
  const currentLiveEl = document.getElementById('market-current-live');
  const asOfLiveEl = document.getElementById('market-asof-live');
  const profitLossLiveEl = document.getElementById('market-profit-loss-live');
  const statusPill = document.getElementById('market-status-pill');
  const liveBadge = document.getElementById('market-live-badge');
  const marketSwitch = document.getElementById('market-live-switch');
  const marketSwitchText = document.getElementById('market-live-switch-text');
  const marketEngineNote = document.getElementById('market-live-engine-note');
  const boardTitleEl = document.getElementById('portfolio-chart-title');
  const boardCurrentEl = document.getElementById('market-current-board');
  const boardChangeEl = document.getElementById('market-board-change');
  const marketModeEl = document.getElementById('market-mode-live');
  const stopLossInput = document.getElementById('portfolio-stop-loss');
  const takeProfitInput = document.getElementById('portfolio-take-profit');
  const autoProtectInput = document.getElementById('portfolio-auto-protect');
  const withdrawInput = document.getElementById('portfolio-withdraw-amount');
  const lastProtectionInput = document.getElementById('portfolio-last-protection');
  const fundStatusInput = document.getElementById('portfolio-fund-status-readonly');
  const lastUpdatedText = formatMarketDateTime(normalizedRecord.lastUpdatedAt || new Date());
  const trendClass = isProtectedStop ? 'gold' : (isEmpty ? 'blue' : (normalizedRecord.trend === 'loss' ? 'red' : 'green'));
  const liveColor = isProtectedStop ? '#ffd86b' : (isEmpty ? '#9fdcff' : (normalizedRecord.trend === 'loss' ? '#ffb0bb' : '#86ffd0'));
  const isMarketActive = !isProtectedStop && !isEmpty && String(normalizedRecord.fundStatus || '').toLowerCase() !== 'stopped';

  if (investedEl) investedEl.textContent = formatRupees(normalizedRecord.amountInvested || 0);
  if (investedLiveEl) investedLiveEl.textContent = formatRupees(normalizedRecord.amountInvested || 0);
  if (currentEl) {
    currentEl.textContent = formatRupees(normalizedRecord.currentValue || 0);
    currentEl.className = `metric-val ${trendClass}`;
  }
  if (currentLiveEl) currentLiveEl.textContent = formatRupees(normalizedRecord.currentValue || 0);
  if (returnEl) {
    returnEl.textContent = `${Number(normalizedRecord.returnPercent || 0).toFixed(1)}%`;
    returnEl.className = `metric-val ${trendClass}`;
  }
  if (profitLossEl) {
    profitLossEl.textContent = formatSignedRupees(normalizedRecord.profitLoss || 0);
    profitLossEl.className = `metric-val ${trendClass}`;
  }
  if (profitLossLiveEl) {
    profitLossLiveEl.textContent = formatSignedRupees(normalizedRecord.profitLoss || 0);
    profitLossLiveEl.style.color = liveColor;
    profitLossLiveEl.style.textShadow = normalizedRecord.trend === 'loss'
      ? '0 0 16px rgba(255,77,103,0.2)'
      : '0 0 16px rgba(0,255,157,0.2)';
  }
  if (boardTitleEl) boardTitleEl.textContent = normalizedRecord.portfolioName || 'SmartLocal Live Market';
  if (boardCurrentEl) boardCurrentEl.textContent = formatRupees(normalizedRecord.currentValue || 0);
  if (boardChangeEl) {
    boardChangeEl.textContent = isProtectedStop
      ? `${normalizedRecord.protectionReason || 'Protected Exit'} | ${formatRupees(normalizedRecord.revenueTransferredAmount || 0)}`
      : `${formatSignedRupees(normalizedRecord.profitLoss || 0)} | ${Number(normalizedRecord.returnPercent || 0).toFixed(1)}%`;
    boardChangeEl.style.color = liveColor;
  }
  if (marketModeEl) {
    marketModeEl.textContent = isProtectedStop ? 'Market Stopped / Revenue Protected' : (isEmpty ? 'Market Off' : (normalizedRecord.trend === 'loss' ? 'Red Wave' : 'Green Wave'));
    marketModeEl.style.color = liveColor;
  }
  if (asOfLiveEl) asOfLiveEl.textContent = lastUpdatedText;
  if (statusPill) {
    statusPill.textContent = isProtectedStop ? 'PROTECTED EXIT' : (isEmpty ? 'MARKET OFF' : (normalizedRecord.trend === 'loss' ? 'LIVE LOSS' : 'LIVE PROFIT'));
    statusPill.className = `market-status-pill ${isProtectedStop ? 'profit' : (isEmpty ? 'flat' : (normalizedRecord.trend === 'loss' ? 'loss' : 'profit'))}`;
  }
  if (liveBadge) {
    liveBadge.textContent = isProtectedStop ? 'Protected / Revenue' : (isEmpty ? 'Market Off' : (normalizedRecord.trend === 'loss' ? 'Loss / Live' : 'Profit / Live'));
    liveBadge.className = `badge-sm ${isProtectedStop ? 'profit-badge' : (isEmpty ? '' : (normalizedRecord.trend === 'loss' ? 'loss-badge' : 'profit-badge'))}`;
  }
  if (marketSwitch) {
    marketSwitch.className = `market-live-switch ${isProtectedStop ? 'stopped' : (isMarketActive ? 'on' : 'off')}`;
  }
  if (marketSwitchText) {
    marketSwitchText.textContent = isProtectedStop ? 'STOPPED' : (isMarketActive ? 'ON' : 'OFF');
  }
  if (marketEngineNote) {
    marketEngineNote.textContent = isProtectedStop
      ? `${normalizedRecord.protectionReason || 'Protected exit'} stopped the live market because no fund is left.`
      : isMarketActive
        ? 'Market engine is ON and syncing the MongoDB portfolio every 1 second.'
        : 'Market engine is OFF because no active fund is stored in MongoDB.';
  }
  if (noteEl) {
    const movement = isProtectedStop
      ? `${normalizedRecord.protectionReason || 'Protected exit'} auto withdrew ${formatRupees(normalizedRecord.revenueTransferredAmount || 0)} and transferred it to the Revenue tab.`
      : isEmpty
      ? 'No active fund is stored yet, so the market switch stays OFF until the first investment.'
      : normalizedRecord.trend === 'loss'
        ? 'Market is currently showing a red loss phase.'
        : 'Market is currently showing a green profit phase.';
    noteEl.textContent = `${normalizedRecord.portfolioName || 'Portfolio'} updated on ${lastUpdatedText}. ${movement} Invested value, current value, profit/loss, and the graph are now read from the latest MongoDB portfolio record.`;
  }
  if (stopLossInput) {
    setPortfolioInputValue(stopLossInput, formatPortfolioInputAmount(normalizedRecord.stopLossValue));
    stopLossInput.max = normalizedRecord.amountInvested > 0 ? formatPortfolioInputAmount(normalizedRecord.amountInvested) : '';
  }
  if (takeProfitInput) {
    setPortfolioInputValue(takeProfitInput, formatPortfolioInputAmount(normalizedRecord.takeProfitValue));
  }
  if (autoProtectInput && !isPortfolioInputLocked(autoProtectInput)) autoProtectInput.value = normalizedRecord.autoWithdrawEnabled ? 'on' : 'off';
  if (withdrawInput) {
    withdrawInput.max = normalizedRecord.currentValue > 0 ? formatPortfolioInputAmount(normalizedRecord.currentValue) : '';
    withdrawInput.placeholder = normalizedRecord.currentValue > 0
      ? `Maximum ${formatRupees(normalizedRecord.currentValue)}`
      : 'Withdraw part of the live current value';
  }
  if (lastProtectionInput) {
    lastProtectionInput.value = normalizedRecord.revenueTransferredAmount > 0
      ? `${normalizedRecord.protectionReason || 'Protected Exit'} | ${formatRupees(normalizedRecord.revenueTransferredAmount)}`
      : 'No protection event yet';
  }
  if (fundStatusInput) {
    fundStatusInput.value = isProtectedStop
      ? 'Stopped after full withdrawal'
      : isMarketActive
        ? `Active | Current ${formatRupees(normalizedRecord.currentValue || 0)}`
        : 'Market Off';
  }
  updateMarketClock();
  drawPortfolioGraph(
    normalizedRecord.points || [],
    normalizedRecord.trend || 'profit',
    normalizedRecord.amountInvested || 0,
    normalizedRecord.currentValue || 0
  );
  renderPortfolioRemarks(normalizedRecord);
  syncPortfolioRevenueLink(normalizedRecord);
}

function syncPortfolioRevenueLink(record) {
  const linkedRecord = normalizePortfolioRecord(record || portfolioLiveState || {});
  const summaryMarketReturn = document.getElementById('summary-market-return');
  const revenueTrendSummary = document.getElementById('revenue-trend-summary');
  const overviewCopy = document.getElementById('overview-copy');

  if (summaryMarketReturn) {
    summaryMarketReturn.textContent = `${linkedRecord.returnPercent.toFixed(1)}%`;
    summaryMarketReturn.style.color = linkedRecord.trend === 'loss' ? '#ff6a7f' : '#7bffce';
  }

  if (revenueTrendSummary) {
    if (linkedRecord.revenueTransferredAmount > 0) {
      revenueTrendSummary.textContent = linkedRecord.amountInvested > 0
        ? `Transfer ${formatRupees(linkedRecord.revenueTransferredAmount)} | Live`
        : `Transfer ${formatRupees(linkedRecord.revenueTransferredAmount)}`;
      revenueTrendSummary.className = 'badge-sm profit-badge';
    } else if (linkedRecord.profitLoss > 0) {
      revenueTrendSummary.textContent = `Market +${formatRupees(linkedRecord.profitLoss)}`;
      revenueTrendSummary.className = 'badge-sm profit-badge';
    } else if (linkedRecord.profitLoss < 0) {
      revenueTrendSummary.textContent = `Market ${formatSignedRupees(linkedRecord.profitLoss)}`;
      revenueTrendSummary.className = 'badge-sm loss-badge';
    } else {
      revenueTrendSummary.textContent = 'Market flat';
      revenueTrendSummary.className = 'badge-sm';
    }
  }

  if (overviewCopy && linkedRecord.revenueTransferredAmount > 0) {
    overviewCopy.textContent = linkedRecord.amountInvested > 0
      ? `${linkedRecord.portfolioName || 'Market portfolio'} has already transferred ${formatRupees(linkedRecord.revenueTransferredAmount)} into Revenue while ${formatRupees(linkedRecord.currentValue || 0)} remains live in market.`
      : `${linkedRecord.portfolioName || 'Market portfolio'} hit ${linkedRecord.protectionReason || 'portfolio protection'} and transferred ${formatRupees(linkedRecord.revenueTransferredAmount)} into the Revenue tab.`;
  } else if (overviewCopy && linkedRecord.profitLoss > 0) {
    overviewCopy.textContent = `${linkedRecord.portfolioName || 'Market portfolio'} is in profit and the live portfolio gain of ${formatRupees(linkedRecord.profitLoss)} is now linked into the revenue overview.`;
  }
}

function renderPortfolioRemarks(record) {
  const normalizedRecord = normalizePortfolioRecord(record);
  const headline = document.getElementById('market-analysis-headline');
  const signal = document.getElementById('market-analysis-signal');
  const risk = document.getElementById('market-analysis-risk');
  const remarks = document.getElementById('market-remarks-list');

  if (headline) headline.textContent = normalizedRecord.marketSummary || 'No market position recorded yet.';
  if (signal) {
    signal.textContent = normalizedRecord.actionSignal || 'No allocation';
    signal.className = `metric-val ${normalizedRecord.revenueTransferredAmount > 0 && normalizedRecord.amountInvested <= 0 ? 'gold' : (normalizedRecord.trend === 'loss' ? 'red' : 'gold')}`;
  }
  if (risk) {
    risk.textContent = `${normalizedRecord.riskBand || 'Low'} | ${normalizedRecord.marketSession || 'Market watch'}`;
    risk.className = `metric-val ${normalizedRecord.revenueTransferredAmount > 0 && normalizedRecord.amountInvested <= 0 ? 'gold' : (normalizedRecord.trend === 'loss' ? 'red' : 'blue')}`;
  }
  if (remarks) {
    const lines = (Array.isArray(normalizedRecord.automatedRemarks) ? normalizedRecord.automatedRemarks : [])
      .filter(Boolean)
      .map((line) => `• ${escapeHtml(line)}`)
      .join('<br>');
    remarks.innerHTML = lines || 'Add an investment to unlock live market remarks, momentum review, and Robert-ready commentary.';
  }
}

async function loadPortfolioDashboard() {
  await syncLatestPortfolioFromMongo();
}

async function handlePortfolioSubmit(event) {
  event.preventDefault();
  const amount = roundPortalAmount(document.getElementById('portfolio-investment')?.value || 0);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
  const portfolioName = document.getElementById('portfolio-name')?.value.trim() || `${currentUser?.business?.name || currentUser?.name || 'Business'} Portfolio`;
  const stopLossValue = Math.max(Number(document.getElementById('portfolio-stop-loss')?.value || 0) || 0, 0);
  const takeProfitValue = Math.max(Number(document.getElementById('portfolio-take-profit')?.value || 0) || 0, 0);
  const autoWithdrawEnabled = (document.getElementById('portfolio-auto-protect')?.value || 'off') === 'on';
  if (!amount || amount <= 0) {
    showToast('Enter a valid investment amount in rupees.', 'error');
    return;
  }
  if (autoWithdrawEnabled && stopLossValue <= 0 && takeProfitValue <= 0) {
    showToast('Enter stop loss or take profit before enabling portfolio protection.', 'error');
    return;
  }
  if (stopLossValue > 0 && stopLossValue >= amount) {
    showToast('Stop loss should be lower than the invested amount.', 'error');
    return;
  }
  if (takeProfitValue > 0 && takeProfitValue <= amount) {
    showToast('Take profit should be higher than the invested amount.', 'error');
    return;
  }

  const points = generatePortfolioGraphPoints(amount, amount, 2);
  const currentValue = roundPortalAmount(amount);
  const rawRecord = {
    investmentId: `INV-${Date.now()}`,
    portfolioName,
    amountInvested: amount,
    currentValue,
    points,
    stopLossValue,
    takeProfitValue,
    autoWithdrawEnabled,
    transferToRevenue: true,
    fundStatus: 'Active',
    appendToActive: true,
    lastUpdatedAt: new Date().toISOString(),
    businessUserId: currentUser?.userid || '',
    businessName: currentUser?.business?.name || currentUser?.name || ''
  };
  const record = normalizePortfolioRecord(rawRecord);

  try {
    const savedRecord = await savePortfolioInvestment(record);
    updatePortfolioSummary(savedRecord);
    document.getElementById('portfolio-form')?.reset();
    clearPortfolioSyncLocks();
    await refreshCommandCenterData({ silent: true, source: 'portfolio-submit' });
    showToast('Investment saved to MongoDB and portfolio graph updated.', 'success');
  } catch (error) {
    showToast(error.message || 'Could not save investment.', 'error');
  }
}

function buildPortfolioWithdrawalRecord(currentRecord, requestedAmount = 0, mode = 'full') {
  const normalizedRecord = normalizePortfolioRecord(currentRecord);
  const currentValue = roundPortalAmount(normalizedRecord.currentValue || 0);
  const investedValue = roundPortalAmount(normalizedRecord.amountInvested || 0);
  const cappedRequestedAmount = roundPortalAmount(Math.min(Math.max(Number(requestedAmount || 0) || 0, 0), currentValue));
  const fullWithdraw = mode === 'full' || cappedRequestedAmount >= currentValue;
  const withdrawValue = fullWithdraw ? currentValue : cappedRequestedAmount;
  const nowIso = new Date().toISOString();
  const existingTransferredValue = roundPortalAmount(normalizedRecord.revenueTransferredAmount || 0);
  const existingRealizedProfitLoss = roundPortalAmount(normalizedRecord.realizedProfitLoss || 0);
  const existingTransferredPrincipal = roundPortalAmount(Math.max(existingTransferredValue - existingRealizedProfitLoss, 0));
  const capitalRatio = currentValue > 0 ? Math.min(Math.max(investedValue / currentValue, 0), 1) : 0;
  const withdrawnPrincipal = fullWithdraw
    ? investedValue
    : roundPortalAmount(Math.min(investedValue, withdrawValue * capitalRatio));
  const remainingCurrentValue = fullWithdraw ? 0 : roundPortalAmount(Math.max(currentValue - withdrawValue, 0));
  const remainingInvestedValue = fullWithdraw ? 0 : roundPortalAmount(Math.max(investedValue - withdrawnPrincipal, 0));
  const totalTransferredValue = roundPortalAmount(existingTransferredValue + withdrawValue);
  const totalRealizedProfitLoss = roundPortalAmount(existingRealizedProfitLoss + (withdrawValue - withdrawnPrincipal));
  const totalTransferredPrincipal = roundPortalAmount(existingTransferredPrincipal + withdrawnPrincipal);
  const realizedReturnPercent = totalTransferredPrincipal > 0
    ? roundPortalAmount((totalRealizedProfitLoss / totalTransferredPrincipal) * 100)
    : 0;
  const nextPoints = fullWithdraw
    ? []
    : [...(Array.isArray(normalizedRecord.points) ? normalizedRecord.points.slice(-29) : []), remainingCurrentValue];

  return normalizePortfolioRecord({
    ...normalizedRecord,
    amountInvested: remainingInvestedValue,
    currentValue: remainingCurrentValue,
    points: nextPoints,
    fundStatus: fullWithdraw ? 'Stopped' : 'Active',
    autoWithdrawTriggered: false,
    protectionReason: fullWithdraw ? 'Manual Withdrawal' : 'Partial Withdrawal',
    protectionTriggeredAt: nowIso,
    revenueTransferredAmount: totalTransferredValue,
    revenueTransferredAt: nowIso,
    lastProtectedValue: withdrawValue,
    realizedProfitLoss: totalRealizedProfitLoss,
    realizedReturnPercent,
    lastInvestedAmount: withdrawnPrincipal,
    lastUpdatedAt: nowIso
  });
}

function getRegisteredPlanPresentation(user) {
  const rawPlan = (user?.planDetails?.name || user?.plan || '').toString().trim();
  const normalizedPlan = rawPlan.toLowerCase();

  if (normalizedPlan.includes('silver') || normalizedPlan.includes('starter')) {
    return { tier: 'silver', label: 'Silver' };
  }
  if (normalizedPlan.includes('platinum') || normalizedPlan.includes('enterprise')) {
    return { tier: 'platinum', label: 'Platinum' };
  }
  if (normalizedPlan.includes('gold')) {
    return { tier: 'gold', label: 'Gold' };
  }

  return { tier: 'gold', label: rawPlan || 'Gold' };
}

const ADMIN_PLAN_SEQUENCE = ['silver', 'gold', 'platinum'];
const ADMIN_PLAN_CATALOG = {
  silver: { key: 'silver', name: 'Silver', price: 999 },
  gold: { key: 'gold', name: 'Gold', price: 2499 },
  platinum: { key: 'platinum', name: 'Platinum', price: 4999 }
};

function normalizeAdminPlanType(value) {
  const clean = String(value || '').trim().toLowerCase();
  if (!clean) return 'gold';
  if (clean.includes('silver') || clean.includes('starter')) return 'silver';
  if (clean.includes('platinum') || clean.includes('enterprise')) return 'platinum';
  if (clean.includes('gold') || clean.includes('professional')) return 'gold';
  return 'gold';
}

function getAdminPlanDetails(value) {
  const normalized = normalizeAdminPlanType(value);
  return ADMIN_PLAN_CATALOG[normalized] || ADMIN_PLAN_CATALOG.gold;
}

function adjacentAdminPlan(currentPlan, direction) {
  const index = ADMIN_PLAN_SEQUENCE.indexOf(normalizeAdminPlanType(currentPlan));
  if (index < 0) return '';
  if (direction === 'upgrade') return ADMIN_PLAN_SEQUENCE[Math.min(index + 1, ADMIN_PLAN_SEQUENCE.length - 1)] || '';
  if (direction === 'downgrade') return ADMIN_PLAN_SEQUENCE[Math.max(index - 1, 0)] || '';
  return '';
}

function renderSegmentPlanControls(user = getSafeCurrentUser()) {
  const currentPlan = normalizeAdminPlanType(user?.planDetails?.name || user?.plan || 'gold');
  const currentDetails = getAdminPlanDetails(currentPlan);
  const targetSelect = document.getElementById('segment-target-select');
  const currentLabel = document.getElementById('segment-switcher-current');
  const note = document.getElementById('segment-switcher-note');
  const upgradeBtn = document.getElementById('segment-upgrade-btn');
  const downgradeBtn = document.getElementById('segment-downgrade-btn');
  const upgradePlan = adjacentAdminPlan(currentPlan, 'upgrade');
  const downgradePlan = adjacentAdminPlan(currentPlan, 'downgrade');
  const upgradeDetails = upgradePlan && upgradePlan !== currentPlan ? getAdminPlanDetails(upgradePlan) : null;
  const downgradeDetails = downgradePlan && downgradePlan !== currentPlan ? getAdminPlanDetails(downgradePlan) : null;

  if (targetSelect) targetSelect.value = currentPlan;
  if (currentLabel) currentLabel.textContent = `Current: ${currentDetails.name}`;
  if (upgradeBtn) {
    upgradeBtn.disabled = !upgradeDetails;
    upgradeBtn.textContent = upgradeDetails ? `Upgrade to ${upgradeDetails.name}` : 'Highest Segment Active';
  }
  if (downgradeBtn) {
    downgradeBtn.disabled = !downgradeDetails;
    downgradeBtn.textContent = downgradeDetails ? `Downgrade to ${downgradeDetails.name}` : 'Lowest Segment Active';
  }
  if (note) {
    const messages = [
      `${currentDetails.name} segment is active at ${formatRupees(currentDetails.price)} per month.`
    ];
    if (upgradeDetails) messages.push(`Next upgrade: ${upgradeDetails.name} at ${formatRupees(upgradeDetails.price)}.`);
    if (downgradeDetails) messages.push(`Available downgrade: ${downgradeDetails.name} at ${formatRupees(downgradeDetails.price)}.`);
    if (!upgradeDetails && !downgradeDetails) messages.push('No other segment movement is available.');
    note.textContent = messages.join(' ');
  }
}

async function updateAdminBusinessPlan(targetPlan) {
  const currentUser = getSafeCurrentUser();
  if (!currentUser?.userid) {
    throw new Error('Please log in first to change the business segment.');
  }

  const normalizedPlan = normalizeAdminPlanType(targetPlan);
  const response = await fetch(`/api/businesses/${encodeURIComponent(currentUser.userid)}/plan`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ plan: normalizedPlan })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to update the segment right now.');
  }

  const updatedUser = {
    ...currentUser,
    ...(data?.user || {}),
    plan: data?.plan || normalizedPlan,
    planDetails: data?.planDetails || data?.user?.planDetails || getAdminPlanDetails(normalizedPlan)
  };
  updateCurrentUserCache(updatedUser);
  renderSegmentPlanControls(updatedUser);
  window.dispatchEvent(new CustomEvent('smartlocal:plan-updated', { detail: updatedUser }));
  await refreshCommandCenterData({ silent: true, source: 'admin-plan-change' });
  return updatedUser;
}

async function changeBusinessSegment(direction = 'manual') {
  const currentUser = getSafeCurrentUser();
  if (!currentUser?.userid) {
    showToast('Please log in first to change the business segment.', 'error');
    return;
  }

  const currentPlan = normalizeAdminPlanType(currentUser.planDetails?.name || currentUser.plan || 'gold');
  let targetPlan = currentPlan;

  if (direction === 'upgrade' || direction === 'downgrade') {
    targetPlan = adjacentAdminPlan(currentPlan, direction);
  } else {
    targetPlan = normalizeAdminPlanType(document.getElementById('segment-target-select')?.value || currentPlan);
  }

  if (!targetPlan) {
    showToast(`No ${direction === 'downgrade' ? 'lower' : 'higher'} segment is available from ${getAdminPlanDetails(currentPlan).name}.`, 'info');
    return;
  }
  if (targetPlan === currentPlan) {
    showToast(`Your business is already on the ${getAdminPlanDetails(currentPlan).name} segment.`, 'info');
    renderSegmentPlanControls(currentUser);
    return;
  }

  try {
    const updatedUser = await updateAdminBusinessPlan(targetPlan);
    const updatedDetails = getAdminPlanDetails(updatedUser?.plan || targetPlan);
    showToast(`Business segment updated to ${updatedDetails.name}.`, 'success');
  } catch (error) {
    showToast(error.message || 'Unable to update the segment.', 'error');
  }
}

async function updateDashboard(options = {}) {
  const currentUser = getSafeCurrentUser() || {};
  const registrations = await fetchRegistrations(100);
  const orders = await fetchDashboardOrders(200);
  await fetchDashboardCollection('/api/couriers', 'courierOrders', 200);
  await fetchDashboardCollection('/api/complaints', 'complaints', 200);
  updateCourierTable();
  renderCourierSummary();
  const portfolioItems = await fetchPortfolioInvestments(100);
  const marketTransferRevenue = getPortfolioRevenueTransferTotal(portfolioItems);
  const orderRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
  const totalRevenue = orderRevenue + marketTransferRevenue;
  const totalOrders = orders.length;
  const year = new Date().getFullYear();
  const yearOrders = orders.filter(order => new Date(order.date).getFullYear() === year).length;
  const averageOrder = totalOrders ? roundPortalAmount(totalRevenue / totalOrders) : 0;
  const currentMonth = orderMetricsForMonth(orders, 0);
  const previousMonth = orderMetricsForMonth(orders, -1);
  const revenueDelta = currentMonth.revenue - previousMonth.revenue;
  const completedOrders = currentMonth.orders.filter((order) => String(order.status || '').toLowerCase() === 'completed').length;

  if (document.getElementById('summary-orders')) document.getElementById('summary-orders').textContent = totalOrders;
  if (document.getElementById('summary-year-transactions')) document.getElementById('summary-year-transactions').textContent = yearOrders;
  if (document.getElementById('summary-revenue')) document.getElementById('summary-revenue').textContent = formatRupees(totalRevenue);
  if (document.getElementById('summary-average-order')) document.getElementById('summary-average-order').textContent = formatRupees(averageOrder);
  if (document.getElementById('order-growth')) document.getElementById('order-growth').textContent = formatDeltaText(currentMonth.count, previousMonth.count);
  if (document.getElementById('revenue-growth')) document.getElementById('revenue-growth').textContent = formatDeltaText(currentMonth.revenue, previousMonth.revenue);
  if (document.getElementById('transaction-growth')) document.getElementById('transaction-growth').textContent = formatDeltaText(currentMonth.count, previousMonth.count);
  if (document.getElementById('aov-growth')) document.getElementById('aov-growth').textContent = formatDeltaText(currentMonth.averageOrderValue, previousMonth.averageOrderValue);
  if (document.getElementById('order-trend')) document.getElementById('order-trend').textContent = `${completedOrders} completed orders this month`;
  if (document.getElementById('revenue-trend')) document.getElementById('revenue-trend').textContent = `${revenueDelta < 0 ? '-' : '+'}${formatRupees(Math.abs(revenueDelta))} versus last month`;
  if (document.getElementById('transaction-trend')) document.getElementById('transaction-trend').textContent = `${yearOrders} transactions this year`;
  if (document.getElementById('aov-trend')) document.getElementById('aov-trend').textContent = 'Average basket value';

  const businessName = currentUser.business?.name || currentUser.name || 'Business Owner';
  const { tier: planTier, label: planLabel } = getRegisteredPlanPresentation(currentUser);
  applyBusinessSettings(currentUser.settings || {}, { silent: true });
  if (document.getElementById('dashboard-greeting')) document.getElementById('dashboard-greeting').textContent = `Welcome back, ${businessName}`.trim();
  if (document.getElementById('dashboard-subtitle')) document.getElementById('dashboard-subtitle').textContent = currentUser.business?.name ? `Registered business: ${currentUser.business.name}` : 'Manage your registered business with live analytics';
  const overviewTitle = document.getElementById('overview-title');
  if (overviewTitle) {
    overviewTitle.textContent = 'WELCOME 365';
    overviewTitle.classList.remove('silver-glow', 'gold-glow', 'platinum-glow');
    overviewTitle.classList.add('circle-panel-glow');
  }
  if (document.getElementById('business-logo')) document.getElementById('business-logo').textContent = getBusinessLogo(currentUser.business?.type || 'platform');

  const segmentBadge = document.getElementById('profile-segment-badge');
  const segmentIcon = document.getElementById('segment-icon');
  const segmentName = document.getElementById('segment-name');
  const overviewCard = document.getElementById('overview-portal');
  const overviewIcon = document.getElementById('overview-icon');
  const overviewCopy = document.getElementById('overview-copy');

  if (segmentBadge) {
    segmentBadge.className = 'profile-segment-badge';
    if (overviewCard) overviewCard.className = 'overview-portal-card';

    if (planTier === 'silver') {
      segmentBadge.classList.add('silver-segment');
      if (overviewCard) overviewCard.classList.add('silver-segment');
      if (segmentIcon) segmentIcon.textContent = 'S';
      if (segmentName) segmentName.textContent = 'Silver';
      if (overviewCopy) overviewCopy.textContent = '365 Circle Panel is active in Silver mode with stable insights and steady growth guidance.';
      if (overviewIcon) overviewIcon.textContent = 'S';
    } else if (planTier === 'platinum') {
      segmentBadge.classList.add('platinum-segment');
      if (overviewCard) overviewCard.classList.add('platinum-segment');
      if (segmentIcon) segmentIcon.textContent = 'P';
      if (segmentName) segmentName.textContent = 'Platinum';
      if (overviewCopy) overviewCopy.textContent = '365 Circle Panel is active in Platinum mode with premium insights and priority control.';
      if (overviewIcon) overviewIcon.textContent = 'P';
    } else {
      segmentBadge.classList.add('gold-segment');
      if (overviewCard) overviewCard.classList.add('gold-segment');
      if (segmentIcon) segmentIcon.textContent = 'G';
      if (segmentName) segmentName.textContent = 'Gold';
      if (overviewCopy) overviewCopy.textContent = '365 Circle Panel is active in Gold mode with glowing revenue momentum and customer intelligence.';
      if (overviewIcon) overviewIcon.textContent = 'G';
    }
  }

  if (overviewIcon && !overviewIcon.textContent) overviewIcon.textContent = 'B';
  if (overviewCopy && !overviewCopy.textContent) overviewCopy.textContent = 'Live plan insights are displayed here.';
  renderSegmentPlanControls(currentUser);

  if (document.getElementById('year-statement-table')) populateYearStatement(orders);
  renderStatementsTab(orders, portfolioItems);
  renderBookingsTab(orders);
  await renderCustomersTab(registrations);
  updateCourierTable();
  renderCourierSummary();
  renderRevenueSummary(totalRevenue, orders, marketTransferRevenue);
  renderComplaintStats();
  await loadPortfolioDashboard();
  await syncOverviewPortal(orders, totalRevenue, totalOrders, yearOrders, averageOrder, currentUser, planLabel, registrations);
  if (options.refreshRates) {
    refreshCurrencyRates();
  }
}

async function loadDashboardIfAvailable() {
  portfolioLiveState = null;
  localStorage.removeItem('currentUser');
  updateNavAuthButton();
  document.getElementById('dashboard-section').style.display = 'none';
  document.getElementById('register-section').style.display = 'none';
  document.getElementById('login-section').style.display = 'block';
  const userField = document.getElementById('login-userid');
  const passwordField = document.getElementById('login-password');
  const rememberBox = document.getElementById('remember-login');
  if (userField) userField.value = '';
  if (passwordField) passwordField.value = '';
  if (rememberBox) rememberBox.checked = false;
  applyBusinessSettings({}, { silent: true });
  generateCaptcha();
  updateMarketClock();
}

async function saveCourierOrder(order) {
  const savedOrder = await saveCourierOrderToServer(order).catch(() => order);
  upsertLocalCollection('courierOrders', 'awb', savedOrder, 200);
  updateCourierTable();
  renderCourierGraph(document.getElementById('courier-chart-filter')?.value || 'all');
  renderCourierProviderChart();
  await fetchDashboardCollection('/api/couriers', 'courierOrders', 200);
  updateCourierTable();
  renderCourierSummary();
  renderCourierGraph(document.getElementById('courier-chart-filter')?.value || 'all');
  renderCourierProviderChart();
  await refreshCommandCenterData({ silent: true, source: 'courier-save' });
  return savedOrder;
}

async function saveCourierOrderToServer(order) {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
  const response = await fetch('/api/couriers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...order,
      businessUserId: currentUser?.userid || '',
      businessName: currentUser?.business?.name || currentUser?.name || '',
      origin: order.origin || order.originPincode || '',
      destination: order.destination || order.destinationPincode || ''
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Unable to save courier booking right now.');
  }
  return data?.record || order;
}

async function markCourierDelivered(awb) {
  const cleanAwb = String(awb || '').trim();
  if (!cleanAwb) {
    showToast('Courier AWB is missing for this row.', 'error');
    return;
  }
  try {
    const response = await fetch(`/api/couriers/${encodeURIComponent(cleanAwb)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Delivered', lastUpdatedAt: new Date().toISOString() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.record) {
      throw new Error(data?.error || 'Unable to mark the courier as delivered.');
    }
    upsertLocalCollection('courierOrders', 'awb', data.record, 200);
    if (data?.linkedOrder?.orderId) {
      upsertLocalCollection('orders', 'orderId', normalizeDashboardOrder(data.linkedOrder), 200);
    }
    await fetchDashboardCollection('/api/couriers', 'courierOrders', 200);
    updateCourierTable();
    renderCourierSummary();
    renderCourierGraph(document.getElementById('courier-chart-filter')?.value || 'all');
    renderCourierProviderChart();
    renderOrdersTable(getLocalOrders());
    renderBookingsTab(getLocalOrders());
    await refreshCommandCenterData({ silent: true, source: 'courier-delivered' });
    showToast(`Courier ${cleanAwb} marked as Delivered.`, 'success');
  } catch (error) {
    showToast(error.message || 'Unable to mark the courier as delivered.', 'error');
  }
}

function generateComplaintId() {
  return `CMP-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function saveComplaintToServer(complaint) {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
    await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...complaint,
        businessUserId: currentUser?.userid || '',
        businessName: currentUser?.business?.name || currentUser?.name || ''
      })
    });
  } catch (err) {
    // keep local save available
  }
}

function renderComplaintTable() {
  const tbody = document.querySelector('#complaint-table tbody');
  if (!tbody) return;
  const complaints = getLocalComplaints();
  if (!complaints.length) {
    tbody.innerHTML = '<tr><td colspan="5">No complaints found.</td></tr>';
    return;
  }
  tbody.innerHTML = complaints.map((complaint) => `
    <tr>
      <td>${complaint.id}</td>
      <td>${complaint.name}</td>
      <td>${complaint.category}</td>
      <td>${complaint.status}</td>
      <td>${formatAdminDate(complaint.date)}</td>
    </tr>
  `).join('');
}

function renderComplaintStats() {
  const complaints = getLocalComplaints();
  const selectedYear = document.getElementById('complaint-year-filter')?.value || '';
  const selectedStatus = document.getElementById('complaint-status-filter')?.value || 'all';
  const filteredComplaints = complaints.filter((item) => {
    const date = new Date(item.date);
    const matchesYear = !selectedYear || String(date.getFullYear()) === selectedYear;
    const matchesStatus = selectedStatus === 'all' || String(item.status || '') === selectedStatus;
    return matchesYear && matchesStatus;
  });
  const monthCount = complaints.filter((item) => {
    const now = new Date();
    const date = new Date(item.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const yearCount = complaints.filter((item) => {
    const date = new Date(item.date);
    return date.getFullYear() === new Date().getFullYear();
  }).length;
  const monthEl = document.getElementById('complaint-month-count');
  const yearEl = document.getElementById('complaint-year-count');
  const yearFilter = document.getElementById('complaint-year-filter');
  if (monthEl) monthEl.textContent = monthCount;
  if (yearEl) yearEl.textContent = yearCount;
  if (yearFilter) {
    const years = Array.from(new Set(complaints.map((item) => new Date(item.date).getFullYear()).filter((year) => Number.isFinite(year)))).sort((a, b) => b - a);
    const selected = selectedYear || String(years[0] || new Date().getFullYear());
    yearFilter.innerHTML = years.length
      ? years.map((year) => `<option value="${year}" ${String(year) === selected ? 'selected' : ''}>${year}</option>`).join('')
      : `<option value="${new Date().getFullYear()}">${new Date().getFullYear()}</option>`;
  }
  renderComplaintCategoryPieChart(filteredComplaints);
}

function handleAdminComplaintSubmit(event) {
  event.preventDefault();
  const complaint = {
    id: generateComplaintId(),
    name: document.getElementById('complaint-name')?.value.trim() || '',
    phone: document.getElementById('complaint-phone')?.value.trim() || '',
    category: document.getElementById('complaint-category')?.value || 'Other',
    priority: document.getElementById('complaint-priority')?.value || 'Medium',
    details: document.getElementById('complaint-details')?.value.trim() || '',
    status: 'Open',
    date: new Date().toISOString()
  };
  if (!complaint.name || !complaint.phone || !complaint.details) {
    showToast('Please complete the complaint form.', 'error');
    return;
  }
  upsertLocalCollection('complaints', 'id', complaint, 100);
  saveComplaintToServer(complaint);
  const summary = document.getElementById('complaint-summary');
  if (summary) {
    summary.innerHTML = `<div class="confirmation-card"><strong>Complaint ID:</strong> ${complaint.id}<br><strong>Status:</strong> ${complaint.status}<br><strong>Priority:</strong> ${complaint.priority}</div>`;
  }
  document.getElementById('complaint-form')?.reset();
  renderComplaintTable();
  renderComplaintStats();
  refreshCommandCenterData({ silent: true, source: 'complaint-save' });
  showToast('Complaint saved successfully.', 'success');
}

function legacyFormatRupees(amount) {
  const safeAmount = Number(amount) || 0;
  return `₹${safeAmount.toLocaleString('en-IN')}`;
}

function getCourierRateConfig() {
  return normalizeCourierRateConfig(currentPortalState().courierRateConfig);
}

function loadCourierRateSettings() {
  const config = getCourierRateConfig();
  const baseRate = document.getElementById('courier-base-rate');
  const weightRate = document.getElementById('courier-weight-rate');
  const valueRate = document.getElementById('courier-value-rate');
  if (baseRate) baseRate.value = config.baseRate;
  if (weightRate) weightRate.value = config.weightRate;
  if (valueRate) valueRate.value = config.valueRate;
}

async function saveCourierRateSettings() {
  const nextConfig = {
    ...getCourierRateConfig(),
    baseRate: parseFloat(document.getElementById('courier-base-rate')?.value || '0') || 0,
    weightRate: parseFloat(document.getElementById('courier-weight-rate')?.value || '0') || 0,
    valueRate: parseFloat(document.getElementById('courier-value-rate')?.value || '0') || 0
  };
  try {
    await saveBusinessPortalState({ courierRateConfig: normalizeCourierRateConfig(nextConfig) }, { silent: true });
    showToast(`Courier rates updated. Base rate is now ${formatRupees(nextConfig.baseRate)}.`, 'success');
  } catch (error) {
    showToast(error.message || 'Unable to save courier rates right now.', 'error');
  }
}

function updateCourierTable() {
  const courierOrders = getLocalCouriers();
  const tbody = document.querySelector('#courier-table tbody');
  if (!tbody) return;
  if (!courierOrders.length) {
    tbody.innerHTML = '<tr><td colspan="8">No courier orders found.</td></tr>';
    return;
  }
  tbody.innerHTML = courierOrders.map(order => {
    const status = String(order.status || 'Pending Dispatch').trim() || 'Pending Dispatch';
    const canMarkDelivered = ['Dispatched', 'Shipped', 'In Transit', 'Out for Delivery'].includes(status);
    return `
      <tr>
        <td>${order.awb || '-'}</td>
        <td>${formatProviderLabel(order.provider)}</td>
        <td>${order.originPincode || order.pincode || '-'}</td>
        <td>${order.destinationPincode || '-'}</td>
        <td>${order.service || 'standard'}</td>
        <td>${status}</td>
        <td>${formatRupees(order.cost)}</td>
        <td>${canMarkDelivered
          ? `<button type="button" class="glow-btn btn-outline-light courier-action-btn courier-deliver-btn" data-awb="${escapeHtml(order.awb || '')}">Mark Delivered</button>`
          : `<span class="badge-sm ${status === 'Delivered' ? 'profit-badge' : ''}">${status === 'Delivered' ? 'Delivered' : 'Live'}</span>`}</td>
      </tr>
    `;
  }).join('');
}

function getCourierGraphData(provider = 'all') {
  const courierOrders = getLocalCouriers();
  const filtered = courierOrders.filter(order => {
    const orderProvider = order.provider || '';
    return provider === 'all' ? true : orderProvider === provider;
  });
  const today = new Date();
  const labels = [];
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const label = date.toISOString().slice(5, 10);
    labels.push(label);
    counts.push(0);
  }
  filtered.forEach(order => {
    const orderDate = new Date(order.date);
    if (isNaN(orderDate)) return;
    const label = orderDate.toISOString().slice(5, 10);
    const index = labels.indexOf(label);
    if (index !== -1) counts[index] += 1;
  });
  return { labels, counts };
}

function renderCourierGraph(provider = 'all') {
  const canvas = document.getElementById('courier-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.offsetWidth || 720;
  const height = canvas.offsetHeight || 320;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  const data = getCourierGraphData(provider);
  const maxCount = Math.max(...data.counts, 1);
  const padding = 50;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = chartWidth / data.labels.length * 0.6;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#071019';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i;
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Inter';
  ctx.textAlign = 'left';
  ctx.fillText('Bookings per day', padding, 28);
  ctx.fillStyle = '#8b5cf6';
  ctx.fillText(provider === 'all' ? 'All Couriers' : provider.replace(/([A-Z])/g, ' $1').trim(), padding, 46);

  if (!data.counts.length || data.counts.every(value => value === 0)) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No courier booking data available', width / 2, height / 2);
    return;
  }

  ctx.font = '14px Inter';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';

  data.labels.forEach((label, index) => {
    const x = padding + index * (chartWidth / data.labels.length) + (chartWidth / data.labels.length - barWidth) / 2;
    const y = padding + chartHeight - (data.counts[index] / maxCount) * chartHeight;
    const barHeight = (data.counts[index] / maxCount) * chartHeight;

    ctx.fillStyle = '#66d9ff';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + barWidth / 2, height - padding + 20);
    ctx.fillText(data.counts[index].toString(), x + barWidth / 2, y - 10);
  });
}

function renderCourierProviderChart() {
  const orders = getLocalCouriers();
  const providerMap = new Map();
  orders.forEach((order) => {
    const label = formatProviderLabel(order?.provider || 'smartlocal');
    providerMap.set(label, (providerMap.get(label) || 0) + 1);
  });
  drawLandscapePieChart('courier-provider-chart', Array.from(providerMap, ([label, value]) => ({ label, value })), {
    legendId: 'courier-provider-legend',
    totalId: 'courier-provider-total',
    totalFormatter: (value) => `${value} AWBs`,
    valueFormatter: (value) => `${value} AWBs`,
    centerLabel: 'Couriers',
    centerFormatter: (value) => `${value}`,
    emptyText: 'No courier provider usage yet.'
  });
}

async function generateAWB() {
  const provider = document.getElementById('courier-provider').value;
  const pincode = document.getElementById('courier-pincode').value;
  const destinationPincode = document.getElementById('courier-destination-pincode').value;
  const weight = parseFloat(document.getElementById('courier-weight').value);
  const service = document.getElementById('courier-service').value;
  const value = parseFloat(document.getElementById('courier-value').value);

  if (!provider || !pincode || !destinationPincode || !weight || !service || isNaN(value)) {
    showToast('Complete all courier fields first.', 'error');
    return;
  }

  const config = getCourierRateConfig();
  const costMultiplier = config.serviceMultipliers?.[service] || 1;
  const cost = Math.max(
    config.baseRate || 0,
    Math.round(((config.baseRate || 0) + (weight * (config.weightRate || 0)) + (value * (config.valueRate || 0))) * costMultiplier)
  );
  const awb = buildAdminAwb(provider);
  const order = {
    awb,
    provider,
    originPincode: pincode,
    destinationPincode,
    service,
    status: 'Booked',
    cost,
    date: new Date().toISOString()
  };

  try {
    await saveCourierOrder(order);
    showToast('Courier AWB generated and synced successfully.', 'success');
  } catch (error) {
    showToast(error.message || 'Unable to generate the courier AWB right now.', 'error');
  }
}

function initCourierProviderDropdown() {
  const selector = document.getElementById('courier-provider-selector');
  const dropdown = document.getElementById('courier-provider-dropdown');
  const hiddenSelect = document.getElementById('courier-provider');
  const providerNameLabel = selector?.querySelector('.provider-name-label');
  const currentLogo = selector?.querySelector('.provider-logo');

  if (!selector || !dropdown || !hiddenSelect || !providerNameLabel || !currentLogo) return;

  function closeDropdown() {
    selector.classList.remove('open');
  }

  function openDropdown() {
    selector.classList.add('open');
  }

  selector.addEventListener('click', function(event) {
    event.stopPropagation();
    selector.classList.toggle('open');
  });

  dropdown.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', function() {
      const value = this.dataset.value;
      const label = this.textContent.trim();
      const logo = this.querySelector('.provider-logo')?.textContent || 'CR';
      hiddenSelect.value = value;
      providerNameLabel.textContent = label;
      currentLogo.textContent = logo;
      closeDropdown();
    });
  });

  document.addEventListener('click', closeDropdown);
}

function roundPortalAmount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

function formatRupees(amount) {
  const safeAmount = roundPortalAmount(amount);
  return `\u20B9${safeAmount.toLocaleString('en-IN', { minimumFractionDigits: safeAmount % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

document.getElementById('courier-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  await generateAWB();
});

// Duplicate tab handler removed; the first showTab implementation is used.

window.restoreAdminUiText = function() {
  const authBtn = document.getElementById('nav-auth-btn');
  if (authBtn) authBtn.textContent = 'Login';

  const sectionTag = document.querySelector('.section-tag');
  if (sectionTag) sectionTag.textContent = 'Admin Panel';

  const loginTitle = document.querySelector('.login-header h3');
  if (loginTitle) loginTitle.textContent = 'Secure Admin Access';

  const registerTitle = document.querySelector('.register-header h3');
  if (registerTitle) registerTitle.textContent = 'Register Your Business';

  const rememberGroup = document.querySelector('#remember-login')?.closest('.form-group');
  if (rememberGroup) rememberGroup.style.display = '';

  const captchaRefresh = document.querySelector('.captcha-refresh');
  if (captchaRefresh) captchaRefresh.textContent = 'Refresh';

  const commandCenterIcon = document.querySelector('.command-center-icon');
  if (commandCenterIcon) commandCenterIcon.textContent = 'CC';

  const overviewIcon = document.getElementById('overview-icon');
  if (overviewIcon) overviewIcon.textContent = 'B';

  const segmentIcon = document.getElementById('segment-icon');
  if (segmentIcon && /Ãƒ|Ã¢/.test(segmentIcon.textContent || '')) segmentIcon.textContent = 'G';

  const revenuePlaceholder = document.getElementById('summary-revenue');
  if (revenuePlaceholder && /Ãƒ|Ã¢/.test(revenuePlaceholder.textContent || '')) revenuePlaceholder.textContent = '\u20B90';

  const averagePlaceholder = document.getElementById('summary-average-order');
  if (averagePlaceholder && /Ãƒ|Ã¢/.test(averagePlaceholder.textContent || '')) averagePlaceholder.textContent = '\u20B90';

  document.querySelectorAll('.tab-btn').forEach((button) => {
    const labels = {
      bookings: 'Bookings',
      revenue: 'Revenue',
      market: 'Market',
      customers: 'Customers',
      orders: 'Orders',
      inventory: 'Inventory',
      analytics: 'Analytics',
      courier: 'Courier',
      complaints: 'Complaints',
      bank: 'Bank Account'
    };
    const label = labels[button.dataset.tab];
    if (label) button.textContent = label;
  });

  document.querySelectorAll('.provider-logo').forEach((element) => {
    const text = (element.closest('li,[data-value],.courier-partner')?.textContent || '').toLowerCase();
    if (text.includes('bluedart')) element.textContent = 'BD';
    else if (text.includes('india post') || text.includes('indiapost')) element.textContent = 'IP';
    else if (text.includes('delhivery')) element.textContent = 'DL';
    else if (text.includes('smartlocal')) element.textContent = 'SL';
    else element.textContent = 'CR';
  });

  document.querySelectorAll('.partner-logo').forEach((element) => {
    const text = (element.parentElement?.textContent || '').toLowerCase();
    if (text.includes('bluedart')) element.textContent = 'BD';
    else if (text.includes('india post') || text.includes('indiapost')) element.textContent = 'IP';
    else if (text.includes('delhivery')) element.textContent = 'DL';
    else element.textContent = 'SL';
  });

  document.querySelectorAll('.social-btn').forEach((button, index) => {
    const socialLabels = ['FB', 'IG', 'YT', 'IN'];
    button.textContent = socialLabels[index] || 'SM';
  });

  const staticLabels = [
    ['#revenue-total', '₹0'],
    ['#market-transfer-total', '₹0'],
    ['#live-usd', '$0'],
    ['#live-gbp', '£0'],
    ['#live-eur', '€0'],
    ['#portfolio-invested', '₹0'],
    ['#portfolio-current', '₹0'],
    ['#portfolio-return', '0.0%'],
    ['#portfolio-note', 'Live market analysis reads the latest MongoDB portfolio record and shows actual saved remarks, action signal, and risk band.']
  ];
  staticLabels.forEach(([selector, value]) => {
    const element = document.querySelector(selector);
    if (element && /Ãƒ|Ã¢/.test(element.textContent || '')) element.textContent = value;
  });

  document.querySelectorAll('.metric-label').forEach((element) => {
    if (/Today.*Cutoff|Ãƒ|Ã¢/.test(element.textContent || '')) {
      element.textContent = (element.textContent || '').replace(/Today.*Cutoff/i, "Today's Cutoff");
    }
  });

  const investLabel = document.querySelector('#portfolio-form label[for="portfolio-investment"]');
  if (investLabel) investLabel.textContent = 'Invest Value (₹)';

  const yearStatementHead = document.querySelector('#year-statement-table thead');
  if (yearStatementHead) {
    yearStatementHead.innerHTML = '<tr><th>Date</th><th>Order</th><th>Amount (₹)</th><th>Status</th><th>Payment Type</th></tr>';
  }

  document.querySelectorAll('th,td,p,span,div,button,label,option').forEach((element) => {
    const text = element.textContent || '';
    if (!/Ã¢â€šÂ¹|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã‚Â©/.test(text)) return;
    element.textContent = text
      .replace(/Ã¢â€šÂ¹/g, 'â‚¹')
      .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢/g, 'â€¢')
      .replace(/Ã‚Â©/g, 'Â©');
  });

  const footerText = document.querySelector('.footer-bottom p');
  if (footerText) footerText.textContent = '© 2025 SmartLocal. All rights reserved. Made in India.';
};

window.updateNavAuthButton = function() {
  const authBtn = document.getElementById('nav-auth-btn');
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (authBtn) {
    authBtn.textContent = currentUser ? 'Logout' : 'Login';
    authBtn.onclick = currentUser ? logout : (() => window.location.href = 'admin.html');
  }
};

window.getBusinessLogo = function(type) {
  const map = { salon: 'SAL', gym: 'GYM', restaurant: 'RST', clinic: 'CLN', grocery: 'GRC', tuition: 'TUI', retail: 'RTL', consulting: 'CNS', other: 'BIZ', platform: 'SL' };
  return map[type] || 'BIZ';
};

window.legacyFormatRupees = function(amount) {
  const safeAmount = Number(amount) || 0;
  return `\u20B9${safeAmount.toLocaleString('en-IN')}`;
};

window.restoreAdminUiText = function() {
  const textFix = (value) => String(value || '')
    .replace(/ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹|Ã¢â€šÂ¹/g, '\u20B9')
    .replace(/ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢/g, '\u2022')
    .replace(/Ãƒâ€šÃ‚Â©|Ã‚Â©/g, '\u00A9')
    .replace(/Ãƒâ€šÃ‚Â£|Ã‚Â£/g, '\u00A3')
    .replace(/ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬|Ã¢â€šÂ¬/g, '\u20AC')
    .replace(/Ã°Å¸Â¤â€“|ðŸ¤–/g, 'R')
    .replace(/Built with .+ for shop owners, entrepreneurs, and dreamers\./, "Built with \u2764\uFE0F for shop owners, entrepreneurs, and dreamers.");

  const safeText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  const safeTextIfBroken = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && /Ã|â|ð|Â/.test(element.textContent || '')) {
      element.textContent = value;
    }
  };

  safeTextIfBroken('#nav-auth-btn', 'Login');
  safeText('.section-tag', 'Admin Panel');
  safeText('.login-header h3', 'Secure Admin Access');
  safeText('.register-header h3', 'Register Your Business');
  safeText('.captcha-refresh', 'Refresh');
  safeText('.command-center-icon', 'CC');
  safeTextIfBroken('#overview-icon', 'B');
  safeTextIfBroken('#summary-revenue', '\u20B90');
  safeTextIfBroken('#summary-average-order', '\u20B90');
  safeTextIfBroken('#revenue-total', '\u20B90');
  safeTextIfBroken('#market-transfer-total', '\u20B90');
  safeTextIfBroken('#live-usd', '$0');
  safeTextIfBroken('#live-gbp', '\u00A30');
  safeTextIfBroken('#live-eur', '\u20AC0');
  safeTextIfBroken('#portfolio-invested', '\u20B90');
  safeTextIfBroken('#portfolio-current', '\u20B90');
  safeTextIfBroken('#portfolio-profit-loss', '\u20B90');
  safeTextIfBroken('#market-investment-live', '\u20B90');
  safeTextIfBroken('#market-current-live', '\u20B90');
  safeTextIfBroken('#market-profit-loss-live', '\u20B90');
  safeTextIfBroken('#portfolio-return', '0.0%');
  safeTextIfBroken('#market-asof-live', '--');
  safeTextIfBroken('#market-current-datetime', 'Current date and time loading...');
  safeTextIfBroken('#market-status-pill', 'MARKET OFF');
  safeTextIfBroken('#market-live-badge', 'Market Off');
  safeTextIfBroken('#market-mode-live', 'Market Off');
  safeTextIfBroken('#portfolio-note', 'Live market analysis reads the latest MongoDB portfolio record and shows actual saved remarks, action signal, and risk band.');
  safeText('.footer-bottom p', '\u00A9 2025 SmartLocal. All rights reserved. Made in India.');
  safeText('.footer-desc', "Empowering India's local businesses to thrive in the digital economy. Built with \u2764\uFE0F for shop owners, entrepreneurs, and dreamers.");

  const rememberGroup = document.querySelector('#remember-login')?.closest('.form-group');
  if (rememberGroup) rememberGroup.style.display = '';

  document.querySelectorAll('.tab-btn').forEach((button) => {
    const labels = {
      bookings: 'Bookings',
      revenue: 'Revenue',
      market: 'Market',
      customers: 'Customers',
      orders: 'Orders',
      inventory: 'Inventory',
      analytics: 'Analytics',
      courier: 'Courier',
      complaints: 'Complaints',
      bank: 'Bank Account'
    };
    if (labels[button.dataset.tab]) button.textContent = labels[button.dataset.tab];
  });

  document.querySelectorAll('.provider-logo').forEach((element) => {
    const text = (element.closest('li,[data-value],.courier-partner')?.textContent || '').toLowerCase();
    if (text.includes('bluedart')) element.textContent = 'BD';
    else if (text.includes('india post') || text.includes('indiapost')) element.textContent = 'IP';
    else if (text.includes('smartlocal')) element.textContent = 'SL';
    else if (text.includes('delhivery')) element.textContent = 'DL';
    else element.textContent = 'CR';
  });

  document.querySelectorAll('.partner-logo').forEach((element) => {
    const text = (element.parentElement?.textContent || '').toLowerCase();
    if (text.includes('bluedart')) element.textContent = 'BD';
    else if (text.includes('india post') || text.includes('indiapost')) element.textContent = 'IP';
    else if (text.includes('smartlocal')) element.textContent = 'SL';
    else if (text.includes('delhivery')) element.textContent = 'DL';
    else element.textContent = 'CR';
  });

  document.querySelectorAll('.social-btn').forEach((button, index) => {
    const labels = ['FB', 'IG', 'YT', 'IN'];
    button.textContent = labels[index] || 'SM';
  });

  const investLabel = document.querySelector('#portfolio-form label[for="portfolio-investment"]');
  if (investLabel) investLabel.textContent = 'Invest Value (\u20B9)';

  const yearStatementHead = document.querySelector('#year-statement-table thead');
  if (yearStatementHead) {
    yearStatementHead.innerHTML = '<tr><th>Date</th><th>Order</th><th>Amount (\u20B9)</th><th>Status</th><th>Payment Type</th></tr>';
  }

  document.querySelectorAll('th,td,p,span,div,button,label,option,a').forEach((element) => {
    if (element.children.length && !element.matches('a.social-btn')) return;
    const cleaned = textFix(element.textContent);
    if (cleaned !== element.textContent) element.textContent = cleaned;
  });

  document.body.classList.remove('admin-pending');
};

function startPortfolioTicker() {
  if (portfolioLiveTimer) clearInterval(portfolioLiveTimer);
  const runPortfolioLiveTick = async () => {
    const dashboard = document.getElementById('dashboard-section');
    if (!dashboard || dashboard.style.display === 'none') return;
    if (portfolioTickInFlight) return;
    portfolioTickInFlight = true;
    try {
      const latestMongoRecord = await fetchLatestPortfolioInvestment();
      if (!latestMongoRecord) {
        updatePortfolioSummary(buildEmptyPortfolioState());
        return;
      }
      updatePortfolioSummary(latestMongoRecord);
      const marketEngineNote = document.getElementById('market-live-engine-note');
      if (marketEngineNote && portfolioLiveState?.amountInvested > 0) {
        marketEngineNote.textContent = 'Market engine is ON and syncing the MongoDB portfolio every 1 second.';
      }
    } catch (error) {
      const marketEngineNote = document.getElementById('market-live-engine-note');
      if (marketEngineNote) {
        marketEngineNote.textContent = 'Market engine sync error. Refresh once and check the live MongoDB connection.';
      }
    } finally {
      portfolioTickInFlight = false;
    }
  };
  runPortfolioLiveTick();
  portfolioLiveTimer = setInterval(runPortfolioLiveTick, LIVE_MONGO_SYNC_MS);
}

let adminSyncInFlight = false;

function currentBusinessUser() {
  return getSafeCurrentUser() || {};
}

function getLocalOrders() {
  return (dashboardLiveData.orders || []).map(normalizeDashboardOrder);
}

function getLocalCouriers() {
  const storedRows = sortAdminCourierRows(
    filterVisibleCourierRows(
      (Array.isArray(dashboardLiveData.couriers) ? dashboardLiveData.couriers : []).map(normalizeDashboardCourier),
      dashboardLiveData.orders
    )
  );
  return storedRows.length ? storedRows : mergeCourierCollections([], dashboardLiveData.orders);
}

function getLocalComplaints() {
  return Array.isArray(dashboardLiveData.complaints) ? dashboardLiveData.complaints : [];
}

function getLocalInventory() {
  return Array.isArray(dashboardLiveData.inventory) ? dashboardLiveData.inventory : [];
}

function upsertLocalCollection(storageKey, idKey, record, limit = 200) {
  const key = getLiveCollectionKey(storageKey);
  const items = key ? (dashboardLiveData[key] || []) : [];
  const filtered = items.filter((item) => item?.[idKey] !== record?.[idKey]);
  filtered.unshift(record);
  if (key === 'orders') {
    dashboardLiveData.orders = filtered.slice(0, limit).map(normalizeDashboardOrder);
    return dashboardLiveData.orders;
  }
  if (key === 'couriers') {
    dashboardLiveData.couriers = filtered.slice(0, limit).map(normalizeDashboardCourier);
    return dashboardLiveData.couriers;
  }
  if (key) dashboardLiveData[key] = filtered.slice(0, limit);
  return filtered.slice(0, limit);
}

function formatProviderLabel(provider) {
  const value = String(provider || '').toLowerCase();
  if (value === 'bluedart') return 'BlueDart';
  if (value === 'indiapost') return 'India Post';
  if (value === 'delhivery') return 'Delhivery';
  if (value === 'smartlocal') return 'SmartLocal Express';
  return provider || '-';
}

function buildAdminAwb(provider) {
  const codes = {
    bluedart: 'BDRT',
    indiapost: 'INDP',
    delhivery: 'DLVY',
    smartlocal: 'SLEX'
  };
  const code = codes[String(provider || '').toLowerCase()] || 'AWB';
  return `${code}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function randomOrderId() {
  return `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
}

function formatAdminDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-IN') : '-';
}

function inventoryStatus(item) {
  const quantity = Math.max(Number(item?.quantity) || 0, 0);
  const reorderLevel = Math.max(Number(item?.reorderLevel) || 0, 0);
  if (quantity <= 0) return 'Out of Stock';
  if (quantity <= reorderLevel) return 'Low Stock';
  return 'In Stock';
}

function renderInventoryTable(itemsInput) {
  const tbody = document.querySelector('#inventory-table tbody');
  if (!tbody) return;
  const items = Array.isArray(itemsInput) ? itemsInput : getLocalInventory();
  const normalized = items.map((item) => ({
    ...item,
    quantity: Math.max(Number(item?.quantity) || 0, 0),
    reorderLevel: Math.max(Number(item?.reorderLevel) || 0, 0),
    status: inventoryStatus(item)
  }));
  const lowStockCount = normalized.filter((item) => item.status !== 'In Stock').length;
  const inventoryCount = document.getElementById('inventory-count');
  const alerts = document.getElementById('inventory-alerts');
  if (inventoryCount) inventoryCount.textContent = normalized.length;
  if (alerts) alerts.textContent = `${lowStockCount} low stock`;
  renderInventoryPieChart(normalized);

  if (!normalized.length) {
    tbody.innerHTML = '<tr><td colspan="6">No inventory items found.</td></tr>';
    return;
  }

  tbody.innerHTML = normalized.map((item) => `
    <tr>
      <td>${item.name || '-'}</td>
      <td>${item.sku || '-'}</td>
      <td>${item.quantity}</td>
      <td>${item.reorderLevel}</td>
      <td>${item.status}</td>
      <td><button type="button" class="glow-btn btn-outline-light inventory-delete-btn" data-sku="${item.sku}">Delete</button></td>
    </tr>
  `).join('');
}

function aggregateTopProducts(orders) {
  const productMap = new Map();
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.name || 'Item';
      const existing = productMap.get(key) || { name: key, qty: 0, revenue: 0 };
      existing.qty += Number(item.qty) || 0;
      existing.revenue += (Number(item.qty) || 0) * (Number(item.price) || 0);
      productMap.set(key, existing);
    });
  });
  return Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
}

function aggregateTopCustomers(orders) {
  const customerMap = new Map();
  orders.forEach((order) => {
    const key = order.customer?.name || 'Customer';
    const existing = customerMap.get(key) || { name: key, orders: 0, spend: 0 };
    existing.orders += 1;
    existing.spend += Number(order.amount || order.total || 0) || 0;
    customerMap.set(key, existing);
  });
  return Array.from(customerMap.values()).sort((a, b) => b.spend - a.spend).slice(0, 8);
}

function drawAdminBarChart(canvasId, labels, values, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const width = canvas.offsetWidth || canvas.width || 720;
  const height = canvas.offsetHeight || canvas.height || 320;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#071019';
  ctx.fillRect(0, 0, width, height);

  const padding = { top: 42, right: 22, bottom: 56, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...values, 1);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 14px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(options.title || 'Chart', padding.left, 24);

  if (!values.length || values.every((value) => Number(value) === 0)) {
    ctx.textAlign = 'center';
    ctx.font = '600 16px Inter';
    ctx.fillText(options.emptyText || 'No live data available.', width / 2, height / 2);
    return;
  }

  const slot = chartWidth / Math.max(labels.length, 1);
  const barWidth = Math.max(16, Math.min(42, slot * 0.56));
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, options.startColor || '#66d9ff');
  gradient.addColorStop(1, options.endColor || '#00ff9d');

  ctx.textAlign = 'center';
  ctx.font = '500 11px Inter';
  labels.forEach((label, index) => {
    const barHeight = (Number(values[index]) || 0) / max * chartHeight;
    const x = padding.left + (slot * index) + (slot - barWidth) / 2;
    const y = padding.top + chartHeight - barHeight;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#dbeafe';
    ctx.fillText(String(label).slice(0, 10), x + barWidth / 2, height - 20);
    ctx.fillText(String(values[index] ?? 0), x + barWidth / 2, Math.max(y - 10, padding.top + 12));
  });
}

function renderAnalyticsDashboard(ordersInput, inventoryInput) {
  const orders = Array.isArray(ordersInput) ? ordersInput : getLocalOrders();
  const inventory = Array.isArray(inventoryInput) ? inventoryInput : getLocalInventory();
  const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.amount || order.total || 0) || 0), 0);
  const analyticsRevenue = document.getElementById('analytics-revenue');
  const analyticsOrders = document.getElementById('analytics-orders');
  const analyticsAov = document.getElementById('analytics-aov');
  if (analyticsRevenue) analyticsRevenue.textContent = formatRupees(totalRevenue);
  if (analyticsOrders) analyticsOrders.textContent = orders.length;
  if (analyticsAov) analyticsAov.textContent = formatRupees(orders.length ? roundPortalAmount(totalRevenue / orders.length) : 0);

  const products = aggregateTopProducts(orders);
  const customers = aggregateTopCustomers(orders);
  const productTbody = document.querySelector('#analytics-products tbody');
  const customerTbody = document.querySelector('#analytics-customers tbody');
  if (productTbody) {
    productTbody.innerHTML = products.length
      ? products.map((item) => `<tr><td>${item.name}</td><td>${item.qty}</td><td>${formatRupees(item.revenue)}</td></tr>`).join('')
      : '<tr><td colspan="3">No product sales available yet.</td></tr>';
  }
  if (customerTbody) {
    customerTbody.innerHTML = customers.length
      ? customers.map((item) => `<tr><td>${item.name}</td><td>${item.orders}</td><td>${formatRupees(item.spend)}</td></tr>`).join('')
      : '<tr><td colspan="3">No customer analytics available yet.</td></tr>';
  }

  const monthMap = new Map();
  orders.forEach((order) => {
    const date = order?.date ? new Date(order.date) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    const label = date.toLocaleString('en-IN', { month: 'short' });
    monthMap.set(label, (monthMap.get(label) || 0) + (Number(order.amount || order.total || 0) || 0));
  });
  const monthLabels = Array.from(monthMap.keys()).slice(-6);
  const monthValues = monthLabels.map((label) => Math.round(monthMap.get(label) || 0));
  drawAdminBarChart('analytics-sales-chart', monthLabels, monthValues, {
    title: 'Monthly Sales',
    startColor: '#66d9ff',
    endColor: '#8b5cf6',
    emptyText: 'No sales data available yet.'
  });

  renderAnalyticsProductPieChart(products);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function collectTabExportPayload(tabName) {
  const tab = document.getElementById(`tab-${tabName}`);
  if (!tab) return { title: tabName, metrics: [], tables: [], textBlocks: [] };
  const title = document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.textContent?.trim() || tabName;
  const metrics = [];
  tab.querySelectorAll('.dash-metric').forEach((card) => {
    const label = card.querySelector('.metric-label')?.textContent?.trim();
    const value = card.querySelector('.metric-val, strong, .badge-sm')?.textContent?.trim();
    const note = card.querySelector('.metric-trend')?.textContent?.trim();
    if (label || value || note) metrics.push({ label: label || 'Metric', value: [value, note].filter(Boolean).join(' | ') || '-' });
  });

  const tables = Array.from(tab.querySelectorAll('table')).map((table) => {
    const heading = table.closest('.booking-detail-panel,.order-table-wrap,.inventory-table-wrap,.customer-table-wrap,.courier-table-wrap,.complaint-table-wrap,.dash-metric')?.querySelector('h4,.metric-label')?.textContent?.trim() || 'Table';
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.children).map((td) => td.textContent.trim()));
    return { heading, headers, rows };
  });

  const textBlocks = Array.from(tab.querySelectorAll('.portfolio-note,.metric-trend,p')).map((node) => node.textContent.trim()).filter(Boolean);
  return { title, metrics, tables, textBlocks };
}

function exportTabCsv(tabName) {
  const payload = collectTabExportPayload(tabName);
  const lines = [[payload.title]];
  if (payload.metrics.length) {
    lines.push([]);
    lines.push(['Metric', 'Value']);
    payload.metrics.forEach((item) => lines.push([item.label, item.value]));
  }
  payload.tables.forEach((table) => {
    lines.push([]);
    lines.push([table.heading]);
    if (table.headers.length) lines.push(table.headers);
    table.rows.forEach((row) => lines.push(row));
  });
  if (!payload.tables.length && payload.textBlocks.length) {
    lines.push([]);
    lines.push(['Content']);
    payload.textBlocks.forEach((line) => lines.push([line]));
  }
  const csv = lines.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${tabName}_export.csv`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 0);
}

function exportTabPdf(tabName) {
  const orders = getLocalOrders();
  const latestOrder = orders[0] || orders[orders.length - 1] || null;
  const target = latestOrder?.orderId
    ? `invoice.html?orderId=${encodeURIComponent(latestOrder.orderId)}`
    : 'invoice.html';
  window.location.href = target;
}

function ensureTabExportBars() {
  document.querySelectorAll('.tab-content').forEach((tab) => {
    if (tab.id === 'tab-statements' || tab.id === 'tab-metals') return;
    if (tab.querySelector('.tab-export-bar')) return;
    const tabName = tab.id.replace('tab-', '');
    const bar = document.createElement('div');
    bar.className = 'tab-export-bar';
    bar.innerHTML = `
      <span class="tab-export-label">Export ${tabName.charAt(0).toUpperCase()}${tabName.slice(1)} Data</span>
      <div class="tab-export-actions">
        <button type="button" class="glow-btn btn-outline-light admin-export-btn" data-format="pdf" data-tab="${tabName}">Export PDF</button>
        <button type="button" class="glow-btn btn-outline-light admin-export-btn" data-format="csv" data-tab="${tabName}">Export CSV</button>
      </div>
    `;
    const body = tab.querySelector('.admin-body');
    if (body) tab.insertBefore(bar, body);
    else tab.prepend(bar);
  });
}

async function handlePortfolioWithdraw(mode = 'full') {
  const currentUser = currentBusinessUser();
  if (!currentUser?.userid) {
    showToast('Please log in to withdraw market funds.', 'error');
    return;
  }
  const currentRecord = await fetchLatestPortfolioInvestment() || portfolioLiveState;
  if (!currentRecord || !(Number(currentRecord.amountInvested) > 0)) {
    updatePortfolioSummary(buildEmptyPortfolioState());
    showToast('No active fund is available to withdraw.', 'info');
    return;
  }
  const withdrawInput = document.getElementById('portfolio-withdraw-amount');
  const requestedAmount = roundPortalAmount(withdrawInput?.value || 0);
  if (mode === 'partial' && !(requestedAmount > 0)) {
    showToast('Enter a partial withdrawal amount in rupees first.', 'error');
    return;
  }
  const liveCurrentValue = roundPortalAmount(currentRecord.currentValue || 0);
  const cappedRequestedAmount = mode === 'partial' ? Math.min(requestedAmount, liveCurrentValue) : liveCurrentValue;
  if (mode === 'partial' && requestedAmount > liveCurrentValue) {
    showToast(`Live current value is ${formatRupees(liveCurrentValue)}. Maximum withdrawable amount has been matched to that value.`, 'info');
  }
  const effectiveMode = mode === 'partial' && cappedRequestedAmount < liveCurrentValue ? 'partial' : 'full';
  const withdrawnRecord = buildPortfolioWithdrawalRecord(currentRecord, cappedRequestedAmount, effectiveMode);
  try {
    const savedRecord = await savePortfolioInvestment(withdrawnRecord);
    updatePortfolioSummary(savedRecord);
    await refreshCommandCenterData({ silent: true, source: 'portfolio-withdraw' });
    if (withdrawInput) withdrawInput.value = '';
    showToast(
      effectiveMode === 'partial' && Number(savedRecord.amountInvested || 0) > 0
        ? 'Partial withdrawal transferred to Revenue and the remaining market fund stays live.'
        : 'Market fund stopped and fully withdrawn successfully.',
      'success'
    );
  } catch (error) {
    showToast('Unable to withdraw the fund right now.', 'error');
  }
}

async function handleAdminOrderSubmit(event) {
  event.preventDefault();
  const currentUser = currentBusinessUser();
  if (!currentUser?.userid) {
    showToast('Please log in before creating an order.', 'error');
    return;
  }
  const businessSettings = currentBusinessSettings();
  if (isAfterBookingCutoff(businessSettings)) {
    updateOrderCutoffNote(businessSettings);
    showToast(`Cutoff ${formatCutoffLabel(businessSettings.bookingCutoff)} has passed. New orders are blocked.`, 'error');
    return;
  }

  const items = collectAdminOrderItemsFromRows();
  if (!items.length) {
    showToast('Please add at least one valid item row.', 'error');
    return;
  }

  const customerName = document.getElementById('order-customer-name')?.value.trim() || '';
  const customerPhone = document.getElementById('order-customer-phone')?.value.trim() || '';
  const customerEmail = document.getElementById('order-customer-email')?.value.trim() || '';
  const customerAddress = document.getElementById('order-customer-address')?.value.trim() || '';
  if (!customerName || !customerPhone || !customerAddress) {
    showToast('Please complete the customer details.', 'error');
    return;
  }

  const gstPercent = Number(document.getElementById('order-gst')?.value || 18) || 18;
  const payment = document.getElementById('order-payment')?.value || 'UPI';
  const originPin = document.getElementById('order-origin-pin')?.value.trim() || '';
  const destinationPin = document.getElementById('order-destination-pin')?.value.trim() || '';
  const weight = Number(document.getElementById('order-weight')?.value || 0) || 0;
  const declaredValue = roundPortalAmount(document.getElementById('order-declared-value')?.value || 0);
  const subtotal = roundPortalAmount(items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0));
  const gstAmount = roundPortalAmount((subtotal * gstPercent) / 100);
  const total = roundPortalAmount(subtotal + gstAmount);
  const order = normalizeDashboardOrder({
    orderId: randomOrderId(),
    customer: {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      address: customerAddress
    },
    items,
    gstPercent,
    gstAmount,
    subtotal,
    total,
    amount: total,
    payment,
    status: 'In Progress',
    date: new Date().toISOString(),
    businessUserId: currentUser.userid,
    businessName: currentUser.business?.name || currentUser.name || '',
    gstNo: currentUser.business?.gst || '',
    warrantyExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-IN'),
    source: 'admin',
    courier: {
      provider: '',
      originPincode: originPin,
      destinationPincode: destinationPin,
      service: 'standard',
      status: 'Pending Dispatch',
      weight,
      value: declaredValue || total,
      description: `Order shipment for ${customerName}`
    }
  });

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.record) {
      throw new Error(data?.error || 'Unable to save order right now.');
    }

    const savedOrder = normalizeDashboardOrder(data.record);
    upsertLocalCollection('orders', 'orderId', savedOrder, 200);
    updateOrderCutoffNote(data.settings || businessSettings);

    const summary = document.getElementById('order-summary');
    if (summary) {
      summary.innerHTML = `Order <strong>${escapeHtml(savedOrder.orderId)}</strong> saved for <strong>${escapeHtml(savedOrder.payment || 'UPI')}</strong>. Current status is <strong>${escapeHtml(savedOrder.status || 'In Progress')}</strong>. Courier is queued as <strong>${escapeHtml(savedOrder.courier?.status || 'Pending Dispatch')}</strong> until cutoff ${formatCutoffLabel((data.settings || businessSettings).bookingCutoff)}.`;
    }

    document.getElementById('order-form')?.reset();
    resetAdminOrderItemRows();
    renderOrdersTable(getLocalOrders());
    updateCourierTable();
    renderCourierGraph(document.getElementById('courier-chart-filter')?.value || 'all');
    renderCourierProviderChart();
    await refreshCommandCenterData({ silent: true, source: 'order-submit' });
    window.open(`invoice.html?orderId=${encodeURIComponent(savedOrder.orderId)}`, '_blank', 'noopener');
    showToast('Order created with In Progress status and queued for automatic courier dispatch.', 'success');
  } catch (error) {
    const summary = document.getElementById('order-summary');
    if (summary) summary.textContent = error.message || 'Unable to save order right now.';
    showToast(error.message || 'Unable to save order right now.', 'error');
  }
}

async function handleInventorySubmit(event) {
  event.preventDefault();
  const currentUser = currentBusinessUser();
  if (!currentUser?.userid) {
    showToast('Please log in before updating inventory.', 'error');
    return;
  }

  const item = {
    name: document.getElementById('inv-name')?.value.trim() || '',
    sku: document.getElementById('inv-sku')?.value.trim() || '',
    quantity: Math.max(Number(document.getElementById('inv-qty')?.value || 0) || 0, 0),
    reorderLevel: Math.max(Number(document.getElementById('inv-reorder')?.value || 0) || 0, 0),
    businessUserId: currentUser.userid,
    businessName: currentUser.business?.name || currentUser.name || ''
  };

  if (!item.name || !item.sku) {
    showToast('Please enter item name and SKU.', 'error');
    return;
  }

  item.status = inventoryStatus(item);
  try {
    const savedRecord = await saveInventoryItemToServer(item);
    upsertLocalCollection('inventoryItems', 'sku', { ...item, ...savedRecord }, 300);
    renderInventoryTable(getLocalInventory());
    renderAnalyticsDashboard(getLocalOrders(), getLocalInventory());
    const message = document.getElementById('inventory-message');
    if (message) message.textContent = `Inventory item ${item.sku} saved and synced to MongoDB.`;
    document.getElementById('inventory-form')?.reset();
    showToast('Inventory saved successfully.', 'success');
  } catch (error) {
    showToast(error.message || 'Unable to save inventory.', 'error');
  }
}

async function handleInventoryTableClick(event) {
  const button = event.target.closest('.inventory-delete-btn');
  if (!button) return;
  const sku = button.dataset.sku;
  if (!sku) return;
  try {
    await deleteInventoryItemFromServer(sku);
    const items = getLocalInventory().filter((item) => item.sku !== sku);
    setLiveCollection('inventoryItems', items);
    renderInventoryTable(items);
    renderAnalyticsDashboard(getLocalOrders(), items);
    showToast(`Inventory item ${sku} deleted.`, 'success');
  } catch (error) {
    showToast(error.message || 'Unable to delete inventory item.', 'error');
  }
}

async function refreshCommandCenterData(options = {}) {
  if (adminSyncInFlight) return;
  const currentUser = currentBusinessUser();
  if (!currentUser?.userid) return;
  adminSyncInFlight = true;
  try {
    if (options.syncPortalState !== false) {
      try {
        await syncAdminPortalState();
      } catch {}
    }
    try {
      await updateDashboard({ refreshRates: options.refreshRates === true });
    } catch (error) {
      console.error('Command Center dashboard sync failed:', error);
    }
    let inventory = getLocalInventory();
    try {
      inventory = await fetchInventoryItems(300);
    } catch (error) {
      console.error('Inventory sync failed:', error);
    }
    const orders = getLocalOrders();
    renderOrdersTable(orders);
    renderInventoryTable(inventory);
    renderComplaintTable();
    renderComplaintStats();
    updateCourierTable();
    renderCourierSummary();
    renderCourierGraph(document.getElementById('courier-chart-filter')?.value || 'all');
    renderCourierProviderChart();
    renderAnalyticsDashboard(orders, inventory);
    renderRevenuePieChart(orders);
    renderBankSettlementPieChart(orders);
    ensureTabExportBars();
    if (!options.silent) {
      showToast('Business Command Center synced with MongoDB.', 'success');
    }
  } finally {
    adminSyncInFlight = false;
  }
}

async function fetchInventoryItems(limit = 200) {
  const items = await fetchDashboardCollection('/api/inventory', 'inventoryItems', limit);
  return Array.isArray(items) ? items : [];
}

async function saveInventoryItemToServer(item) {
  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Failed to save inventory item.');
  return data?.record || item;
}

async function deleteInventoryItemFromServer(sku) {
  const currentUser = currentBusinessUser();
  const response = await fetch(`/api/inventory/${encodeURIComponent(sku)}?userid=${encodeURIComponent(currentUser.userid || '')}`, {
    method: 'DELETE'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Failed to delete inventory item.');
  return true;
}

function renderOrdersTable(ordersInput) {
  const tbody = document.querySelector('#orders-table tbody');
  if (!tbody) return;
  const orders = Array.isArray(ordersInput) ? ordersInput : getLocalOrders();
  const search = (document.getElementById('order-search')?.value || '').trim().toLowerCase();
  const status = document.getElementById('order-status-filter')?.value || 'all';
  const dateFrom = document.getElementById('order-date-from')?.value || '';
  const dateTo = document.getElementById('order-date-to')?.value || '';

  const filtered = orders.filter((order) => {
    const orderDate = order?.date ? new Date(order.date) : null;
    const customerName = String(order?.customer?.name || '').toLowerCase();
    const itemSummary = String(order?.itemSummary || buildOrderItemsLabel(order?.items || [])).toLowerCase();
    if (search && !customerName.includes(search) && !String(order?.orderId || '').toLowerCase().includes(search) && !itemSummary.includes(search)) return false;
    if (status !== 'all' && String(order?.status || '') !== status) return false;
    if (dateFrom && orderDate && orderDate < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && orderDate && orderDate > new Date(`${dateTo}T23:59:59`)) return false;
    return true;
  });

  renderOrdersPaymentPieChart(filtered);

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10">No orders found for the selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((order) => `
    <tr>
      <td>${order.orderId || '-'}</td>
      <td>${order.customer?.name || '-'}</td>
      <td><span class="order-item-summary">${escapeHtml(order.itemSummary || buildOrderItemsLabel(order.items || []))}</span></td>
      <td>${formatRupees(order.amount || order.total || 0)}</td>
      <td>${order.payment || '-'}</td>
      <td>${order.status || 'In Progress'}</td>
      <td>${escapeHtml(buildOrderCourierLabel(order))}</td>
      <td>${formatAdminDate(order.date)}</td>
      <td><a href="invoice.html?orderId=${encodeURIComponent(order.orderId || '')}" target="_blank" rel="noopener">Open</a></td>
      <td>${order.customer?.email || '-'}</td>
    </tr>
  `).join('');
}

function parseAdminOrderItems(raw) {
  return String(raw || '')
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((item) => item.trim());
      if (parts.length < 3) return null;
      return {
        name: parts[0],
        qty: Math.max(Math.round(Number(parts[1]) || 0), 1),
        price: Math.max(roundPortalAmount(parts[2]), 0),
        hsn: ''
      };
    })
    .filter(Boolean);
}

function buildOrderItemRow(item = {}) {
  const row = document.createElement('div');
  row.className = 'order-item-grid order-item-row';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'order-item-name';
  nameInput.placeholder = 'Item name';
  nameInput.value = String(item.name || '').trim();

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'order-item-qty';
  qtyInput.min = '1';
  qtyInput.step = '1';
  qtyInput.value = String(Math.max(Math.round(Number(item.qty) || 1), 1));

  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.className = 'order-item-price';
  priceInput.min = '0';
  priceInput.step = '0.01';
  priceInput.placeholder = '0.00';
  priceInput.value = item.price !== undefined && item.price !== null && item.price !== ''
    ? roundPortalAmount(item.price).toFixed(2)
    : '';

  const totalCell = document.createElement('div');
  totalCell.className = 'order-item-line-total';
  totalCell.textContent = formatRupees(0);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'glow-btn btn-outline-light order-item-remove';
  removeBtn.textContent = 'Remove';

  row.append(nameInput, qtyInput, priceInput, totalCell, removeBtn);
  return row;
}

function getAdminOrderItemRows() {
  return Array.from(document.querySelectorAll('#order-item-rows .order-item-row'));
}

function collectAdminOrderItemsFromRows() {
  return getAdminOrderItemRows()
    .map((row) => {
      const name = row.querySelector('.order-item-name')?.value.trim() || '';
      const qty = Math.max(Math.round(Number(row.querySelector('.order-item-qty')?.value || 0) || 0), 1);
      const priceValue = row.querySelector('.order-item-price')?.value;
      const hasPrice = String(priceValue || '').trim() !== '';
      const price = hasPrice ? Math.max(roundPortalAmount(priceValue), 0) : 0;
      if (!name) return null;
      return {
        name,
        qty,
        price,
        hsn: ''
      };
    })
    .filter(Boolean);
}

function refreshAdminOrderItemPreview() {
  const rows = getAdminOrderItemRows();
  rows.forEach((row) => {
    const qtyInput = row.querySelector('.order-item-qty');
    const priceInput = row.querySelector('.order-item-price');
    const totalCell = row.querySelector('.order-item-line-total');
    const removeBtn = row.querySelector('.order-item-remove');
    const qty = Math.max(Math.round(Number(qtyInput?.value || 0) || 0), 1);
    const price = Math.max(roundPortalAmount(priceInput?.value || 0), 0);
    if (qtyInput) qtyInput.value = String(qty);
    if (totalCell) totalCell.textContent = formatRupees(qty * price);
    if (removeBtn) removeBtn.disabled = rows.length === 1;
  });

  const items = collectAdminOrderItemsFromRows();
  const gstPercent = Math.max(Number(document.getElementById('order-gst')?.value || 0) || 0, 0);
  const subtotal = roundPortalAmount(items.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0));
  const gstAmount = roundPortalAmount((subtotal * gstPercent) / 100);
  const total = roundPortalAmount(subtotal + gstAmount);
  const preview = document.getElementById('order-item-preview');
  if (preview) {
    preview.textContent = items.length
      ? `Subtotal ${formatRupees(subtotal)} | GST ${formatRupees(gstAmount)} | Total ${formatRupees(total)}`
      : 'Add at least one item row to calculate the order total.';
  }
}

function addAdminOrderItemRow(item = {}) {
  const container = document.getElementById('order-item-rows');
  if (!container) return null;
  const row = buildOrderItemRow(item);
  container.appendChild(row);
  refreshAdminOrderItemPreview();
  return row;
}

function resetAdminOrderItemRows(items = [{ name: '', qty: 1, price: '' }]) {
  const container = document.getElementById('order-item-rows');
  if (!container) return;
  container.innerHTML = '';
  (Array.isArray(items) && items.length ? items : [{ name: '', qty: 1, price: '' }]).forEach((item) => addAdminOrderItemRow(item));
  refreshAdminOrderItemPreview();
}

function normalizeMoneyInputValue(input) {
  if (!input) return;
  const raw = String(input.value || '').trim();
  if (!raw) return;
  input.value = roundPortalAmount(raw).toFixed(2);
}

function initAdminOrderItemBuilder() {
  const rowsWrap = document.getElementById('order-item-rows');
  if (!rowsWrap || rowsWrap.dataset.ready === 'true') return;
  rowsWrap.dataset.ready = 'true';

  document.getElementById('order-item-add')?.addEventListener('click', () => {
    const row = addAdminOrderItemRow({ qty: 1, price: '' });
    row?.querySelector('.order-item-name')?.focus();
  });

  rowsWrap.addEventListener('input', (event) => {
    if (event.target.closest('.order-item-row')) {
      refreshAdminOrderItemPreview();
    }
  });

  rowsWrap.addEventListener('change', (event) => {
    if (event.target.classList.contains('order-item-price')) {
      normalizeMoneyInputValue(event.target);
    }
    refreshAdminOrderItemPreview();
  });

  rowsWrap.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.order-item-remove');
    if (!removeBtn) return;
    const rows = getAdminOrderItemRows();
    if (rows.length === 1) {
      const onlyRow = rows[0];
      onlyRow.querySelector('.order-item-name').value = '';
      onlyRow.querySelector('.order-item-qty').value = '1';
      onlyRow.querySelector('.order-item-price').value = '';
    } else {
      removeBtn.closest('.order-item-row')?.remove();
    }
    refreshAdminOrderItemPreview();
  });

  document.getElementById('order-gst')?.addEventListener('input', refreshAdminOrderItemPreview);
  document.getElementById('order-gst')?.addEventListener('change', refreshAdminOrderItemPreview);
  document.getElementById('order-declared-value')?.addEventListener('change', (event) => normalizeMoneyInputValue(event.target));
  document.getElementById('order-declared-value')?.addEventListener('blur', (event) => normalizeMoneyInputValue(event.target));

  resetAdminOrderItemRows();
}

function nextAdminProvider() {
  const providers = ['bluedart', 'indiapost', 'delhivery', 'smartlocal'];
  const last = currentPortalState().lastAdminCourierProvider || '';
  const options = providers.filter((provider) => provider !== last);
  const next = options[Math.floor(Math.random() * options.length)] || providers[0];
  saveBusinessPortalState({ lastAdminCourierProvider: next }, { silent: true }).catch(() => {});
  return next;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Unable to read ${file?.name || 'the file'}.`));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Unable to read ${file?.name || 'the file'}.`));
    reader.readAsArrayBuffer(file);
  });
}

function downloadBlobFile(content, type, fileName) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function downloadBulkOrderSampleExcel() {
  const headers = ['customerName', 'customerPhone', 'customerEmail', 'customerAddress', 'itemName1', 'qty1', 'price1', 'itemName2', 'qty2', 'price2', 'gstPercent', 'payment', 'originPincode', 'destinationPincode', 'weightKg', 'declaredValue', 'provider', 'orderDate'];
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Arial,sans-serif;}th,td{border:1px solid #cfd8e3;padding:8px;text-align:left;}th{background:#0f1c2f;color:#fff;}</style></head><body><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody></tbody></table></body></html>`;
  downloadBlobFile(html, 'application/vnd.ms-excel;charset=utf-8', 'smartlocal_bulk_order_sample.xls');
}

function splitDelimitedLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((item) => item.trim());
}

function parseDelimitedRows(text, preferredDelimiter = '') {
  const clean = String(text || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  const lines = clean.split('\n').filter((line) => line.trim());
  const headerLine = lines[0] || '';
  const delimiter = preferredDelimiter || [',', '\t', ';'].sort((a, b) => splitDelimitedLine(headerLine, b).length - splitDelimitedLine(headerLine, a).length)[0];
  return lines.map((line) => splitDelimitedLine(line, delimiter));
}

function parseHtmlTableRows(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent.trim())).filter((row) => row.some(Boolean));
}

function parseSpreadsheetXmlRows(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const rows = Array.from(doc.getElementsByTagNameNS('*', 'Row'));
  if (!rows.length) return [];
  return rows.map((row) => {
    const cells = [];
    Array.from(row.getElementsByTagNameNS('*', 'Cell')).forEach((cell) => {
      const indexAttr = cell.getAttribute('ss:Index') || cell.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Index');
      if (indexAttr) {
        while (cells.length < Number(indexAttr) - 1) cells.push('');
      }
      const data = cell.getElementsByTagNameNS('*', 'Data')[0];
      cells.push((data?.textContent || '').trim());
    });
    return cells;
  }).filter((row) => row.some(Boolean));
}

function uint32At(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function uint16At(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

async function inflateZipEntry(bytes, entry) {
  if (entry.compression === 0) return bytes.slice(entry.dataStart, entry.dataStart + entry.compressedSize).buffer;
  if (entry.compression !== 8) throw new Error('This Excel file uses an unsupported compression method.');
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot read modern Excel files here. Please upload CSV instead.');
  }
  const stream = new Blob([bytes.slice(entry.dataStart, entry.dataStart + entry.compressedSize)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).arrayBuffer();
}

function parseZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (uint32At(bytes, offset) !== 0x06054b50) continue;
    const centralDirectoryOffset = uint32At(bytes, offset + 16);
    const totalEntries = uint16At(bytes, offset + 10);
    const entries = new Map();
    let pointer = centralDirectoryOffset;
    const decoder = new TextDecoder();
    for (let index = 0; index < totalEntries; index += 1) {
      if (uint32At(bytes, pointer) !== 0x02014b50) break;
      const compression = uint16At(bytes, pointer + 10);
      const compressedSize = uint32At(bytes, pointer + 20);
      const fileNameLength = uint16At(bytes, pointer + 28);
      const extraLength = uint16At(bytes, pointer + 30);
      const commentLength = uint16At(bytes, pointer + 32);
      const localHeaderOffset = uint32At(bytes, pointer + 42);
      const fileName = decoder.decode(bytes.slice(pointer + 46, pointer + 46 + fileNameLength));
      const localNameLength = uint16At(bytes, localHeaderOffset + 26);
      const localExtraLength = uint16At(bytes, localHeaderOffset + 28);
      entries.set(fileName, {
        compression,
        compressedSize,
        dataStart: localHeaderOffset + 30 + localNameLength + localExtraLength
      });
      pointer += 46 + fileNameLength + extraLength + commentLength;
    }
    return { bytes, entries };
  }
  throw new Error('Unable to open the Excel workbook.');
}

function getCellColumnIndex(reference) {
  const letters = String(reference || '').replace(/[^A-Z]/gi, '').toUpperCase();
  return Array.from(letters).reduce((sum, char) => (sum * 26) + char.charCodeAt(0) - 64, 0) - 1;
}

async function parseXlsxRows(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const { bytes, entries } = parseZipEntries(arrayBuffer);
  const decoder = new TextDecoder();
  const readEntryText = async (name) => {
    const entry = entries.get(name);
    if (!entry) return '';
    const buffer = await inflateZipEntry(bytes, entry);
    return decoder.decode(buffer);
  };
  const workbookXml = await readEntryText('xl/workbook.xml');
  const relsXml = await readEntryText('xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relsXml) throw new Error('Workbook structure is incomplete.');
  const parser = new DOMParser();
  const workbookDoc = parser.parseFromString(workbookXml, 'application/xml');
  const relsDoc = parser.parseFromString(relsXml, 'application/xml');
  const firstSheet = workbookDoc.getElementsByTagNameNS('*', 'sheet')[0];
  const firstRelationId = firstSheet?.getAttribute('r:id') || firstSheet?.getAttribute('id');
  const relations = Array.from(relsDoc.getElementsByTagNameNS('*', 'Relationship'));
  const target = relations.find((relation) => relation.getAttribute('Id') === firstRelationId)?.getAttribute('Target');
  const worksheetPath = target ? `xl/${target.replace(/^\/?xl\//, '')}` : 'xl/worksheets/sheet1.xml';
  const sharedStringsXml = await readEntryText('xl/sharedStrings.xml');
  const worksheetXml = await readEntryText(worksheetPath);
  if (!worksheetXml) throw new Error('Worksheet data could not be read.');

  const sharedStrings = sharedStringsXml
    ? Array.from(parser.parseFromString(sharedStringsXml, 'application/xml').getElementsByTagNameNS('*', 'si')).map((item) => Array.from(item.getElementsByTagNameNS('*', 't')).map((node) => node.textContent || '').join(''))
    : [];
  const worksheetDoc = parser.parseFromString(worksheetXml, 'application/xml');
  return Array.from(worksheetDoc.getElementsByTagNameNS('*', 'row')).map((row) => {
    const cells = [];
    Array.from(row.getElementsByTagNameNS('*', 'c')).forEach((cell) => {
      const index = getCellColumnIndex(cell.getAttribute('r'));
      while (cells.length < index) cells.push('');
      const type = cell.getAttribute('t');
      const valueNode = cell.getElementsByTagNameNS('*', 'v')[0];
      const inlineNode = cell.getElementsByTagNameNS('*', 't')[0];
      let value = valueNode?.textContent || inlineNode?.textContent || '';
      if (type === 's') value = sharedStrings[Number(value)] || '';
      cells[index] = String(value).trim();
    });
    return cells;
  }).filter((row) => row.some(Boolean));
}

function normalizeBulkHeader(header) {
  const clean = String(header || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const itemNameMatch = clean.match(/^(?:item|itemname|product|productname|productitem|service|servicename)(\d+)$/);
  if (itemNameMatch) return `itemName${itemNameMatch[1]}`;
  const itemQtyMatch = clean.match(/^(?:qty|quantity|itemqty|productqty|units?)(\d+)$/);
  if (itemQtyMatch) return `qty${itemQtyMatch[1]}`;
  const itemPriceMatch = clean.match(/^(?:price|rate|unitprice|sellingprice|itemprice|productprice|mrp|unitrate)(\d+)$/);
  if (itemPriceMatch) return `price${itemPriceMatch[1]}`;
  const itemHsnMatch = clean.match(/^(?:hsn|itemhsn|producthsn)(\d+)$/);
  if (itemHsnMatch) return `hsn${itemHsnMatch[1]}`;
  const map = {
    orderid: 'orderId',
    ordernumber: 'orderId',
    customername: 'customerName',
    name: 'customerName',
    customer: 'customerName',
    partyname: 'customerName',
    customerphone: 'customerPhone',
    phone: 'customerPhone',
    mobile: 'customerPhone',
    phoneno: 'customerPhone',
    phonenumber: 'customerPhone',
    mobileno: 'customerPhone',
    mobilenumber: 'customerPhone',
    contactnumber: 'customerPhone',
    customercontact: 'customerPhone',
    customeremail: 'customerEmail',
    email: 'customerEmail',
    customeraddress: 'customerAddress',
    address: 'customerAddress',
    addressline1: 'customerAddress',
    deliveryaddress: 'customerAddress',
    customerlocation: 'customerAddress',
    items: 'items',
    orderitems: 'items',
    itemlist: 'items',
    productlist: 'items',
    item: 'itemName',
    itemname: 'itemName',
    product: 'itemName',
    productname: 'itemName',
    servicename: 'itemName',
    serviceitem: 'itemName',
    qty: 'qty',
    quantity: 'qty',
    units: 'qty',
    unit: 'qty',
    itemqty: 'qty',
    price: 'price',
    rate: 'price',
    unitprice: 'price',
    sellingprice: 'price',
    itemprice: 'price',
    productprice: 'price',
    mrp: 'price',
    unitrate: 'price',
    hsn: 'hsn',
    gst: 'gstPercent',
    gstpercent: 'gstPercent',
    gstrate: 'gstPercent',
    payment: 'payment',
    paymentmode: 'payment',
    paymenttype: 'payment',
    originpincode: 'originPincode',
    pickuppincode: 'originPincode',
    pickupincode: 'originPincode',
    pickup: 'originPincode',
    originpin: 'originPincode',
    frompincode: 'originPincode',
    destinationpincode: 'destinationPincode',
    deliverypincode: 'destinationPincode',
    deliverypin: 'destinationPincode',
    destinationpin: 'destinationPincode',
    destination: 'destinationPincode',
    topincode: 'destinationPincode',
    weight: 'weightKg',
    weightkg: 'weightKg',
    shipmentweight: 'weightKg',
    weightinkg: 'weightKg',
    declaredvalue: 'declaredValue',
    value: 'declaredValue',
    ordervalue: 'declaredValue',
    shipmentvalue: 'declaredValue',
    declaredamount: 'declaredValue',
    provider: 'provider',
    courierprovider: 'provider',
    orderdate: 'orderDate',
    date: 'orderDate'
  };
  return map[clean] || header;
}

function rowsToBulkObjects(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = rows[0].map(normalizeBulkHeader);
  return rows.slice(1).map((row) => headers.reduce((acc, header, index) => {
    if (!header) return acc;
    acc[header] = String(row[index] || '').trim();
    return acc;
  }, {})).filter((row) => Object.values(row).some(Boolean));
}

function buildBulkItemsFromRow(row = {}) {
  const directItems = parseAdminOrderItems(row.items || row.orderItems || row.itemList || row.productList || '');
  if (directItems.length) return directItems;

  const groups = new Map();
  const ensureGroup = (key) => {
    if (!groups.has(key)) {
      groups.set(key, { name: '', qty: '', price: '', hsn: '' });
    }
    return groups.get(key);
  };

  const seedPrimary = ensureGroup('1');
  seedPrimary.name = String(row.itemName || row.productName || row.item || row.product || '').trim();
  seedPrimary.qty = String(row.qty || row.quantity || row.units || row.unit || '').trim();
  seedPrimary.price = String(row.price || row.rate || row.unitPrice || row.itemPrice || '').trim();
  seedPrimary.hsn = String(row.hsn || '').trim();

  Object.entries(row || {}).forEach(([key, value]) => {
    const textValue = String(value || '').trim();
    if (!textValue) return;
    let match = key.match(/^itemName(\d+)$/i) || key.match(/^productName(\d+)$/i) || key.match(/^item(\d+)$/i) || key.match(/^product(\d+)$/i);
    if (match) {
      ensureGroup(match[1]).name = textValue;
      return;
    }
    match = key.match(/^qty(\d+)$/i) || key.match(/^quantity(\d+)$/i) || key.match(/^units?(\d+)$/i);
    if (match) {
      ensureGroup(match[1]).qty = textValue;
      return;
    }
    match = key.match(/^price(\d+)$/i) || key.match(/^rate(\d+)$/i) || key.match(/^unitPrice(\d+)$/i) || key.match(/^itemPrice(\d+)$/i);
    if (match) {
      ensureGroup(match[1]).price = textValue;
      return;
    }
    match = key.match(/^hsn(\d+)$/i);
    if (match) {
      ensureGroup(match[1]).hsn = textValue;
    }
  });

  return Array.from(groups.entries())
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map(([, item]) => ({
      name: String(item.name || '').trim(),
      qty: Math.max(Math.round(Number(item.qty || 0) || 0), 0),
      price: Math.max(roundPortalAmount(item.price || 0), 0),
      hsn: String(item.hsn || '').trim()
    }))
    .filter((item) => item.name && item.qty > 0);
}

function normalizeBulkProvider(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('blue')) return 'bluedart';
  if (text.includes('india')) return 'indiapost';
  if (text.includes('del')) return 'delhivery';
  if (text.includes('smart')) return 'smartlocal';
  return '';
}

function parseBulkOrderDate(value) {
  const clean = String(value || '').trim();
  if (!clean) return new Date().toISOString();
  const date = new Date(clean.replace(/\./g, '-'));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function buildBulkOrderPayload(row, rowIndex, currentUser) {
  const items = buildBulkItemsFromRow(row);
  if (!items.length) throw new Error('items are missing or invalid. Use items column or itemName/qty/price columns');
  const customerName = String(row.customerName || '').trim();
  const customerPhone = String(row.customerPhone || '').trim();
  const customerAddress = String(row.customerAddress || '').trim();
  const originPincode = String(row.originPincode || '').trim();
  const destinationPincode = String(row.destinationPincode || '').trim();
  const weight = Number(row.weightKg || 0) || 0;
  if (!customerName || !customerPhone || !customerAddress || !originPincode || !destinationPincode || !(weight > 0)) {
    throw new Error('customer, address, pincode, or weight columns are incomplete');
  }
  const gstPercent = Number(row.gstPercent || 18) || 18;
  const subtotal = roundPortalAmount(items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0));
  const gstAmount = roundPortalAmount((subtotal * gstPercent) / 100);
  const total = roundPortalAmount(subtotal + gstAmount);
  return {
    orderId: String(row.orderId || randomOrderId()).trim(),
    customer: {
      name: customerName,
      phone: customerPhone,
      email: String(row.customerEmail || '').trim(),
      address: customerAddress
    },
    items,
    gstPercent,
    gstAmount,
    subtotal,
    total,
    amount: total,
    payment: String(row.payment || 'UPI').trim() || 'UPI',
    status: 'In Progress',
    date: parseBulkOrderDate(row.orderDate),
    businessUserId: currentUser.userid,
    businessName: currentUser.business?.name || currentUser.name || '',
    gstNo: currentUser.business?.gst || '',
    warrantyExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-IN'),
    source: 'bulk-upload',
    courier: {
      provider: normalizeBulkProvider(row.provider),
      originPincode,
      destinationPincode,
      service: 'standard',
      status: 'Pending Dispatch',
      weight,
      value: roundPortalAmount(row.declaredValue || 0) || total,
      description: `Bulk upload row ${rowIndex + 2} shipment for ${customerName}`
    }
  };
}

async function parseBulkUploadFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.xlsx')) return parseXlsxRows(file);
  const text = await readFileAsText(file);
  if (name.endsWith('.xml')) return parseSpreadsheetXmlRows(text);
  if (name.endsWith('.xls')) {
    if (/<table/i.test(text)) return parseHtmlTableRows(text);
    if (/<workbook/i.test(text)) return parseSpreadsheetXmlRows(text);
    return parseDelimitedRows(text, '\t');
  }
  if (name.endsWith('.tsv')) return parseDelimitedRows(text, '\t');
  return parseDelimitedRows(text);
}

async function handleBulkOrderUpload() {
  const currentUser = currentBusinessUser();
  if (!currentUser?.userid) {
    showToast('Please log in before uploading bulk orders.', 'error');
    return;
  }
  const settings = currentBusinessSettings();
  updateOrderCutoffNote(settings);
  if (isAfterBookingCutoff(settings)) {
    showToast(`Cutoff ${formatCutoffLabel(settings.bookingCutoff)} has passed. Bulk upload is locked.`, 'error');
    return;
  }
  const input = document.getElementById('bulk-order-file');
  const status = document.getElementById('bulk-order-status');
  const file = input?.files?.[0];
  if (!file) {
    showToast('Choose a CSV or Excel file first.', 'error');
    return;
  }

  try {
    if (status) status.textContent = `Reading ${file.name}...`;
    const rows = await parseBulkUploadFile(file);
    const objects = rowsToBulkObjects(rows);
    if (!objects.length) {
      throw new Error('No order rows were found in the uploaded file.');
    }
    const orders = [];
    const localFailures = [];
    objects.forEach((row, index) => {
      try {
        orders.push(buildBulkOrderPayload(row, index, currentUser));
      } catch (error) {
        localFailures.push(`Row ${index + 2}: ${error.message}`);
      }
    });
    if (!orders.length) {
      throw new Error(localFailures[0] || 'No valid orders were found in the uploaded file.');
    }

    if (status) status.textContent = `Uploading ${orders.length} orders to the server...`;
    const response = await fetch('/api/orders/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessUserId: currentUser.userid,
        orders
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Bulk upload failed.');
    }

    (Array.isArray(data.created) ? data.created : []).forEach((record) => {
      upsertLocalCollection('orders', 'orderId', normalizeDashboardOrder(record), 200);
    });

    await refreshCommandCenterData({ silent: true, source: 'bulk-upload' });
    const failedMessages = [
      ...localFailures,
      ...(Array.isArray(data.failed) ? data.failed.map((item) => `Row ${item.row}: ${item.error}`) : [])
    ].slice(0, 5);

    if (status) {
      status.innerHTML = `${data.createdCount || 0} orders uploaded successfully. ${data.failedCount || 0} server-side failures.${failedMessages.length ? `<br>${failedMessages.map((line) => escapeHtml(line)).join('<br>')}` : ''}`;
    }
    if (input) input.value = '';
    showToast(`Bulk upload finished. ${data.createdCount || 0} orders are now In Progress and queued for dispatch.`, 'success');
  } catch (error) {
    if (status) status.textContent = error.message || 'Bulk upload failed.';
    showToast(error.message || 'Bulk upload failed.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  restoreAdminUiText();
  updateNavAuthButton();
  renderSegmentPlanControls();
  initAdminSettingsInputLocks();
  initPortfolioInputLocks();
  loadDashboardIfAvailable();
  initAdminOrderItemBuilder();
  ensureTabExportBars();
  document.getElementById('order-form')?.addEventListener('submit', handleAdminOrderSubmit);
  document.getElementById('inventory-form')?.addEventListener('submit', handleInventorySubmit);
  document.getElementById('portfolio-form')?.addEventListener('submit', handlePortfolioSubmit);
  document.getElementById('portfolio-withdraw')?.addEventListener('click', () => handlePortfolioWithdraw('full'));
  document.getElementById('portfolio-withdraw-partial')?.addEventListener('click', () => handlePortfolioWithdraw('partial'));
  document.getElementById('complaint-form')?.addEventListener('submit', handleAdminComplaintSubmit);
  document.getElementById('bulk-order-sample-btn')?.addEventListener('click', downloadBulkOrderSampleExcel);
  document.getElementById('bulk-order-upload-btn')?.addEventListener('click', handleBulkOrderUpload);
  document.getElementById('statement-export-pdf')?.addEventListener('click', () => handleStatementExport('pdf'));
  document.getElementById('statement-export-excel')?.addEventListener('click', () => handleStatementExport('excel'));
  document.getElementById('statement-export-csv')?.addEventListener('click', () => handleStatementExport('csv'));
  document.getElementById('inventory-table')?.addEventListener('click', handleInventoryTableClick);
  document.getElementById('courier-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('.courier-deliver-btn');
    if (!button) return;
    markCourierDelivered(button.dataset.awb);
  });
  document.addEventListener('click', (event) => {
    const exportButton = event.target.closest('.admin-export-btn');
    if (!exportButton) return;
    const tabName = exportButton.dataset.tab;
    if (exportButton.dataset.format === 'pdf') exportTabPdf(tabName);
    else exportTabCsv(tabName);
  });
  ['order-search', 'order-status-filter', 'order-date-from', 'order-date-to'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => renderOrdersTable());
    document.getElementById(id)?.addEventListener('change', () => renderOrdersTable());
  });
  document.getElementById('order-sync-btn')?.addEventListener('click', () => refreshCommandCenterData({ silent: false, source: 'order-sync' }));
  document.getElementById('order-export-btn')?.addEventListener('click', () => exportTabCsv('orders'));
  renderComplaintTable();
  renderComplaintStats();
  loadCourierRateSettings();
  renderInventoryTable();
  renderAnalyticsDashboard(getLocalOrders(), getLocalInventory());
  renderCourierGraph('all');
  renderCourierProviderChart();
  renderRevenuePieChart(getLocalOrders());
  renderBankSettlementPieChart(getLocalOrders());
  renderBookingsPieChart(getLocalOrders());
  renderOrdersPaymentPieChart(getLocalOrders());
  renderInventoryPieChart(getLocalInventory());
  renderCustomerTypePieChart(customerPieSource);
  initCourierProviderDropdown();
  document.getElementById('courier-rate-save')?.addEventListener('click', saveCourierRateSettings);
  updateOrderCutoffNote(currentBusinessSettings());
  startPortfolioTicker();
  updateMarketClock();
  if (portfolioClockTimer) clearInterval(portfolioClockTimer);
  portfolioClockTimer = setInterval(() => updateMarketClock(), 1000);
  window.addEventListener('smartlocal:plan-updated', (event) => {
    renderSegmentPlanControls(event.detail || getSafeCurrentUser());
  });
  window.addEventListener('resize', () => {
    if (chartResizeTimer) clearTimeout(chartResizeTimer);
    chartResizeTimer = setTimeout(() => {
      const orders = getLocalOrders();
      const inventory = getLocalInventory();
      if (portfolioLiveState) {
        drawPortfolioGraph(
          portfolioLiveState.points,
          portfolioLiveState.trend,
          portfolioLiveState.amountInvested,
          portfolioLiveState.currentValue
        );
      }
      renderBookingsTab(orders);
      renderOrdersTable(orders);
      renderInventoryTable(inventory);
      renderComplaintStats();
      renderCourierGraph(document.getElementById('courier-chart-filter')?.value || 'all');
      renderCourierProviderChart();
      renderAnalyticsDashboard(orders, inventory);
      renderRevenuePieChart(orders);
      renderBankSettlementPieChart(orders);
      renderCustomerTypePieChart(customerPieSource);
    }, 120);
  });
  if (adminLiveSyncTimer) clearInterval(adminLiveSyncTimer);
  adminLiveSyncTimer = setInterval(() => {
    const dashboard = document.getElementById('dashboard-section');
    if (document.hidden) return;
    if (dashboard && dashboard.style.display !== 'none') {
      refreshCommandCenterData({ silent: true, source: 'interval-1s', refreshRates: false, syncPortalState: true });
      restoreAdminUiText();
    }
  }, LIVE_MONGO_SYNC_MS);
});
