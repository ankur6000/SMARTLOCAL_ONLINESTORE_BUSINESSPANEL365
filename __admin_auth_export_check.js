
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

document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const userid = document.getElementById('login-userid').value;
  const password = document.getElementById('login-password').value;
  const captchaInput = document.getElementById('captcha-input').value;
  const captchaDisplay = document.getElementById('captcha-display').textContent;
  // Check CAPTCHA
  if (captchaInput.toUpperCase() !== captchaDisplay) {
    showToast('Invalid security code! Please try again.', 'error');
    generateCaptcha(); // Generate new CAPTCHA
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userid, password })
    });
    if (!response.ok) {
      throw new Error('invalid');
    }
    const data = await response.json();
    const user = data?.user;
    if (!user) throw new Error('invalid');

    localStorage.setItem('currentUser', JSON.stringify(user));
    applyBusinessSettings(user.settings || {}, { silent: true });

    const rememberBox = document.getElementById('remember-login');
    if (rememberBox?.checked) {
      localStorage.setItem('rememberLogin', JSON.stringify({ userid }));
    } else {
      localStorage.removeItem('rememberLogin');
    }

    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    updateNavAuthButton();
    const welcomeName = user.business?.name || user.name || 'Business Owner';
    showToast(`Welcome back, ${welcomeName}!`, 'success');
    if (typeof playLoginTone === 'function') playLoginTone();
    await updateDashboard();
    await refreshCommandCenterData({ silent: true, source: 'login' });
    startPortfolioTicker();
  } catch (err) {
    showToast('Invalid credentials! Please use the User ID and Password from Business Registration.', 'error');
    generateCaptcha(); // Generate new CAPTCHA on failed login
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
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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

function applyBusinessSettings(settingsInput = {}, options = {}) {
  const settings = normalizeBusinessSettings(settingsInput);
  const cutoffEl = document.getElementById('booking-cutoff');
  const cutoffInput = document.getElementById('admin-booking-cutoff-input');
  const languageSelect = document.getElementById('admin-robert-language-setting');
  const statusEl = document.getElementById('admin-settings-status');

  if (cutoffEl) cutoffEl.textContent = formatCutoffLabel(settings.bookingCutoff);
  if (cutoffInput) cutoffInput.value = settings.bookingCutoff;
  if (languageSelect) languageSelect.value = settings.rovertLanguage;
  if (!options.silent && statusEl) {
    statusEl.textContent = `Cutoff ${formatCutoffLabel(settings.bookingCutoff)} and Robert language ${ROBERT_LANGUAGE_LABELS[settings.rovertLanguage]} are active.`;
  }

  localStorage.setItem('rovertLanguage', settings.rovertLanguage);
  localStorage.setItem('smartlocalBusinessSettings', JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('smartlocal:robert-settings', { detail: settings }));
  return settings;
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

    const updatedUser = { ...currentUser, ...data.user, settings: normalizeBusinessSettings(data.user.settings) };
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
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

function normalizeDashboardOrder(order) {
  return {
    ...order,
    amount: Number(order?.amount ?? order?.total ?? 0) || 0,
    status: order?.status || 'Placed',
    payment: order?.payment || '-',
    date: order?.date || new Date().toISOString()
  };
}

async function fetchDashboardOrders(limit = 50) {
  const currentUser = getSafeCurrentUser();
  const userQuery = currentUser?.userid ? `&userid=${encodeURIComponent(currentUser.userid)}` : '';

  try {
    const response = await fetch(`/api/orders?limit=${limit}${userQuery}`);
    if (!response.ok) throw new Error('orders');
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items.map(normalizeDashboardOrder) : [];
    localStorage.setItem('orders', JSON.stringify(items));
    return items;
  } catch (error) {
    const stored = JSON.parse(localStorage.getItem('orders') || '[]');
    return Array.isArray(stored) ? stored.map(normalizeDashboardOrder) : [];
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
    localStorage.setItem(storageKey, JSON.stringify(items));
    return items;
  } catch (error) {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(stored) ? stored : [];
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

function renderOverviewLiveFeed(orders) {
  const feed = document.getElementById('dashboard-live-feed');
  if (!feed) return;
  const courierOrders = JSON.parse(localStorage.getItem('courierOrders')) || [];
  const complaints = JSON.parse(localStorage.getItem('complaints')) || [];
  const events = [
    ...orders.slice(-3).reverse().map(order => `Order ${order.orderId} for ${formatRupees(order.amount)} is ${order.status}`),
    ...courierOrders.slice(0, 2).map(order => `AWB ${order.awb} ${order.status}`),
    ...complaints.slice(0, 2).map(item => `Complaint ${item.id || 'NEW'} is ${item.status || 'Open'}`)
  ].filter(Boolean).slice(0, 6);
  feed.innerHTML = events.length ? events.map(event => `<li class="activity-feed-item">${event}</li>`).join('') : '<li class="activity-feed-item">No live events yet.</li>';
}

function renderBookingsTab(orders) {
  const tbody = document.querySelector('#bookings-table tbody');
  const pendingCount = orders.filter(order => order.status !== 'Completed').length;
  document.getElementById('booking-total-count').textContent = orders.length;
  document.getElementById('booking-pending-count').textContent = pendingCount;
  if (!tbody) return;
  tbody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.orderId}</td>
      <td>${order.date}</td>
      <td>${formatRupees(order.amount)}</td>
      <td class="${order.status.toLowerCase()}">${order.status}</td>
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

async function renderCustomersTab() {
  const tbody = document.querySelector('#customers-table tbody');
  const remote = await fetchRegistrations(100);
  if (remote && Array.isArray(remote.items)) {
    const count = remote.total || remote.items.length;
    document.getElementById('customer-count').textContent = count;
    document.getElementById('customer-growth').textContent = count > 20 ? '+12%' : '+0%';
    document.getElementById('returning-customers').textContent = Math.round(count * 0.68) || 0;
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

  const users = JSON.parse(localStorage.getItem('users')) || [];
  const count = users.length;
  document.getElementById('customer-count').textContent = count;
  document.getElementById('customer-growth').textContent = count > 20 ? '+12%' : '+0%';
  document.getElementById('returning-customers').textContent = Math.round(count * 0.68) || 0;
  if (!tbody) return;
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.name || 'N/A'}</td>
      <td>${user.email || '-'}</td>
      <td>${user.business?.name || 'N/A'}</td>
      <td>${user.business?.type || 'N/A'}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">No registered customers yet.</td></tr>';
}

function renderCourierSummary() {
  const courierOrders = JSON.parse(localStorage.getItem('courierOrders')) || [];
  const count = courierOrders.length;
  const active = courierOrders.filter(order => order.status !== 'Delivered').length;
  const label = document.getElementById('courier-active-count');
  if (label) label.textContent = count || 0;
  document.getElementById('live-pickups').textContent = active || 0;
}

function renderRevenueSummary(totalRevenue) {
  const revenueTotal = document.getElementById('revenue-total');
  const revenueMom = document.getElementById('revenue-mom');
  if (revenueTotal) revenueTotal.textContent = formatRupees(totalRevenue);
  if (revenueMom) revenueMom.textContent = totalRevenue > 50000 ? '+18%' : '+6%';
}

async function getOverviewCustomerCount() {
  const remote = await fetchRegistrations(100);
  if (remote && Array.isArray(remote.items)) {
    return remote.total || remote.items.length || 0;
  }
  const users = JSON.parse(localStorage.getItem('users')) || [];
  return users.length;
}

async function syncOverviewPortal(orders, totalRevenue, totalOrders, yearOrders, averageOrder, currentUser, planLabel) {
  const courierOrders = JSON.parse(localStorage.getItem('courierOrders')) || [];
  const complaints = JSON.parse(localStorage.getItem('complaints')) || [];
  const customers = await getOverviewCustomerCount();
  const portfolioItems = await fetchPortfolioInvestments(1);
  const latestPortfolio = Array.isArray(portfolioItems) && portfolioItems.length ? portfolioItems[0] : null;
  let fallbackAwb = 'N/A';
  try {
    const storedAwb = localStorage.getItem('lastAWB');
    fallbackAwb = storedAwb ? JSON.parse(storedAwb) : 'N/A';
  } catch (error) {
    fallbackAwb = localStorage.getItem('lastAWB') || 'N/A';
  }
  const latestAwb = courierOrders[0]?.awb || fallbackAwb || 'N/A';
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
    overviewCopy.textContent = `${businessName} overview is synchronized with ${totalOrders} orders, ${courierOrders.length} courier bookings, ${complaints.length} complaints, ${customers} customers, and a ${marketReturn.toFixed(1)}% market return snapshot.`;
  }

  if (dashboardMeta) {
    dashboardMeta.textContent = `Plan: ${planLabel} | Customers: ${customers} | Latest AWB: ${latestAwb} | Updated: ${new Date().toLocaleTimeString()}`;
  }

  if (commandCenterMeta) {
    commandCenterMeta.textContent = `Last updated: ${new Date().toLocaleTimeString()} | Revenue ${formatRupees(totalRevenue)} | Yearly sales ${yearOrders}`;
  }

  renderOverviewLiveFeed(orders);
}

async function updateLiveRevenueRates(totalRevenue) {
  const usd = document.getElementById('live-usd');
  const gbp = document.getElementById('live-gbp');
  const eur = document.getElementById('live-eur');
  const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
  try {
    const response = await fetch('https://api.exchangerate.host/latest?base=INR&symbols=USD,GBP,EUR');
    const data = await response.json();
    const rates = data.rates;
    usd.textContent = (totalRevenue * rates.USD).toFixed(2);
    gbp.textContent = (totalRevenue * rates.GBP).toFixed(2);
    eur.textContent = (totalRevenue * rates.EUR).toFixed(2);
    const planInfo = getRegisteredPlanPresentation(currentUser);
    const dashboardMeta = document.getElementById('dashboard-meta');
    if (dashboardMeta && !dashboardMeta.textContent.includes(`Plan: ${planInfo.label}`)) {
      dashboardMeta.textContent = `Plan: ${planInfo.label} | Updated: ${new Date().toLocaleTimeString()}`;
    }
  } catch (err) {
    console.error('Currency update failed', err);
    usd.textContent = 'N/A';
    gbp.textContent = 'N/A';
    eur.textContent = 'N/A';
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

function updateMarketClock(dateValue = new Date()) {
  const dateTimeEl = document.getElementById('market-current-datetime');
  if (dateTimeEl) {
    dateTimeEl.textContent = `Current date and time: ${formatMarketDateTime(dateValue)}`;
  }
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
  if (safeAmount >= 10000000) return `?${(safeAmount / 10000000).toFixed(1)}Cr`;
  if (safeAmount >= 100000) return `?${(safeAmount / 100000).toFixed(1)}L`;
  if (safeAmount >= 1000) return `?${(safeAmount / 1000).toFixed(1)}K`;
  return formatRupees(safeAmount);
}

function generatePortfolioGraphPoints(amount, endValue = null, pointCount = 30) {
  const { invested, floor, ceiling } = getPortfolioBounds(amount);
  if (invested <= 0) return [];
  const points = [invested];
  let current = invested;
  for (let i = 1; i < pointCount; i += 1) {
    const direction = Math.random() > 0.5 ? 1 : -1;
    const volatility = 0.025 + Math.random() * 0.09;
    current = Math.min(ceiling, Math.max(floor, current * (1 + direction * volatility)));
    points.push(Math.round(current));
  }
  if (endValue !== null && Number.isFinite(Number(endValue))) {
    points[points.length - 1] = clampPortfolioValue(endValue, invested);
  }
  return points;
}

function normalizePortfolioRecord(record = {}) {
  const invested = Math.max(Number(record.amountInvested) || 0, 0);
  const currentValue = invested > 0 ? clampPortfolioValue(record.currentValue ?? invested, invested) : 0;
  const profitLoss = currentValue - invested;
  const returnPercent = invested > 0 ? Number((((currentValue - invested) / invested) * 100).toFixed(1)) : 0;
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
    businessName: record.businessName || ''
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
    ctx.fillText('Add an investment to start the live market simulation.', padding.left, padding.top - 2);
    ctx.font = "700 20px Rajdhani";
    ctx.fillStyle = 'rgba(103,227,255,0.92)';
    ctx.fillText('No investment recorded yet', padding.left, (height / 2) - 8);
    ctx.font = "600 14px Rajdhani";
    ctx.fillStyle = 'rgba(186, 208, 232, 0.88)';
    ctx.fillText('Current value, profit/loss, and the chart will appear after the first investment.', padding.left, (height / 2) + 20);
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
    return Array.isArray(data.items) ? data.items : [];
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
  const items = await fetchPortfolioInvestments(1);
  return Array.isArray(items) && items.length ? items[0] : null;
}

function buildEmptyPortfolioState() {
  return normalizePortfolioRecord({
    portfolioName: 'SmartLocal Live Market',
    amountInvested: 0,
    currentValue: 0,
    trend: 'profit',
    lastUpdatedAt: new Date().toISOString(),
    points: []
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
  const boardTitleEl = document.getElementById('portfolio-chart-title');
  const boardCurrentEl = document.getElementById('market-current-board');
  const boardChangeEl = document.getElementById('market-board-change');
  const marketModeEl = document.getElementById('market-mode-live');
  const lastUpdatedText = formatMarketDateTime(normalizedRecord.lastUpdatedAt || new Date());
  const trendClass = isEmpty ? 'blue' : (normalizedRecord.trend === 'loss' ? 'red' : 'green');
  const liveColor = isEmpty ? '#9fdcff' : (normalizedRecord.trend === 'loss' ? '#ffb0bb' : '#86ffd0');

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
    boardChangeEl.textContent = `${formatSignedRupees(normalizedRecord.profitLoss || 0)} | ${Number(normalizedRecord.returnPercent || 0).toFixed(1)}%`;
    boardChangeEl.style.color = liveColor;
  }
  if (marketModeEl) {
    marketModeEl.textContent = isEmpty ? 'Waiting for Investment' : (normalizedRecord.trend === 'loss' ? 'Red Wave' : 'Green Wave');
    marketModeEl.style.color = liveColor;
  }
  if (asOfLiveEl) asOfLiveEl.textContent = lastUpdatedText;
  if (statusPill) {
    statusPill.textContent = isEmpty ? 'NO INVESTMENT' : (normalizedRecord.trend === 'loss' ? 'LIVE LOSS' : 'LIVE PROFIT');
    statusPill.className = `market-status-pill ${isEmpty ? 'flat' : (normalizedRecord.trend === 'loss' ? 'loss' : 'profit')}`;
  }
  if (liveBadge) {
    liveBadge.textContent = isEmpty ? 'Ready / Live' : (normalizedRecord.trend === 'loss' ? 'Loss / Live' : 'Profit / Live');
    liveBadge.className = `badge-sm ${isEmpty ? '' : (normalizedRecord.trend === 'loss' ? 'loss-badge' : 'profit-badge')}`;
  }
  if (noteEl) {
    const movement = isEmpty
      ? 'No investment has been recorded yet, so the board is waiting for the first live amount.'
      : normalizedRecord.trend === 'loss'
        ? 'Market is currently showing a red loss phase.'
        : 'Market is currently showing a green profit phase.';
    noteEl.textContent = `${normalizedRecord.portfolioName || 'Portfolio'} updated on ${lastUpdatedText}. ${movement} Invested value, current value, profit/loss, and the graph are synced live every 6 seconds. Maximum return remains capped at 500%.`;
  }
  updateMarketClock();
  drawPortfolioGraph(
    normalizedRecord.points || [],
    normalizedRecord.trend || 'profit',
    normalizedRecord.amountInvested || 0,
    normalizedRecord.currentValue || 0
  );
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
    if (linkedRecord.profitLoss > 0) {
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

  if (overviewCopy && linkedRecord.profitLoss > 0) {
    overviewCopy.textContent = `${linkedRecord.portfolioName || 'Market portfolio'} is in profit and the live portfolio gain of ${formatRupees(linkedRecord.profitLoss)} is now linked into the revenue overview.`;
  }
}

async function loadPortfolioDashboard() {
  await syncLatestPortfolioFromMongo();
}

async function handlePortfolioSubmit(event) {
  event.preventDefault();
  const amount = parseFloat(document.getElementById('portfolio-investment')?.value || '0');
  const portfolioName = document.getElementById('portfolio-name')?.value.trim() || 'SmartLocal Growth';
  if (!amount || amount <= 0) {
    showToast('Enter a valid investment amount in rupees.', 'error');
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
  const points = generatePortfolioGraphPoints(amount);
  const currentValue = points[points.length - 1];
  const rawRecord = {
    investmentId: `INV-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`,
    portfolioName,
    amountInvested: Math.round(amount),
    currentValue,
    points,
    lastUpdatedAt: new Date().toISOString(),
    businessUserId: currentUser?.userid || '',
    businessName: currentUser?.business?.name || currentUser?.name || ''
  };
  const record = normalizePortfolioRecord(rawRecord);

  try {
    const savedRecord = await savePortfolioInvestment(record);
    updatePortfolioSummary(savedRecord);
    startPortfolioTicker();
    document.getElementById('portfolio-form')?.reset();
    showToast('Investment saved to MongoDB and portfolio graph updated.', 'success');
  } catch (error) {
    showToast(error.message || 'Could not save investment.', 'error');
  }
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

async function updateDashboard() {
  const currentUser = getSafeCurrentUser() || {};
  const orders = await fetchDashboardOrders(200);
  await fetchDashboardCollection('/api/couriers', 'courierOrders', 200);
  await fetchDashboardCollection('/api/complaints', 'complaints', 200);
  const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
  const totalOrders = orders.length;
  const year = new Date().getFullYear();
  const yearOrders = orders.filter(order => new Date(order.date).getFullYear() === year).length;
  const averageOrder = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
  const completedOrders = orders.filter(order => order.status === 'Completed').length;

  if (document.getElementById('summary-orders')) document.getElementById('summary-orders').textContent = totalOrders;
  if (document.getElementById('summary-year-transactions')) document.getElementById('summary-year-transactions').textContent = yearOrders;
  if (document.getElementById('summary-revenue')) document.getElementById('summary-revenue').textContent = formatRupees(totalRevenue);
  if (document.getElementById('summary-average-order')) document.getElementById('summary-average-order').textContent = formatRupees(averageOrder);
  if (document.getElementById('order-growth')) document.getElementById('order-growth').textContent = `${Math.round((totalOrders / Math.max(totalOrders - 1, 1)) * 100)}%`;
  if (document.getElementById('revenue-growth')) document.getElementById('revenue-growth').textContent = `${Math.round((totalRevenue / Math.max(totalRevenue - 10000, 1)) * 100)}%`;
  if (document.getElementById('transaction-growth')) document.getElementById('transaction-growth').textContent = `${Math.round((yearOrders / Math.max(yearOrders - 2, 1)) * 100)}%`;
  if (document.getElementById('aov-growth')) document.getElementById('aov-growth').textContent = `${Math.round((averageOrder / Math.max(averageOrder - 500, 1)) * 100)}%`;
  if (document.getElementById('order-trend')) document.getElementById('order-trend').textContent = `${completedOrders} completed orders this month`;
  if (document.getElementById('revenue-trend')) document.getElementById('revenue-trend').textContent = `${formatRupees(Math.max(totalRevenue - 82000, 0))} change since last period`;
  if (document.getElementById('transaction-trend')) document.getElementById('transaction-trend').textContent = `${yearOrders} transactions this year`;
  if (document.getElementById('aov-trend')) document.getElementById('aov-trend').textContent = 'Average basket value';

  const businessName = currentUser.business?.name || currentUser.name || 'Business Owner';
  const { tier: planTier, label: planLabel } = getRegisteredPlanPresentation(currentUser);
  applyBusinessSettings(currentUser.settings || {}, { silent: true });
  if (document.getElementById('dashboard-greeting')) document.getElementById('dashboard-greeting').textContent = `Welcome back, ${businessName}`.trim();
  if (document.getElementById('dashboard-subtitle')) document.getElementById('dashboard-subtitle').textContent = currentUser.business?.name ? `Registered business: ${currentUser.business.name}` : 'Manage your registered business with live analytics';
  const overviewTitle = document.getElementById('overview-title');
  if (overviewTitle) {
    overviewTitle.textContent = 'Welcome to 365 Circle Panel';
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

  if (document.getElementById('year-statement-table')) populateYearStatement(orders);
  renderBookingsTab(orders);
  await renderCustomersTab();
  renderCourierSummary();
  renderRevenueSummary(totalRevenue);
  renderComplaintStats();
  await loadPortfolioDashboard();
  await syncOverviewPortal(orders, totalRevenue, totalOrders, yearOrders, averageOrder, currentUser, planLabel);
  refreshCurrencyRates();
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
  const remembered = JSON.parse(localStorage.getItem('rememberLogin') || 'null');
  const recent = JSON.parse(sessionStorage.getItem('smartlocalRecentRegistration') || 'null');
  const recentPassword = sessionStorage.getItem('smartlocalRecentPassword') || '';
  if (userField) userField.value = remembered?.userid || recent?.userid || '';
  if (passwordField) passwordField.value = recentPassword || '';
  if (rememberBox) rememberBox.checked = Boolean(remembered?.userid || recent?.userid);
  try {
    applyBusinessSettings(JSON.parse(localStorage.getItem('smartlocalBusinessSettings') || '{}'), { silent: true });
  } catch (error) {
    applyBusinessSettings({}, { silent: true });
  }
  generateCaptcha();
  updateMarketClock();
}

function saveCourierOrder(order) {
  const courierOrders = JSON.parse(localStorage.getItem('courierOrders')) || [];
  courierOrders.unshift(order);
  localStorage.setItem('courierOrders', JSON.stringify(courierOrders.slice(0, 20)));
  localStorage.setItem('lastAWB', order.awb);
  saveCourierOrderToServer(order);
  updateCourierTable();
  renderCourierGraph(document.getElementById('courier-chart-filter')?.value || 'all');
  renderCourierProviderChart();
  refreshCommandCenterData({ silent: true, source: 'courier-save' });
}

async function saveCourierOrderToServer(order) {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
    await fetch('/api/couriers', {
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
  } catch (err) {
    // keep local save available
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
  const complaints = JSON.parse(localStorage.getItem('complaints') || '[]');
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
  const complaints = JSON.parse(localStorage.getItem('complaints') || '[]');
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
  if (yearFilter && !yearFilter.options.length) {
    const currentYear = new Date().getFullYear();
    yearFilter.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;
  }
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
  const complaints = JSON.parse(localStorage.getItem('complaints') || '[]');
  complaints.unshift(complaint);
  localStorage.setItem('complaints', JSON.stringify(complaints.slice(0, 100)));
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
  return `?${safeAmount.toLocaleString('en-IN')}`;
}

function getCourierRateConfig() {
  const defaults = {
    baseRate: 80,
    weightRate: 25,
    valueRate: 0.02,
    serviceMultipliers: {
      standard: 1,
      express: 1.5,
      'same-day': 2.2
    }
  };

  try {
    const saved = JSON.parse(localStorage.getItem('courierRateConfig') || '{}');
    return {
      ...defaults,
      ...saved,
      serviceMultipliers: {
        ...defaults.serviceMultipliers,
        ...(saved.serviceMultipliers || {})
      }
    };
  } catch (err) {
    return defaults;
  }
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

function saveCourierRateSettings() {
  const nextConfig = {
    ...getCourierRateConfig(),
    baseRate: parseFloat(document.getElementById('courier-base-rate')?.value || '0') || 0,
    weightRate: parseFloat(document.getElementById('courier-weight-rate')?.value || '0') || 0,
    valueRate: parseFloat(document.getElementById('courier-value-rate')?.value || '0') || 0
  };
  localStorage.setItem('courierRateConfig', JSON.stringify(nextConfig));
  showToast(`Courier rates updated. Base rate is now ${formatRupees(nextConfig.baseRate)}.`, 'success');
}

function updateCourierTable() {
  const courierOrders = JSON.parse(localStorage.getItem('courierOrders')) || [];
  const tbody = document.querySelector('#courier-table tbody');
  if (!tbody) return;
  if (!courierOrders.length) {
    tbody.innerHTML = '<tr><td colspan="7">No courier orders found.</td></tr>';
    return;
  }
  tbody.innerHTML = courierOrders.map(order => {
    return `
      <tr>
        <td>${order.awb}</td>
        <td>${formatProviderLabel(order.provider)}</td>
        <td>${order.originPincode || order.pincode}</td>
        <td>${order.destinationPincode || '-'}</td>
        <td>${order.service}</td>
        <td>${order.status}</td>
        <td>${formatRupees(order.cost)}</td>
      </tr>
    `;
  }).join('');
}

function getCourierGraphData(provider = 'all') {
  const courierOrders = JSON.parse(localStorage.getItem('courierOrders')) || [];
  const filtered = courierOrders.filter(order => {
    const orderProvider = order.provider || 'smartlocal';
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
  const canvas = document.getElementById('courier-provider-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const orders = JSON.parse(localStorage.getItem('courierOrders')) || [];
  const counts = {
    bluedart: 0,
    indiapost: 0,
    delhivery: 0,
    smartlocal: 0
  };
  orders.forEach(order => {
    const key = (order.provider || 'smartlocal').toLowerCase();
    if (counts[key] !== undefined) counts[key] += 1;
  });
  const labels = ['BlueDart', 'India Post', 'Delhivery', 'SmartLocal'];
  const values = [counts.bluedart, counts.indiapost, counts.delhivery, counts.smartlocal];

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const barWidth = chartWidth / labels.length * 0.6;
  const max = Math.max(1, ...values);

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.font = '13px Inter';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';

  values.forEach((value, index) => {
    const x = padding + index * (chartWidth / labels.length) + (chartWidth / labels.length - barWidth) / 2;
    const barHeight = (value / max) * chartHeight;
    const y = padding + chartHeight - barHeight;
    ctx.fillStyle = '#00ff9d';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labels[index], x + barWidth / 2, height - padding + 20);
    ctx.fillText(value.toString(), x + barWidth / 2, y - 8);
  });
}

function generateAWB() {
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
    date: new Date().toISOString().slice(0, 10)
  };

  saveCourierOrder(order);
  showToast('Courier AWB generated successfully.', 'success');
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

function formatRupees(amount) {
  const safeAmount = Number(amount) || 0;
  return `\u20B9${safeAmount.toLocaleString('en-IN')}`;
}

document.getElementById('courier-form').addEventListener('submit', function(e) {
  e.preventDefault();
  generateAWB();
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
  if (segmentIcon && /Ã|â/.test(segmentIcon.textContent || '')) segmentIcon.textContent = 'G';

  const revenuePlaceholder = document.getElementById('summary-revenue');
  if (revenuePlaceholder && /Ã|â/.test(revenuePlaceholder.textContent || '')) revenuePlaceholder.textContent = '\u20B90';

  const averagePlaceholder = document.getElementById('summary-average-order');
  if (averagePlaceholder && /Ã|â/.test(averagePlaceholder.textContent || '')) averagePlaceholder.textContent = '\u20B90';

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
    ['#revenue-total', '?0'],
    ['#live-usd', '$0'],
    ['#live-gbp', '�0'],
    ['#live-eur', '�0'],
    ['#portfolio-invested', '?0'],
    ['#portfolio-current', '?0'],
    ['#portfolio-return', '0.0%'],
    ['#portfolio-note', 'Simulated live market trend. Profit glows green and loss glows red. Maximum return is capped at 500%.']
  ];
  staticLabels.forEach(([selector, value]) => {
    const element = document.querySelector(selector);
    if (element && /Ã|â/.test(element.textContent || '')) element.textContent = value;
  });

  document.querySelectorAll('.metric-label').forEach((element) => {
    if (/Today.*Cutoff|Ã|â/.test(element.textContent || '')) {
      element.textContent = (element.textContent || '').replace(/Today.*Cutoff/i, "Today's Cutoff");
    }
  });

  const investLabel = document.querySelector('#portfolio-form label[for="portfolio-investment"]');
  if (investLabel) investLabel.textContent = 'Invest Value (?)';

  const yearStatementHead = document.querySelector('#year-statement-table thead');
  if (yearStatementHead) {
    yearStatementHead.innerHTML = '<tr><th>Date</th><th>Order</th><th>Amount (?)</th><th>Status</th><th>Payment</th></tr>';
  }

  document.querySelectorAll('th,td,p,span,div,button,label,option').forEach((element) => {
    const text = element.textContent || '';
    if (!/â‚¹|Ã¢â‚¬Â¢|Â©/.test(text)) return;
    element.textContent = text
      .replace(/â‚¹/g, '₹')
      .replace(/Ã¢â‚¬Â¢/g, '•')
      .replace(/Â©/g, '©');
  });

  const footerText = document.querySelector('.footer-bottom p');
  if (footerText) footerText.textContent = '� 2025 SmartLocal. All rights reserved. Made in India.';
};

window.updateNavAuthButton = function() {
  const authBtn = document.getElementById('nav-auth-btn');
  const commandAuthBtn = document.getElementById('command-center-auth-btn');
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (authBtn) {
    authBtn.textContent = currentUser ? 'Logout' : 'Login';
    authBtn.onclick = currentUser ? logout : (() => window.location.href = 'admin.html');
  }
  if (commandAuthBtn) {
    commandAuthBtn.textContent = currentUser ? 'Logout' : 'Login';
    commandAuthBtn.style.display = currentUser ? 'inline-flex' : 'none';
    commandAuthBtn.onclick = currentUser ? logout : (() => window.location.href = 'admin.html');
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
    .replace(/Ã¢â€šÂ¹|â‚¹/g, '\u20B9')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã¢â‚¬Â¢/g, '\u2022')
    .replace(/Ã‚Â©|Â©/g, '\u00A9')
    .replace(/Ã‚Â£|Â£/g, '\u00A3')
    .replace(/Ã¢â€šÂ¬|â‚¬/g, '\u20AC')
    .replace(/ðŸ¤–|🤖/g, 'R')
    .replace(/Built with .+ for shop owners, entrepreneurs, and dreamers\./, "Built with \u2764\uFE0F for shop owners, entrepreneurs, and dreamers.");

  const safeText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  const safeTextIfBroken = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && /�|�|�|�/.test(element.textContent || '')) {
      element.textContent = value;
    }
  };

  safeTextIfBroken('#nav-auth-btn', 'Login');
  safeTextIfBroken('#command-center-auth-btn', 'Logout');
  safeText('.section-tag', 'Admin Panel');
  safeText('.login-header h3', 'Secure Admin Access');
  safeText('.register-header h3', 'Register Your Business');
  safeText('.captcha-refresh', 'Refresh');
  safeText('.command-center-icon', 'CC');
  safeTextIfBroken('#overview-icon', 'B');
  safeTextIfBroken('#summary-revenue', '\u20B90');
  safeTextIfBroken('#summary-average-order', '\u20B90');
  safeTextIfBroken('#revenue-total', '\u20B90');
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
  safeTextIfBroken('#market-status-pill', 'LIVE PROFIT');
  safeTextIfBroken('#portfolio-note', 'Simulated live market trend. Profit glows green and loss glows red. Maximum return is capped at 500%.');
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
    yearStatementHead.innerHTML = '<tr><th>Date</th><th>Order</th><th>Amount (\u20B9)</th><th>Status</th><th>Payment</th></tr>';
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
  portfolioLiveTimer = setInterval(async () => {
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

      const currentRecord = normalizePortfolioRecord(latestMongoRecord);
      if (!(Number(currentRecord.amountInvested) > 0)) {
        updatePortfolioSummary(buildEmptyPortfolioState());
        return;
      }
      const invested = currentRecord.amountInvested;
      const currentReturn = currentRecord.returnPercent;
      let profitChance = 0.5;

      if (currentReturn <= -10) profitChance = 0.72;
      else if (currentReturn <= 8) profitChance = 0.58;
      else if (currentReturn >= 120) profitChance = 0.32;
      else if (currentReturn >= 45) profitChance = 0.42;

      const direction = Math.random() < profitChance ? 1 : -1;
      const swing = (direction === 1 ? 0.025 : 0.03) + Math.random() * 0.09;
      let nextValue = currentRecord.currentValue * (1 + direction * swing);
      const { floor, ceiling } = getPortfolioBounds(invested);

      if (nextValue >= ceiling * 0.98) {
        nextValue = currentRecord.currentValue * (1 - (0.04 + Math.random() * 0.08));
      }
      if (nextValue <= floor * 1.02) {
        nextValue = currentRecord.currentValue * (1 + (0.05 + Math.random() * 0.09));
      }

      const normalizedNextValue = clampPortfolioValue(nextValue, invested);
      const nextPoints = (Array.isArray(currentRecord.points) && currentRecord.points.length
        ? [...currentRecord.points.slice(-29), normalizedNextValue]
        : generatePortfolioGraphPoints(invested, normalizedNextValue)
      ).map((point) => clampPortfolioValue(point, invested));

      const nextRecord = {
        ...currentRecord,
        currentValue: normalizedNextValue,
        points: nextPoints,
        lastUpdatedAt: new Date().toISOString()
      };

      updatePortfolioSummary(nextRecord);

      try {
        const savedRecord = await savePortfolioInvestment(nextRecord);
        if (savedRecord) {
          portfolioLiveState = normalizePortfolioRecord(savedRecord);
        }
      } catch (error) {
        // Keep the UI moving even if the background sync has a transient issue.
      }
    } finally {
      portfolioTickInFlight = false;
    }
  }, 6000);
}

let adminSyncInFlight = false;

function currentBusinessUser() {
  return getSafeCurrentUser() || {};
}

function getLocalOrders() {
  return (JSON.parse(localStorage.getItem('orders') || '[]') || []).map(normalizeDashboardOrder);
}

function getLocalCouriers() {
  return JSON.parse(localStorage.getItem('courierOrders') || '[]') || [];
}

function getLocalComplaints() {
  return JSON.parse(localStorage.getItem('complaints') || '[]') || [];
}

function getLocalInventory() {
  return JSON.parse(localStorage.getItem('inventoryItems') || '[]') || [];
}

function upsertLocalCollection(storageKey, idKey, record, limit = 200) {
  const items = JSON.parse(localStorage.getItem(storageKey) || '[]') || [];
  const filtered = items.filter((item) => item?.[idKey] !== record?.[idKey]);
  filtered.unshift(record);
  localStorage.setItem(storageKey, JSON.stringify(filtered.slice(0, limit)));
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
  if (analyticsAov) analyticsAov.textContent = formatRupees(orders.length ? Math.round(totalRevenue / orders.length) : 0);

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

  const inventoryLabels = products.slice(0, 6).map((item) => item.name);
  const inventoryValues = products.slice(0, 6).map((item) => item.qty);
  drawAdminBarChart('analytics-product-chart', inventoryLabels, inventoryValues, {
    title: inventory.length ? 'Product Mix' : 'Product Mix',
    startColor: '#ffd86b',
    endColor: '#00ff9d',
    emptyText: 'No product mix available yet.'
  });
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

async function handlePortfolioWithdraw() {
  const currentUser = currentBusinessUser();
  if (!currentUser?.userid) {
    showToast('Please log in to withdraw market funds.', 'error');
    return;
  }
  const currentRecord = portfolioLiveState || await fetchLatestPortfolioInvestment();
  if (!currentRecord || !(Number(currentRecord.amountInvested) > 0)) {
    updatePortfolioSummary(buildEmptyPortfolioState());
    showToast('No active fund is available to withdraw.', 'info');
    return;
  }
  const withdrawnRecord = {
    ...normalizePortfolioRecord(currentRecord),
    currentValue: 0,
    amountInvested: 0,
    returnPercent: 0,
    profitLoss: 0,
    points: [],
    trend: 'profit',
    lastUpdatedAt: new Date().toISOString()
  };
  try {
    await savePortfolioInvestment(withdrawnRecord);
    updatePortfolioSummary(withdrawnRecord);
    showToast('Market fund stopped and withdrawn successfully.', 'success');
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

  const items = parseAdminOrderItems(document.getElementById('order-items')?.value || '');
  if (!items.length) {
    showToast('Please add at least one valid item line.', 'error');
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
  const declaredValue = Number(document.getElementById('order-declared-value')?.value || 0) || 0;
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
  const gstAmount = Number(((subtotal * gstPercent) / 100).toFixed(2));
  const total = Number((subtotal + gstAmount).toFixed(2));
  const provider = nextAdminProvider();
  const courier = {
    awb: buildAdminAwb(provider),
    provider,
    originPincode: originPin,
    destinationPincode: destinationPin,
    service: 'standard',
    status: 'Booked',
    weight,
    value: declaredValue || total,
    cost: Math.max(
      getCourierRateConfig().baseRate || 0,
      Math.round(((getCourierRateConfig().baseRate || 0) + (weight * (getCourierRateConfig().weightRate || 0)) + ((declaredValue || total) * (getCourierRateConfig().valueRate || 0))) * (getCourierRateConfig().serviceMultipliers?.standard || 1))
    ),
    date: new Date().toISOString(),
    senderName: customerName,
    senderPhone: customerPhone,
    description: `Order shipment for ${customerName}`,
    businessUserId: currentUser.userid,
    businessName: currentUser.business?.name || currentUser.name || ''
  };

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
    status: 'Placed',
    date: new Date().toISOString(),
    businessUserId: currentUser.userid,
    businessName: currentUser.business?.name || currentUser.name || '',
    gstNo: currentUser.business?.gst || '27AABCS1234F1Z5',
    warrantyExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-IN'),
    courier: {
      awb: courier.awb,
      provider: courier.provider,
      status: courier.status
    }
  });

  upsertLocalCollection('orders', 'orderId', order, 200);
  upsertLocalCollection('courierOrders', 'awb', courier, 200);
  localStorage.setItem('lastAWB', courier.awb);
  await Promise.allSettled([
    fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) }),
    fetch('/api/couriers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(courier) })
  ]);

  const summary = document.getElementById('order-summary');
  if (summary) {
    summary.innerHTML = `Order <strong>${order.orderId}</strong> saved. Invoice ready and AWB <strong>${courier.awb}</strong> created with ${formatProviderLabel(provider)}.`;
  }

  document.getElementById('order-form')?.reset();
  renderOrdersTable(getLocalOrders());
  updateCourierTable();
  renderCourierGraph(document.getElementById('courier-chart-filter')?.value || 'all');
  renderCourierProviderChart();
  await refreshCommandCenterData({ silent: true, source: 'order-submit' });
  window.open(`invoice.html?orderId=${encodeURIComponent(order.orderId)}`, '_blank', 'noopener');
  showToast('Order created and synced successfully.', 'success');
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
    localStorage.setItem('inventoryItems', JSON.stringify(items));
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
    await updateDashboard();
    const inventory = await fetchInventoryItems(300);
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
    if (search && !customerName.includes(search) && !String(order?.orderId || '').toLowerCase().includes(search)) return false;
    if (status !== 'all' && String(order?.status || '') !== status) return false;
    if (dateFrom && orderDate && orderDate < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && orderDate && orderDate > new Date(`${dateTo}T23:59:59`)) return false;
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9">No orders found for the selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((order) => `
    <tr>
      <td>${order.orderId || '-'}</td>
      <td>${order.customer?.name || '-'}</td>
      <td>${formatRupees(order.amount || order.total || 0)}</td>
      <td>${order.payment || '-'}</td>
      <td>${order.status || 'Placed'}</td>
      <td>${order.courier?.awb || '-'}</td>
      <td>${formatAdminDate(order.date)}</td>
      <td><a href="invoice.html?orderId=${encodeURIComponent(order.orderId || '')}" target="_blank" rel="noopener">Open</a></td>
      <td>${order.customer?.email || '-'}</td>
    </tr>
  `).join('');
}

function parseAdminOrderItems(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((item) => item.trim());
      if (parts.length < 3) return null;
      return {
        name: parts[0],
        qty: Math.max(Number(parts[1]) || 0, 1),
        price: Math.max(Number(parts[2]) || 0, 0),
        hsn: String(3000 + Math.floor(Math.random() * 800))
      };
    })
    .filter(Boolean);
}

function nextAdminProvider() {
  const providers = ['bluedart', 'indiapost', 'delhivery', 'smartlocal'];
  const last = localStorage.getItem('smartlocalLastAdminCourierProvider') || '';
  const options = providers.filter((provider) => provider !== last);
  const next = options[Math.floor(Math.random() * options.length)] || providers[0];
  localStorage.setItem('smartlocalLastAdminCourierProvider', next);
  return next;
}

document.addEventListener('DOMContentLoaded', function() {
  restoreAdminUiText();
  updateNavAuthButton();
  loadDashboardIfAvailable();
  ensureTabExportBars();
  document.getElementById('order-form')?.addEventListener('submit', handleAdminOrderSubmit);
  document.getElementById('inventory-form')?.addEventListener('submit', handleInventorySubmit);
  document.getElementById('portfolio-form')?.addEventListener('submit', handlePortfolioSubmit);
  document.getElementById('portfolio-withdraw')?.addEventListener('click', handlePortfolioWithdraw);
  document.getElementById('complaint-form')?.addEventListener('submit', handleAdminComplaintSubmit);
  document.getElementById('inventory-table')?.addEventListener('click', handleInventoryTableClick);
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
  initCourierProviderDropdown();
  document.getElementById('courier-rate-save')?.addEventListener('click', saveCourierRateSettings);
  startPortfolioTicker();
  updateMarketClock();
  if (portfolioClockTimer) clearInterval(portfolioClockTimer);
  portfolioClockTimer = setInterval(() => updateMarketClock(), 1000);
  window.addEventListener('resize', () => {
    if (portfolioLiveState) {
      drawPortfolioGraph(
        portfolioLiveState.points,
        portfolioLiveState.trend,
        portfolioLiveState.amountInvested,
        portfolioLiveState.currentValue
      );
    }
  });
  setInterval(() => {
    const dashboard = document.getElementById('dashboard-section');
    if (dashboard && dashboard.style.display !== 'none') {
      refreshCommandCenterData({ silent: true, source: 'interval' });
      restoreAdminUiText();
    }
  }, 30000);
});

