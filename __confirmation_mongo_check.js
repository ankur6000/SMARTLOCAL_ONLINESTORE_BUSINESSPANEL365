
  const params = new URLSearchParams(window.location.search);
  const type = (params.get('type') || 'generic').toLowerCase();
  const ref = params.get('ref') || 'Pending';
  const name = params.get('name') || '';
  const plan = (params.get('plan') || '').toLowerCase();
  const userid = params.get('userid') || '';
  const business = params.get('business') || '';
  const planLabel = plan ? `${plan.charAt(0).toUpperCase()}${plan.slice(1)}` : 'Selected';

  const title = document.getElementById('confirmation-title');
  const copy = document.getElementById('confirmation-copy');
  const badge = document.getElementById('confirmation-badge');
  const icon = document.getElementById('confirmation-icon');
  const highlightTitle = document.getElementById('confirmation-highlight-title');
  const highlightCopy = document.getElementById('confirmation-highlight-copy');
  const planPill = document.getElementById('confirmation-plan-pill');
  const cardTitle = document.getElementById('confirmation-card-title');
  const refEl = document.getElementById('confirmation-ref');
  const refPill = document.getElementById('confirmation-ref-pill');
  const planEl = document.getElementById('confirmation-plan');
  const businessEl = document.getElementById('confirmation-business');
  const userEl = document.getElementById('confirmation-userid');
  const stepsTitle = document.getElementById('confirmation-steps-title');

  if (icon && !/^[A-Za-z0-9]+$/.test((icon.textContent || '').trim())) {
    icon.textContent = 'OK';
  }

  refEl.textContent = ref;
  refPill.textContent = `REF ${ref}`;
  planEl.textContent = planLabel;
  businessEl.textContent = business || 'Registered Business';
  userEl.textContent = userid || 'Created';

  const applyPlanTone = (value) => {
    planPill.className = 'confirmation-plan-pill';
    if (value === 'silver' || value === 'gold' || value === 'platinum') {
      planPill.classList.add(value);
    }
  };

  if (type === 'register') {
    badge.textContent = 'Registration Successful';
    icon.textContent = '✓';
    title.textContent = 'Business Registration Confirmed';
    copy.textContent = `${name ? `${name}, ` : ''}your ${planLabel} plan registration has been saved successfully and your SmartLocal business account is ready.`;
    highlightTitle.textContent = 'Welcome to SmartLocal Business Command Center';
    highlightCopy.textContent = `Your registration is complete. Use the same business user ID and password in the Admin Panel to continue setup, overview, Robert, and market tools.`;
    planPill.textContent = `${planLabel} Segment Active`;
    cardTitle.textContent = 'Business Activation';
    stepsTitle.textContent = 'Your next three steps';
    applyPlanTone(plan);
  } else if (type === 'contact') {
    badge.textContent = 'Contact Confirmation';
    icon.textContent = '✉';
    title.textContent = 'Message Sent Successfully';
    copy.textContent = `${name ? `${name}, ` : ''}our team has received your message and will get back to you soon.`;
    highlightTitle.textContent = 'SmartLocal support has your message';
    highlightCopy.textContent = 'We have recorded your contact request and the support team will follow up using the submitted email address.';
    planPill.textContent = 'Support Queue';
    planEl.textContent = 'Support';
    businessEl.textContent = business || 'Contact Request';
    userEl.textContent = userid || 'Not required';
    cardTitle.textContent = 'Contact Request';
    stepsTitle.textContent = 'What happens next';
  } else {
    planPill.textContent = 'Request Logged';
  }

  if (type === 'register') icon.textContent = 'OK';
  if (type === 'contact') icon.textContent = 'Mail';
