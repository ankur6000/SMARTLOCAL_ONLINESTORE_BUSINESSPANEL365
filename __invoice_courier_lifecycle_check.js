
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
      doc.text('DIGITALLY SIGNED INVOICE', 34, y + 8);
      doc.setFontSize(9);
      doc.text(sanitizePdfText(`Verified by SmartLocal for ${businessName}`), 34, y + 14);
      doc.text(sanitizePdfText(`Platform: SmartLocal | Business: ${businessName}`), 34, y + 20);
      doc.text(sanitizePdfText(`Signed at: ${signedAt}`), 34, y + 26);
      doc.setTextColor(18, 24, 38);
      return y + 38;
    }

    function pdfPageWidth(doc) {
      return Number(doc?.internal?.pageSize?.getWidth?.() || doc?.internal?.pageSize?.width || 210);
    }

    function pdfPageHeight(doc) {
      return Number(doc?.internal?.pageSize?.getHeight?.() || doc?.internal?.pageSize?.height || 297);
    }

    function ensurePdfSpace(doc, y, neededHeight = 10, top = 18, bottom = 14) {
      if (y + neededHeight > pdfPageHeight(doc) - bottom) {
        doc.addPage();
        return top;
      }
      return y;
    }

    function drawPdfTable(doc, columns, rows, startY, options = {}) {
      if (!doc || !Array.isArray(columns) || !columns.length) return startY;
      const startX = Number(options.startX ?? 14);
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
      let y = startY;

      const drawHeader = () => {
        y = ensurePdfSpace(doc, y, headerHeight + 2, topMargin, bottomMargin);
        let x = startX;
        doc.setLineWidth(0.2);
        doc.setDrawColor(...borderColor);
        doc.setFillColor(...headerFill);
        doc.setTextColor(...headerText);
        doc.setFont('courier', 'bold');
        doc.setFontSize(options.headerFontSize || 8.4);
        columns.forEach((column) => {
          doc.rect(x, y, column.width, headerHeight, 'FD');
          doc.text(sanitizePdfText(column.header || ''), x + cellPadding, y + 5.2);
          x += column.width;
        });
        y += headerHeight;
      };

      drawHeader();
      doc.setFont('courier', 'normal');
      doc.setFontSize(options.bodyFontSize || 8.1);
      doc.setTextColor(...bodyText);

      (Array.isArray(rows) ? rows : []).forEach((row, rowIndex) => {
        const preparedCells = columns.map((column) => {
          const text = sanitizePdfText(row?.[column.key] ?? '');
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
      const courierLabel = `${order.courier?.provider || 'Pending'} | ${order.courier?.awb || 'Pending'}`;
      doc.setFont('courier', 'normal');
      doc.setFontSize(15);
      doc.text('SMARTLOCAL INVOICE', 14, 18);
      let y = 26;
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
        price: formatPdfMoney(item?.price || 0),
        amount: formatPdfMoney((Number(item?.qty || 0) || 0) * (Number(item?.price || 0) || 0))
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
        { label: 'Subtotal', value: formatPdfMoney(order.subtotal || 0) },
        { label: `GST ${Number(order.gstPercent || 0)}%`, value: formatPdfMoney(order.gstAmount || 0) },
        { label: 'Grand Total', value: formatPdfMoney(order.total || 0) }
      ], y, {
        startX: pdfPageWidth(doc) - 14 - 78,
        headerFill: [22, 101, 52],
        borderColor: [176, 190, 210],
        bodyFontSize: 8.3,
        headerFontSize: 8.4
      });
      y += 8;
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
            <div class="value">${escapeHtml(order.status || 'In Progress')}</div>
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
  
