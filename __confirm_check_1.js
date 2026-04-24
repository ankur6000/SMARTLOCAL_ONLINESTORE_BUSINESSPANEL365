
  const params = new URLSearchParams(window.location.search);
  const type = (params.get('type') || 'generic').toLowerCase();
  const ref = params.get('ref') || 'Pending';
  const name = params.get('name') || '';
  const plan = params.get('plan') || '';
  const userid = params.get('userid') || '';
  const business = params.get('business') || '';

  const title = document.getElementById('confirmation-title');
  const copy = document.getElementById('confirmation-copy');
  const card = document.getElementById('confirmation-card');
  const refEl = document.getElementById('confirmation-ref');

  refEl.textContent = ref;

  if (type === 'register') {
    title.textContent = 'Business Registration Confirmed';
    copy.textContent = `${name ? `${name}, ` : ''}your ${plan || 'selected'} plan registration has been saved successfully.`;
    card.innerHTML = `<strong>Plan:</strong> ${plan || 'Selected'}<br><strong>Business:</strong> ${business || 'Registered Business'}<br><strong>User ID:</strong> ${userid || 'Created'}<br><strong>Reference:</strong> ${ref}`;
  } else if (type === 'contact') {
    title.textContent = 'Message Sent Successfully';
    copy.textContent = `${name ? `${name}, ` : ''}our team has received your message and will get back to you soon.`;
    card.innerHTML = `<strong>Contact Reference:</strong> ${ref}<br><strong>Status:</strong> Received by SmartLocal support`;
  }

