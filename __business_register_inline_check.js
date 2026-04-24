
// Plan selection functionality
let selectedPlan = null;
const registrationPasswordInput = document.getElementById('reg-password');
const registrationBusinessNameInput = document.getElementById('reg-business-name');
const passwordToggleButton = document.getElementById('reg-password-toggle');
const passwordStrengthPanel = document.getElementById('password-strength-panel');
const passwordStrengthLabel = document.getElementById('password-strength-label');
const passwordStrengthScore = document.getElementById('password-strength-score');
const passwordStrengthMeter = document.getElementById('password-strength-meter');
const passwordStrengthFill = document.getElementById('password-strength-fill');
const passwordCriteriaItems = {
  length: document.querySelector('[data-rule="length"]'),
  uppercase: document.querySelector('[data-rule="uppercase"]'),
  number: document.querySelector('[data-rule="number"]'),
  underscore: document.querySelector('[data-rule="underscore"]'),
  business: document.querySelector('[data-rule="business"]')
};
function getPlanTierClass(planType) {
  const tier = planType.toLowerCase();
  if (tier === 'silver' || tier === 'starter') return 'plan-tier-silver';
  if (tier === 'gold' || tier === 'professional') return 'plan-tier-gold';
  if (tier === 'platinum' || tier === 'enterprise') return 'plan-tier-platinum';
  return 'plan-tier-default';
}

function selectPlan(planType, showToastNotification = true) {
  const normalizedPlan = String(planType || '').toLowerCase();
  if (!['silver', 'gold', 'platinum'].includes(normalizedPlan)) return;
  selectedPlan = normalizedPlan;
  document.getElementById('plan-selection').style.display = 'none';
  document.getElementById('registration-form').style.display = 'block';
  updateSelectedPlanUI(normalizedPlan);

  // Scroll to form
  document.getElementById('registration-form').scrollIntoView({ behavior: 'smooth' });

  if (showToastNotification) {
    const planLabel = normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1);
    showToast(`Plan "${planLabel}" selected!`, 'success');
  }
}

function updateSelectedPlanUI(planType) {
  const planBadge = document.getElementById('selected-plan-display');
  const normalizedPlan = String(planType || '').toLowerCase();
  if (!normalizedPlan) {
    planBadge.textContent = 'None';
    planBadge.className = 'plan-highlight plan-tier-badge plan-tier-default';
    return;
  }
  const planLabel = normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1);
  planBadge.textContent = planLabel;
  planBadge.className = `plan-highlight plan-tier-badge ${getPlanTierClass(normalizedPlan)}`;
}

function goBackToPlans() {
  document.getElementById('registration-form').style.display = 'none';
  document.getElementById('plan-selection').style.display = 'block';
  selectedPlan = null;
  updateSelectedPlanUI('');
}

function normalizePasswordPolicyValue(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function analyzeRegistrationPassword(password, businessName) {
  const rawPassword = String(password || '');
  const normalizedPassword = normalizePasswordPolicyValue(rawPassword);
  const normalizedBusinessName = normalizePasswordPolicyValue(businessName);
  const businessRulePending = !normalizedBusinessName;
  const checks = {
    length: rawPassword.length >= 9,
    uppercase: /[A-Z]/.test(rawPassword),
    number: /\d/.test(rawPassword),
    underscore: rawPassword.includes('_'),
    business: businessRulePending ? false : !normalizedPassword.startsWith(normalizedBusinessName)
  };
  const passedCount = Object.values(checks).filter(Boolean).length;
  const percentage = rawPassword ? Math.round((passedCount / 5) * 100) : 0;

  let level = 'idle';
  let label = 'Password strength graph will appear here';
  let message = 'Use 1 capital letter, 1 number, 1 underscore, and do not start with business name.';

  if (!rawPassword) {
    message = 'Use 1 capital letter, 1 number, 1 underscore, and do not start with business name.';
  } else if (!checks.length) {
    level = 'weak';
    label = 'Weak password';
    message = 'Password must be at least 9 characters long.';
  } else if (!checks.uppercase) {
    level = 'weak';
    label = 'Weak password';
    message = 'Password must include at least 1 capital letter.';
  } else if (!checks.number) {
    level = 'weak';
    label = 'Weak password';
    message = 'Password must include at least 1 number.';
  } else if (!checks.underscore) {
    level = 'medium';
    label = 'Medium password';
    message = 'Password must include at least 1 underscore (_).';
  } else if (businessRulePending) {
    level = 'good';
    label = 'Almost ready';
    message = 'Enter business name to verify the final security rule.';
  } else if (!checks.business) {
    level = 'medium';
    label = 'Rename password';
    message = 'Password cannot start with your business name.';
  } else if (passedCount === 5) {
    level = 'strong';
    label = 'Strong password';
    message = 'All password rules are satisfied.';
  } else {
    level = 'good';
    label = 'Good password';
    message = 'Password is getting stronger.';
  }

  return {
    valid: rawPassword.length > 0 && checks.length && checks.uppercase && checks.number && checks.underscore && !businessRulePending && checks.business,
    level,
    label,
    message,
    percentage,
    criteriaStates: {
      length: checks.length ? 'complete' : (rawPassword ? 'fail' : 'idle'),
      uppercase: checks.uppercase ? 'complete' : (rawPassword ? 'fail' : 'idle'),
      number: checks.number ? 'complete' : (rawPassword ? 'fail' : 'idle'),
      underscore: checks.underscore ? 'complete' : (rawPassword ? 'fail' : 'idle'),
      business: businessRulePending ? (rawPassword ? 'pending' : 'idle') : (checks.business ? 'complete' : 'fail')
    }
  };
}

function renderPasswordStrength() {
  if (!registrationPasswordInput || !passwordStrengthPanel || !passwordStrengthFill) return { valid: false };

  const analysis = analyzeRegistrationPassword(
    registrationPasswordInput.value,
    registrationBusinessNameInput ? registrationBusinessNameInput.value : ''
  );

  passwordStrengthPanel.dataset.strength = analysis.level;
  passwordStrengthLabel.textContent = `${analysis.label} - ${analysis.message}`;
  passwordStrengthScore.textContent = `${analysis.percentage}%`;
  passwordStrengthFill.style.width = `${analysis.percentage}%`;
  passwordStrengthMeter.setAttribute('aria-valuenow', String(analysis.percentage));
  passwordStrengthMeter.setAttribute('aria-label', analysis.label);

  Object.entries(passwordCriteriaItems).forEach(([key, element]) => {
    if (!element) return;
    const state = analysis.criteriaStates[key];
    element.classList.remove('is-complete', 'is-fail', 'is-pending');
    if (state === 'complete') element.classList.add('is-complete');
    if (state === 'fail') element.classList.add('is-fail');
    if (state === 'pending') element.classList.add('is-pending');
  });

  return analysis;
}

if (registrationPasswordInput) {
  registrationPasswordInput.addEventListener('input', renderPasswordStrength);
}

if (registrationBusinessNameInput) {
  registrationBusinessNameInput.addEventListener('input', renderPasswordStrength);
}

if (passwordToggleButton && registrationPasswordInput) {
  passwordToggleButton.addEventListener('click', function() {
    const shouldReveal = registrationPasswordInput.type === 'password';
    registrationPasswordInput.type = shouldReveal ? 'text' : 'password';
    passwordToggleButton.setAttribute('aria-pressed', shouldReveal ? 'true' : 'false');
    passwordToggleButton.setAttribute('aria-label', shouldReveal ? 'Hide password' : 'Show password');
    passwordToggleButton.setAttribute('title', shouldReveal ? 'Hide password' : 'Show password');
    passwordToggleButton.classList.toggle('is-visible', shouldReveal);
  });
}

// Form submission
document.getElementById('business-register-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  if (!selectedPlan) {
    showToast('Please select a plan first.', 'error');
    return;
  }

  const password = document.getElementById('reg-password').value;
  const businessName = document.getElementById('reg-business-name').value.trim();
  const passwordAnalysis = renderPasswordStrength();
  if (!passwordAnalysis.valid) {
    showToast(passwordAnalysis.message, 'error');
    document.getElementById('reg-password').focus();
    return;
  }

  const user = {
    userid: document.getElementById('reg-userid').value.trim(),
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password,
    plan: selectedPlan,
    planDetails: getPlanDetails(selectedPlan),
    business: {
      name: businessName,
      type: document.getElementById('reg-business-type').value,
      address: document.getElementById('reg-address').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      gender: document.getElementById('reg-gender').value,
      bank: document.getElementById('reg-bank').value.trim(),
      ifsc: document.getElementById('reg-ifsc').value.trim(),
      gst: document.getElementById('reg-gst').value.trim(),
      description: document.getElementById('reg-description').value.trim()
    },
    registrationDate: new Date().toISOString(),
    status: 'active'
  };

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
    if (!payload?.user) {
      showToast('Registration saved, but user confirmation is unavailable right now.', 'error');
      return;
    }
  } catch (error) {
    showToast('Server unavailable. Please try again later.', 'error');
    return;
  }

  // Redirect to confirmation with plan info and reference number
  const ref = generateFormRef('REG');
  window.location.href = `confirmation.html?type=register&plan=${encodeURIComponent(selectedPlan)}&ref=${encodeURIComponent(ref)}&name=${encodeURIComponent(user.name)}&userid=${encodeURIComponent(user.userid)}&business=${encodeURIComponent(user.business?.name || '')}`;
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
  if (!urlPlan) {
    updateSelectedPlanUI('');
    return;
  }

  const normalized = urlPlan.toLowerCase();
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

renderPasswordStrength();

