(() => {
  const RUPEE = '\u20B9';
  const READY = 'ROBERT is ready for the next question.';
  const PROVIDERS = ['bluedart', 'indiapost', 'delhivery', 'smartlocal'];
  const ROBERT_PROVIDERS = ['bluedart', 'indiapost'];
  const PROVIDER_LABELS = { bluedart: 'BlueDart', indiapost: 'India Post', delhivery: 'Delhivery', smartlocal: 'SmartLocal Express' };
  const PROVIDER_CODES = { bluedart: 'BDRT', indiapost: 'INDP', delhivery: 'DLVY', smartlocal: 'SLEX' };
  const LIVE_PORTAL_SYNC_MS = 1000;
  const DEFAULT_COURIER_RATE_CONFIG = {
    baseRate: 80,
    weightRate: 25,
    valueRate: 0.02,
    serviceMultipliers: { standard: 1, express: 1.5, 'same-day': 2.2 }
  };
  const safeJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
  const currentUser = () => safeJson(localStorage.getItem('currentUser') || 'null', null);
  const isPublicHomepageContext = () => {
    const path = String(window.location?.pathname || '').trim().toLowerCase();
    return Boolean(document.body?.classList.contains('landing-homepage'))
      || path === '/'
      || path === '/index.html'
      || path.endsWith('/index.html');
  };
  const robertScopedUser = () => isPublicHomepageContext() ? null : currentUser();
  let robertAbort = null;
  let robertRecognition = null;
  let robertTypingNode = null;
  let portalStateLiveTimer = null;
  let homepageNotificationTimer = null;
  let homepageHeroSliderTimer = null;
  let homepageVisualGalleryTimer = null;
  let homepageNotificationSignature = '';
  const PRELOADER_MIN_DURATION_MS = 10000;
  const roundMoneyValue = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
  };
  const ROBERT_LANGUAGE_LABELS = {
    'en-US': 'English',
    'hi-IN': 'Hindi',
    'bn-IN': 'Bengali',
    'ta-IN': 'Tamil',
    'te-IN': 'Telugu',
    'mr-IN': 'Marathi',
    'gu-IN': 'Gujarati',
    'pa-IN': 'Punjabi',
    'ur-IN': 'Urdu',
    'kn-IN': 'Kannada',
    'ml-IN': 'Malayalam',
    'or-IN': 'Odia',
    'as-IN': 'Assamese',
    'fr-FR': 'French',
    'es-ES': 'Spanish',
    'de-DE': 'German',
    'it-IT': 'Italian',
    'pt-BR': 'Portuguese',
    'ru-RU': 'Russian',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    'zh-CN': 'Chinese',
    'ar-SA': 'Arabic'
  };
  const ROBERT_TESSERACT_LANG = {
    'en-US': 'eng',
    'hi-IN': 'hin',
    'bn-IN': 'ben',
    'ta-IN': 'tam',
    'te-IN': 'tel',
    'mr-IN': 'mar',
    'gu-IN': 'guj',
    'pa-IN': 'pan',
    'ur-IN': 'urd',
    'kn-IN': 'kan',
    'ml-IN': 'mal',
    'or-IN': 'ori',
    'as-IN': 'asm',
    'fr-FR': 'fra',
    'es-ES': 'spa',
    'de-DE': 'deu',
    'it-IT': 'ita',
    'pt-BR': 'por',
    'ru-RU': 'rus',
    'ja-JP': 'jpn',
    'ko-KR': 'kor',
    'zh-CN': 'chi_sim',
    'ar-SA': 'ara'
  };
  const normalizeCourierRateConfig = (raw = {}) => ({
    baseRate: roundMoneyValue(raw?.baseRate ?? DEFAULT_COURIER_RATE_CONFIG.baseRate),
    weightRate: roundMoneyValue(raw?.weightRate ?? DEFAULT_COURIER_RATE_CONFIG.weightRate),
    valueRate: roundMoneyValue(raw?.valueRate ?? DEFAULT_COURIER_RATE_CONFIG.valueRate),
    serviceMultipliers: {
      standard: Number(raw?.serviceMultipliers?.standard ?? DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers.standard) || DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers.standard,
      express: Number(raw?.serviceMultipliers?.express ?? DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers.express) || DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers.express,
      'same-day': Number(raw?.serviceMultipliers?.['same-day'] ?? DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers['same-day']) || DEFAULT_COURIER_RATE_CONFIG.serviceMultipliers['same-day']
    }
  });
  const normalizePortalState = (raw = {}) => ({
    soundEnabled: raw?.soundEnabled !== false,
    rememberLogin: Boolean(raw?.rememberLogin),
    courierRateConfig: normalizeCourierRateConfig(raw?.courierRateConfig),
    lastAdminCourierProvider: PROVIDERS.includes(String(raw?.lastAdminCourierProvider || '').toLowerCase()) ? String(raw.lastAdminCourierProvider).toLowerCase() : '',
    robertHistory: Array.isArray(raw?.robertHistory)
      ? raw.robertHistory
        .map((item) => ({
          role: String(item?.role || '').toLowerCase() === 'user' ? 'user' : 'assistant',
          text: String(item?.text || '').trim(),
          createdAt: String(item?.createdAt || '').trim()
        }))
        .filter((item) => item.text)
        .slice(-20)
      : [],
    robertGreeted: Boolean(raw?.robertGreeted),
    robertSessionId: String(raw?.robertSessionId || '').trim(),
    robertResponseLength: ['short', 'normal', 'long'].includes(String(raw?.robertResponseLength || '').trim().toLowerCase()) ? String(raw.robertResponseLength).trim().toLowerCase() : 'normal',
    robertLastProvider: ['local', 'gemini', 'scitely', 'groq'].includes(String(raw?.robertLastProvider || '').trim().toLowerCase()) ? String(raw.robertLastProvider).trim().toLowerCase() : '',
    robertLastFallback: Boolean(raw?.robertLastFallback),
    robertLastAiStatus: ['idle', 'success', 'fallback', 'error'].includes(String(raw?.robertLastAiStatus || '').trim().toLowerCase()) ? String(raw.robertLastAiStatus).trim().toLowerCase() : 'idle',
    robertLastAiMode: ['chat', 'json', 'command', 'file'].includes(String(raw?.robertLastAiMode || '').trim().toLowerCase()) ? String(raw.robertLastAiMode).trim().toLowerCase() : 'chat',
    robertLastAiReason: String(raw?.robertLastAiReason || '').replace(/\s+/g, ' ').trim().slice(0, 220),
    robertLastAiAt: String(raw?.robertLastAiAt || '').trim().slice(0, 60)
  });
  const robertProviderLabel = (provider = '', fallback = false) => {
    const clean = String(provider || '').trim().toLowerCase();
    const label = clean === 'groq' ? 'GROQ' : clean === 'scitely' ? 'SCITELY' : clean === 'gemini' ? 'GEMINI' : 'LOCAL';
    return fallback && label !== 'LOCAL' ? `${label} fallback` : label;
  };
  const normalizeRobertReplyLength = (value = 'normal') => ['short', 'normal', 'long'].includes(String(value || '').trim().toLowerCase()) ? String(value).trim().toLowerCase() : 'normal';
  let portalStateCache = normalizePortalState(currentUser()?.portalState || {});
  let publicRobertPortalState = normalizePortalState({});
  const syncCurrentUserCache = (nextUser) => {
    if (!nextUser) return null;
    const user = {
      ...nextUser,
      portalState: normalizePortalState(nextUser.portalState || portalStateCache || {})
    };
    portalStateCache = user.portalState;
    localStorage.setItem('currentUser', JSON.stringify(user));
    return user;
  };
  const currentPortalState = () => {
    if (isPublicHomepageContext()) {
      publicRobertPortalState = normalizePortalState(publicRobertPortalState || portalStateCache || {});
      return publicRobertPortalState;
    }
    const userPortalState = currentUser()?.portalState;
    if (userPortalState) {
      portalStateCache = normalizePortalState(userPortalState);
      return portalStateCache;
    }
    return normalizePortalState(portalStateCache || {});
  };
  const savePortalState = async (patch = {}, options = {}) => {
    const user = robertScopedUser();
    const nextPortalState = normalizePortalState({ ...currentPortalState(), ...(patch || {}) });
    if (isPublicHomepageContext()) {
      publicRobertPortalState = nextPortalState;
      return publicRobertPortalState;
    }
    portalStateCache = nextPortalState;
    if (user) syncCurrentUserCache({ ...user, portalState: portalStateCache });
    if (!user?.userid) return portalStateCache;
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(user.userid)}/portal-state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(portalStateCache)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Unable to save live portal state.');
      if (data?.user) syncCurrentUserCache({ ...user, ...data.user });
      if (!options.silent) window.dispatchEvent(new CustomEvent('smartlocal:portal-state', { detail: currentPortalState() }));
    } catch (error) {
      if (!options.silent) toast(error.message || 'Unable to save live portal state right now.', 'error');
    }
    return currentPortalState();
  };
  const cacheRobertAiMeta = (meta = {}) => {
    const nextPortalState = normalizePortalState({
      ...currentPortalState(),
      robertLastProvider: meta.provider,
      robertLastFallback: meta.fallback,
      robertLastAiStatus: meta.aiStatus,
      robertLastAiMode: meta.aiMode,
      robertLastAiReason: meta.aiReason,
      robertLastAiAt: meta.aiAt || new Date().toISOString()
    });
    if (isPublicHomepageContext()) {
      publicRobertPortalState = nextPortalState;
      return nextPortalState;
    }
    portalStateCache = nextPortalState;
    const user = robertScopedUser();
    if (user) syncCurrentUserCache({ ...user, portalState: nextPortalState });
    return nextPortalState;
  };
  const loadPortalState = async () => {
    if (isPublicHomepageContext()) return currentPortalState();
    const user = robertScopedUser();
    if (!user?.userid) return currentPortalState();
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(user.userid)}/portal-state`, {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Unable to load live portal state.');
      if (data?.user) syncCurrentUserCache({ ...user, ...data.user });
    } catch {}
    return currentPortalState();
  };
  const startPortalStateLiveSync = () => {
    if (portalStateLiveTimer) clearInterval(portalStateLiveTimer);
    portalStateLiveTimer = setInterval(() => {
      if (document.hidden) return;
      if (isPublicHomepageContext()) return;
      if (!robertScopedUser()?.userid) return;
      loadPortalState().then(() => {
        window.dispatchEvent(new CustomEvent('smartlocal:portal-state', { detail: currentPortalState() }));
      }).catch(() => {});
    }, LIVE_PORTAL_SYNC_MS);
  };
  const formatMoney = (amount) => {
    const safeAmount = roundMoneyValue(amount);
    return `${RUPEE}${safeAmount.toLocaleString('en-IN', { minimumFractionDigits: safeAmount % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  };
  const formRef = (prefix = 'REF') => `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
  const safeFileStem = (value, fallback = 'smartlocal_report') => {
    const clean = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return clean || fallback;
  };
  const businessLogo = (type) => ({ salon: 'SAL', gym: 'GYM', restaurant: 'RST', clinic: 'CLN', grocery: 'GRC', tuition: 'TUI', retail: 'RTL', consulting: 'CNS', other: 'BIZ', platform: 'SL' }[String(type || '').toLowerCase()] || 'BIZ');
  const activeBusinessName = (fallback = 'SmartLocal Business') => String(currentUser()?.business?.name || currentUser()?.name || fallback).trim() || fallback;
  const resolvedBusinessName = (record = {}, fallback = activeBusinessName()) => String(record?.businessName || record?.business?.name || record?.portfolioName || fallback).trim() || fallback;
  const PLAN_SEQUENCE = ['silver', 'gold', 'platinum'];
  const PLAN_CATALOG = {
    silver: { key: 'silver', name: 'Silver', price: 999 },
    gold: { key: 'gold', name: 'Gold', price: 2499 },
    platinum: { key: 'platinum', name: 'Platinum', price: 4999 }
  };
  const normalizePlanType = (value = '') => {
    const clean = String(value || '').trim().toLowerCase();
    if (!clean) return 'gold';
    if (clean.includes('silver') || clean.includes('starter')) return 'silver';
    if (clean.includes('platinum') || clean.includes('enterprise')) return 'platinum';
    if (clean.includes('gold') || clean.includes('professional')) return 'gold';
    return 'gold';
  };
  const getPlanDetails = (value = '') => PLAN_CATALOG[normalizePlanType(value)] || PLAN_CATALOG.gold;
  const currentPlanType = (user = currentUser()) => normalizePlanType(user?.planDetails?.name || user?.plan || 'gold');
  const planSupportsRobert = (value = '') => ['gold', 'platinum'].includes(normalizePlanType(value));
  const robertAccessState = (user = robertScopedUser()) => {
    const requester = user?.userid ? user : null;
    const plan = currentPlanType(requester || {});
    const planDetails = getPlanDetails(plan);
    const allowed = !requester || planSupportsRobert(plan);
    return {
      allowed,
      plan,
      planDetails,
      requiresUpgrade: Boolean(requester && !allowed),
      message: requester && !allowed
        ? `ROBERT is available only on Gold and Platinum plans. Your current segment is ${planDetails.name}. Upgrade to continue.`
        : ''
    };
  };
  const extractPlanTarget = (text = '') => {
    const clean = String(text || '').toLowerCase();
    const directedMatch = clean.match(/\b(?:to|into|as)\s+(silver|gold|platinum|starter|professional|enterprise)\b/);
    const candidate = directedMatch?.[1]
      || (clean.match(/\b(silver|gold|platinum|starter|professional|enterprise)\b/g) || []).slice(-1)[0]
      || '';
    if (/(silver|starter)/.test(candidate)) return 'silver';
    if (/(gold|professional)/.test(candidate)) return 'gold';
    if (/(platinum|enterprise)/.test(candidate)) return 'platinum';
    return '';
  };
  const adjacentPlanType = (currentPlan, direction) => {
    const currentIndex = PLAN_SEQUENCE.indexOf(normalizePlanType(currentPlan));
    if (currentIndex < 0) return '';
    if (direction === 'upgrade') return PLAN_SEQUENCE[Math.min(currentIndex + 1, PLAN_SEQUENCE.length - 1)] || '';
    if (direction === 'downgrade') return PLAN_SEQUENCE[Math.max(currentIndex - 1, 0)] || '';
    return '';
  };
  const planMoveSummary = (currentPlan) => {
    const current = getPlanDetails(currentPlan);
    const upgrade = adjacentPlanType(current.key, 'upgrade');
    const downgrade = adjacentPlanType(current.key, 'downgrade');
    return `Current segment is ${current.name}. ${upgrade && upgrade !== current.key ? `Upgrade available to ${getPlanDetails(upgrade).name}.` : 'No higher upgrade is available.'} ${downgrade && downgrade !== current.key ? `Downgrade available to ${getPlanDetails(downgrade).name}.` : 'No lower downgrade is available.'}`.trim();
  };
  const settings = () => {
    const user = robertScopedUser();
    const bookingCutoff = /^\d{2}:\d{2}$/.test(String(user?.settings?.bookingCutoff || '').trim())
      ? String(user?.settings?.bookingCutoff).trim()
      : '18:00';
    return {
      bookingCutoff,
      rovertLanguage: user?.settings?.rovertLanguage || 'en-US'
    };
  };
  const cutoffLabel = (value = '18:00') => {
    const safeValue = /^\d{2}:\d{2}$/.test(String(value || '').trim()) ? value : '18:00';
    const [hourText, minuteText] = safeValue.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    const hour12 = ((hour + 11) % 12) + 1;
    return `${hour12}:${String(minute).padStart(2, '0')} ${meridiem}`;
  };
  const afterCutoff = (value = settings().bookingCutoff) => {
    const safeValue = /^\d{2}:\d{2}$/.test(String(value || '').trim()) ? value : '18:00';
    const [hourText, minuteText] = safeValue.split(':');
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
  };
  const soundEnabled = () => true;
  let audioCtx = null;
  const providerName = (value) => { const key = String(value || '').toLowerCase(); if (key.includes('blue')) return 'bluedart'; if (key.includes('india')) return 'indiapost'; if (key.includes('del')) return 'delhivery'; if (key.includes('smart')) return 'smartlocal'; return 'bluedart'; };
  const initSoundToggles = () => {
    savePortalState({ soundEnabled: true }, { silent: true });
  };
  const nextProvider = () => PROVIDERS[0];
  const nextRobertProvider = () => ROBERT_PROVIDERS[0];
  const robertCourierProvider = (value) => { const normalized = providerName(value); return ROBERT_PROVIDERS.includes(normalized) ? normalized : nextRobertProvider(); };
  const courierCfg = () => currentPortalState().courierRateConfig;
  const courierCost = (weight, value, service) => { const cfg = courierCfg(); return Math.max(cfg.baseRate || 0, Math.round(((cfg.baseRate || 0) + (Number(weight) || 0) * (cfg.weightRate || 0) + (Number(value) || 0) * (cfg.valueRate || 0)) * (cfg.serviceMultipliers?.[service] || 1))); };
  const sanitizeText = (text) => String(text || '').replace(/ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹|Ã¢â€šÂ¹|â‚¹/g, RUPEE).replace(/ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|â€¢/g, '\u2022').replace(/ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬|Ã¢â€šÂ¬/g, '\u20AC').replace(/Ãƒâ€šÃ‚Â£|Ã‚Â£|Â£/g, '\u00A3').replace(/Ãƒâ€šÃ‚Â©|Ã‚Â©|Â©/g, '\u00A9').replace(/â†/g, '<-').replace(/â†—|â†’/g, '->').replace(/âœ¦/g, '\u2726').replace(/âœ…/g, 'OK').replace(/â¤ï¸|â¤/g, 'love').replace(/ðŸ‡®ðŸ‡³/g, 'India').replace(/ROBERT is ready\. Secure key is loaded from the server\./g, READY);
  const toast = (message, type = 'info') => { const node = document.createElement('div'); const icon = document.createElement('span'); const text = document.createElement('span'); node.className = 'toast'; icon.className = 'toast-icon'; icon.textContent = type === 'success' ? 'OK' : type === 'error' ? '!' : 'i'; if (type === 'error') { node.style.borderColor = 'rgba(255,95,95,0.55)'; icon.style.color = '#ff9f9f'; } if (type === 'info') { node.style.borderColor = 'rgba(0,200,255,0.45)'; icon.style.color = '#8fe9ff'; } text.textContent = sanitizeText(message); node.append(icon, text); document.body.appendChild(node); requestAnimationFrame(() => node.classList.add('show')); setTimeout(() => { node.classList.remove('show'); setTimeout(() => node.remove(), 400); }, 2800); };
  const tone = (frequency, duration = 0.08, type = 'sine', volume = 0.025) => { if (!soundEnabled()) return; const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return; try { audioCtx = audioCtx || new Ctx(); const oscillator = audioCtx.createOscillator(); const gain = audioCtx.createGain(); oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = volume; oscillator.connect(gain); gain.connect(audioCtx.destination); oscillator.start(); oscillator.stop(audioCtx.currentTime + duration); } catch {} };
  const playLoginTone = () => { tone(660, 0.1, 'triangle', 0.03); setTimeout(() => tone(880, 0.12, 'triangle', 0.028), 90); };
  const playUiTone = () => tone(540, 0.06, 'sine', 0.02);
  const playHoverTone = () => tone(420, 0.045, 'sine', 0.014);
  const initHomepageAudio = () => {
    const targets = document.querySelectorAll('.premium-home .glow-btn, .premium-home .btn-glow, .premium-home .nav-link, .premium-home .premium-slider-dot, .premium-home .premium-account-trigger');
    targets.forEach((element) => {
      if (element.dataset.audioReady === 'true') return;
      element.dataset.audioReady = 'true';
      element.addEventListener('mouseenter', () => { if (!document.hidden) playHoverTone(); }, { passive: true });
      element.addEventListener('click', () => { if (!document.hidden) playUiTone(); });
    });
  };
  const hidePreloader = () => {
    const preloader = document.getElementById('sl-preloader');
    if (!preloader || preloader.dataset.hidden === 'true') return;
    preloader.dataset.hidden = 'true';
    const reveal = () => {
      requestAnimationFrame(() => {
        preloader.classList.add('is-hidden');
        setTimeout(() => preloader.remove(), 700);
      });
    };
    const elapsed = Number(preloader.dataset.startedAt || '0');
    const wait = Math.max(PRELOADER_MIN_DURATION_MS - (Date.now() - elapsed), 0);
    if (wait > 0) {
      setTimeout(reveal, wait);
    } else {
      reveal();
    }
  };
  const json = async (url, payload, signal) => { const response = await fetch(url, { method: payload ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined, signal }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data?.error || `Request failed for ${url}`); return data; };
  const normalizeHomepageNotification = (item = {}) => {
    const priority = String(item?.priority || '').trim().toLowerCase();
    return {
      id: String(item?._id || item?.id || '').trim(),
      businessName: String(item?.businessName || '').trim(),
      title: String(item?.title || '').trim(),
      message: String(item?.message || '').trim(),
      priority: ['success', 'warning', 'alert'].includes(priority) ? priority : 'info',
      status: String(item?.status || 'active').trim().toLowerCase() === 'draft' ? 'draft' : 'active',
      publishedAt: String(item?.publishedAt || item?.createdAt || '').trim()
    };
  };
  const formatHomepageNotificationTime = (value) => {
    if (!value) return 'Live now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Live now';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };
  const buildHomepageNotificationNode = (item) => {
    const notification = normalizeHomepageNotification(item);
    const node = document.createElement('div');
    node.className = `notification-item priority-${notification.priority}`;
    const dot = document.createElement('span');
    dot.className = 'notification-dot';
    dot.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = notification.businessName ? `${notification.businessName} | ${notification.title || 'Notification'}` : (notification.title || 'Live Notification');
    const messageLine = document.createElement('span');
    messageLine.className = 'notification-message-line';
    messageLine.textContent = notification.message || 'A new business notification has been published from SmartLocal.';
    const meta = document.createElement('small');
    meta.className = 'notification-meta-line';
    meta.textContent = formatHomepageNotificationTime(notification.publishedAt);
    copy.append(heading, messageLine, meta);
    node.append(dot, copy);
    return node;
  };
  const renderHomepageNotifications = (items = []) => {
    const track = document.getElementById('homepage-notification-track');
    const title = document.querySelector('.hero-notification-card .hero-side-title');
    if (!track) return;
    const normalized = Array.isArray(items)
      ? items
        .map(normalizeHomepageNotification)
        .filter((item) => item.status === 'active' && (item.title || item.message))
      : [];
    const nextSignature = JSON.stringify(normalized.map((item) => [item.id, item.businessName, item.title, item.message, item.priority, item.status, item.publishedAt]));
    if (nextSignature === homepageNotificationSignature && track.childElementCount) return;
    homepageNotificationSignature = nextSignature;
    track.innerHTML = '';
    track.classList.remove('is-animated');
    track.style.removeProperty('--notification-duration');
    if (!normalized.length) {
      const node = document.createElement('div');
      node.className = 'notification-item notification-item-placeholder';
      const dot = document.createElement('span');
      dot.className = 'notification-dot';
      dot.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('div');
      const heading = document.createElement('strong');
      heading.textContent = 'No live notifications yet';
      const messageLine = document.createElement('span');
      messageLine.className = 'notification-message-line';
      messageLine.textContent = 'Published business notifications will move here automatically.';
      copy.append(heading, messageLine);
      node.append(dot, copy);
      track.appendChild(node);
      if (title) title.textContent = 'Published business updates will appear here.';
      return;
    }
    const list = normalized.length > 1 && !prefersReducedMotion() ? normalized.concat(normalized) : normalized;
    const fragment = document.createDocumentFragment();
    list.forEach((item) => fragment.appendChild(buildHomepageNotificationNode(item)));
    track.appendChild(fragment);
    if (title) title.textContent = `${normalized.length} live notification${normalized.length === 1 ? '' : 's'} published from SmartLocal.`;
    if (normalized.length > 1 && !prefersReducedMotion()) {
      track.style.setProperty('--notification-duration', `${Math.max(16, normalized.length * 5)}s`);
      track.classList.add('is-animated');
    }
  };
  const fetchHomepageNotifications = async () => {
    const track = document.getElementById('homepage-notification-track');
    if (!track) return [];
    try {
      const response = await fetch('/api/notifications?activeOnly=true&limit=12', { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Unable to load live notifications.');
      const items = Array.isArray(data?.items) ? data.items : [];
      renderHomepageNotifications(items);
      return items;
    } catch {
      if (!homepageNotificationSignature) renderHomepageNotifications([]);
      return [];
    }
  };
  const initHomepageNotifications = () => {
    const track = document.getElementById('homepage-notification-track');
    if (!track) return;
    const syncNotifications = () => {
      if (document.hidden) return;
      fetchHomepageNotifications().catch(() => {});
    };
    if (homepageNotificationTimer) clearInterval(homepageNotificationTimer);
    syncNotifications();
    homepageNotificationTimer = setInterval(syncNotifications, LIVE_PORTAL_SYNC_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncNotifications();
    }, { passive: true });
  };
  const initHomepageHeroSlider = () => {
    const shell = document.getElementById('homepage-hero-shell');
    const slides = Array.from(shell?.querySelectorAll('.premium-home-slide') || []);
    const dots = Array.from(document.querySelectorAll('#homepage-slider-dots .premium-slider-dot'));
    if (!shell || !slides.length || !dots.length) return;
    let currentIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
    const showSlide = (nextIndex = 0) => {
      currentIndex = (nextIndex + slides.length) % slides.length;
      slides.forEach((slide, index) => {
        slide.classList.toggle('is-active', index === currentIndex);
        slide.setAttribute('aria-hidden', index === currentIndex ? 'false' : 'true');
      });
      dots.forEach((dot, index) => {
        const active = index === currentIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      shell.setAttribute('data-active-slide', String(currentIndex));
      if (nextIndex !== 0) playUiTone();
    };
    const stopSlider = () => {
      if (homepageHeroSliderTimer) {
        clearInterval(homepageHeroSliderTimer);
        homepageHeroSliderTimer = null;
      }
    };
    const startSlider = () => {
      stopSlider();
      if (prefersReducedMotion()) return;
      homepageHeroSliderTimer = setInterval(() => {
        if (document.hidden) return;
        showSlide(currentIndex + 1);
      }, 10000);
    };
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        showSlide(index);
        playUiTone();
        startSlider();
      });
    });
    showSlide(currentIndex);
    startSlider();
  };
  const initHomepageVisualGallery = () => {
    const stage = document.getElementById('homepage-visual-gallery');
    const images = Array.from(stage?.querySelectorAll('.premium-gallery-image') || []);
    if (!stage || !images.length) return;
    let currentIndex = Math.max(0, images.findIndex((image) => image.classList.contains('is-active')));
    const showImage = (nextIndex = 0) => {
      currentIndex = (nextIndex + images.length) % images.length;
      images.forEach((image, index) => {
        const active = index === currentIndex;
        image.classList.toggle('is-active', active);
        image.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
    };
    const stopGallery = () => {
      if (homepageVisualGalleryTimer) {
        clearInterval(homepageVisualGalleryTimer);
        homepageVisualGalleryTimer = null;
      }
    };
    const startGallery = () => {
      stopGallery();
      if (prefersReducedMotion()) return;
      homepageVisualGalleryTimer = setInterval(() => {
        if (document.hidden) return;
        showImage(currentIndex + 1);
      }, 10000);
    };
    showImage(currentIndex);
    startGallery();
  };

  const initHomepageBookingCalendar = () => {
    const dayNode = document.getElementById('smart-booking-calendar-day');
    const monthNode = document.getElementById('smart-booking-calendar-month');
    if (!dayNode || !monthNode) return;
    const now = new Date();
    dayNode.textContent = String(now.getDate());
    monthNode.textContent = now.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
  };
  const initHomepageVisitorCounter = async () => {
    const counterNode = document.getElementById('footer-visit-count');
    if (!counterNode) return;
    const counterWrap = document.getElementById('footer-visit-counter');
    const REEL_CYCLES = 20;
    const BASE_REEL_CYCLE = 10;
    let reelPattern = '';
    let reelSlots = [];
    const createDigitSlot = (digit, immediate = false) => {
      const slot = document.createElement('span');
      slot.className = 'footer-visit-digit';
      const reel = document.createElement('span');
      reel.className = 'footer-visit-digit-reel';
      for (let cycle = 0; cycle < REEL_CYCLES; cycle += 1) {
        for (let numeral = 0; numeral <= 9; numeral += 1) {
          const digitNode = document.createElement('span');
          digitNode.className = 'footer-visit-digit-cell';
          digitNode.textContent = String(numeral);
          reel.appendChild(digitNode);
        }
      }
      slot.appendChild(reel);
      const initialDigit = Number(digit) || 0;
      const initialPos = (immediate ? BASE_REEL_CYCLE : BASE_REEL_CYCLE - 1) * 10 + initialDigit;
      slot.dataset.position = String(initialPos);
      reel.style.transform = `translateY(-${initialPos * 1.08}em)`;
      return slot;
    };
    const rebuildCounterMarkup = (formattedValue, immediate = false) => {
      const nextPattern = formattedValue.replace(/\d/g, '#');
      if (nextPattern === reelPattern && reelSlots.length) return false;
      reelPattern = nextPattern;
      reelSlots = [];
      counterNode.textContent = '';
      let digitIndex = 0;
      for (const character of formattedValue) {
        if (/\d/.test(character)) {
          const slot = createDigitSlot(character, immediate);
          counterNode.appendChild(slot);
          reelSlots.push(slot);
          digitIndex += 1;
        } else {
          const separator = document.createElement('span');
          separator.className = 'footer-visit-separator';
          separator.textContent = character;
          counterNode.appendChild(separator);
        }
      }
      return true;
    };
    const renderCounterDisplay = (value, { animateDigits = false, immediate = false } = {}) => {
      const normalizedValue = Math.max(0, Number(value) || 0);
      const formattedValue = normalizedValue.toLocaleString('en-IN');
      const patternChanged = rebuildCounterMarkup(formattedValue, immediate);
      counterNode.setAttribute('aria-label', `${formattedValue} total website visitors`);
      const digits = formattedValue.replace(/\D/g, '').split('');
      reelSlots.forEach((slot, slotIndex) => {
        const reel = slot.firstElementChild;
        if (!reel) return;
        const targetDigit = Number(digits[slotIndex] || 0);
        let nextPosition = Number(slot.dataset.position || 0);
        if (immediate || patternChanged || !animateDigits) {
          nextPosition = BASE_REEL_CYCLE * 10 + targetDigit;
        } else {
          while (nextPosition % 10 !== targetDigit) nextPosition += 1;
          const minTarget = BASE_REEL_CYCLE * 10 + targetDigit;
          if (nextPosition < minTarget) {
            while (nextPosition < minTarget) nextPosition += 10;
          }
        }
        slot.dataset.position = String(nextPosition);
        reel.style.transform = `translateY(-${nextPosition * 1.08}em)`;
      });
    };
  const animateCounterValue = (targetValue) => {
    const finalValue = Math.max(0, Number(targetValue) || 0);
    const reducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || finalValue <= 0) {
      renderCounterDisplay(finalValue, { immediate: true });
      counterNode.classList.remove('is-counting');
      counterWrap?.classList.remove('is-counting');
      return;
    }
    const animationDuration = Math.min(3200, Math.max(1400, finalValue * 85));
    const startTime = performance.now();
    counterNode.classList.add('is-counting');
    counterWrap?.classList.add('is-counting');

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / animationDuration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.max(0, Math.round(finalValue * easedProgress));
        renderCounterDisplay(currentValue, { animateDigits: true });
        if (progress < 1) {
          window.requestAnimationFrame(step);
      } else {
        renderCounterDisplay(finalValue, { animateDigits: true, immediate: true });
        counterNode.classList.remove('is-counting');
        counterWrap?.classList.remove('is-counting');
      }
    };

    renderCounterDisplay(0, { immediate: true });
    window.requestAnimationFrame(step);
  };

  const waitForCounterInView = (callback) => {
    let hasStarted = false;
    const begin = () => {
      if (hasStarted) return;
      hasStarted = true;
      callback();
    };

    if (!counterWrap) {
      begin();
      return;
    }

    const reducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || typeof window.IntersectionObserver !== 'function') {
      begin();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.35) {
          observer.disconnect();
            begin();
          }
        },
        {
        threshold: [0.2, 0.35, 0.5]
      }
    );

    observer.observe(counterWrap);
  };
    const sessionKey = 'smartlocal-home-visit-recorded';
    const shouldIncrement = !window.sessionStorage.getItem(sessionKey);
    const requestUrl = shouldIncrement ? '/api/public/homepage-visits' : '/api/public/homepage-visits?mode=read';
    const requestOptions = shouldIncrement
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      : { method: 'GET' };
    try {
      const response = await fetch(requestUrl, requestOptions);
      if (!response.ok) throw new Error(`Visitor counter request failed with ${response.status}`);
      const payload = await response.json();
      const count = Number(payload?.count || 0);
      renderCounterDisplay(0, { immediate: true });
      waitForCounterInView(() => animateCounterValue(count));
      if (shouldIncrement) window.sessionStorage.setItem(sessionKey, '1');
    } catch (error) {
      counterNode.classList.remove('is-counting');
      counterWrap?.classList.remove('is-counting');
      counterNode.textContent = 'Live soon';
      console.warn('Homepage visitor counter unavailable:', error);
    }
  };
  const initHomepageSegmentAccess = () => {
    const segmentSelect = document.querySelector('[data-homepage-segment]');
    const signupLinks = Array.from(document.querySelectorAll('[data-homepage-signup]'));
    if (!segmentSelect || !signupLinks.length) return;
    const normalizeSegment = (value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'gold' || normalized === 'platinum' || normalized === 'silver') return normalized;
      return '';
    };
    const applySelectedSegment = () => {
      const selectedSegment = normalizeSegment(segmentSelect.value);
      signupLinks.forEach((link) => {
        if (selectedSegment) {
          link.setAttribute('href', `business-register.html?plan=${encodeURIComponent(selectedSegment)}`);
          link.dataset.plan = selectedSegment;
          link.setAttribute('aria-disabled', 'false');
          link.removeAttribute('tabindex');
        } else {
          link.setAttribute('href', '#');
          link.dataset.plan = '';
          link.setAttribute('aria-disabled', 'true');
          link.setAttribute('tabindex', '-1');
        }
      });
    };
    signupLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
      });
    });
    segmentSelect.addEventListener('change', applySelectedSegment);
    applySelectedSegment();
  };
  const updateBusinessPlan = async (targetPlan) => {
    const user = currentUser();
    if (!user?.userid) throw new Error('Please log in first so I can change the segment.');
    const normalizedPlan = normalizePlanType(targetPlan);
    const response = await fetch(`/api/businesses/${encodeURIComponent(user.userid)}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ plan: normalizedPlan })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Unable to update the plan right now.');
    const updatedUser = {
      ...user,
      ...(data?.user || {}),
      plan: data?.plan || normalizedPlan,
      planDetails: data?.planDetails || data?.user?.planDetails || getPlanDetails(normalizedPlan)
    };
    syncCurrentUserCache(updatedUser);
    window.dispatchEvent(new CustomEvent('smartlocal:plan-updated', { detail: updatedUser }));
    if (typeof window.refreshCommandCenterData === 'function') {
      try { await window.refreshCommandCenterData({ silent: true, source: 'robert-plan-change' }); } catch {}
    } else if (typeof window.updateDashboard === 'function') {
      try { await window.updateDashboard(); } catch {}
    }
    return updatedUser;
  };
  const normalizeBusinessPhone = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const compact = raw.replace(/[^\d+]/g, '');
    if (!compact) return '';
    if (compact.startsWith('+')) return `+${compact.slice(1).replace(/\+/g, '')}`;
    return compact.replace(/\+/g, '');
  };
  const isValidBusinessPhone = (value = '') => /^[+]?\d{8,15}$/.test(normalizeBusinessPhone(value));
  const isValidBusinessEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim());
  const maskBusinessPhone = (value = '') => {
    const phone = normalizeBusinessPhone(value);
    if (!phone) return 'Not added';
    const visible = phone.slice(-4);
    const hiddenLength = Math.max(phone.replace(/\D/g, '').length - 4, 8);
    return `${'*'.repeat(hiddenLength)}${visible}`;
  };
  const maskBusinessEmail = (value = '') => {
    const email = String(value || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return 'Not added';
    const [localPart, domain] = email.split('@');
    const head = localPart.slice(0, Math.min(2, localPart.length)) || '*';
    const tail = localPart.length > 2 ? localPart.slice(-1) : '';
    const hidden = '*'.repeat(Math.max(localPart.length - head.length - tail.length, 3));
    return `${head}${hidden}${tail}@${domain}`;
  };
  const maskBusinessGst = (value = '') => {
    const gst = String(value || '').trim().toUpperCase();
    if (!gst) return 'Not added';
    return gst.length <= 4 ? gst : `${gst.slice(0, 2)}***${gst.slice(-4)}`;
  };
  const maskBusinessBank = (value = '') => {
    const bank = String(value || '').trim().replace(/[^\dA-Za-z]/g, '');
    if (!bank) return 'Not added';
    return bank.length <= 4 ? bank : `${'*'.repeat(Math.max(bank.length - 4, 8))}${bank.slice(-4)}`;
  };
  const updateBusinessProfileContact = async (profilePatch = {}) => {
    const user = currentUser();
    if (!user?.userid) throw new Error('Please log in first so I can update the business contact profile.');
    const payload = {};
    if (Object.prototype.hasOwnProperty.call(profilePatch, 'phone')) payload.phone = String(profilePatch.phone || '').trim();
    if (Object.prototype.hasOwnProperty.call(profilePatch, 'email')) payload.email = String(profilePatch.email || '').trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(profilePatch, 'gst')) payload.gst = String(profilePatch.gst || '').trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(profilePatch, 'bank')) payload.bank = String(profilePatch.bank || '').trim();
    if (Object.prototype.hasOwnProperty.call(profilePatch, 'ifsc')) payload.ifsc = String(profilePatch.ifsc || '').trim().toUpperCase();
    if (!Object.keys(payload).length) throw new Error('Please share the new mobile number, email ID, GST, bank account, or IFSC.');
    const response = await fetch(`/api/businesses/${encodeURIComponent(user.userid)}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Unable to update the business contact profile right now.');
    const updatedUser = {
      ...user,
      ...(data?.user || {})
    };
    syncCurrentUserCache(updatedUser);
    await refreshLiveBusinessViews('robert-profile-update');
    return updatedUser;
  };
  const parseProfilePatchFromText = (text = '') => {
    const raw = String(text || '').trim();
    if (!raw) return {};
    const patch = {};
    const emailMatch = raw.match(/(?:email|mail)\s*(?:id|address|is|to|as|set\s*to|change\s*to|update\s*to)?\s*([^\s<>"'`]+@[^\s<>"'`]+\.[^\s<>"'`]{2,})/i);
    const phoneMatch = raw.match(/(?:mobile|phone|contact)\s*(?:no|number|is|to|as|set\s*to|change\s*to|update\s*to)?\s*([+]?\d[\d\s-]{6,20}\d)/i)
      || raw.match(/\b(?:mobile|phone|contact)\s*(?:is|to|as|number|no|:)?\s*([+]?\d[\d\s-]{6,20}\d)\b/i);
    const gstMatch = raw.match(/(?:gst(?:in)?|tax(?:\s*id)?|goods\s+and\s+services\s+tax|gst\s*number)\s*(?:number|no|id|is|to|as|details|:)?\s*([A-Z0-9]{10,20})/i)
      || raw.match(/\b([0-9]{2}[A-Z0-9]{13})\b/i);
    const bankMatch = raw.match(/(?:bank(?:\s*account)?|account(?:\s*number)?|a\/c|ac|acct|bank\s*no|account\s*no)\s*(?:number|no|is|to|as|details|:)?\s*([0-9]{6,20})/i)
      || raw.match(/(?:bank(?:\s*account)?|account(?:\s*number)?|a\/c|ac|acct|bank\s*no|account\s*no)\s*(?:is|to|as|:)?\s*([0-9]{6,20})\b/i);
    const ifscMatch = raw.match(/(?:ifsc|ifsc\s*code)\s*(?:code|is|to|as|:)?\s*([A-Z]{4}0[A-Z0-9]{6})/i);
    if (emailMatch?.[1]) patch.email = emailMatch[1].trim().toLowerCase();
    if (phoneMatch?.[1]) patch.phone = normalizeBusinessPhone(phoneMatch[1]);
    if (gstMatch?.[1]) patch.gst = gstMatch[1].trim().toUpperCase();
    if (bankMatch?.[1]) patch.bank = bankMatch[1].trim();
    if (ifscMatch?.[1]) patch.ifsc = ifscMatch[1].trim().toUpperCase();
    return patch;
  };
  const updateBusinessPassword = async (passwordPatch = {}) => {
    const user = currentUser();
    if (!user?.userid) throw new Error('Please log in first so I can change the business password.');
    const payload = {
      oldPassword: String(passwordPatch.oldPassword || '').trim(),
      newPassword: String(passwordPatch.newPassword || '').trim(),
      confirmPassword: String(passwordPatch.confirmPassword || '').trim()
    };
    const response = await fetch(`/api/businesses/${encodeURIComponent(user.userid)}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Unable to update the business password right now.');
    const updatedUser = {
      ...user,
      ...(data?.user || {})
    };
    syncCurrentUserCache(updatedUser);
    await refreshLiveBusinessViews('robert-password-update');
    return updatedUser;
  };
  const refreshLiveBusinessViews = async (source = 'robert-action') => {
    if (typeof window.refreshCommandCenterData === 'function') {
      try { await window.refreshCommandCenterData({ silent: true, source }); return; } catch {}
    }
    if (typeof window.updateDashboard === 'function') {
      try { await window.updateDashboard(); } catch {}
    }
  };
  const persist = () => {};
  const extract = (text, regex, fallback = '') => { const match = String(text || '').match(regex); return match ? (match[1] || '').trim() : fallback; };
  const segment = (text, start, stops) => extract(text, new RegExp(`(?:${start})\\s+(.+?)(?=\\s+(?:${stops})\\b|$)`, 'i'));
  const nlpText = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9\s:]/g, ' ').replace(/\s+/g, ' ').trim();
  const hasAnyPhrase = (text, phrases = []) => phrases.some((phrase) => text.includes(phrase));
  const looksLikeOrderMessage = (text = '') => {
    const raw = String(text || '').trim();
    if (!raw) return false;
    const lower = raw.toLowerCase();
    const hasPhone = /\b\d{8,15}\b/.test(raw);
    const hasPin = /\b\d{6}\b/.test(raw);
    const hasAddress = /\baddress\b|\bdelivery\b|\bdeliver\b|\bshipping\b/i.test(lower);
    const hasItemLabel = /\bitems?\b|\bproducts?\b/i.test(lower);
    const hasPricedItem = /(?:^|[\s,;])([a-z][a-z0-9 .&()/-]{1,80})\s*x\s*\d+(?:\s*@\s*\d+(?:\.\d+)?)?/i.test(lower);
    const hasOrderVerb = /\b(create|place|make|generate|new|book)\b.*\b(order|invoice)\b|\b(order|invoice)\b.*\b(create|place|make|generate|new|book)\b|order bana|bana order|order kar|order bhej/i.test(lower);
    return hasOrderVerb || ((hasPhone || hasPin) && hasAddress && (hasItemLabel || hasPricedItem)) || (hasPhone && hasPricedItem);
  };
  const safeMathNumber = (value) => { const numeric = Number(value); return Number.isFinite(numeric) ? Number(numeric.toFixed(6)) : null; };
  const extractDirectMathExpression = (text) => {
    const source = String(text || '').replace(/,/g, '').replace(/[xX×]/g, '*').replace(/÷/g, '/');
    const sqrtMatch = source.match(/(?:square root of|sqrt of|sqrt|root of)\s*(-?\d+(?:\.\d+)?)/i);
    if (sqrtMatch) return `Math.sqrt(${sqrtMatch[1]})`;
    const percentMatch = source.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:of|on)\s*(-?\d+(?:\.\d+)?)/i);
    if (percentMatch) return `((${percentMatch[1]}/100)*${percentMatch[2]})`;
    const arithmeticMatch = source.match(/-?\d+(?:\.\d+)?(?:\s*(?:\+|-|\*|\/)\s*-?\d+(?:\.\d+)?)+/);
    return arithmeticMatch ? arithmeticMatch[0] : '';
  };
  const mathWordExpression = (text) => {
    let normalized = ` ${String(text || '').toLowerCase()} `;
    const replacements = [
      [/(?:square root of|sqrt of|sqrt|root of|वर्गमूल|মূল|raiz cuadrada)\s*(\d+(?:\.\d+)?)/g, ' Math.sqrt($1) '],
      [/(?:plus|add|sum|jod|jodo|jod do|aur|और|যোগ)\b/g, ' + '],
      [/(?:minus|subtract|less|ghata|ghatao|कम|বিয়োগ)\b/g, ' - '],
      [/(?:multiplied by|multiply|times|into|guna|gunaa|गुणा|গুণ)\b/g, ' * '],
      [/(?:divided by|divide|bhaag|भाग|ভাগ)\b/g, ' / '],
      [/(?:power of|raised to|to the power)\b/g, ' ^ ']
    ];
    replacements.forEach(([pattern, replacement]) => { normalized = normalized.replace(pattern, replacement); });
    normalized = normalized.replace(/\b(what|whats|what s|is|equals|equal|calculate|solve|please|answer|result|how much|kitna|hoga|hai|hisab|hisaab)\b/g, ' ');
    normalized = normalized.replace(/(\d)\s*x\s*(\d)/gi, '$1 * $2');
    normalized = normalized.replace(/[×]/g, '*').replace(/[÷]/g, '/');
    normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*%\s*(?:of|ka|का|का value|का कितना)?\s*(\d+(?:\.\d+)?)/gi, '(($1/100)*$2)');
    normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
    normalized = normalized.replace(/\^/g, '**');
    normalized = normalized.replace(/[^0-9+\-*/().\sA-Za-z_]/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
  };
  const safeEvalMathExpression = (text) => {
    let expression = mathWordExpression(text);
    if ((!expression || /[A-Za-z]/.test(expression.replace(/Math\.sqrt/g, ''))) && extractDirectMathExpression(text)) {
      expression = extractDirectMathExpression(text);
    }
    if (!expression) return null;
    if (!/^[0-9+\-*/().\sA-Za-z_]+$/.test(expression)) return null;
    if (!/[\d)]/.test(expression)) return null;
    try {
      const result = Function(`"use strict"; return (${expression});`)();
      return safeMathNumber(result);
    } catch {
      return null;
    }
  };
  const solveLocalMath = (text) => {
    const raw = String(text || '').trim();
    if (looksLikeOrderMessage(raw) || /\b(customer|phone|mobile|address|delivery|pincode|pin|items?)\b/i.test(raw)) return null;
    const clean = raw.toLowerCase().replace(/,/g, '');
    let match = clean.match(/(?:gst|tax)\s*(\d+(?:\.\d+)?)\s*%?\s*(?:on|of|for|ka|का)?\s*(\d+(?:\.\d+)?)/i)
      || clean.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:gst|tax)\s*(?:on|of|for|ka|का)?\s*(\d+(?:\.\d+)?)/i);
    if (match) {
      const rate = Number(match[1]) || 0;
      const base = Number(match[2]) || 0;
      const tax = safeMathNumber((base * rate) / 100) || 0;
      return `GST ${rate}% on ${formatMoney(base)} is ${formatMoney(tax)}. Total is ${formatMoney(base + tax)}.`;
    }
    match = clean.match(/(?:discount|off)\s*(\d+(?:\.\d+)?)\s*%?\s*(?:on|of|for|ka|का)?\s*(\d+(?:\.\d+)?)/i)
      || clean.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:discount|off)\s*(?:on|of|for|ka|का)?\s*(\d+(?:\.\d+)?)/i);
    if (match) {
      const rate = Number(match[1]) || 0;
      const base = Number(match[2]) || 0;
      const discount = safeMathNumber((base * rate) / 100) || 0;
      return `Discount ${rate}% on ${formatMoney(base)} is ${formatMoney(discount)}. Final amount is ${formatMoney(base - discount)}.`;
    }
    match = clean.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of|ka|का)\s*(\d+(?:\.\d+)?)/i);
    if (match) {
      const rate = Number(match[1]) || 0;
      const base = Number(match[2]) || 0;
      const result = safeMathNumber((base * rate) / 100) || 0;
      return `${rate}% of ${base} is ${result}.`;
    }
    const evaluated = safeEvalMathExpression(raw);
    if (evaluated === null) return null;
    return `Result: ${evaluated}.`;
  };
  const istDate = () => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full' }).format(new Date());
  const istTime = () => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', timeStyle: 'medium', hour12: true }).format(new Date());
  const currentDateTimeReply = () => `Current date is ${istDate()} and current time is ${istTime()} IST.`;
  const parseItems = (block) => {
    const source = String(block || '').trim();
    if (!source) return [];
    const directMatches = Array.from(source.matchAll(/([^,;\n]+?)\s*x\s*(\d+)(?:\s*@\s*(\d+(?:\.\d+)?))?/gi))
      .map((match) => ({
        name: String(match[1] || '').trim(),
        qty: Math.max(Number(match[2]) || 1, 1),
        price: roundMoneyValue(match[3]),
        hsn: ''
      }))
      .filter((item) => item.name);
    if (directMatches.length) return directMatches;
    return source
      .split(/\r?\n|,|;/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/(.+?)\s*x\s*(\d+)(?:\s*@\s*(\d+(?:\.\d+)?))?/i);
        return match ? {
          name: String(match[1] || '').trim(),
          qty: Math.max(Number(match[2]) || 1, 1),
          price: roundMoneyValue(match[3]),
          hsn: ''
        } : null;
      })
      .filter(Boolean);
  };
  const cleanPortal = () => { document.querySelectorAll('th,td,p,span,div,button,label,option,h1,h2,h3,h4,h5,a,small').forEach((element) => { if (element.children.length && !element.matches('.social-btn,.provider-logo,.partner-logo')) return; const cleaned = sanitizeText(element.textContent || ''); if (cleaned !== (element.textContent || '')) element.textContent = cleaned; }); document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach((element) => { const cleaned = sanitizeText(element.getAttribute('placeholder') || ''); if (cleaned !== (element.getAttribute('placeholder') || '')) element.setAttribute('placeholder', cleaned); }); const status = document.getElementById('rovert-status'); if (status) status.textContent = READY; const close = document.getElementById('rovert-close'); if (close && /x/i.test(close.textContent || '')) close.textContent = '\u2715'; document.querySelectorAll('.social-btn').forEach((button, index) => { if (/Ã|â|ð|Â/.test(button.textContent || '')) button.textContent = ['FB', 'IG', 'X', 'IN'][index] || 'SM'; }); };

  const initNav = () => { const button = document.querySelector('.nav-toggle'); const links = document.querySelector('.nav-links'); if (!button || !links) return; button.addEventListener('click', () => { button.classList.toggle('open'); links.classList.toggle('open'); links.classList.toggle('active'); playUiTone(); }); };
  const initContact = () => document.querySelectorAll('form.contact-form,#contact-form').forEach((form) => form.addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(form).entries()); if (!data.name || !data.email || !data.message) return toast('Please complete the contact form before sending.', 'error'); const payload = { name: data.name, email: data.email, phone: data.phone || '', businessType: data.businessType || '', message: data.message, sourcePage: (location.pathname.split('/').pop() || 'index.html').toLowerCase() }; const ref = formRef('CNT'); try { await Promise.allSettled([json('/api/contacts', payload), fetch('https://formspree.io/f/xeepvrqa', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })]); location.href = `confirmation.html?type=contact&ref=${encodeURIComponent(ref)}`; } catch (error) { toast(error.message || 'Unable to send the contact form right now.', 'error'); } }));
  const initCourier = () => { const form = document.getElementById('courier-portal-form'); if (!form) return; form.addEventListener('submit', async (event) => { event.preventDefault(); const provider = providerName(document.getElementById('courier-provider')?.value || nextProvider()); const service = document.getElementById('courier-service-type')?.value || 'standard'; const weight = Number(document.getElementById('courier-weight')?.value || 0); const value = Number(document.getElementById('courier-value')?.value || 0); const courier = { awb: `${PROVIDER_CODES[provider]}-${Math.floor(100000 + Math.random() * 900000)}`, provider, senderName: document.getElementById('courier-sender-name')?.value || 'Customer', senderPhone: document.getElementById('courier-sender-phone')?.value || '', originPincode: document.getElementById('courier-origin-pincode')?.value || '', destinationPincode: document.getElementById('courier-destination-pincode')?.value || '', service, weight, value, description: document.getElementById('courier-description')?.value || '', status: 'Pickup Scheduled', cost: courierCost(weight, value, service), date: new Date().toISOString(), businessUserId: currentUser()?.userid || '', businessName: currentUser()?.business?.name || '' }; const saved = await json('/api/couriers', courier).catch(() => ({ record: courier })); const liveCourier = saved?.record || courier; const liveProvider = PROVIDER_LABELS[providerName(liveCourier.provider)] || liveCourier.provider || 'Courier'; const result = document.getElementById('courier-portal-result'); if (result) result.innerHTML = `<div><h4 style="margin-bottom:0.75rem;font-family:'Orbitron',sans-serif;">Pickup Scheduled</h4><p style="line-height:1.8;">AWB ${liveCourier.awb}<br>Provider: ${liveProvider}<br>Service: ${liveCourier.service || service}<br>Cost: ${formatMoney(liveCourier.cost)}</p></div>`; [['pickup-date', new Date(liveCourier.date || Date.now()).toLocaleString('en-IN')], ['pickup-by', liveProvider], ['transit-date', 'Awaiting live courier update'], ['transit-by', 'Awaiting live courier update'], ['delivered-date', 'Awaiting live courier update'], ['delivered-by', 'Awaiting live courier update']].forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; }); toast(`Courier booked. AWB ${liveCourier.awb}`, 'success'); form.reset(); }); };

  const history = () => currentPortalState().robertHistory;
  const saveHistory = (items) => {
    const nextHistory = (Array.isArray(items) ? items : []).slice(-20).map((item) => ({
      role: String(item?.role || '').toLowerCase() === 'user' ? 'user' : 'assistant',
      text: String(item?.text || '').trim(),
      createdAt: String(item?.createdAt || new Date().toISOString()).trim()
    })).filter((item) => item.text);
    portalStateCache = normalizePortalState({ ...currentPortalState(), robertHistory: nextHistory });
    savePortalState({ robertHistory: nextHistory }, { silent: true });
  };
  const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const scrollRobertChatToBottom = () => {
    const chat = document.getElementById('rovert-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
    return chat;
  };
  const message = (text, role, save = true) => {
    const chat = document.getElementById('rovert-chat');
    if (!chat) return null;
    const node = document.createElement('div');
    node.className = `rovert-message ${role === 'user' ? 'user' : 'bot'}`;
    node.textContent = sanitizeText(text);
    chat.appendChild(node);
    scrollRobertChatToBottom();
    if (save) {
      const items = history();
      items.push({ role: role === 'user' ? 'user' : 'assistant', text: node.textContent });
      saveHistory(items);
    }
    return node;
  };
  const animateRobertReply = async (text, save = true) => {
    const finalText = sanitizeText(text);
    if (!finalText) return message('', 'assistant', save);
    if (prefersReducedMotion() || finalText.length < 6) return message(finalText, 'assistant', save);
    const chat = document.getElementById('rovert-chat');
    if (!chat) return null;
    const node = document.createElement('div');
    node.className = 'rovert-message bot';
    node.setAttribute('data-rovert-streaming', 'true');
    chat.appendChild(node);
    scrollRobertChatToBottom();
    const charsPerFrame = finalText.length > 320 ? 8 : finalText.length > 180 ? 6 : 4;
    const frameDelay = finalText.length > 320 ? 8 : 14;
    for (let index = 0; index < finalText.length; index += charsPerFrame) {
      node.textContent = finalText.slice(0, index + charsPerFrame);
      scrollRobertChatToBottom();
      await new Promise((resolve) => setTimeout(resolve, frameDelay));
    }
    node.textContent = finalText;
    node.removeAttribute('data-rovert-streaming');
    if (save) {
      const items = history();
      items.push({ role: 'assistant', text: finalText });
      saveHistory(items);
    }
    return node;
  };
  const hideRobertTyping = () => { if (robertTypingNode) { robertTypingNode.remove(); robertTypingNode = null; } };
  const clearRobertComposer = () => {
    const input = document.getElementById('rovert-input');
    if (input) input.value = '';
    const file = document.getElementById('rovert-file');
    if (file) file.value = '';
    const label = document.getElementById('rovert-file-name');
    if (label) label.textContent = 'No file selected';
    const status = document.getElementById('rovert-status');
    if (status) status.textContent = READY;
  };
  const showRobertTyping = () => {
    const chat = document.getElementById('rovert-chat');
    if (!chat) return null;
    hideRobertTyping();
    const node = document.createElement('div');
    node.className = 'rovert-message bot';
    node.setAttribute('data-rovert-typing', 'true');
    node.innerHTML = '<span class="rovert-typing" aria-label="ROBERT is typing"><span class="rovert-dot"></span><span class="rovert-dot"></span><span class="rovert-dot"></span></span>';
    chat.appendChild(node);
    chat.scrollTop = chat.scrollHeight;
    robertTypingNode = node;
    return node;
  };
  const renderHistory = () => { const chat = document.getElementById('rovert-chat'); if (!chat) return; chat.innerHTML = ''; robertTypingNode = null; history().forEach((item) => message(item.text, item.role, false)); };
  const robertStatus = (text) => { const node = document.getElementById('rovert-status'); if (node) node.textContent = sanitizeText(text); };
  const updateRobertAccessUI = () => {
    const access = robertAccessState();
    const statusMessage = access.allowed ? READY : access.message;
    if (!access.allowed) {
      if (robertAbort) {
        robertAbort.abort();
        robertAbort = null;
      }
      if (robertRecognition) {
        try { robertRecognition.stop(); } catch {}
        robertRecognition = null;
      }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      setRobertMicState(false);
      hideRobertTyping();
    }
    document.querySelectorAll('#rovert-fab,#admin-rovert-btn,#rovert-hero-btn').forEach((node) => {
      node.classList.toggle('rovert-trigger-locked', !access.allowed);
      node.setAttribute('title', access.allowed ? 'Open ROBERT Assistant' : access.message);
      node.setAttribute('aria-disabled', access.allowed ? 'false' : 'true');
    });
    const panel = document.getElementById('rovert-panel');
    if (panel) panel.classList.toggle('rovert-panel-locked', !access.allowed);
    const input = document.getElementById('rovert-input');
    if (input) {
      input.disabled = !access.allowed;
      input.placeholder = access.allowed ? 'Ask Robert about your business...' : access.message;
    }
    ['rovert-send', 'rovert-mic', 'rovert-stop', 'rovert-clear', 'rovert-analysis-download', 'rovert-file', 'rovert-analysis', 'rovert-ocr', 'rovert-language'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.disabled = !access.allowed;
    });
    document.querySelectorAll('.rovert-chip').forEach((chip) => { chip.disabled = !access.allowed; });
    const fileLabel = document.getElementById('rovert-file-name');
    if (fileLabel) fileLabel.textContent = access.allowed ? (document.getElementById('rovert-file')?.files?.[0]?.name || 'No file selected') : 'Available on Gold and Platinum plans';
    robertStatus(statusMessage);
    return access;
  };
  const showRobertAccessMessage = (options = {}) => {
    const access = updateRobertAccessUI();
    if (access.allowed) return access;
    const panel = document.getElementById('rovert-panel');
    if (options.openPanel && panel) {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
    }
    if (options.toast !== false) toast(access.message, 'info');
    const chat = document.getElementById('rovert-chat');
    const lastText = chat?.lastElementChild?.textContent?.trim();
    if (chat && lastText !== access.message) message(access.message, 'assistant', false);
    return access;
  };
  const normalizeRobertSpeechLanguage = (value = '') => {
    const lang = String(value || '').trim();
    return ROBERT_LANGUAGE_LABELS[lang] ? lang : 'en-US';
  };
  const robertLanguageLabel = (value = '') => ROBERT_LANGUAGE_LABELS[normalizeRobertSpeechLanguage(value)] || 'English';
  const setRobertMicState = (listening = false) => {
    const button = document.getElementById('rovert-mic');
    if (!button) return;
    button.classList.toggle('is-listening', listening);
    button.setAttribute('aria-pressed', listening ? 'true' : 'false');
    button.title = listening ? 'Listening...' : 'Voice input';
  };
  const saveRobertLanguagePreference = async (value) => {
    const user = robertScopedUser();
    if (!user?.userid) return settings().rovertLanguage;
    const nextSettings = {
      bookingCutoff: settings().bookingCutoff,
      rovertLanguage: value === 'auto' ? settings().rovertLanguage : value
    };
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(user.userid)}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(nextSettings)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Unable to save Robert language right now.');
      if (data?.user) syncCurrentUserCache({ ...user, ...data.user });
      window.dispatchEvent(new CustomEvent('smartlocal:robert-settings', { detail: nextSettings }));
      return nextSettings.rovertLanguage;
    } catch (error) {
      toast(error.message || 'Unable to save Robert language right now.', 'error');
      return settings().rovertLanguage;
    }
  };
  const robertLang = () => {
    const select = document.getElementById('rovert-language');
    const value = select?.value || settings().rovertLanguage;
    return normalizeRobertSpeechLanguage(value === 'auto' ? settings().rovertLanguage : value);
  };
  const robertResponseLength = () => {
    const select = document.getElementById('rovert-length');
    return normalizeRobertReplyLength(select?.value || currentPortalState().robertResponseLength || 'normal');
  };
  const robertBusinessName = () => {
    const user = robertScopedUser();
    return String(user?.business?.name || user?.name || 'SmartLocal').trim() || 'SmartLocal';
  };
  const robertGreetingName = () => {
    const user = robertScopedUser();
    const businessName = String(user?.business?.name || user?.name || '').trim();
    if (businessName) return businessName;
    return 'SmartLocal';
  };
  const updateRobertIdentity = () => {
    const businessName = robertBusinessName();
    document.querySelectorAll('.rovert-subtitle').forEach((node) => {
      node.textContent = sanitizeText(`Live business help for ${businessName}`);
    });
  };
  const robertGreeting = () => {
    const hour = new Date().getHours();
    const greetingName = robertGreetingName();
    const salutation = robertScopedUser()?.userid ? greetingName : 'SmartLocal';
    if (hour < 12) return `Good morning, ${salutation}. I am Robert from SmartLocal. How may I help you today?`;
    if (hour < 17) return `Good afternoon, ${salutation}. I am Robert from SmartLocal. How may I help you today?`;
    return `Good evening, ${salutation}. I am Robert from SmartLocal. How may I help you today?`;
  };
  const syncRobertGreetingHistory = () => {
    const items = history();
    if (!items.length) return false;
    const firstItem = items[0];
    if (!firstItem || firstItem.role !== 'assistant') return false;
    if (!/^Good (morning|afternoon|evening),\s+/i.test(String(firstItem.text || '').trim())) return false;
    const nextGreeting = robertGreeting();
    if (String(firstItem.text || '').trim() === nextGreeting) return false;
    items[0] = { ...firstItem, text: nextGreeting };
    saveHistory(items);
    return true;
  };
  const pickRobertVoice = (lang = robertLang()) => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const safeLang = normalizeRobertSpeechLanguage(lang);
    return voices.find((voice) => String(voice.lang || '').toLowerCase() === safeLang.toLowerCase())
      || voices.find((voice) => String(voice.lang || '').toLowerCase().startsWith(safeLang.split('-')[0].toLowerCase()))
      || null;
  };
  const robertSpeak = (text) => {
    const toggle = document.getElementById('rovert-voice-toggle');
    if (!toggle?.checked || !('speechSynthesis' in window)) return;
    const spokenText = String(text || '').trim();
    if (!spokenText) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = robertLang();
    const voice = pickRobertVoice(utterance.lang);
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  };
  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Unable to read ${file?.name || 'the file'}.`));
    reader.readAsDataURL(file);
  });
  const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Unable to read ${file?.name || 'the file'}.`));
    reader.readAsArrayBuffer(file);
  });
  const dataUrlToBase64 = (value = '') => String(value || '').split(',')[1] || '';
  const isPdfFile = (file) => /\.pdf$/i.test(String(file?.name || '')) || String(file?.type || '').toLowerCase().includes('pdf');
  const isImageFile = (file) => /^image\//i.test(String(file?.type || '')) || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(String(file?.name || ''));
  const ensurePdfWorker = () => {
    if (!window.pdfjsLib) return false;
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
    return true;
  };
  const extractPdfText = async (file) => {
    if (!ensurePdfWorker()) return '';
    const buffer = await readFileAsArrayBuffer(file);
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const textParts = [];
    const maxPages = Math.min(pdf.numPages || 0, 10);
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = (content.items || []).map((item) => item?.str || '').join(' ').replace(/\s+/g, ' ').trim();
      if (pageText) textParts.push(pageText);
    }
    return textParts.join('\n').trim();
  };
  const extractPdfOcrText = async (file) => {
    if (!ensurePdfWorker() || !window.Tesseract) return '';
    const buffer = await readFileAsArrayBuffer(file);
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const lang = ROBERT_TESSERACT_LANG[robertLang()] || 'eng';
    const textParts = [];
    const maxPages = Math.min(pdf.numPages || 0, 5);
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.75 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) continue;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await window.Tesseract.recognize(canvas, lang);
      const pageText = String(result?.data?.text || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (pageText) textParts.push(pageText);
      canvas.width = 0;
      canvas.height = 0;
    }
    return textParts.join('\n').trim();
  };
  const extractImageText = async (file) => {
    if (!window.Tesseract) return '';
    const lang = ROBERT_TESSERACT_LANG[robertLang()] || 'eng';
    const result = await window.Tesseract.recognize(file, lang);
    return String(result?.data?.text || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };
  const buildRobertFilePrompt = (file, analysisMode = 'short', ocrText = '') => {
    const fileTypeLabel = isPdfFile(file) ? 'PDF' : 'image';
    const modeLabel = analysisMode === 'long' ? 'long' : 'short';
    return [
      `Analyze this ${fileTypeLabel} for the business user.`,
      modeLabel === 'long'
        ? 'Give a long, detailed analysis with structured findings, extracted points, risks, observations, and recommended actions.'
        : 'Give a short analysis with the main findings, key extracted points, and one quick recommendation.',
      `Respond in ${robertLanguageLabel(robertLang())}.`,
      ocrText ? `Use OCR/extracted text when helpful:\n${ocrText}` : ''
    ].filter(Boolean).join('\n\n');
  };
  const buildRobertLocalFileAnalysisReply = (file, analysisMode = 'short', ocrText = '') => {
    const text = String(ocrText || '').replace(/\s+/g, ' ').trim();
    const label = isPdfFile(file) ? 'PDF' : 'image';
    const sample = text ? text.slice(0, analysisMode === 'long' ? 900 : 320) : '';
    const lines = [
      `Robert could not reach the online model, so here is a local ${analysisMode} analysis of the ${label}.`,
      sample ? `Detected text preview: ${sample}` : 'No OCR text was available from this file.',
      analysisMode === 'long'
        ? 'Review the headings, totals, dates, names, and any mismatched values carefully.'
        : 'Review the main text, totals, names, and dates carefully.',
      'This fallback analysis is still ready to save and download as a PDF.'
    ];
    return lines.join(' ');
  };
  const downloadRobertAnalysisPdf = (analysis = {}) => {
    const doc = pdfDoc();
    if (!doc) return false;
    const fileName = String(analysis.fileName || 'analysis').trim();
    let y = 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('ROBERT File Analysis', 14, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = pdfWrite(doc, `File: ${fileName}`, 14, y);
    y = pdfWrite(doc, `Mode: ${analysis.analysisMode === 'long' ? 'Long' : 'Short'}`, 14, y);
    y = pdfWrite(doc, `Language: ${robertLanguageLabel(analysis.preferredLanguage || robertLang())}`, 14, y);
    y = pdfWrite(doc, `Provider: ${robertProviderLabel(analysis.provider, analysis.fallback)}`, 14, y);
    y = pdfWrite(doc, `Generated At: ${new Date().toLocaleString('en-IN')}`, 14, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Analysis', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    y = pdfWrite(doc, analysis.reply || 'No analysis reply available.', 14, y);
    if (analysis.ocrText) {
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('OCR / Extracted Text', 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      pdfWrite(doc, analysis.ocrText, 14, y);
    }
    doc.save(`${safeFileStem(fileName, 'robert_analysis')}.pdf`);
    return true;
  };
  const runRobertFileAnalysis = async ({ download = false } = {}) => {
    const access = robertAccessState();
    if (!access.allowed) {
      showRobertAccessMessage({ openPanel: true, toast: true });
      return;
    }
    const fileInput = document.getElementById('rovert-file');
    const selectedFile = fileInput?.files?.[0];
    if (!selectedFile) {
      toast('Please upload a PDF or image first.', 'info');
      return;
    }
    const analysisMode = String(document.getElementById('rovert-analysis')?.value || 'short').trim().toLowerCase() === 'long' ? 'long' : 'short';
    const ocrEnabled = Boolean(document.getElementById('rovert-ocr')?.checked);
    const user = currentUser();
    let ocrText = '';
    let payload = null;
    message(`Analyze ${selectedFile.name} with ${analysisMode} analysis.`, 'user');
    robertStatus(`ROBERT is reading ${selectedFile.name}...`);
    const typingStartedAt = Date.now();
    showRobertTyping();
    try {
      if (ocrEnabled) {
        robertStatus(`ROBERT is extracting text from ${selectedFile.name}...`);
        if (isPdfFile(selectedFile)) {
          ocrText = await extractPdfText(selectedFile);
          if (!ocrText) {
            robertStatus(`ROBERT is running OCR on ${selectedFile.name}...`);
            ocrText = await extractPdfOcrText(selectedFile);
          }
        } else if (isImageFile(selectedFile)) {
          ocrText = await extractImageText(selectedFile);
        }
      }
      const dataUrl = await readFileAsDataUrl(selectedFile);
      payload = {
        userid: String(user?.userid || '').trim(),
        preferredLanguage: robertLang(),
        analysisMode,
        responseLength: analysisMode,
        ocrText,
        prompt: buildRobertFilePrompt(selectedFile, analysisMode, ocrText),
        file: {
          name: selectedFile.name,
          type: isPdfFile(selectedFile) ? 'application/pdf' : (selectedFile.type || 'application/octet-stream'),
          data: dataUrlToBase64(dataUrl)
        }
      };
      const data = await json('/api/rovert-file', payload);
      const elapsed = Date.now() - typingStartedAt;
      if (elapsed < 320) await new Promise((resolve) => setTimeout(resolve, 320 - elapsed));
      hideRobertTyping();
      await animateRobertReply(data.reply || 'Robert could not prepare a file analysis.');
      robertSpeak(data.reply || '');
      cacheRobertAiMeta({
        provider: data?.provider || 'local',
        fallback: Boolean(data?.fallback),
        aiStatus: data?.aiStatus || 'success',
        aiMode: 'file',
        aiReason: data?.aiReason || '',
        aiAt: data?.aiAt || new Date().toISOString()
      });
      const record = {
        businessUserId: String(user?.userid || '').trim(),
        businessName: activeBusinessName('SmartLocal Business'),
        fileName: selectedFile.name,
        fileType: selectedFile.type || 'application/octet-stream',
        analysisMode,
        preferredLanguage: robertLang(),
        provider: data?.provider || 'local',
        prompt: payload.prompt,
        reply: data?.reply || '',
        ocrText: data?.ocrText || ocrText || ''
      };
      await json('/api/analyses', record).catch(() => ({}));
      if (download) {
        const downloaded = downloadRobertAnalysisPdf({ ...record, fallback: Boolean(data?.fallback) });
        toast(downloaded ? 'Analysis PDF downloaded.' : 'Analysis is ready, but PDF download is unavailable right now.', downloaded ? 'success' : 'info');
      }
      robertStatus(`ROBERT file analysis ready. Source: ${robertProviderLabel(data?.provider || currentPortalState().robertLastProvider, Boolean(data?.fallback))}.`);
    } catch (error) {
      hideRobertTyping();
      const fallbackReply = buildRobertLocalFileAnalysisReply(selectedFile, analysisMode, ocrText);
      await animateRobertReply(fallbackReply);
      robertSpeak(fallbackReply);
      robertStatus('ROBERT file analysis ready using a local fallback.');
      const fallbackRecord = {
        businessUserId: String(user?.userid || '').trim(),
        businessName: activeBusinessName('SmartLocal Business'),
        fileName: selectedFile.name,
        fileType: selectedFile.type || 'application/octet-stream',
        analysisMode,
        preferredLanguage: robertLang(),
        provider: 'local',
        prompt: payload?.prompt || buildRobertFilePrompt(selectedFile, analysisMode, ocrText),
        reply: fallbackReply,
        ocrText
      };
      await json('/api/analyses', fallbackRecord).catch(() => ({}));
      if (download) {
        downloadRobertAnalysisPdf({ ...fallbackRecord, fallback: true });
      }
      toast(error?.message ? `Used local fallback: ${error.message}` : 'Used local fallback analysis.', 'info');
      robertStatus(READY);
    }
  };
  const stopRobert = () => {
    if (robertAbort) {
      robertAbort.abort();
      robertAbort = null;
    }
    if (robertRecognition) {
      try { robertRecognition.stop(); } catch {}
      robertRecognition = null;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setRobertMicState(false);
    hideRobertTyping();
    robertStatus(READY);
  };
  const openRobert = () => {
    const panel = document.getElementById('rovert-panel');
    if (!panel) return;
    updateRobertIdentity();
    playUiTone();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    const access = updateRobertAccessUI();
    if (!access.allowed) {
      setRobertMicState(false);
      hideRobertTyping();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const chat = document.getElementById('rovert-chat');
      const lastText = chat?.lastElementChild?.textContent?.trim();
      if (chat && lastText !== access.message) message(access.message, 'assistant', false);
      return;
    }
    if (syncRobertGreetingHistory()) {
      renderHistory();
    }
    if (!currentPortalState().robertGreeted) {
      const greeting = robertGreeting();
      savePortalState({ robertGreeted: true }, { silent: true });
      if (!history().length) message(greeting, 'assistant');
      robertSpeak(greeting);
    }
    document.getElementById('rovert-input')?.focus();
  };
  const closeRobert = () => {
    const panel = document.getElementById('rovert-panel');
    if (!panel) return;
    if (robertRecognition) {
      try { robertRecognition.stop(); } catch {}
      robertRecognition = null;
    }
    setRobertMicState(false);
    hideRobertTyping();
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  };
  const pdfText = (value) => sanitizeText(value).replace(/\u20B9/g, 'Rs. ').replace(/\s+/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
  const pdfDoc = (options = {}) => window.jspdf?.jsPDF ? new window.jspdf.jsPDF(options) : null;
  const pdfWrite = (doc, text, x, y, maxWidth = 180, lineHeight = 6) => {
    const lines = doc.splitTextToSize(pdfText(text), maxWidth);
    if (y + (lines.length * lineHeight) > 280) {
      doc.addPage();
      y = 18;
    }
    doc.text(lines, x, y);
    return y + (lines.length * lineHeight);
  };
  const pdfPageWidth = (doc) => Number(doc?.internal?.pageSize?.getWidth?.() || doc?.internal?.pageSize?.width || 210);
  const pdfPageHeight = (doc) => Number(doc?.internal?.pageSize?.getHeight?.() || doc?.internal?.pageSize?.height || 297);
  const ensurePdfSpace = (doc, y, neededHeight = 10, top = 18, bottom = 14) => {
    if (y + neededHeight > pdfPageHeight(doc) - bottom) {
      doc.addPage();
      return top;
    }
    return y;
  };
  const drawPdfTable = (doc, columns = [], rows = [], startY = 18, options = {}) => {
    if (!doc || !Array.isArray(columns) || !columns.length) return startY;
    const startX = Number(options.startX ?? 14);
    const totalWidth = columns.reduce((sum, column) => sum + (Number(column?.width) || 0), 0);
    const topMargin = Number(options.topMargin ?? 18);
    const bottomMargin = Number(options.bottomMargin ?? 14);
    const cellPadding = Number(options.cellPadding ?? 2.2);
    const headerHeight = Number(options.headerHeight ?? 8);
    const lineHeight = Number(options.lineHeight ?? 4.2);
    const minRowHeight = Number(options.minRowHeight ?? 8);
    const headerFill = options.headerFill || [15, 98, 254];
    const headerText = options.headerText || [255, 255, 255];
    const borderColor = options.borderColor || [207, 216, 227];
    const bodyText = options.bodyText || [18, 24, 38];
    const altFill = options.altFill || [248, 250, 252];
    const plainFill = options.plainFill || [255, 255, 255];
    const headerFontSize = Number(options.headerFontSize || 8.4);
    const headerLineHeight = Number(options.headerLineHeight || 3.4);
    const headerPadding = Number(options.headerPadding ?? Math.max(cellPadding - 0.2, 1.8));
    let y = startY;

    const drawHeader = () => {
      doc.setLineWidth(0.2);
      doc.setDrawColor(...borderColor);
      doc.setFont('courier', 'bold');
      doc.setFontSize(headerFontSize);
      const preparedHeaders = columns.map((column) => {
        const maxWidth = Math.max(Number(column?.width || 0) - (headerPadding * 2), 4);
        const lines = doc.splitTextToSize(pdfText(column?.header || ''), maxWidth);
        return {
          column,
          lines: Array.isArray(lines) && lines.length ? lines : ['']
        };
      });
      const maxHeaderLines = preparedHeaders.reduce((highest, cell) => Math.max(highest, cell.lines.length), 1);
      const headerRowHeight = Math.max(headerHeight, (maxHeaderLines * headerLineHeight) + (headerPadding * 2));
      y = ensurePdfSpace(doc, y, headerRowHeight + 2, topMargin, bottomMargin);
      let x = startX;
      preparedHeaders.forEach(({ column, lines }) => {
        doc.setFillColor(...headerFill);
        doc.setDrawColor(...borderColor);
        doc.rect(x, y, column.width, headerRowHeight, 'FD');
        doc.setTextColor(...headerText);
        doc.text(lines, x + headerPadding, y + headerPadding + 0.4, {
          align: 'left',
          baseline: 'top'
        });
        x += column.width;
      });
      y += headerRowHeight;
    };

    drawHeader();
    doc.setFont('courier', 'normal');
    doc.setFontSize(options.bodyFontSize || 8.1);
    doc.setTextColor(...bodyText);

    (Array.isArray(rows) ? rows : []).forEach((row, rowIndex) => {
      const preparedCells = columns.map((column) => {
        const text = pdfText(row?.[column.key] ?? '');
        const maxWidth = Math.max(column.width - (cellPadding * 2), 4);
        const lines = doc.splitTextToSize(text, maxWidth);
        return { column, lines: lines.length ? lines : [''] };
      });
      const maxLines = preparedCells.reduce((highest, cell) => Math.max(highest, cell.lines.length), 1);
      const rowHeight = Math.max(minRowHeight, (maxLines * lineHeight) + (cellPadding * 2));
      const nextY = ensurePdfSpace(doc, y, rowHeight + 1, topMargin, bottomMargin);
      if (nextY !== y) {
        y = nextY;
        drawHeader();
      }
      let x = startX;
      preparedCells.forEach(({ column, lines }) => {
        doc.setFillColor(...(rowIndex % 2 ? altFill : plainFill));
        doc.setDrawColor(...borderColor);
        doc.rect(x, y, column.width, rowHeight, 'FD');
        const textX = column.align === 'right' ? x + column.width - cellPadding : x + cellPadding;
        doc.text(lines, textX, y + cellPadding + 2.8, {
          align: column.align === 'right' ? 'right' : 'left',
          baseline: 'top'
        });
        x += column.width;
      });
      y += rowHeight;
    });
    doc.setTextColor(18, 24, 38);
    doc.setFont('courier', 'normal');
    return y + 2;
  };
  const documentBusinessName = (record = {}) => resolvedBusinessName(record, robertBusinessName());
  const invoiceBusinessName = (order) => documentBusinessName(order);
  const invoiceSignedAtLabel = () => new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date());
  const drawSignedPdfPanel = (doc, options = {}, y = 18) => {
    const businessName = String(options.businessName || robertBusinessName()).trim() || 'SmartLocal Business';
    const title = String(options.title || 'DIGITALLY SIGNED DOCUMENT').trim() || 'DIGITALLY SIGNED DOCUMENT';
    const subtitle = String(options.subtitle || `Verified by SmartLocal for ${businessName}`).trim() || `Verified by SmartLocal for ${businessName}`;
    const detailLine = String(options.detailLine || `Platform: SmartLocal | Business: ${businessName}`).trim() || `Platform: SmartLocal | Business: ${businessName}`;
    const signedAt = invoiceSignedAtLabel();
    const panelWidth = Math.min(182, pdfPageWidth(doc) - 28);
    if (y + 38 > pdfPageHeight(doc) - 14) {
      doc.addPage();
      y = 18;
    }
    doc.setDrawColor(134, 239, 172);
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, y, panelWidth, 34, 4, 4, 'FD');
    doc.setFillColor(34, 197, 94);
    doc.circle(24, y + 10, 5, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1.1);
    doc.line(21.5, y + 10, 23.3, y + 11.9);
    doc.line(23.3, y + 11.9, 27.2, y + 8.1);
    doc.setTextColor(22, 101, 52);
    doc.setFontSize(11);
    doc.text(pdfText(title), 34, y + 8);
    doc.setFontSize(9);
    doc.text(pdfText(subtitle), 34, y + 14);
    doc.text(pdfText(detailLine), 34, y + 20);
    doc.text(pdfText(`Signed at: ${signedAt}`), 34, y + 26);
    doc.setTextColor(18, 24, 38);
    return y + 38;
  };
  const drawInvoiceSignaturePanel = (doc, order, y) => drawSignedPdfPanel(doc, {
    title: 'DIGITALLY SIGNED INVOICE',
    businessName: invoiceBusinessName(order),
    subtitle: `Verified by SmartLocal for ${invoiceBusinessName(order)}`,
    detailLine: `Platform: SmartLocal | Business: ${invoiceBusinessName(order)}`
  }, y);
  const statementMoneyNumber = (value) => roundMoneyValue(value);
  const statementMoneyLabel = (value) => `${RUPEE}${statementMoneyNumber(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const buildComplaintAnalysis = (complaint = {}) => {
    const name = String(complaint?.name || 'Customer').trim() || 'Customer';
    const category = String(complaint?.category || 'General').trim() || 'General';
    const priority = String(complaint?.priority || 'Medium').trim() || 'Medium';
    const details = String(complaint?.details || '').trim();
    const combined = `${category} ${priority} ${details}`.toLowerCase();
    const highRisk = /(urgent|critical|fraud|lost|missing|damage|damaged|refund|payment|breach|injury|broken|fire)/i.test(combined) || /high/i.test(priority);
    const lowRisk = /(minor|general|query|question|feedback|suggestion)/i.test(combined) || /low/i.test(priority);
    const analysisSeverity = highRisk ? 'High' : (lowRisk ? 'Low' : 'Medium');
    const analysisAction = analysisSeverity === 'High'
      ? 'Call the customer immediately, verify the issue, and update the resolution status today.'
      : analysisSeverity === 'Medium'
        ? 'Review the complaint within 1 business day and share a status update with the customer.'
        : 'Acknowledge the complaint and resolve it in the standard support queue.';
    const shortDetails = details.length > 140 ? `${details.slice(0, 137)}...` : details;
    const analysisSummary = `${category} complaint logged for ${name}. Key issue: ${shortDetails || 'Customer needs support review.'}`;
    return {
      analysisSummary,
      analysisSeverity,
      analysisAction,
      automatedRemarks: [
        `Severity assessed as ${analysisSeverity.toLowerCase()} from the complaint details and priority.`,
        `Suggested next step: ${analysisAction}`,
        `Status is ${String(complaint?.status || 'Open').trim() || 'Open'} and is synced for live complaint tracking.`
      ]
    };
  };
  const syncRobertAction = async (storageKey, idKey, record, max, source) => {
    if (storageKey && idKey && record?.[idKey]) persist(storageKey, record, idKey, max);
    await refreshLiveBusinessViews(source);
  };
  const openOrderInvoicePage = (orderId) => {
    if (!orderId || typeof window === 'undefined') return false;
    try {
      const popup = window.open(`invoice.html?orderId=${encodeURIComponent(orderId)}`, '_blank', 'noopener');
      return Boolean(popup);
    } catch {
      return false;
    }
  };
  const downloadOrderInvoicePdf = (order) => {
    const doc = pdfDoc();
    if (!doc) return false;
    const businessName = invoiceBusinessName(order);
    const paymentMode = String(order?.payment || 'UPI').trim() || 'UPI';
    const courierLabel = `${PROVIDER_LABELS[providerName(order.courier?.provider)] || order.courier?.provider || 'Pending'} | ${order.courier?.awb || 'Pending'}`;
    let y = 18;
    doc.setFont('courier', 'normal');
    doc.setFontSize(15);
    doc.text('SMARTLOCAL INVOICE', 14, y);
    y += 8;
    y = drawPdfTable(doc, [
      { header: 'Field', key: 'leftLabel', width: 28 },
      { header: 'Value', key: 'leftValue', width: 72 },
      { header: 'Field', key: 'rightLabel', width: 28 },
      { header: 'Value', key: 'rightValue', width: 54 }
    ], [
      {
        leftLabel: 'Invoice ID',
        leftValue: order.orderId || '-',
        rightLabel: 'Date',
        rightValue: new Date(order.date).toLocaleDateString('en-IN')
      },
      {
        leftLabel: 'Business',
        leftValue: businessName,
        rightLabel: 'Payment',
        rightValue: paymentMode
      },
      {
        leftLabel: 'Customer',
        leftValue: order.customer?.name || '-',
        rightLabel: 'Phone',
        rightValue: order.customer?.phone || '-'
      },
      {
        leftLabel: 'Address',
        leftValue: order.customer?.address || '-',
        rightLabel: 'Status',
        rightValue: order.status || 'In Progress'
      },
      {
        leftLabel: 'GST No',
        leftValue: order.gstNo || '-',
        rightLabel: 'Courier',
        rightValue: courierLabel
      }
    ], y, {
      headerFill: [15, 28, 47],
      borderColor: [176, 190, 210],
      altFill: [247, 250, 253],
      plainFill: [255, 255, 255],
      bodyFontSize: 8.2,
      headerFontSize: 8.4
    });
    y += 2;
    y = drawPdfTable(doc, [
      { header: 'Sr', key: 'index', width: 12 },
      { header: 'Item', key: 'name', width: 62 },
      { header: 'HSN', key: 'hsn', width: 22 },
      { header: 'Qty', key: 'qty', width: 16, align: 'right' },
      { header: 'Rate', key: 'price', width: 28, align: 'right' },
      { header: 'Amount', key: 'amount', width: 42, align: 'right' }
    ], (order.items || []).map((item, index) => ({
      index: String(index + 1),
      name: item?.name || '-',
      hsn: item?.hsn || '-',
      qty: String(item?.qty || 0),
      price: statementMoneyLabel(item?.price || 0),
      amount: statementMoneyLabel((Number(item?.qty || 0) || 0) * (Number(item?.price || 0) || 0))
    })), y, {
      headerFill: [15, 98, 254],
      borderColor: [176, 190, 210],
      altFill: [248, 250, 252],
      plainFill: [255, 255, 255],
      bodyFontSize: 8.1,
      headerFontSize: 8.2
    });
    y += 2;
    y = drawPdfTable(doc, [
      { header: 'Summary', key: 'label', width: 42 },
      { header: 'Value', key: 'value', width: 36, align: 'right' }
    ], [
      { label: 'Subtotal', value: statementMoneyLabel(order.subtotal || 0) },
      { label: `GST ${Number(order.gstPercent || 0)}%`, value: statementMoneyLabel(order.gstAmount || 0) },
      { label: 'Grand Total', value: statementMoneyLabel(order.total || order.amount || 0) }
    ], y, {
      startX: pdfPageWidth(doc) - 14 - 78,
      headerFill: [22, 101, 52],
      borderColor: [176, 190, 210],
      bodyFontSize: 8.3,
      headerFontSize: 8.4
    });
    y += 6;
    drawInvoiceSignaturePanel(doc, order, y);
    doc.save(`invoice_${order.orderId}.pdf`);
    return true;
  };
  const downloadCourierReceiptPdf = (courier) => {
    const doc = pdfDoc();
    if (!doc) return false;
    const businessName = documentBusinessName(courier);
    let y = 18;
    doc.setFont('courier', 'normal');
    doc.setFontSize(14);
    doc.text('SMARTLOCAL COURIER RECEIPT', 14, y);
    y += 8;
    doc.setFontSize(10);
    y = pdfWrite(doc, `AWB: ${courier.awb}`, 14, y);
    y = pdfWrite(doc, `Date: ${new Date(courier.date).toLocaleString('en-IN')}`, 14, y);
    y = pdfWrite(doc, `Provider: ${PROVIDER_LABELS[providerName(courier.provider)] || courier.provider || 'Courier'}`, 14, y);
    y = pdfWrite(doc, `Sender: ${courier.senderName || 'Customer'}`, 14, y);
    if (courier.senderPhone) y = pdfWrite(doc, `Phone: ${courier.senderPhone}`, 14, y);
    y = pdfWrite(doc, `Route: ${courier.originPincode || 'N/A'} -> ${courier.destinationPincode || 'N/A'}`, 14, y);
    y = pdfWrite(doc, `Service: ${courier.service || 'standard'}`, 14, y);
    y = pdfWrite(doc, `Weight: ${courier.weight || 0} kg`, 14, y);
    y = pdfWrite(doc, `Declared Value: Rs. ${Number(courier.value || 0).toFixed(2)}`, 14, y);
    y = pdfWrite(doc, `Cost: Rs. ${Number(courier.cost || 0).toFixed(2)}`, 14, y);
    y = pdfWrite(doc, `Status: ${courier.status || 'Pickup Scheduled'}`, 14, y);
    if (courier.description) y = pdfWrite(doc, `Description: ${courier.description}`, 14, y);
    y += 6;
    drawSignedPdfPanel(doc, {
      title: 'DIGITALLY SIGNED COURIER RECEIPT',
      businessName,
      subtitle: `Verified courier receipt for ${businessName}`,
      detailLine: `Platform: SmartLocal | AWB: ${courier.awb || 'Pending'}`
    }, y);
    doc.save(`courier_${courier.awb}.pdf`);
    return true;
  };
  const downloadComplaintReceiptPdf = (complaint) => {
    const doc = pdfDoc();
    if (!doc) return false;
    const analysis = buildComplaintAnalysis(complaint);
    const businessName = documentBusinessName(complaint);
    let y = 18;
    doc.setFont('courier', 'normal');
    doc.setFontSize(14);
    doc.text('SMARTLOCAL COMPLAINT RECEIPT', 14, y);
    y += 8;
    doc.setFontSize(10);
    y = pdfWrite(doc, `Complaint ID: ${complaint.id}`, 14, y);
    y = pdfWrite(doc, `Date: ${new Date(complaint.date).toLocaleString('en-IN')}`, 14, y);
    y = pdfWrite(doc, `Name: ${complaint.name}`, 14, y);
    y = pdfWrite(doc, `Phone: ${complaint.phone}`, 14, y);
    y = pdfWrite(doc, `Category: ${complaint.category || 'General'}`, 14, y);
    y = pdfWrite(doc, `Priority: ${complaint.priority || 'Medium'}`, 14, y);
    y = pdfWrite(doc, `Status: ${complaint.status || 'Open'}`, 14, y);
    y = pdfWrite(doc, `Details: ${complaint.details || ''}`, 14, y);
    y += 2;
    y = pdfWrite(doc, `Analysis Summary: ${complaint.analysisSummary || analysis.analysisSummary}`, 14, y);
    y = pdfWrite(doc, `Severity: ${complaint.analysisSeverity || analysis.analysisSeverity}`, 14, y);
    y = pdfWrite(doc, `Recommended Action: ${complaint.analysisAction || analysis.analysisAction}`, 14, y);
    (Array.isArray(complaint.automatedRemarks) && complaint.automatedRemarks.length ? complaint.automatedRemarks : analysis.automatedRemarks).forEach((line) => {
      y = pdfWrite(doc, `Remark: ${line}`, 14, y);
    });
    y += 6;
    drawSignedPdfPanel(doc, {
      title: 'DIGITALLY SIGNED COMPLAINT ANALYSIS',
      businessName,
      subtitle: `Verified complaint analysis for ${businessName}`,
      detailLine: `Platform: SmartLocal | Complaint: ${complaint.id || 'Pending'}`
    }, y);
    doc.save(`complaint_${complaint.id}.pdf`);
    return true;
  };
  const downloadBlob = (content, type, fileName) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };
  const htmlEscape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const safeStatementFilePart = (value, fallback = 'statement') => {
    const clean = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return clean || fallback;
  };
  const statementDateObject = (value) => {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  };
  const statementDateLabel = (value) => statementDateObject(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const statementOrderDateValue = (order = {}) => {
    const candidates = [
      order?.createdAt,
      order?.date,
      order?.updatedAt,
      order?.lastUpdatedAt
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const stamp = new Date(candidate);
      if (!Number.isNaN(stamp.getTime())) return stamp.toISOString();
    }
    return new Date().toISOString();
  };
  const statementOrderCustomerName = (order = {}) => {
    const directName = [
      order?.customerName,
      order?.party,
      order?.customer?.name,
      typeof order?.customer === 'string' ? order.customer : '',
      order?.businessName
    ].map((value) => String(value || '').trim()).find(Boolean);
    return directName || 'Customer';
  };
  const statementOrderItemSummary = (order = {}) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    const itemLabels = items.map((item) => {
      const name = String(item?.name || '').trim();
      const qty = Math.max(Number(item?.qty || 0) || 0, 0);
      if (!name) return '';
      return `${name}${qty > 0 ? ` x${qty}` : ''}`;
    }).filter(Boolean);
    if (itemLabels.length) {
      return `${itemLabels.slice(0, 3).join(', ')}${itemLabels.length > 3 ? ` +${itemLabels.length - 3} more` : ''}`;
    }
    const directSummary = [
      order?.itemSummary,
      order?.itemText,
      order?.note
    ].map((value) => String(value || '').trim()).find(Boolean);
    if (directSummary) return directSummary;
    const itemCount = Math.max(Number(order?.itemCount || 0) || 0, 0);
    return itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : 'No items';
  };
  const statementRowsFromRecords = (orders = [], portfolioItems = []) => {
    const orderRows = (Array.isArray(orders) ? orders : []).map((order) => {
      const amount = statementMoneyNumber(order?.amount ?? order?.total ?? order?.value ?? 0);
      const party = statementOrderCustomerName(order);
      const itemSummary = statementOrderItemSummary(order);
      const status = String(order?.status || 'In Progress').trim() || 'In Progress';
      const orderDate = statementOrderDateValue(order);
      return {
        sortDate: statementDateObject(orderDate).toISOString(),
        dateLabel: statementDateLabel(orderDate),
        type: 'Order',
        reference: String(order?.orderId || '').trim() || formRef('ORD'),
        party,
        particulars: `${party} | ${itemSummary} | ${status}`,
        mode: String(order?.payment || order?.paymentType || order?.paymentMode || 'UPI').trim() || 'UPI',
        status,
        amount,
        debit: 0,
        credit: amount,
        note: itemSummary
      };
    });
    const transferRows = (Array.isArray(portfolioItems) ? portfolioItems : [])
      .filter((item) => Number(item?.revenueTransferredAmount || 0) > 0)
      .map((item) => {
        const amount = statementMoneyNumber(item?.revenueTransferredAmount || 0);
        const realized = statementMoneyNumber(Math.abs(Number(item?.realizedProfitLoss || 0) || 0));
        const party = String(item?.portfolioName || item?.businessName || 'Market Portfolio').trim() || 'Market Portfolio';
        const status = String(item?.protectionReason || item?.fundStatus || 'Transferred').trim() || 'Transferred';
        return {
          sortDate: statementDateObject(item?.revenueTransferredAt || item?.protectionTriggeredAt || item?.lastUpdatedAt || Date.now()).toISOString(),
          dateLabel: statementDateLabel(item?.revenueTransferredAt || item?.protectionTriggeredAt || item?.lastUpdatedAt || Date.now()),
          type: 'Market Transfer',
          reference: String(item?.investmentId || '').trim() || formRef('INV'),
          party,
          particulars: `${party} | ${status} | Realized ${Number(item?.realizedProfitLoss || 0) >= 0 ? 'profit' : 'loss'} ${statementMoneyLabel(realized)}`,
          mode: 'Auto Transfer',
          status,
          amount,
          debit: 0,
          credit: amount,
          note: `Realized ${Number(item?.realizedProfitLoss || 0) >= 0 ? 'profit' : 'loss'} ${statementMoneyLabel(realized)}`
        };
      });
    let runningBalance = 0;
    return [...orderRows, ...transferRows]
      .sort((left, right) => new Date(left.sortDate).getTime() - new Date(right.sortDate).getTime())
      .map((row) => {
        runningBalance = statementMoneyNumber(runningBalance + statementMoneyNumber(row.credit || 0) - statementMoneyNumber(row.debit || 0));
        return {
          ...row,
          balance: runningBalance
        };
      })
      .reverse();
  };
  const summarizeStatementRows = (rows = []) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const transferRows = safeRows.filter((row) => String(row?.type || '').toLowerCase() === 'market transfer');
    const totalCredit = safeRows.reduce((sum, row) => sum + (Number(row?.credit) || 0), 0);
    const totalDebit = safeRows.reduce((sum, row) => sum + (Number(row?.debit) || 0), 0);
    return {
      count: safeRows.length,
      totalAmount: totalCredit,
      transferAmount: transferRows.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0),
      transferCount: transferRows.length,
      latestDate: safeRows[0]?.sortDate || '',
      earliestDate: safeRows[safeRows.length - 1]?.sortDate || '',
      totalCredit,
      totalDebit,
      closingBalance: Number(safeRows[0]?.balance || 0) || 0
    };
  };
  const statementMeta = (rows = [], options = {}) => {
    const user = currentUser();
    const businessName = String(options.businessName || user?.business?.name || user?.name || 'SmartLocal Business').trim() || 'SmartLocal Business';
    const stamp = new Date();
    const summary = summarizeStatementRows(rows);
    return {
      businessName,
      title: String(options.title || `${businessName} Live Bank Statement`).trim() || `${businessName} Live Bank Statement`,
      generatedAt: stamp,
      generatedLabel: statementDateLabel(stamp),
      downloadedAt: stamp,
      downloadedLabel: statementDateLabel(stamp),
      fileStem: safeStatementFilePart(options.fileStem || `${businessName}_statement_${stamp.toISOString().slice(0, 10)}`),
      summary
    };
  };
  const downloadStatementCsv = (rows, options = {}) => {
    const meta = statementMeta(rows, options);
    const lines = [
      [meta.title],
      ['Generated At', meta.generatedLabel],
      ['Downloaded At', meta.downloadedLabel],
      ['Total Entries', meta.summary.count],
      ['Total Credit', Number(meta.summary.totalCredit || 0).toFixed(2)],
      ['Total Debit', Number(meta.summary.totalDebit || 0).toFixed(2)],
      ['Closing Balance', Number(meta.summary.closingBalance || 0).toFixed(2)],
      ['Market Transfer Total', Number(meta.summary.transferAmount || 0).toFixed(2)],
      [],
      ['Date', 'Entry', 'Reference', 'Particulars', 'Mode', 'Debit', 'Credit', 'Balance', 'Status']
    ];
    rows.forEach((row) => {
      lines.push([
        row.dateLabel,
        row.type,
        row.reference,
        row.particulars || row.party,
        row.mode,
        Number(row.debit || 0).toFixed(2),
        Number(row.credit || 0).toFixed(2),
        Number(row.balance || 0).toFixed(2),
        row.status,
      ]);
    });
    const csv = lines.map((row) => row.map((value) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',')).join('\n');
    downloadBlob(csv, 'text/csv;charset=utf-8;', `${meta.fileStem}.csv`);
    return meta;
  };
  const downloadStatementExcel = (rows, options = {}) => {
    const meta = statementMeta(rows, options);
    const headerCell = (label, align = 'left') => `<th style="border:1px solid #0f172a;padding:8px;background:#0f1c2f;color:#ffffff;text-align:${align};font-weight:700;">${htmlEscape(label)}</th>`;
    const bodyCell = (value, align = 'left', extraStyle = '') => `<td style="border:1px solid #0f172a;padding:8px;text-align:${align};vertical-align:top;${extraStyle}">${htmlEscape(value)}</td>`;
    const bodyRows = rows.map((row) => `<tr>${bodyCell(row.dateLabel)}${bodyCell(row.type)}${bodyCell(row.reference)}${bodyCell(row.particulars || row.party || '')}${bodyCell(row.mode)}${bodyCell(statementMoneyLabel(row.debit || 0), 'right', 'font-weight:700;color:#b91c1c;')}${bodyCell(statementMoneyLabel(row.credit || 0), 'right', 'font-weight:700;color:#166534;')}${bodyCell(statementMoneyLabel(row.balance || 0), 'right', 'font-weight:700;color:#1d4ed8;')}${bodyCell(row.status)}</tr>`).join('');
    const emptyRow = `<tr><td colspan="9" style="border:1px solid #0f172a;padding:10px;text-align:left;font-weight:600;">No live statement entries found.</td></tr>`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;padding:14px;color:#0f172a;}h1{font-size:20px;margin:0 0 10px;}table{border-collapse:collapse;width:100%;border:1px solid #0f172a;} .summary-table{margin:0 0 14px;max-width:520px;} .ledger-table{table-layout:fixed;} .ledger-table col:nth-child(1){width:16%;}.ledger-table col:nth-child(2){width:11%;}.ledger-table col:nth-child(3){width:14%;}.ledger-table col:nth-child(4){width:30%;}.ledger-table col:nth-child(5){width:11%;}.ledger-table col:nth-child(6),.ledger-table col:nth-child(7),.ledger-table col:nth-child(8){width:12%;}.ledger-table col:nth-child(9){width:8%;}</style></head><body><h1>${htmlEscape(meta.title)}</h1><table class="summary-table"><tbody><tr>${headerCell('Generated At')}${bodyCell(meta.generatedLabel)}</tr><tr>${headerCell('Downloaded At')}${bodyCell(meta.downloadedLabel)}</tr><tr>${headerCell('Total Entries')}${bodyCell(String(meta.summary.count || 0))}</tr><tr>${headerCell('Total Credit')}${bodyCell(statementMoneyLabel(meta.summary.totalCredit || 0), 'right', 'font-weight:700;color:#166534;')}</tr><tr>${headerCell('Total Debit')}${bodyCell(statementMoneyLabel(meta.summary.totalDebit || 0), 'right', 'font-weight:700;color:#b91c1c;')}</tr><tr>${headerCell('Closing Balance')}${bodyCell(statementMoneyLabel(meta.summary.closingBalance || 0), 'right', 'font-weight:700;color:#1d4ed8;')}</tr><tr>${headerCell('Market Transfer Total')}${bodyCell(statementMoneyLabel(meta.summary.transferAmount || 0), 'right')}</tr></tbody></table><table class="ledger-table"><colgroup><col><col><col><col><col><col><col><col><col></colgroup><thead><tr>${headerCell('Date')}${headerCell('Entry')}${headerCell('Reference')}${headerCell('Particulars')}${headerCell('Mode')}${headerCell('Debit', 'right')}${headerCell('Credit', 'right')}${headerCell('Balance', 'right')}${headerCell('Status')}</tr></thead><tbody>${bodyRows || emptyRow}</tbody></table></body></html>`;
    downloadBlob(html, 'application/vnd.ms-excel;charset=utf-8', `${meta.fileStem}.xls`);
    return meta;
  };
  const downloadStatementPdf = (rows, options = {}) => {
    const meta = statementMeta(rows, options);
    const doc = pdfDoc({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    if (!doc) return null;
    let y = 18;
    doc.setFont('courier', 'normal');
    doc.setFontSize(15);
    doc.text(pdfText(meta.title), 14, y);
    y += 8;
    doc.setFontSize(10);
    y = pdfWrite(doc, `Generated At: ${meta.generatedLabel}`, 14, y);
    y = pdfWrite(doc, `Downloaded At: ${meta.downloadedLabel}`, 14, y);
    y = pdfWrite(doc, `Total Entries: ${meta.summary.count}`, 14, y);
    y = pdfWrite(doc, `Total Credit: Rs. ${Number(meta.summary.totalCredit || 0).toFixed(2)}`, 14, y);
    y = pdfWrite(doc, `Total Debit: Rs. ${Number(meta.summary.totalDebit || 0).toFixed(2)}`, 14, y);
    y = pdfWrite(doc, `Closing Balance: Rs. ${Number(meta.summary.closingBalance || 0).toFixed(2)}`, 14, y);
    y = pdfWrite(doc, `Market Transfer Total: Rs. ${Number(meta.summary.transferAmount || 0).toFixed(2)}`, 14, y);
    y += 3;
    if (!rows.length) {
      y = pdfWrite(doc, 'No live statement entries found.', 14, y);
    } else {
      y = drawPdfTable(doc, [
        { header: 'Date', key: 'dateLabel', width: 32 },
        { header: 'Entry', key: 'type', width: 20 },
        { header: 'Reference', key: 'reference', width: 27 },
        { header: 'Particulars', key: 'particulars', width: 52 },
        { header: 'Mode', key: 'mode', width: 18 },
        { header: 'Debit', key: 'debitLabel', width: 18, align: 'right' },
        { header: 'Credit', key: 'creditLabel', width: 18, align: 'right' },
        { header: 'Balance', key: 'balanceLabel', width: 22, align: 'right' },
        { header: 'Status', key: 'status', width: 17 }
      ], rows.map((row) => ({
        ...row,
        debitLabel: statementMoneyLabel(row.debit || 0),
        creditLabel: statementMoneyLabel(row.credit || 0),
        balanceLabel: statementMoneyLabel(row.balance || 0)
      })), y, {
        startX: 14,
        headerHeight: 10,
        lineHeight: 3.8,
        minRowHeight: 8,
        headerFill: [14, 24, 38],
        headerText: [255, 255, 255],
        altFill: [245, 248, 252],
        plainFill: [255, 255, 255],
        borderColor: [164, 180, 200],
        bodyFontSize: 7.7,
        headerFontSize: 8.6
      });
    }
    y += 6;
    drawSignedPdfPanel(doc, {
      title: 'DIGITALLY SIGNED STATEMENT',
      businessName: meta.businessName,
      subtitle: `Verified live statement for ${meta.businessName}`,
      detailLine: `${meta.title} | Entries: ${meta.summary.count}`
    }, y);
    doc.save(`${meta.fileStem}.pdf`);
    return meta;
  };
  const fetchLiveStatementRows = async (orderLimit = 250, portfolioLimit = 100) => {
    const user = currentUser();
    if (!user?.userid) throw new Error('Please log in first so I can access the live statement.');
    const userQuery = encodeURIComponent(user.userid);
    const [orderData, portfolioData] = await Promise.all([
      json(`/api/orders?limit=${orderLimit}&userid=${userQuery}`),
      json(`/api/portfolio?limit=${portfolioLimit}&userid=${userQuery}`)
    ]);
    return statementRowsFromRecords(orderData?.items || [], portfolioData?.items || []);
  };
  const downloadStatement = async (format = 'pdf', options = {}) => {
    const rows = Array.isArray(options.rows) ? options.rows.slice() : await fetchLiveStatementRows(options.orderLimit || 250, options.portfolioLimit || 100);
    const normalizedFormat = String(format || 'pdf').trim().toLowerCase();
    const meta = normalizedFormat === 'csv'
      ? downloadStatementCsv(rows, options)
      : (normalizedFormat === 'excel' || normalizedFormat === 'xls' || normalizedFormat === 'xlsx')
        ? downloadStatementExcel(rows, options)
        : downloadStatementPdf(rows, options);
    if (!meta) throw new Error('PDF download is unavailable in this browser right now.');
    const formatLabel = normalizedFormat === 'excel' || normalizedFormat === 'xls' || normalizedFormat === 'xlsx'
      ? 'Excel'
      : normalizedFormat.toUpperCase();
    return {
      rows,
      summary: meta.summary,
      message: `${normalizedFormat === 'pdf' ? 'Digitally signed statement' : 'Statement'} ${formatLabel} downloaded with ${meta.summary.count} entries totaling ${formatMoney(meta.summary.totalAmount)}.`
    };
  };
  const localRobertReply = async (raw) => {
    const text = String(raw || '').trim();
    const lower = text.toLowerCase();
    const plain = nlpText(text);
    let user = robertScopedUser();
    if (user?.userid) {
      try {
        await loadPortalState();
        user = robertScopedUser();
      } catch {}
    }
    const asksDateTime = /\b(date|time|today|day|now|current)\b/i.test(text) && (
      /current date|current time|date and time|time and date|what time|what date|today date|today s date|date today|time now|aaj|abhi|samay|kitna baje/i.test(lower)
      || hasAnyPhrase(plain, ['current date', 'current time', 'date and time', 'time and date', 'what time', 'what date', 'today date', 'date today', 'time now', 'today time', 'aaj ki date', 'aaj ka time', 'abhi time'])
    );
    const wantsHelp = /\bhelp\b|\bwhat can you do\b/i.test(lower) || hasAnyPhrase(plain, ['help me', 'what all can you do', 'what can robert do', 'tum kya kar sakte ho', 'kya kar sakte ho']);
    const planIntent = /\b(plan|segment|membership|tier|upgrade|downgrade)\b/i.test(lower)
      && (/\b(silver|gold|platinum|starter|professional|enterprise|upgrade|downgrade|switch|change|current|my|show|move)\b/i.test(lower)
        || hasAnyPhrase(plain, ['current plan', 'current segment', 'my plan', 'my segment', 'upgrade plan', 'downgrade plan', 'change plan', 'switch plan', 'change segment', 'switch segment']));
    const statementIntent = /\b(statement|ledger|transaction report|revenue report|revenue statement|account statement)\b/i.test(lower)
      && (/\b(download|export|get|save|send|pdf|csv|excel|xls|xlsx)\b/i.test(lower)
        || hasAnyPhrase(plain, ['download statement', 'export statement', 'statement pdf', 'statement csv', 'statement excel', 'ledger pdf', 'ledger csv', 'ledger excel']));
    const orderIntent = looksLikeOrderMessage(text)
      || /create order|place order|new order|order bana|bana order|order create|customer order|order kar|order bhej/i.test(lower)
      || (hasAnyPhrase(plain, ['order', 'customer order', 'sales order']) && (hasAnyPhrase(plain, ['create', 'make', 'place', 'new', 'bana', 'banado', 'kar do', 'krdo', 'generate']) || ((/\b\d{8,15}\b/.test(text)) && hasAnyPhrase(plain, ['address', 'item', 'items', 'phone', 'mobile']))));
    const mathIntent = !orderIntent && (
      /\b(solve|calculate|calculation|math|mathematics|equation|formula|gst|tax|discount|percentage|percent|ratio|emi|interest|multiply|division|divide|plus|minus|square root|sqrt)\b/i.test(lower)
      || /\d+(?:\.\d+)?\s*(?:[+\-*/x]|into|times|multiplied by|divide by|divided by)\s*\d+(?:\.\d+)?/i.test(lower)
      || /\d+(?:\.\d+)?\s*%\s*(?:of|on)\s*\d+(?:\.\d+)?/i.test(lower)
      || /(?:square root of|sqrt of|sqrt|root of)\s*\d+(?:\.\d+)?/i.test(lower)
      || hasAnyPhrase(plain, ['how much is', 'what is', 'solve this', 'calculate this', 'kitna hoga', 'kitna hai', 'hisab', 'hisaab', 'ganit', 'maths', 'percent of', 'gst on', 'discount on', 'square root'])
    );
    const courierIntent = /book courier|courier booking|schedule courier|shipment|pickup|awb|parcel|consignment/i.test(lower)
      || (hasAnyPhrase(plain, ['courier', 'shipment', 'parcel', 'pickup', 'awb']) && hasAnyPhrase(plain, ['book', 'schedule', 'create', 'kar do', 'banado', 'bhej do']));
    const complaintIntent = /lodge complaint|raise complaint|complaint|complain|issue|problem|shikayat/i.test(lower)
      || (hasAnyPhrase(plain, ['issue', 'problem', 'complaint', 'complain', 'shikayat']) && hasAnyPhrase(plain, ['raise', 'log', 'register', 'create', 'kar do', 'banado']));
    const courierAnalysisIntent = /courier analysis|analyze courier|courier report/i.test(lower)
      || (hasAnyPhrase(plain, ['courier', 'awb', 'shipment']) && hasAnyPhrase(plain, ['analysis', 'report', 'summary', 'status']));
    const marketAnalysisIntent = /market analysis|portfolio analysis|analyze market|current market/i.test(lower)
      || (hasAnyPhrase(plain, ['market', 'portfolio', 'investment', 'returns']) && hasAnyPhrase(plain, ['analysis', 'summary', 'status', 'remark', 'remarks', 'current', 'review']));
    const investmentIntent = /\binvest\b|\bportfolio\b/i.test(lower)
      || (hasAnyPhrase(plain, ['investment', 'invest', 'portfolio', 'fund']) && hasAnyPhrase(plain, ['add', 'create', 'start', 'put', 'save', 'kar do', 'banado']));
    const profileIntent = /\b(profile|contact|email|mail|mobile|phone|number|details|gst|bank|account|ifsc|bank account)\b/i.test(lower)
      && (hasAnyPhrase(plain, [
        'show profile', 'show contact', 'my contact', 'my email', 'my mobile', 'my gst', 'my bank',
        'current mobile', 'current email', 'current gst', 'current bank', 'current ifsc',
        'update email', 'update mobile', 'update gst', 'update bank', 'update account', 'update ifsc',
        'change email', 'change mobile', 'change gst', 'change bank', 'change account', 'change ifsc',
        'contact details', 'profile details', 'bank details', 'finance details'
      ])
        || /\b(show|view|mask|hide|display|update|change|edit|set|save|replace|modify)\b/i.test(lower));
    const passwordIntent = /\b(password|passcode|credential)\b/i.test(lower)
      && (hasAnyPhrase(plain, ['change password', 'update password', 'reset password', 'old password', 'new password', 'confirm password', 'password strength', 'show password strength'])
        || /\b(change|update|reset|show|check|set)\b/i.test(lower));
    const statementFormat = /\bcsv\b/i.test(lower)
      ? 'csv'
      : /\b(excel|xls|xlsx)\b/i.test(lower)
        ? 'excel'
        : 'pdf';
    const requestedPlan = extractPlanTarget(text);
    const currentPlan = currentPlanType(user);
    const wantsCurrentPlan = /\b(current|present|existing)\b/i.test(lower)
      || hasAnyPhrase(plain, ['what is my plan', 'what is my segment', 'my current plan', 'my current segment', 'show my plan', 'show my segment', 'which plan']);
    const wantsUpgrade = /\bupgrade|higher|next\b/i.test(lower) || hasAnyPhrase(plain, ['move up', 'next segment', 'next plan', 'upgrade me']);
    const wantsDowngrade = /\bdowngrade|lower|previous|reduce\b/i.test(lower) || hasAnyPhrase(plain, ['move down', 'lower segment', 'previous plan', 'downgrade me']);
    if (!text) return 'Please type your message for Robert.';
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(lower)) return robertGreeting();
    if (asksDateTime) return currentDateTimeReply();
    if (wantsHelp) return 'I can tell the current date and time, solve maths in natural language, create orders before cutoff, book courier pickups, lodge complaints, download live statements in PDF, Excel, or CSV, upgrade or downgrade your plan segment, run market-style portfolio analysis with automated remarks, and update your investment record.';
    if (planIntent) {
      if (!user?.userid) return 'Please log in first so I can check or change your segment.';
      const currentDetails = getPlanDetails(currentPlan);
      let targetPlan = requestedPlan;
      if (!targetPlan && wantsUpgrade) targetPlan = adjacentPlanType(currentPlan, 'upgrade');
      if (!targetPlan && wantsDowngrade) targetPlan = adjacentPlanType(currentPlan, 'downgrade');
      if (!targetPlan || wantsCurrentPlan) {
        return `${planMoveSummary(currentPlan)} Say "upgrade to gold", "upgrade to platinum", or "downgrade to silver" whenever you want me to change it.`;
      }
      if (targetPlan === currentPlan) {
        return `Your business is already on the ${currentDetails.name} segment. ${planMoveSummary(currentPlan)}`;
      }
      const targetDetails = getPlanDetails(targetPlan);
      const currentIndex = PLAN_SEQUENCE.indexOf(currentPlan);
      const targetIndex = PLAN_SEQUENCE.indexOf(targetPlan);
      if (wantsUpgrade && targetIndex < currentIndex) {
        return `Moving from ${currentDetails.name} to ${targetDetails.name} is a downgrade, not an upgrade. Say "downgrade to ${targetDetails.name.toLowerCase()}" if you want me to do that.`;
      }
      if (wantsDowngrade && targetIndex > currentIndex) {
        return `Moving from ${currentDetails.name} to ${targetDetails.name} is an upgrade, not a downgrade. Say "upgrade to ${targetDetails.name.toLowerCase()}" if you want me to do that.`;
      }
      const updatedUser = await updateBusinessPlan(targetPlan);
      const updatedDetails = getPlanDetails(updatedUser?.plan || targetPlan);
      return `Plan updated successfully. ${updatedUser?.business?.name || updatedUser?.name || 'Your business'} moved from ${currentDetails.name} to ${updatedDetails.name}. Monthly segment price is ${formatMoney(updatedDetails.price)}.`;
    }
    if (statementIntent) {
      if (!user?.userid) return 'Please log in first so I can download your live statement.';
      const result = await downloadStatement(statementFormat, {
        title: `${user?.business?.name || user?.name || 'SmartLocal'} Live Statement`
      });
      return result.message;
    }

    if (profileIntent) {
      if (!user?.userid) return 'Please log in first so I can show or update the business profile.';
      const nextPatch = parseProfilePatchFromText(text);
      const wantsExplicitField = /\b(mobile|phone|email|mail|gst|bank|bank account|account|account number|ifsc)\b/i.test(lower);
      const wantsUpdate = Object.keys(nextPatch).length > 0 && /\b(update|change|edit|set|save|replace|modify|fix|correct|enable)\b/i.test(lower);
      if (!wantsExplicitField && /\b(update|change|edit|set|save|replace|modify|fix|correct|enable)\b/i.test(lower)) {
        return 'Please tell me exactly what to update: mobile number, email ID, GST, bank account, or IFSC. For example, say "update mobile to 9876543210" or "update bank account to 1234567890".';
      }
      if (wantsUpdate) {
        const updatedUser = await updateBusinessProfileContact(nextPatch);
        const maskedPhone = maskBusinessPhone(updatedUser?.business?.phone || '');
        const maskedEmail = maskBusinessEmail(updatedUser?.email || '');
        const maskedGst = maskBusinessGst(updatedUser?.business?.gst || '');
        const maskedBank = maskBusinessBank(updatedUser?.business?.bank || '');
        const updatedFields = [];
        if (nextPatch.phone) updatedFields.push(`mobile ${maskedPhone}`);
        if (nextPatch.email) updatedFields.push(`email ${maskedEmail}`);
        if (nextPatch.gst) updatedFields.push(`GST ${maskedGst}`);
        if (nextPatch.bank) updatedFields.push(`bank ${maskedBank}`);
        if (nextPatch.ifsc) updatedFields.push(`IFSC ${nextPatch.ifsc}`);
        return `Profile updated successfully. ${updatedFields.join(' and ') || 'Contact details'} are now saved in MongoDB for ${updatedUser?.business?.name || updatedUser?.name || 'your business'}.`;
      }
      const maskedPhone = maskBusinessPhone(user?.business?.phone || '');
      const maskedEmail = maskBusinessEmail(user?.email || '');
      const maskedGst = maskBusinessGst(user?.business?.gst || '');
      const maskedBank = maskBusinessBank(user?.business?.bank || '');
      const ifsc = String(user?.business?.ifsc || '').trim().toUpperCase();
      const businessName = user?.business?.name || user?.name || 'your business';
      return `${businessName} profile contact is live from MongoDB. Mobile: ${maskedPhone}. Email: ${maskedEmail}. GST: ${maskedGst}. Bank: ${maskedBank}. IFSC: ${ifsc || 'Not added'}. If you want, say "update mobile to 9876543210", "change GST to 22AAAAA0000A1Z5", "update bank account to 1234567890", or "update IFSC to HDFC0001234".`;
    }

    if (passwordIntent) {
      if (!user?.userid) return 'Please log in first so I can change the business password.';
      const oldMatch = text.match(/(?:old\s*password|current\s*password|old)\s*(?:is|to|:)?\s*([^\s]{4,})/i);
      const newMatch = text.match(/(?:new\s*password|new)\s*(?:is|to|:)?\s*([^\s]{4,})/i);
      const confirmMatch = text.match(/(?:confirm\s*password|confirm|again)\s*(?:is|to|:)?\s*([^\s]{4,})/i);
      if (!oldMatch?.[1] || !newMatch?.[1] || !confirmMatch?.[1]) {
        return 'To change the password, tell me the old password, new password, and confirm password. The new password must have at least 9 characters, 1 capital letter, 1 number, and 1 underscore, and it must not start with the business name.';
      }
      const updatedUser = await updateBusinessPassword({
        oldPassword: oldMatch[1],
        newPassword: newMatch[1],
        confirmPassword: confirmMatch[1]
      });
      return `Password updated successfully for ${updatedUser?.business?.name || updatedUser?.name || 'your business'}. The new password is saved securely in MongoDB.`;
    }

    if (orderIntent) {
      if (!user?.userid) return 'Please log in first so I can create the order, sync it to MongoDB, and generate the invoice PDF for your business.';
      const name = segment(text, '(?:for|name)', 'phone|mobile|address|items|gst|payment|delivery|weight|value|provider|service');
      const phone = extract(text, /(?:phone|mobile)\s+([0-9]{8,15})/i);
      const address = segment(text, 'address', 'items|gst|payment|delivery|weight|value|provider|service');
      const items = parseItems(segment(text, 'items?', 'gst|payment|delivery|weight|value|provider|service'));
      if (!name || !phone || !address || !items.length) return 'Please share customer name, phone, address, and at least one item with quantity and rate.';
      if (afterCutoff()) return `Order intake is closed after cutoff ${cutoffLabel(settings().bookingCutoff)}. Pending orders are auto-dispatched after cutoff, but I cannot accept a new order right now.`;

      const payment = segment(text, 'payment', 'delivery|weight|value|provider|service') || 'UPI';
      const gstPercent = Number(extract(text, /gst\s+(\d{1,2})/i, '18')) || 18;
      const weight = Number(extract(text, /weight\s+(\d+(?:\.\d+)?)\s*kg/i, '1')) || 1;
      const declaredValue = roundMoneyValue(extract(text, /value\s+(\d+(?:\.\d+)?)/i, '0'));
      const pins = String(text).match(/\b\d{6}\b/g) || [];
      const provider = segment(text, 'provider', 'service|weight|value') ? robertCourierProvider(segment(text, 'provider', 'service|weight|value')) : nextRobertProvider();
      const service = /same[- ]day/i.test(lower) ? 'same-day' : /express/i.test(lower) ? 'express' : 'standard';
      const subtotal = roundMoneyValue(items.reduce((sum, item) => sum + item.qty * item.price, 0));
      const gstAmount = roundMoneyValue((subtotal * gstPercent) / 100);
      const total = roundMoneyValue(subtotal + gstAmount);

      const order = {
        orderId: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        businessUserId: user?.userid || '',
        businessName: user?.business?.name || 'SmartLocal',
        customer: { name, phone, address },
        items,
        gstPercent,
        gstAmount,
        subtotal,
        total,
        amount: total,
        payment,
        gstNo: user?.business?.gst || '',
        warrantyExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-IN'),
        date: new Date().toISOString(),
        status: 'In Progress',
        source: 'robert',
        courier: {
          provider: '',
          status: 'Pending Dispatch',
          service,
          weight,
          value: declaredValue || total,
          originPincode: pins[0] || '',
          destinationPincode: pins[pins.length - 1] || '',
          description: `Order shipment for ${name}`
        }
      };
      const response = await json('/api/orders', order).catch((error) => ({ error: error.message || 'Unable to save order.' }));
      if (response?.error) return response.error;
      const savedOrder = response?.record || order;
      await syncRobertAction('orders', 'orderId', savedOrder, 200, 'robert-order');
      const pdfDownloaded = downloadOrderInvoicePdf(savedOrder);
      const invoiceOpened = openOrderInvoicePage(savedOrder.orderId);
      const orderItems = Array.isArray(savedOrder.items) && savedOrder.items.length
        ? savedOrder.items.map((item) => `${item.name} x${item.qty}`).slice(0, 3).join(', ')
        : 'items ready';
      const liveSettings = response?.settings || settings();
      const firstRemark = Array.isArray(savedOrder.automatedRemarks) ? savedOrder.automatedRemarks.find(Boolean) : '';
      return `Order ${savedOrder.orderId} created for ${name}. Items: ${orderItems}. Invoice total ${formatMoney(savedOrder.total)} by ${savedOrder.payment || 'UPI'}. Current order status is ${savedOrder.status || 'In Progress'} and courier status is ${savedOrder.courier?.status || 'Pending Dispatch'}. Auto-dispatch will move it after cutoff ${cutoffLabel(liveSettings.bookingCutoff)} with live AWB sync to the Courier panel. ${firstRemark ? `${firstRemark} ` : ''}${pdfDownloaded ? 'Digitally signed invoice PDF downloaded.' : 'Digitally signed invoice PDF could not download in this browser.'} ${invoiceOpened ? 'Invoice page opened.' : 'Invoice page is ready from the Orders panel.'}`.trim();
    }

    if (mathIntent) {
      const mathReply = solveLocalMath(text);
      if (mathReply) return mathReply;
      return null;
    }

    if (courierIntent) {
      if (!user?.userid) return 'Please log in first so I can book the courier and sync it to your business panel.';
      const pins = String(text).match(/\b\d{6}\b/g) || [];
      if (pins.length < 2) return 'Please share pickup PIN and delivery PIN to book the courier.';

      const provider = segment(text, 'provider', 'service|weight|value') ? robertCourierProvider(segment(text, 'provider', 'service|weight|value')) : nextRobertProvider();
      const service = /same[- ]day/i.test(lower) ? 'same-day' : /express/i.test(lower) ? 'express' : 'standard';
      const weight = Number(extract(text, /weight\s+(\d+(?:\.\d+)?)\s*kg/i, '1')) || 1;
      const value = Number(extract(text, /value\s+(\d+(?:\.\d+)?)/i, '0')) || 0;

      const courier = {
        awb: `${PROVIDER_CODES[provider]}-${Math.floor(100000 + Math.random() * 900000)}`,
        provider,
        senderName: segment(text, '(?:from|sender|name)', 'phone|mobile|to|weight|value|service|provider') || 'Customer',
        senderPhone: extract(text, /(?:phone|mobile)\s+([0-9]{8,15})/i),
        originPincode: pins[0],
        destinationPincode: pins[1],
        service,
        weight,
        value,
        description: 'Business shipment',
        status: 'Pickup Scheduled',
        cost: courierCost(weight, value, service),
        date: new Date().toISOString(),
        businessUserId: user?.userid || '',
        businessName: user?.business?.name || 'SmartLocal'
      };

      const response = await json('/api/couriers', courier).catch((error) => ({ error: error.message || 'Unable to save courier booking.' }));
      if (response?.error) return response.error;
      const savedCourier = response?.record || courier;
      await syncRobertAction('courierOrders', 'awb', savedCourier, 200, 'robert-courier');
      const pdfDownloaded = downloadCourierReceiptPdf(savedCourier);
      return `Courier booked successfully. AWB ${savedCourier.awb} is live with ${PROVIDER_LABELS[providerName(savedCourier.provider)] || savedCourier.provider || 'Courier'}, route ${savedCourier.originPincode || 'N/A'} to ${savedCourier.destinationPincode || 'N/A'}, service ${savedCourier.service || 'standard'}, and cost ${formatMoney(savedCourier.cost)}. The booking is synced to MongoDB and your Courier panel. ${pdfDownloaded ? 'Digitally signed courier PDF downloaded.' : 'Digitally signed courier receipt is ready, but PDF download is unavailable right now.'}`;
    }

    if (complaintIntent) {
      if (!user?.userid) return 'Please log in first so I can lodge the complaint and sync it to your business panel.';
      const name = segment(text, '(?:name|for)', 'phone|mobile|details|issue|category|priority');
      const phone = extract(text, /(?:phone|mobile)\s+([0-9]{8,15})/i);
      const details = segment(text, 'details|issue', 'category|priority') || String(text).replace(/.*complaint/i, '').trim();
      if (!name || !phone || !details) return 'Please share complaint name, phone number, and details so I can register it properly.';

      const complaint = {
        id: `CMP-${Math.floor(100000 + Math.random() * 900000)}`,
        name,
        phone,
        details,
        category: segment(text, 'category', 'priority') || 'General',
        priority: segment(text, 'priority', 'details|issue') || 'Medium',
        status: 'Open',
        date: new Date().toISOString(),
        businessUserId: user?.userid || '',
        businessName: user?.business?.name || 'SmartLocal'
      };
      Object.assign(complaint, buildComplaintAnalysis(complaint));

      const response = await json('/api/complaints', complaint).catch((error) => ({ error: error.message || 'Unable to save complaint.' }));
      if (response?.error) return response.error;
      const savedComplaint = response?.record || complaint;
      await syncRobertAction('complaints', 'id', savedComplaint, 100, 'robert-complaint');
      const pdfDownloaded = downloadComplaintReceiptPdf(savedComplaint);
      return `Complaint ${savedComplaint.id} has been lodged for ${name}. Current complaint status is ${savedComplaint.status || 'Open'}. Analysis severity is ${savedComplaint.analysisSeverity || complaint.analysisSeverity}, summary: ${savedComplaint.analysisSummary || complaint.analysisSummary}. Recommended action: ${savedComplaint.analysisAction || complaint.analysisAction}. The complaint is synced to MongoDB and your Complaints panel. ${pdfDownloaded ? 'Digitally signed complaint analysis PDF downloaded.' : 'Digitally signed complaint analysis is ready, but PDF download is unavailable right now.'}`;
    }

    if (courierAnalysisIntent) {
      if (!user?.userid) return 'Please log in first so I can read your live courier data.';
      const courierData = await fetch(`/api/couriers?limit=100&userid=${encodeURIComponent(user.userid)}`).then((r) => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] }));
      const rows = Object.entries((Array.isArray(courierData.items) ? courierData.items : []).reduce((map, item) => {
        const label = PROVIDER_LABELS[providerName(item.provider)] || 'BlueDart';
        map[label] = (map[label] || 0) + 1;
        return map;
      }, {})).sort((a, b) => b[1] - a[1]);
      return rows.length ? `Courier usage: ${rows.map(([label, count]) => `${label}: ${count}`).join(', ')}. Top provider: ${rows[0][0]} (${rows[0][1]}).` : 'No courier bookings are available yet.';
    }

    if (marketAnalysisIntent) {
      if (!user?.userid) return 'Please log in first so I can read your market portfolio analysis.';
      const data = await fetch(`/api/portfolio/analysis?userid=${encodeURIComponent(user.userid)}`).then((r) => r.ok ? r.json() : { hasInvestment: false }).catch(() => ({ hasInvestment: false }));
      const record = data?.record || null;
      const revenueTransferredAmount = Number(record?.revenueTransferredAmount || 0) || 0;
      const realizedProfitLoss = Number(record?.realizedProfitLoss || 0) || 0;
      const lastProtectedValue = Number(record?.lastProtectedValue || revenueTransferredAmount || 0) || 0;
      const marketStopped = record && Number(record.amountInvested || 0) <= 0 && (revenueTransferredAmount > 0 || record.autoWithdrawTriggered || String(record.fundStatus || '').toLowerCase() === 'stopped');
      if (marketStopped) {
        return `Market is stopped because no fund is left. ${record.protectionReason || 'Portfolio protection'} moved ${formatMoney(revenueTransferredAmount || lastProtectedValue)} to Revenue with realized ${realizedProfitLoss >= 0 ? 'profit' : 'loss'} ${formatMoney(Math.abs(realizedProfitLoss))}. Reinvest to restart market tracking.`;
      }
      if (!data?.hasInvestment || !record || Number(record.amountInvested) <= 0) {
        return `No market investment is recorded yet. Current invested value is ${formatMoney(0)} and current value is ${formatMoney(0)}.`;
      }
      const remarks = Array.isArray(record.automatedRemarks) ? record.automatedRemarks.filter(Boolean).slice(0, 3) : [];
      return `Market portfolio update: invested ${formatMoney(record.amountInvested)}, current value ${formatMoney(record.currentValue)}, return ${Number(record.returnPercent || 0).toFixed(2)}%, and ${Number(record.profitLoss || 0) >= 0 ? 'profit' : 'loss'} ${formatMoney(Math.abs(record.profitLoss || 0))}. Market view: ${record.marketSummary || 'Live review ready'}. ${remarks.join(' ')}`.trim();
    }

    if (investmentIntent) {
      const amount = Number(extract(text, /(?:invest|investment|amount)\s+(\d+(?:\.\d+)?)/i, '0')) || 0;
      const stopLossValue = Math.max(Number(extract(text, /(?:stop\s*loss|sl)\s+(\d+(?:\.\d+)?)/i, '0')) || 0, 0);
      const takeProfitValue = Math.max(Number(extract(text, /(?:take\s*profit|target|tp)\s+(\d+(?:\.\d+)?)/i, '0')) || 0, 0);
      const protectionDisabled = /(?:auto\s*(?:withdraw|protect)|protection)\s+(?:off|disable|disabled|band|stop)/i.test(lower);
      const protectionRequested = /(stop\s*loss|take\s*profit|target|profit\s*lock|auto\s*(?:withdraw|protect)|protection\s+on|enable\s+protection)/i.test(lower);
      const autoWithdrawEnabled = !protectionDisabled && (stopLossValue > 0 || takeProfitValue > 0 || protectionRequested);
      if (!amount) return 'Please tell me the investment amount in rupees, for example: Invest 5000.';
      if (!user?.userid) return 'Please log in first so I can save the investment to your live MongoDB portfolio.';
      const portfolioData = await json(`/api/portfolio?limit=12&userid=${encodeURIComponent(user.userid)}`).catch(() => ({ items: [] }));
      const activeRecord = Array.isArray(portfolioData?.items)
        ? portfolioData.items.find((item) => Number(item?.amountInvested || 0) > 0 && String(item?.fundStatus || '').toLowerCase() !== 'stopped')
        : null;
      const existingInvested = Number(activeRecord?.amountInvested || 0) || 0;
      const existingStopLoss = Number(activeRecord?.stopLossValue || 0) || 0;
      const existingTakeProfit = Number(activeRecord?.takeProfitValue || 0) || 0;
      const projectedAmount = Number((existingInvested + amount).toFixed(2));
      const effectiveStopLossValue = stopLossValue > 0 ? stopLossValue : existingStopLoss;
      const effectiveTakeProfitValue = takeProfitValue > 0 ? takeProfitValue : existingTakeProfit;
      if (autoWithdrawEnabled && effectiveStopLossValue <= 0 && effectiveTakeProfitValue <= 0) return 'Please give a stop loss amount or take profit amount if you want portfolio protection enabled.';
      if (effectiveStopLossValue > 0 && effectiveStopLossValue >= projectedAmount) return `Stop loss should be lower than the total invested value ${formatMoney(projectedAmount)}.`;
      if (effectiveTakeProfitValue > 0 && effectiveTakeProfitValue <= projectedAmount) return `Take profit should be higher than the total invested value ${formatMoney(projectedAmount)}.`;
      const currentValue = Number(amount.toFixed(2));
      const profitLoss = 0;
      const record = {
        investmentId: `INV-${Date.now()}`,
        businessUserId: user?.userid || '',
        businessName: user?.business?.name || '',
        portfolioName: user?.business?.name ? `${user.business.name} Market Portfolio` : 'SmartLocal Live Market',
        amountInvested: amount,
        currentValue,
        returnPercent: 0,
        profitLoss,
        trend: 'profit',
        color: '#00ff9d',
        points: [currentValue, currentValue],
        stopLossValue,
        takeProfitValue,
        autoWithdrawEnabled,
        appendToActive: true,
        transferToRevenue: true,
        fundStatus: 'Active',
        lastUpdatedAt: new Date().toISOString()
      };
      const response = await json('/api/portfolio', record).catch((error) => ({ error: error.message || 'Unable to save investment.' }));
      if (response?.error) return response.error;
      const savedRecord = response?.record || record;
      await refreshLiveBusinessViews('robert-investment');
      const firstRemark = Array.isArray(savedRecord.automatedRemarks) ? savedRecord.automatedRemarks[0] : '';
      const protectionSummary = [
        savedRecord.stopLossValue > 0 ? `Stop loss ${formatMoney(savedRecord.stopLossValue)}` : '',
        savedRecord.takeProfitValue > 0 ? `Take profit ${formatMoney(savedRecord.takeProfitValue)}` : '',
        savedRecord.autoWithdrawEnabled ? 'Auto protection on' : 'Auto protection off'
      ].filter(Boolean).join('. ');
      return `Investment ${savedRecord.investmentId} saved. Added ${formatMoney(amount)} and total invested value is now ${formatMoney(savedRecord.amountInvested)}. Current value is ${formatMoney(savedRecord.currentValue)} with return ${Number(savedRecord.returnPercent || 0).toFixed(2)}%. ${protectionSummary}. ${savedRecord.marketSummary || ''} ${firstRemark || ''}`.trim();
    }

    return null;
  };
  const sendRobert = async (forced = '') => {
    const access = robertAccessState();
    if (!access.allowed) {
      showRobertAccessMessage({ openPanel: true, toast: true });
      return;
    }
    const input = document.getElementById('rovert-input');
    const text = String(forced || input?.value || '').trim();
    if (!text) {
      if (document.getElementById('rovert-file')?.files?.length) {
        await runRobertFileAnalysis({ download: false });
      }
      return;
    }
    if (!forced && input) input.value = '';
    message(text, 'user');
    robertStatus('ROBERT is thinking...');
    const typingStartedAt = Date.now();
    showRobertTyping();
    try {
      const localReply = await localRobertReply(text);
      let replyProvider = '';
      let replyFallback = false;
      if (localReply) {
        replyProvider = 'local';
        cacheRobertAiMeta({
          provider: 'local',
          fallback: false,
          aiStatus: 'success',
          aiMode: 'chat',
          aiReason: 'client_rule'
        });
      }
      const reply = localReply || await (async () => {
        robertAbort = new AbortController();
        const endpoint = text.toLowerCase().startsWith('db ') ? '/api/rovert-db' : '/api/rovert';
        const userid = String(robertScopedUser()?.userid || '').trim();
        const payload = endpoint === '/api/rovert-db'
          ? { command: text, userid }
          : { message: text, history: history().slice(-8), preferredLanguage: robertLang(), responseLength: robertResponseLength(), userid };
        const data = await json(endpoint, payload, robertAbort.signal);
        if (endpoint === '/api/rovert') {
          replyProvider = data?.provider || 'local';
          replyFallback = Boolean(data?.fallback);
          cacheRobertAiMeta({
            provider: data?.provider || 'local',
            fallback: Boolean(data?.fallback),
            aiStatus: data?.aiStatus || (data?.provider === 'groq' ? 'fallback' : data?.fallback ? 'error' : 'success'),
            aiMode: data?.aiMode || 'chat',
            aiReason: data?.aiReason || '',
            aiAt: data?.aiAt || new Date().toISOString()
          });
        }
        return data.reply || 'Robert could not prepare a reply.';
      })();
      const elapsed = Date.now() - typingStartedAt;
      if (elapsed < 320) await new Promise((resolve) => setTimeout(resolve, 320 - elapsed));
      hideRobertTyping();
      await animateRobertReply(reply);
      robertSpeak(reply);
      robertStatus(`ROBERT is ready. Source: ${robertProviderLabel(replyProvider || currentPortalState().robertLastProvider, replyFallback || currentPortalState().robertLastFallback)}.`);
    } catch (error) {
      hideRobertTyping();
      await animateRobertReply(error.name === 'AbortError' ? 'Robert stopped the current reply.' : (error.message || 'Sorry, I could not reach Robert right now.'));
      robertStatus(READY);
    } finally {
      hideRobertTyping();
      robertAbort = null;
    }
  };
  const ensureRobertMicPermission = async () => {
    const isLocalHost = /^(localhost|127(?:\.\d{1,3}){3})$/i.test(window.location.hostname || '');
    if (!window.isSecureContext && !isLocalHost) {
      throw new Error('Voice input works only on HTTPS or localhost.');
    }
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  };
  const robertVoiceErrorMessage = (errorCode = '') => ({
    'not-allowed': 'Microphone permission is blocked. Please allow mic access for this page and try again.',
    'service-not-allowed': 'Speech recognition is blocked by the browser. Please enable microphone access and try again.',
    'audio-capture': 'No microphone was found. Please connect a mic and try again.',
    'network': 'Voice service could not be reached right now. Please check the browser connection and try again.',
    'no-speech': 'No speech was detected. Please speak clearly and try again.',
    'aborted': 'Voice input was stopped.',
    'language-not-supported': `Voice input is not available for ${robertLanguageLabel(robertLang())} in this browser.`,
    'bad-grammar': 'Voice input could not understand the request. Please try again.'
  }[String(errorCode || '').trim()] || 'Voice input could not start right now.');
  const startRobertVoice = async () => {
    const access = robertAccessState();
    if (!access.allowed) {
      showRobertAccessMessage({ openPanel: true, toast: true });
      return;
    }
    const Api = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Api) {
      toast('Voice input is not available in this browser.', 'error');
      return;
    }
    if (robertRecognition) {
      try { robertRecognition.stop(); } catch {}
      robertRecognition = null;
    }
    try {
      await ensureRobertMicPermission();
    } catch (error) {
      setRobertMicState(false);
      robertStatus(READY);
      toast(error.message || 'Microphone permission is required for Robert voice input.', 'error');
      return;
    }
    const recognition = new Api();
    robertRecognition = recognition;
    recognition.lang = robertLang();
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setRobertMicState(true);
      robertStatus(`ROBERT is listening in ${robertLanguageLabel(recognition.lang)}...`);
    };
    recognition.onresult = (event) => {
      const input = document.getElementById('rovert-input');
      const parts = Array.from(event.results || []);
      const finalTranscript = parts
        .filter((result) => result.isFinal)
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();
      const interimTranscript = parts
        .filter((result) => !result.isFinal)
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();
      const transcript = finalTranscript || interimTranscript;
      if (input) input.value = transcript;
      if (finalTranscript) {
        if (document.getElementById('rovert-voice-autosend')?.checked) sendRobert(finalTranscript);
        else robertStatus('Voice captured. Review or send it.');
      }
    };
    recognition.onerror = (event) => {
      setRobertMicState(false);
      if (robertRecognition === recognition) robertRecognition = null;
      if (event?.error !== 'aborted') toast(robertVoiceErrorMessage(event?.error), event?.error === 'no-speech' ? 'info' : 'error');
      robertStatus(READY);
    };
    recognition.onend = () => {
      setRobertMicState(false);
      if (robertRecognition === recognition) robertRecognition = null;
      const inputText = String(document.getElementById('rovert-input')?.value || '').trim();
      if (!inputText) robertStatus(READY);
      else if (!document.getElementById('rovert-voice-autosend')?.checked) robertStatus('Voice captured. Review or send it.');
    };
    try {
      recognition.start();
    } catch (error) {
      setRobertMicState(false);
      robertRecognition = null;
      robertStatus(READY);
      toast(error.message || 'Voice input could not start right now.', 'error');
    }
  };
  const initRobert = () => {
    const panel = document.getElementById('rovert-panel');
    if (!panel) return;
    updateRobertIdentity();
    renderHistory();
    updateRobertAccessUI();
    savePortalState({ robertSessionId: String(Date.now()) }, { silent: true });
    const select = document.getElementById('rovert-language');
    if (select) {
      select.value = settings().rovertLanguage;
      select.addEventListener('change', async () => {
        const savedLanguage = await saveRobertLanguagePreference(select.value);
        select.value = savedLanguage;
        robertStatus(`ROBERT language set to ${select.options[select.selectedIndex]?.text || 'selected language'}.`);
      });
    }
    const lengthSelect = document.getElementById('rovert-length');
    if (lengthSelect) {
      lengthSelect.value = robertResponseLength();
      lengthSelect.addEventListener('change', async () => {
        const nextLength = normalizeRobertReplyLength(lengthSelect.value);
        await savePortalState({ robertResponseLength: nextLength }, { silent: true });
        lengthSelect.value = nextLength;
        robertStatus(`ROBERT reply length set to ${nextLength}.`);
      });
    }
    ['rovert-fab', 'rovert-hero-btn', 'admin-rovert-btn'].map((id) => document.getElementById(id)).filter(Boolean).forEach((button) => button.addEventListener('click', openRobert));
    document.getElementById('rovert-close')?.addEventListener('click', closeRobert);
    document.getElementById('rovert-send')?.addEventListener('click', () => sendRobert());
    document.getElementById('rovert-stop')?.addEventListener('click', stopRobert);
    document.getElementById('rovert-mic')?.addEventListener('click', startRobertVoice);
    document.getElementById('rovert-clear')?.addEventListener('click', () => {
      stopRobert();
      clearRobertComposer();
      savePortalState({ robertHistory: [], robertGreeted: false }, { silent: true });
      renderHistory();
      robertStatus(READY);
    });
    document.querySelectorAll('.rovert-chip').forEach((chip) => chip.addEventListener('click', () => sendRobert(chip.dataset.prompt || chip.textContent || '')));
    document.getElementById('rovert-input')?.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendRobert(); } });
    const file = document.getElementById('rovert-file');
    const label = document.getElementById('rovert-file-name');
    if (file && label) file.addEventListener('change', () => { label.textContent = file.files?.[0]?.name || 'No file selected'; });
    document.getElementById('rovert-analysis-download')?.addEventListener('click', () => runRobertFileAnalysis({ download: true }));
    window.addEventListener('smartlocal:robert-settings', () => {
      const selectBox = document.getElementById('rovert-language');
      if (selectBox) selectBox.value = settings().rovertLanguage;
      const lengthBox = document.getElementById('rovert-length');
      if (lengthBox) lengthBox.value = robertResponseLength();
      updateRobertIdentity();
      updateRobertAccessUI();
    });
    window.addEventListener('smartlocal:portal-state', () => {
      const lengthBox = document.getElementById('rovert-length');
      if (lengthBox) lengthBox.value = robertResponseLength();
      renderHistory();
      updateRobertIdentity();
      updateRobertAccessUI();
    });
    window.addEventListener('smartlocal:plan-updated', () => {
      updateRobertIdentity();
      updateRobertAccessUI();
    });
    loadPortalState().then(() => {
      initSoundToggles();
      renderHistory();
      if (select) select.value = settings().rovertLanguage;
      if (lengthSelect) lengthSelect.value = robertResponseLength();
      updateRobertIdentity();
      updateRobertAccessUI();
    }).catch(() => {});
  };

  window.showToast = toast;
  window.generateFormRef = formRef;
  window.formatRupees = formatMoney;
  window.getBusinessLogo = businessLogo;
  window.playLoginTone = playLoginTone;
  window.playUiTone = playUiTone;
  window.smartlocalBuildStatementRows = statementRowsFromRecords;
  window.smartlocalStatementSummary = summarizeStatementRows;
  window.smartlocalFetchStatementRows = fetchLiveStatementRows;
  window.smartlocalDownloadStatement = downloadStatement;
  window.addEventListener('DOMContentLoaded', () => { window.sanitizePortalText = cleanPortal; window.getBusinessLogo = businessLogo; window.formatRupees = formatMoney; window.generateFormRef = formRef; window.showToast = toast; cleanPortal(); initNav(); initHomepageSegmentAccess(); initHomepageHeroSlider(); initHomepageVisualGallery(); initHomepageBookingCalendar(); initHomepageVisitorCounter(); initContact(); initCourier(); initHomepageNotifications(); initRobert(); startPortalStateLiveSync(); setTimeout(cleanPortal, 120); });
  window.addEventListener('load', () => {
    const preloader = document.getElementById('sl-preloader');
    if (preloader && !preloader.dataset.startedAt) preloader.dataset.startedAt = String(Date.now());
    hidePreloader();
    initHomepageAudio();
  });
})();

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

// Final overrides for text cleanup after legacy mojibake blocks.
function sanitizeDisplayText(text) {
  return String(text || '')
    .replace(/Ã¢â€šÂ¹|â‚¹/g, '\u20B9')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã¢â‚¬Â¢/g, '\u2022')
    .replace(/Ã‚Â©|Â©/g, '\u00A9')
    .replace(/Ã‚Â£|Â£/g, '\u00A3')
    .replace(/Ã¢â€šÂ¬|â‚¬/g, '\u20AC')
    .replace(/ðŸ¤–|🤖/g, 'R')
    .replace(/ROBERT is ready\. Secure key is loaded from the server\./g, 'ROBERT is ready for the next question.');
}

function sanitizePortalText(root = document) {
  const selectors = ['th', 'td', 'p', 'span', 'div', 'button', 'label', 'option', 'h1', 'h2', 'h3', 'h4', 'h5'];
  root.querySelectorAll(selectors.join(',')).forEach((element) => {
    if (element.children.length) return;
    const original = element.textContent || '';
    if (!/Ã¢â€šÂ¹|â‚¹|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã¢â‚¬Â¢|Ã‚Â©|Â©|Ã‚Â£|Â£|Ã¢â€šÂ¬|â‚¬|ðŸ¤–|🤖/.test(original)) return;
    const cleaned = sanitizeDisplayText(original);
    if (cleaned !== original) element.textContent = cleaned;
  });

  const rovertStatus = document.getElementById('rovert-status');
  if (rovertStatus) rovertStatus.textContent = 'ROBERT is ready for the next question.';
}
