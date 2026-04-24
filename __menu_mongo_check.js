
let rates = {};

function normalizeMenuCopy() {
  document.querySelector('.nav-cta').textContent = 'Dashboard ->';
  const sectionTag = document.querySelector('.section-tag');
  if (sectionTag) sectionTag.textContent = '* Menu';

  const iconLabels = ['SR', 'FX', 'PDF', 'BIZ', 'AN', 'SET', 'ME'];
  document.querySelectorAll('.features-grid .feat-icon').forEach((icon, index) => {
    if (iconLabels[index]) icon.textContent = iconLabels[index];
  });

  ['total-sales', 'month-sales', 'week-sales', 'today-sales'].forEach((id) => {
    const value = document.getElementById(id);
    const wrap = value?.parentElement;
    if (wrap) wrap.firstChild.textContent = 'Rs ';
  });

  const currencyLabels = Array.from(document.querySelectorAll('#currency-converter label'));
  if (currencyLabels[0]) currencyLabels[0].textContent = 'Amount in Rupees (Rs)';
  if (currencyLabels[1]) currencyLabels[1].textContent = 'Select Currency';
  const currencySelect = document.getElementById('currency-select');
  if (currencySelect) {
    const optionText = ['USD ($)', 'GBP (Pound)', 'EUR (Euro)', 'JPY (Yen)'];
    Array.from(currencySelect.options).forEach((option, index) => {
      if (optionText[index]) option.textContent = optionText[index];
    });
  }
  const invoiceItems = document.getElementById('inv-items');
  if (invoiceItems) invoiceItems.placeholder = 'Item1: Rs 100\nItem2: Rs 200';
  const labels = Array.from(document.querySelectorAll('#invoice-generator label'));
  if (labels[3]) labels[3].textContent = 'Total Amount (Rs)';

  const profileAvatar = document.getElementById('profile-avatar-full');
  if (profileAvatar) profileAvatar.textContent = 'ME';
  const profileTitles = document.querySelectorAll('.profile-section-title');
  if (profileTitles[0]) profileTitles[0].textContent = 'Business Information';
  if (profileTitles[1]) profileTitles[1].textContent = 'Membership & Pricing';

  const footerDesc = document.querySelector('.footer-desc');
  if (footerDesc) footerDesc.textContent = "Empowering India's local businesses to thrive in the digital economy. Built with care for shop owners, entrepreneurs, and dreamers.";
  const footerCopy = document.querySelector('.footer-bottom p');
  if (footerCopy) footerCopy.innerHTML = '&copy; 2025 SmartLocal. All rights reserved. Made in India.';
  const socialLabels = ['FB', 'IG', 'X', 'IN'];
  document.querySelectorAll('.social-btn').forEach((button, index) => {
    if (socialLabels[index]) button.textContent = socialLabels[index];
  });
}

async function fetchRates() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
    const data = await response.json();
    rates = data.rates;
  } catch (error) {
    console.error('Error fetching rates:', error);
    rates = { USD: 0.012, GBP: 0.0095, EUR: 0.011, JPY: 1.8 }; // Fallback
  }
}

function showSalesReport() {
  document.querySelectorAll('.admin-wrapper').forEach(el => el.style.display = 'none');
  document.getElementById('sales-report').style.display = 'block';
}

function showCurrencyConverter() {
  document.querySelectorAll('.admin-wrapper').forEach(el => el.style.display = 'none');
  document.getElementById('currency-converter').style.display = 'block';
}

function showBusinessList() {
  document.querySelectorAll('.admin-wrapper').forEach(el => el.style.display = 'none');
  document.getElementById('business-list-menu').style.display = 'block';
  renderBusinessesMenu();
}

function convertCurrency() {
  const amount = parseFloat(document.getElementById('rupees-amount').value);
  const currency = document.getElementById('currency-select').value;
  if (amount && rates[currency]) {
    const converted = (amount * rates[currency]).toFixed(2);
    document.getElementById('conversion-result').innerText = `₹${amount} = ${converted} ${currency}`;
  } else {
    document.getElementById('conversion-result').innerText = 'Please enter a valid amount.';
  }
}

convertCurrency = function() {
  const amount = parseFloat(document.getElementById('rupees-amount').value);
  const currency = document.getElementById('currency-select').value;
  if (amount && rates[currency]) {
    const converted = (amount * rates[currency]).toFixed(2);
    document.getElementById('conversion-result').innerText = `Rs ${amount} = ${converted} ${currency}`;
  } else {
    document.getElementById('conversion-result').innerText = 'Please enter a valid amount.';
  }
};

document.getElementById('invoice-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const customer = document.getElementById('inv-customer').value;
  const orderId = document.getElementById('inv-order-id').value;
  const items = document.getElementById('inv-items').value;
  const total = document.getElementById('inv-total').value;
  
  doc.setFontSize(20);
  doc.text('SmartLocal Invoice', 20, 20);
  doc.setFontSize(12);
  doc.text(`Order ID: ${orderId}`, 20, 40);
  doc.text(`Customer: ${customer}`, 20, 50);
  doc.text(`Items:`, 20, 60);
  doc.text(items, 20, 70);
  doc.text(`Total: ₹${total}`, 20, 100);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 110);
  
  doc.save(`invoice_${orderId}.pdf`);
  showToast('Invoice generated and downloaded!', 'success');
});

async function renderBusinessesMenu() {
  const container = document.getElementById('businesses-menu');
  if (!container) return;
  container.innerHTML = '<div class="business-item"><p>Loading live businesses...</p></div>';
  try {
    const response = await fetch('/api/businesses?limit=100');
    const data = response.ok ? await response.json() : { items: [] };
    const businesses = Array.isArray(data.items) ? data.items : [];
    if (!businesses.length) {
      container.innerHTML = '<div class="business-item"><p>No live business registrations found.</p></div>';
      return;
    }
    container.innerHTML = businesses.filter(user => user.business).map((user) => `
      <div class="business-item">
        <h4>${user.business.name}</h4>
        <p>Type: ${user.business.type || '-'}</p>
        <p>Address: ${user.business.address || '-'}</p>
        <p>Phone: ${user.business.phone || '-'}</p>
      </div>
    `).join('') || '<div class="business-item"><p>No live business registrations found.</p></div>';
  } catch (error) {
    container.innerHTML = '<div class="business-item"><p>Live business data is unavailable right now.</p></div>';
  }
}

let businessesMenuLiveTimer = null;
const LIVE_MENU_SYNC_MS = 1000;

function showAnalytics() {
  showToast('Analytics feature coming soon!', 'info');
}

function showSettings() {
  showToast('Settings feature coming soon!', 'info');
}

function showProfile() {
  document.querySelectorAll('.admin-wrapper').forEach(el => el.style.display = 'none');
  document.getElementById('profile-section').style.display = 'block';
  populateProfile();
}

function populateProfile() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
  
  // Set user info
  document.getElementById('profile-name-full').textContent = currentUser.name || 'Business Owner';
  document.getElementById('profile-email-full').textContent = currentUser.email || 'email@example.com';
  document.getElementById('profile-userid-full').textContent = `User ID: ${currentUser.userid || 'N/A'}`;
  document.getElementById('profile-avatar-full').textContent = getBusinessLogo(currentUser.business?.type || 'platform');
  
  // Set business info
  document.getElementById('profile-business-name').textContent = currentUser.business?.name || '-';
  document.getElementById('profile-business-type').textContent = capitalizeFirst(currentUser.business?.type || '-');
  document.getElementById('profile-address').textContent = currentUser.business?.address || '-';
  document.getElementById('profile-phone').textContent = currentUser.business?.phone || '-';
  document.getElementById('profile-gst').textContent = currentUser.business?.gst || 'Not Provided';
  document.getElementById('profile-bank').textContent = formatBankAccount(currentUser.business?.bank || '-');
  
  // Set segment display
  const plan = (currentUser.plan || 'gold').toLowerCase();
  const segmentDisplay = document.getElementById('profile-segment-display');
  let segmentHTML = '<div class="segment-badge-large">';
  
  if (plan === 'silver' || plan === 'starter') {
    segmentHTML += '<span class="segment-icon-large">⭐</span>';
    segmentHTML += '<span class="segment-label-large">Silver Member</span>';
    segmentHTML += '<span class="segment-description-large">Basic tier with essential features</span>';
  } else if (plan === 'platinum' || plan === 'enterprise') {
    segmentHTML += '<span class="segment-icon-large">💎</span>';
    segmentHTML += '<span class="segment-label-large">Platinum Elite</span>';
    segmentHTML += '<span class="segment-description-large">Premium tier with all features</span>';
  } else {
    segmentHTML += '<span class="segment-icon-large">⚡</span>';
    segmentHTML += '<span class="segment-label-large">Gold Premium</span>';
    segmentHTML += '<span class="segment-description-large">Professional tier with advanced tools</span>';
  }
  
  segmentHTML += '</div>';
  segmentDisplay.innerHTML = segmentHTML;
  const iconNode = segmentDisplay.querySelector('.segment-icon-large');
  if (iconNode) {
    iconNode.textContent = plan === 'silver' || plan === 'starter'
      ? 'S'
      : plan === 'platinum' || plan === 'enterprise'
        ? 'P'
        : 'G';
  }
  
  // Set plan details
  const planDetails = getPlanDetails(plan);
  let planHTML = '<div class="plan-badge-large">';
  planHTML += `<div class="plan-name-large">${planDetails.name}</div>`;
  planHTML += `<div class="plan-price-large">₹ ${planDetails.price.toLocaleString()}/month</div>`;
  planHTML += '<div class="plan-features-large">';
  
  (planDetails.features || []).forEach(feature => {
    planHTML += `<div class="plan-feature-item">${feature}</div>`;
  });
  
  planHTML += '</div></div>';
  document.getElementById('profile-plan-display').innerHTML = planHTML;
  const priceNode = document.querySelector('.plan-price-large');
  if (priceNode) priceNode.textContent = `Rs ${planDetails.price.toLocaleString()}/month`;
}

function getPlanDetails(plan) {
  const plans = {
    silver: {
      name: 'Silver',
      price: 999,
      features: ['Digital Business Card', 'Basic Analytics', 'Customer Management', 'Mobile App Access', 'Email Support']
    },
    gold: {
      name: 'Gold',
      price: 2499,
      features: ['Everything in Silver', 'Advanced Analytics', 'Sales Reports & PDF', 'Currency Converter', 'Priority Support', 'Custom Branding', 'Marketing Tools']
    },
    platinum: {
      name: 'Platinum',
      price: 4999,
      features: ['Everything in Gold', 'White-label Solution', 'API Access', 'Multi-location Support', 'Advanced Integrations', 'Dedicated Account Manager', 'Custom Development', '24/7 Phone Support']
    }
  };
  return plans[plan] || plans.gold;
}

function capitalizeFirst(str) {
  if (!str) return '-';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatBankAccount(account) {
  if (!account || account === '-') return '-';
  const last4 = account.slice(-4);
  return `****${last4}`;
}

function editProfile() {
  showToast('Redirect to registration page to edit profile.', 'info');
  setTimeout(() => {
    window.location.href = 'business-register.html';
  }, 800);
}

function upgradeMembership() {
  showToast('Redirecting to membership upgrade page...', 'info');
  setTimeout(() => {
    window.location.href = 'business-register.html?plan=gold';
  }, 800);
}

document.addEventListener('DOMContentLoaded', function() {
  normalizeMenuCopy();
  fetchRates();
  renderBusinessesMenu();
  if (businessesMenuLiveTimer) clearInterval(businessesMenuLiveTimer);
  businessesMenuLiveTimer = setInterval(() => {
    if (document.hidden) return;
    renderBusinessesMenu();
  }, LIVE_MENU_SYNC_MS);
});
