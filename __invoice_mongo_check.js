
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    const content = document.getElementById('invoice-content');

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatMoney(value) {
      const amount = Number(value) || 0;
      return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function formatPdfMoney(value) {
      const amount = Number(value) || 0;
      return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function formatDisplayMoney(value) {
      const amount = Number(value) || 0;
      return `\u20B9${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function normalizePaymentMode(value) {
      const raw = String(value || '').trim();
      const clean = raw.toLowerCase();
      if (!raw) return 'UPI';
      if (clean.includes('credit')) return 'Credit';
      if (clean.includes('debit')) return 'Debit';
      if (clean === 'upi' || clean.includes('upi')) return 'UPI';
      if (clean.includes('net')) return 'Netbanking';
      if (clean.includes('wallet')) return 'E-Wallet';
      if (clean.includes('auto')) return 'Autopay';
      return raw;
    }

    function sanitizePdfText(value) {
      return String(value ?? '')
        .replace(/\u20B9/g, 'Rs. ')
        .replace(/[•·]/g, '|')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();
    }

    function currentInvoiceDateTime() {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date());
    }

    function invoiceBusinessName(order) {
      return String(order?.businessName || 'SmartLocal Business').trim() || 'SmartLocal Business';
    }

    function drawDigitalSignaturePanel(doc, order, y) {
      const businessName = invoiceBusinessName(order);
      const signedAt = currentInvoiceDateTime();
      if (y > 244) {
        doc.addPage();
        y = 18;
      }

      doc.setDrawColor(134, 239, 172);
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(14, y, 182, 34, 4, 4, 'FD');
      doc.setFillColor(34, 197, 94);
      doc.circle(24, y + 10, 5, 'F');
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(1.1);
      doc.line(21.5, y + 10, 23.3, y + 11.9);
      doc.line(23.3, y + 11.9, 27.2, y + 8.1);
      doc.setTextColor(22, 101, 52);
      doc.setFontSize(11);
      doc.text('DIGITALLY SIGNED INVOICE', 34, y + 8);
      doc.setFontSize(9);
      doc.text(sanitizePdfText(`Verified by SmartLocal for ${businessName}`), 34, y + 14);
      doc.text(sanitizePdfText(`Platform: SmartLocal | Business: ${businessName}`), 34, y + 20);
      doc.text(sanitizePdfText(`Signed at: ${signedAt}`), 34, y + 26);
      doc.setTextColor(18, 24, 38);
      return y + 38;
    }

    async function fetchOrder(id) {
      try {
        const response = await fetch(`/api/orders/by-id/${encodeURIComponent(id)}`);
        if (!response.ok) return null;
        return await response.json();
      } catch (err) {
        return null;
      }
    }

    function generateInvoicePdf(order) {
      if (!window.jspdf || !window.jspdf.jsPDF) return;

      const doc = new window.jspdf.jsPDF();
      const paymentMode = normalizePaymentMode(order.payment);
      const businessName = invoiceBusinessName(order);
      doc.setFont('courier', 'normal');
      doc.setFontSize(14);
      doc.text('SMARTLOCAL INVOICE', 14, 18);
      doc.setFontSize(10);
      doc.text(sanitizePdfText(`Invoice ID: ${order.orderId}`), 14, 26);
      doc.text(sanitizePdfText(`Date: ${new Date(order.date).toLocaleDateString('en-IN')}`), 14, 32);
      doc.text(sanitizePdfText(`Business: ${businessName}`), 14, 38);
      doc.text(sanitizePdfText(`GST No: ${order.gstNo}`), 14, 44);
      doc.text(sanitizePdfText(`Warranty: 1 year (till ${order.warrantyExpiry})`), 14, 50);
      doc.text(sanitizePdfText(`Customer: ${order.customer.name}`), 14, 60);
      doc.text(sanitizePdfText(`Phone: ${order.customer.phone}`), 14, 66);
      doc.text(doc.splitTextToSize(sanitizePdfText(`Address: ${order.customer.address}`), 180), 14, 72);

      let y = 84;
      doc.text('Items:', 14, y);
      y += 6;

      (order.items || []).forEach((item, idx) => {
        const line = sanitizePdfText(
          `${idx + 1}. ${item.name} | HSN ${item.hsn} | Qty ${item.qty} | ${formatPdfMoney(item.price)} | ${formatPdfMoney(item.qty * item.price)}`
        );
        const split = doc.splitTextToSize(line, 180);
        doc.text(split, 14, y);
        y += split.length * 6;
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
      });

      y += 4;
      doc.text(sanitizePdfText(`Subtotal: ${formatPdfMoney(order.subtotal)}`), 14, y);
      y += 6;
      doc.text(sanitizePdfText(`GST ${order.gstPercent}%: ${formatPdfMoney(order.gstAmount)}`), 14, y);
      y += 6;
      doc.text(sanitizePdfText(`Grand Total: ${formatPdfMoney(order.total)}`), 14, y);
      y += 8;
      doc.text(sanitizePdfText(`Payment Type: ${paymentMode}`), 14, y);
      y += 6;
      doc.text(sanitizePdfText(`Status: ${order.status || 'Placed'}`), 14, y);
      y += 6;
      doc.text(doc.splitTextToSize(sanitizePdfText(`Courier: ${order.courier?.provider || 'Pending'} | AWB: ${order.courier?.awb || 'Pending'}`), 180), 14, y);
      y += 12;
      drawDigitalSignaturePanel(doc, order, y);
      doc.save(`invoice_${order.orderId}.pdf`);
    }

    function renderInvoice(order) {
      const paymentMode = normalizePaymentMode(order.payment);
      const businessName = invoiceBusinessName(order);
      const signedAt = currentInvoiceDateTime();
      const itemsRows = (order.items || []).map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.hsn)}</td>
          <td>${escapeHtml(item.qty)}</td>
          <td>${formatDisplayMoney(item.price)}</td>
          <td>${formatDisplayMoney(item.qty * item.price)}</td>
        </tr>
      `).join('');

      content.innerHTML = `
        <div class="meta">
          <div class="card">
            <div class="label">Invoice ID</div>
            <div class="value">${escapeHtml(order.orderId)}</div>
          </div>
          <div class="card">
            <div class="label">Date</div>
            <div class="value">${escapeHtml(new Date(order.date).toLocaleDateString('en-IN'))}</div>
          </div>
          <div class="card">
            <div class="label">Business Name</div>
            <div class="value">${escapeHtml(businessName)}</div>
          </div>
          <div class="card">
            <div class="label">Customer</div>
            <div class="value">${escapeHtml(order.customer.name)}</div>
          </div>
          <div class="card">
            <div class="label">Contact</div>
            <div class="value">${escapeHtml(order.customer.phone)}${order.customer.email ? ` &bull; ${escapeHtml(order.customer.email)}` : ''}</div>
          </div>
          <div class="card">
            <div class="label">GST No</div>
            <div class="value">${escapeHtml(order.gstNo)}</div>
          </div>
          <div class="card">
            <div class="label">Warranty</div>
            <div class="value">1 year (till ${escapeHtml(order.warrantyExpiry)})</div>
          </div>
          <div class="card">
            <div class="label">Status</div>
            <div class="value">${escapeHtml(order.status || 'Placed')}</div>
          </div>
          <div class="card">
            <div class="label">Payment Type</div>
            <div class="value">${escapeHtml(paymentMode)}</div>
          </div>
          <div class="card">
            <div class="label">Courier</div>
            <div class="value">${escapeHtml(order.courier?.provider || 'Pending')} &bull; AWB ${escapeHtml(order.courier?.awb || 'Pending')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>

        <div class="totals">
          <table>
            <tr><td class="muted">Subtotal</td><td>${formatDisplayMoney(order.subtotal)}</td></tr>
            <tr><td class="muted">GST ${escapeHtml(order.gstPercent)}%</td><td>${formatDisplayMoney(order.gstAmount)}</td></tr>
            <tr><th>Total</th><th>${formatDisplayMoney(order.total)}</th></tr>
          </table>
        </div>

        <div class="signed-panel">
          <div class="signed-badge" aria-hidden="true"><span>&#10003;</span></div>
          <div class="signed-copy">
            <div class="signed-title">DIGITALLY SIGNED INVOICE</div>
            <div class="signed-desc">Verified by SmartLocal for this purchased order invoice.</div>
            <div class="signed-grid">
              <div class="card">
                <div class="label">Platform</div>
                <div class="value">SmartLocal</div>
              </div>
              <div class="card">
                <div class="label">Business Name</div>
                <div class="value">${escapeHtml(businessName)}</div>
              </div>
              <div class="card">
                <div class="label">Current Date & Time</div>
                <div class="value">${escapeHtml(signedAt)} IST</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const downloadButton = document.getElementById('download-pdf');
      if (downloadButton) downloadButton.onclick = () => generateInvoicePdf(order);
    }

    let invoiceLiveTimer = null;
    const LIVE_INVOICE_SYNC_MS = 1000;

    if (!orderId) {
      content.innerHTML = '<div class="empty">Missing order ID.</div>';
    } else {
      const syncInvoice = async () => {
        const order = await fetchOrder(orderId);
        if (!order) {
          content.innerHTML = '<div class="empty">Order not found.</div>';
          return;
        }
        renderInvoice(order);
      };
      syncInvoice();
      if (invoiceLiveTimer) clearInterval(invoiceLiveTimer);
      invoiceLiveTimer = setInterval(() => {
        if (document.hidden) return;
        syncInvoice();
      }, LIVE_INVOICE_SYNC_MS);
    }
  