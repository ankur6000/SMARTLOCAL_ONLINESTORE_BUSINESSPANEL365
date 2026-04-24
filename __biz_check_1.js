
// Plan selection functionality
let selectedPlan = null;

function getPlanTierClass(planType) {
  const tier = planType.toLowerCase();
  if (tier === 'silver' || tier === 'starter') return 'plan-tier-silver';
  if (tier === 'gold' || tier === 'professional') return 'plan-tier-gold';
  if (tier === 'platinum' || tier === 'enterprise') return 'plan-tier-platinum';
  return 'plan-tier-default';
}

function selectPlan(planType, showToastNotification = true) {
  selectedPlan = planType;
  localStorage.setItem('selectedPlan', planType);
  document.getElementById('plan-selection').style.display = 'none';
  document.getElementById('registration-form').style.display = 'block';
  updateSelectedPlanUI(planType);

  // Scroll to form
  document.getElementById('registration-form').scrollIntoView({ behavior: 'smooth' });

  if (showToastNotification) {
    const planLabel = planType.charAt(0).toUpperCase() + planType.slice(1);
    showToast(`Plan "${planLabel}" selected!`, 'success');
  }
}

function updateSelectedPlanUI(planType) {
  const planLabel = planType.charAt(0).toUpperCase() + planType.slice(1);
  const planBadge = document.getElementById('selected-plan-display');
  planBadge.textContent = planLabel;
  planBadge.className = `plan-highlight plan-tier-badge ${getPlanTierClass(planType)}`;
}

function getPlanSegment(planType) {
  const tier = (planType || '').toLowerCase();
  if (tier === 'silver' || tier === 'starter') return 'Silver';
  if (tier === 'gold' || tier === 'professional') return 'Gold';
  if (tier === 'platinum' || tier === 'enterprise') return 'Platinum';
  return 'Professional';
}

function goBackToPlans() {
  document.getElementById('registration-form').style.display = 'none';
  document.getElementById('plan-selection').style.display = 'block';
  selectedPlan = null;
  localStorage.removeItem('selectedPlan');
  document.getElementById('selected-plan-display').textContent = 'None';
}

// Form submission
document.getElementById('business-register-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  if (!selectedPlan) {
    showToast('Please select a plan first.', 'error');
    return;
  }

  const password = document.getElementById('reg-password').value;
  const user = {
    userid: document.getElementById('reg-userid').value,
    name: document.getElementById('reg-name').value,
    email: document.getElementById('reg-email').value,
    password,
    plan: selectedPlan,
    planDetails: getPlanDetails(selectedPlan),
    business: {
      name: document.getElementById('reg-business-name').value,
      type: document.getElementById('reg-business-type').value,
      address: document.getElementById('reg-address').value,
      phone: document.getElementById('reg-phone').value,
      gender: document.getElementById('reg-gender').value,
      bank: document.getElementById('reg-bank').value,
      ifsc: document.getElementById('reg-ifsc').value,
      gst: document.getElementById('reg-gst').value,
      description: document.getElementById('reg-description').value
    },
    registrationDate: new Date().toISOString(),
    status: 'active'
  };

  let savedUser = null;
  try {
    const response = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload?.error || 'Registration failed. Please try again.';
      showToast(message, 'error');
      return;
    }

    const payload = await response.json().catch(() => ({}));
    savedUser = payload?.user || null;
  } catch (error) {
    showToast('Server unavailable. Please try again later.', 'error');
    return;
  }

  if (savedUser) {
    localStorage.setItem('registeredBusinessUser', JSON.stringify(savedUser));
    localStorage.setItem('rememberLogin', JSON.stringify({ userid: savedUser.userid || user.userid }));
  }
  sessionStorage.setItem('smartlocalRecentPassword', password);
  sessionStorage.setItem('smartlocalRecentRegistration', JSON.stringify({
    userid: user.userid,
    password,
    name: user.name,
    plan: user.plan,
    businessName: user.business?.name || ''
  }));

  // Redirect to confirmation with plan info and reference number
  const ref = generateFormRef('REG');
  window.location.href = `confirmation.html?type=register&plan=${encodeURIComponent(selectedPlan)}&ref=${encodeURIComponent(ref)}&name=${encodeURIComponent(user.name)}`;
});

function getPlanDetails(planType) {
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
  return plans[planType] || plans.gold;
}

function readQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function tryAutoSelectPlan() {
  const urlPlan = readQueryParam('plan');
  const savedPlan = localStorage.getItem('selectedPlan');
  const planToUse = urlPlan || savedPlan || 'gold'; // Default to gold if no plan
  if (!planToUse) return;

  const normalized = planToUse.toLowerCase();
  if (['silver', 'gold', 'platinum'].includes(normalized)) {
    selectPlan(normalized, false);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  tryAutoSelectPlan();
});

// Auto-generate User ID suggestion
document.getElementById('reg-business-name').addEventListener('input', function() {
  const businessName = this.value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (businessName && !document.getElementById('reg-userid').value) {
    document.getElementById('reg-userid').value = businessName + Math.floor(Math.random() * 100);
  }
});

