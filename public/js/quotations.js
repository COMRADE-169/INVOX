/**
 * INVOX - Quotation and Estimate Module
 */

(function () {
  'use strict';

  const statuses = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];
  const statusIds = {
    Draft: 'quotation-count-draft',
    Sent: 'quotation-count-sent',
    Accepted: 'quotation-count-accepted',
    Rejected: 'quotation-count-rejected',
    Expired: 'quotation-count-expired'
  };
  let currentQuotation = null;
  let currentFilter = 'All';
  let searchTerm = '';

  document.addEventListener('DOMContentLoaded', async () => {
    await window.InvoxAuth?.whenReady();
    if (window.InvoxAuth?.getCurrentUser()) initialize();
  });

  function initialize() {
    document.getElementById('btn-quotation-create-new')?.addEventListener('click', () => {
      navigate('/new');
    });
    document.getElementById('btn-back-to-quotations')?.addEventListener('click', () => navigate('/'));
    document.getElementById('btn-save-quotation')?.addEventListener('click', saveCurrentQuotation);
    document.getElementById('btn-add-quotation-item')?.addEventListener('click', () => addItem());
    document.getElementById('btn-convert-quotation')?.addEventListener('click', convertCurrentQuotation);
    document.getElementById('btn-download-quotation')?.addEventListener('click', downloadCurrentQuotation);
    document.getElementById('btn-print-quotation')?.addEventListener('click', printCurrentQuotation);
    document.getElementById('quotation-search-input')?.addEventListener('input', event => {
      searchTerm = event.target.value.trim().toLowerCase();
      renderList();
    });
    document.querySelectorAll('.quotation-filter-btn').forEach(button => {
      button.addEventListener('click', () => {
        currentFilter = button.dataset.status || 'All';
        document.querySelectorAll('.quotation-filter-btn').forEach(filterButton => {
          filterButton.classList.toggle('bg-indigo-600', filterButton === button);
          filterButton.classList.toggle('text-white', filterButton === button);
          filterButton.classList.toggle('font-semibold', filterButton === button);
          filterButton.classList.toggle('text-slate-400', filterButton !== button);
        });
        renderList();
      });
    });

    const editor = document.getElementById('quotation-editor-container');
    editor?.addEventListener('input', updateLivePreview);
    editor?.addEventListener('change', updateLivePreview);
    editor?.addEventListener('click', event => {
      const removeButton = event.target.closest('.btn-remove-quotation-item');
      if (removeButton) {
        removeButton.closest('.quotation-item-row')?.remove();
        updateLivePreview();
      }
    });
    document.getElementById('quotation-client')?.addEventListener('change', updateSelectedClient);
    document.getElementById('quotation-status')?.addEventListener('change', event => {
      if (currentQuotation) currentQuotation.status = event.target.value;
      updateConvertButton();
    });
    document.getElementById('btn-quotation-manage-clients')?.addEventListener('click', () => {
      window.InvoxApp?.switchModule('invoices');
      window.InvoxApp?.openClients();
    });
    document.getElementById('nav-tab-invoices')?.addEventListener('click', clearQuotationRoute);
    document.getElementById('nav-tab-pos')?.addEventListener('click', clearQuotationRoute);
    document.getElementById('nav-tab-quotations')?.addEventListener('click', () => navigate('/'));
    window.addEventListener('hashchange', routeFromHash);

    window.InvoxQuotations = {
      renderList,
      setCurrency(currency) {
        if (currentQuotation) currentQuotation.currency = currency;
        updateLivePreview();
      }
    };
    updateNavigationCount();
    routeFromHash();
    window.setInterval(refreshQuotationExpiry, 60000);
  }

  function refreshQuotationExpiry() {
    const quotations = InvoxStorage.getQuotations();
    updateNavigationCount(quotations.length);
    if (currentQuotation?.id) {
      const saved = quotations.find(quotation => quotation.id === currentQuotation.id);
      if (saved?.status === 'Expired' && currentQuotation.status !== 'Expired') {
        currentQuotation.status = 'Expired';
        setValue('quotation-status', 'Expired');
        updateConvertButton();
        updateLivePreview();
      }
    }
    if (!document.getElementById('module-quotations')?.classList.contains('hidden')) {
      renderList();
    }
  }

  function clearQuotationRoute() {
    if (window.location.hash.startsWith('#/quotations')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function navigate(route) {
    const hash = `#/quotations${route === '/' ? '' : route}`;
    if (window.location.hash === hash) {
      routeFromHash();
    } else {
      window.location.hash = hash;
    }
  }

  function routeFromHash() {
    const hash = window.location.hash;
    if (!hash.startsWith('#/quotations')) return;

    window.InvoxApp?.switchModule('quotations');
    const segments = hash.slice(1).split('/').filter(Boolean);
    if (segments.length === 1) {
      showList();
      return;
    }

    if (segments[1] === 'new') {
      createNewQuotation();
      return;
    }

    if (segments.length === 3 && segments[2] === 'edit') {
      const quotation = InvoxStorage.getQuotationById(decodeURIComponent(segments[1]));
      if (!quotation?.data) {
        showToast('Quotation not found.', 'error');
        navigate('/');
        return;
      }
      loadQuotation(quotation);
      return;
    }

    navigate('/');
  }

  function showList() {
    currentQuotation = null;
    document.getElementById('quotation-list-view')?.classList.remove('hidden');
    document.getElementById('quotation-editor-view')?.classList.add('hidden');
    renderList();
  }

  function showEditor() {
    document.getElementById('quotation-list-view')?.classList.add('hidden');
    document.getElementById('quotation-editor-view')?.classList.remove('hidden');
    updateConvertButton();
    updateLivePreview();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderList() {
    const body = document.getElementById('quotation-table-body');
    if (!body) return;

    const quotations = InvoxStorage.getQuotations();
    const counts = { All: quotations.length, Draft: 0, Sent: 0, Accepted: 0, Rejected: 0, Expired: 0 };
    quotations.forEach(quotation => {
      if (counts[quotation.status] !== undefined) counts[quotation.status]++;
    });
    Object.entries(counts).forEach(([status, count]) => {
      const target = document.getElementById(status === 'All' ? 'quotation-count-all' : statusIds[status]);
      if (target) target.textContent = count;
    });

    const badge = document.getElementById('quotation-total-badge');
    if (badge) badge.textContent = `${quotations.length} ${quotations.length === 1 ? 'Quote' : 'Quotes'}`;
    setText('quotation-summary-count', String(quotations.length));
    const totalsByCurrency = quotations.reduce((totals, quotation) => {
      const currency = quotation.currency || 'INR';
      totals[currency] = (totals[currency] || 0) + (Number(quotation.grandTotal) || 0);
      return totals;
    }, {});
    const summaryValue = Object.entries(totalsByCurrency)
      .map(([currency, amount]) => InvoxCalc.formatCurrency(amount, currency))
      .join(' + ') || InvoxCalc.formatCurrency(0, 'INR');
    setText('quotation-summary-value', `Total value: ${summaryValue}`);
    updateNavigationCount(quotations.length);

    const filtered = quotations.filter(quotation => {
      if (currentFilter !== 'All' && quotation.status !== currentFilter) return false;
      const client = quotation.data?.client || {};
      const searchable = [
        quotation.quotationNumber,
        quotation.clientName,
        client.email
      ].join(' ').toLowerCase();
      return searchable.includes(searchTerm);
    });

    body.innerHTML = '';
    if (!filtered.length) {
      const message = quotations.length
        ? 'No quotations match these search or status filters.'
        : 'No quotations yet. Create your first quote to get started.';
      body.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center text-slate-500">${escapeHtml(message)}</td></tr>`;
      return;
    }

    filtered.forEach(quotation => {
      const row = document.createElement('tr');
      const quoteDate = quotation.quoteDate || quotation.data?.quoteDate || '';
      const validUntil = quotation.validUntil || quotation.data?.validUntil || '';
      const statusClass = {
        Draft: 'bg-slate-800 text-slate-300',
        Sent: 'bg-sky-500/10 text-sky-300',
        Accepted: 'bg-emerald-500/10 text-emerald-300',
        Rejected: 'bg-rose-500/10 text-rose-300',
        Expired: 'bg-amber-500/10 text-amber-300'
      }[quotation.status] || 'bg-slate-800 text-slate-300';
      const accepted = quotation.status === 'Accepted';
      const converted = Boolean(quotation.invoiceId);
      row.innerHTML = `
        <td class="py-3 px-4">
          <button type="button" class="btn-edit-quotation font-mono font-bold text-violet-300 hover:text-violet-200">${escapeHtml(quotation.quotationNumber)}</button>
          <div class="mt-1 text-[10px] text-slate-500">${escapeHtml(formatDate(quoteDate))}</div>
        </td>
        <td class="py-3 px-4">
          <span class="font-semibold text-slate-200">${escapeHtml(quotation.clientName)}</span>
          <div class="mt-1 text-[10px] text-slate-500">${escapeHtml(quotation.data?.client?.email || '')}</div>
        </td>
        <td class="py-3 px-3 text-slate-300">${escapeHtml(formatDate(validUntil))}</td>
        <td class="py-3 px-4 text-right font-semibold text-slate-200">${escapeHtml(InvoxCalc.formatCurrency(quotation.grandTotal, quotation.currency))}</td>
        <td class="py-3 px-4"><span class="rounded-full px-2 py-1 text-[10px] font-bold ${statusClass}">${escapeHtml(quotation.status)}</span>
          ${converted ? `<div class="mt-1 text-[10px] text-emerald-400">Invoice ${escapeHtml(quotation.data?.linkedInvoiceNumber || '')}</div>` : ''}
        </td>
        <td class="py-3 px-4">
          <div class="flex flex-wrap justify-end gap-1">
            <button type="button" class="btn-edit-quotation rounded px-2 py-1 text-[10px] font-semibold text-indigo-300 hover:bg-slate-800" title="Edit quotation">Edit</button>
            <button type="button" class="btn-duplicate-quotation rounded px-2 py-1 text-[10px] font-semibold text-violet-300 hover:bg-slate-800" title="Duplicate quotation">Duplicate</button>
            <button type="button" class="btn-pdf-quotation rounded px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800" title="Download quotation PDF">PDF</button>
            <button type="button" class="btn-print-quotation rounded px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-800" title="Print quotation">Print</button>
            ${accepted ? `<button type="button" class="btn-convert-quotation rounded px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-slate-800" title="Convert accepted quotation to invoice">${converted ? 'Open Invoice' : 'Convert'}</button>` : ''}
            <button type="button" class="btn-delete-quotation rounded px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-slate-800" title="Delete quotation">Delete</button>
          </div>
        </td>
      `;

      row.querySelectorAll('.btn-edit-quotation').forEach(button => {
        button.addEventListener('click', () => navigate(`/${encodeURIComponent(quotation.id)}/edit`));
      });
      row.querySelector('.btn-duplicate-quotation')?.addEventListener('click', () => duplicateQuotation(quotation));
      row.querySelector('.btn-pdf-quotation')?.addEventListener('click', () => openQuotationAction(quotation, downloadCurrentQuotation));
      row.querySelector('.btn-print-quotation')?.addEventListener('click', () => openQuotationAction(quotation, printCurrentQuotation));
      row.querySelector('.btn-convert-quotation')?.addEventListener('click', () => {
        window.InvoxApp?.convertQuotationToInvoice(quotation.id);
      });
      row.querySelector('.btn-delete-quotation')?.addEventListener('click', () => {
        if (!confirm(`Delete quotation ${quotation.quotationNumber}? This cannot be undone.`)) return;
        if (!InvoxStorage.deleteQuotation(quotation.id)) {
          showToast('Could not delete the quotation.', 'error');
          return;
        }
        renderList();
        showToast(`Quotation ${quotation.quotationNumber} deleted.`, 'info');
      });
      body.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function updateNavigationCount(count = InvoxStorage.getQuotations().length) {
    const badge = document.getElementById('badge-nav-quotation-count');
    if (badge) badge.textContent = count;
  }

  function createNewQuotation() {
    const today = localDate();
    const validUntil = addDays(today, 30);
    currentQuotation = {
      id: null,
      quotationNumber: generateQuotationNumber(),
      quoteDate: today,
      validUntil,
      status: 'Draft',
      currency: document.getElementById('currency-select')?.value || 'INR',
      client: emptyClient(),
      items: [emptyItem()],
      terms: 'This quotation is valid until the date shown above. Work will begin after written acceptance.',
      notes: '',
      totals: null,
      invoiceId: null,
      linkedInvoiceNumber: null
    };
    populateClientOptions();
    fillEditor(currentQuotation);
    showEditor();
  }

  function loadQuotation(record) {
    currentQuotation = { ...record.data, id: record.id };
    currentQuotation.quotationNumber = record.quotationNumber || currentQuotation.quotationNumber;
    currentQuotation.status = record.status || currentQuotation.status;
    currentQuotation.client = { ...emptyClient(), ...(currentQuotation.client || {}) };
    populateClientOptions();
    fillEditor(currentQuotation);
    showEditor();
  }

  function emptyClient() {
    return {
      id: '',
      name: '',
      company: '',
      email: '',
      phone: '',
      billingAddress: '',
      shippingAddress: '',
      taxId: ''
    };
  }

  function emptyItem() {
    return {
      id: `qi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      description: '',
      quantity: 1,
      rate: 0,
      taxRate: 18,
      discountValue: 0,
      discountType: '%'
    };
  }

  function populateClientOptions(selectedId = currentQuotation?.client?.id || '') {
    const select = document.getElementById('quotation-client');
    if (!select) return;
    const clients = InvoxStorage.getClients();
    select.innerHTML = '<option value="">Select a saved client</option>';
    clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client.id;
      option.textContent = client.company
        ? `${client.name} — ${client.company}`
        : client.name;
      option.selected = client.id === selectedId;
      select.appendChild(option);
    });
    document.getElementById('quotation-client-empty')?.classList.toggle('hidden', clients.length > 0);
  }

  function fillEditor(quotation) {
    setValue('quotation-number', quotation.quotationNumber);
    setValue('quotation-status', quotation.status);
    setValue('quotation-date', quotation.quoteDate);
    setValue('quotation-valid-until', quotation.validUntil);
    setValue('quotation-terms', quotation.terms);
    setValue('quotation-notes', quotation.notes);
    setValue('quotation-client', quotation.client?.id || '');
    setValue('currency-select', quotation.currency || 'INR');
    renderItemInputs(quotation.items?.length ? quotation.items : [emptyItem()]);
    document.getElementById('quotation-error')?.classList.add('hidden');
  }

  function renderItemInputs(items) {
    const container = document.getElementById('quotation-items-container');
    if (!container) return;
    container.innerHTML = items.map((item, index) => `
      <div class="quotation-item-row rounded-xl border border-slate-800 bg-slate-950/50 p-3" data-item-id="${escapeHtml(item.id || '')}">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[11px] font-semibold text-slate-400">Item ${index + 1}</span>
          <button type="button" class="btn-remove-quotation-item rounded px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-950/40" aria-label="Remove item ${index + 1}">Remove</button>
        </div>
        <label class="sr-only" for="quotation-item-description-${index}">Item description</label>
        <input id="quotation-item-description-${index}" data-field="description" class="invox-input mb-2 !py-2 text-xs" maxlength="200" placeholder="Description *" value="${escapeHtml(item.description || '')}" required>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div><label class="invox-label">Quantity *</label><input data-field="quantity" type="number" min="0.001" step="any" class="invox-input !py-2 text-xs" value="${escapeHtml(item.quantity ?? 1)}" required></div>
          <div><label class="invox-label">Rate *</label><input data-field="rate" type="number" min="0" step="any" class="invox-input !py-2 text-xs" value="${escapeHtml(item.rate ?? 0)}" required></div>
          <div><label class="invox-label">GST %</label><input data-field="taxRate" type="number" min="0" max="100" step="any" class="invox-input !py-2 text-xs" value="${escapeHtml(item.taxRate ?? 0)}" required></div>
          <div><label class="invox-label">Discount</label><input data-field="discountValue" type="number" min="0" step="any" class="invox-input !py-2 text-xs" value="${escapeHtml(item.discountValue ?? 0)}" required></div>
          <div><label class="invox-label">Discount Type</label><select data-field="discountType" class="invox-select w-full !py-2 text-xs">
            <option value="%" ${item.discountType === '%' ? 'selected' : ''}>%</option>
            <option value="fixed" ${item.discountType !== '%' ? 'selected' : ''}>Fixed amount</option>
          </select></div>
          <div class="flex items-end justify-end text-right text-[11px] text-slate-400">Line total <span class="ml-1 font-bold text-white" data-line-total>₹0.00</span></div>
        </div>
      </div>
    `).join('');
  }

  function addItem(item = emptyItem()) {
    const container = document.getElementById('quotation-items-container');
    if (!container) return;
    const existing = readItems();
    existing.push(item);
    renderItemInputs(existing);
    updateLivePreview();
  }

  function readItems() {
    return [...document.querySelectorAll('.quotation-item-row')].map(row => {
      const value = field => row.querySelector(`[data-field="${field}"]`)?.value ?? '';
      return {
        id: row.dataset.itemId || emptyItem().id,
        description: value('description').trim(),
        quantity: toNumber(value('quantity')),
        rate: toNumber(value('rate')),
        taxRate: toNumber(value('taxRate')),
        discountValue: toNumber(value('discountValue')),
        discountType: value('discountType') || '%'
      };
    });
  }

  function updateSelectedClient() {
    if (!currentQuotation) return;
    const id = document.getElementById('quotation-client')?.value;
    const client = InvoxStorage.getClients().find(savedClient => savedClient.id === id);
    currentQuotation.client = client ? {
      id: client.id,
      name: client.name || '',
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      billingAddress: client.billingAddress || client.address || '',
      shippingAddress: client.shippingAddress || client.billingAddress || client.address || '',
      taxId: client.taxId || client.taxNumber || ''
    } : emptyClient();
    updateLivePreview();
  }

  function readForm() {
    return {
      id: currentQuotation?.id || null,
      quotationNumber: document.getElementById('quotation-number')?.value.trim() || '',
      quoteDate: document.getElementById('quotation-date')?.value || '',
      validUntil: document.getElementById('quotation-valid-until')?.value || '',
      status: document.getElementById('quotation-status')?.value || 'Draft',
      currency: document.getElementById('currency-select')?.value || 'INR',
      client: currentQuotation?.client || emptyClient(),
      items: readItems(),
      terms: document.getElementById('quotation-terms')?.value.trim() || '',
      notes: document.getElementById('quotation-notes')?.value.trim() || '',
      invoiceId: currentQuotation?.invoiceId || null,
      linkedInvoiceNumber: currentQuotation?.linkedInvoiceNumber || null
    };
  }

  function calculateQuotation(quotation) {
    const totals = { itemsSubtotal: 0, totalDiscounts: 0, taxableAmount: 0, totalTax: 0, grandTotal: 0 };
    const lines = quotation.items.map(item => {
      const line = InvoxCalc.calculateLineItem({
        ...item,
        discountType: item.discountType === '%' ? '%' : 'fixed'
      });
      totals.itemsSubtotal += line.rawBase;
      totals.totalDiscounts += line.discountAmount;
      totals.taxableAmount += line.taxableAmount;
      totals.totalTax += line.taxAmount;
      return { item, line };
    });
    totals.grandTotal = totals.taxableAmount + totals.totalTax;
    return { totals, lines };
  }

  function updateLivePreview() {
    if (!document.getElementById('quotation-editor-view') || document.getElementById('quotation-editor-view').classList.contains('hidden')) return;
    const quotation = readForm();
    const { totals, lines } = calculateQuotation(quotation);
    const currency = quotation.currency;

    setText('quotation-subtotal', InvoxCalc.formatCurrency(totals.itemsSubtotal, currency));
    setText('quotation-discount', `−${InvoxCalc.formatCurrency(totals.totalDiscounts, currency)}`);
    setText('quotation-tax', InvoxCalc.formatCurrency(totals.totalTax, currency));
    setText('quotation-grand-total', InvoxCalc.formatCurrency(totals.grandTotal, currency));

    lines.forEach(({ line }, index) => {
      const target = document.querySelectorAll('[data-line-total]')[index];
      if (target) target.textContent = InvoxCalc.formatCurrency(line.total, currency);
    });

    const profile = InvoxStorage.getBusinessProfile() || {};
    const user = window.InvoxAuth?.getCurrentUser() || {};
    setText('qv-business-name', profile.companyName || profile.name || user.displayName || 'Your Business');
    setText('qv-business-address', profile.address || '');
    setText('qv-business-contact', [profile.email || user.email, profile.phone].filter(Boolean).join(' | '));
    setText('qv-business-tax', profile.taxNumber || profile.taxId ? `GSTIN: ${profile.taxNumber || profile.taxId}` : '');
    setText('qv-number', quotation.quotationNumber);
    setText('qv-date', formatDate(quotation.quoteDate));
    setText('qv-valid-until', formatDate(quotation.validUntil));
    setText('qv-status', quotation.status);
    setText('qv-client-name', quotation.client.name || 'Client name');
    setText('qv-client-company', quotation.client.company || '');
    setText('qv-client-address', quotation.client.billingAddress || '');
    setText('qv-client-contact', [quotation.client.email, quotation.client.phone].filter(Boolean).join(' | '));
    setText('qv-client-tax', quotation.client.taxId ? `GSTIN: ${quotation.client.taxId}` : '');

    const previewItems = document.getElementById('qv-items');
    if (previewItems) {
      previewItems.innerHTML = lines.map(({ item, line }) => `
        <tr>
          <td class="p-2">${escapeHtml(item.description || 'Item description')}</td>
          <td class="p-2 text-right">${escapeHtml(item.quantity)}</td>
          <td class="p-2 text-right">${escapeHtml(InvoxCalc.formatCurrency(item.rate, currency))}</td>
          <td class="p-2 text-right">${escapeHtml(item.taxRate)}%</td>
          <td class="p-2 text-right">${escapeHtml(InvoxCalc.formatCurrency(line.discountAmount, currency))}</td>
          <td class="p-2 text-right font-semibold">${escapeHtml(InvoxCalc.formatCurrency(line.total, currency))}</td>
        </tr>
      `).join('');
    }
    setText('qv-subtotal', InvoxCalc.formatCurrency(totals.itemsSubtotal, currency));
    setText('qv-discount', `−${InvoxCalc.formatCurrency(totals.totalDiscounts, currency)}`);
    setText('qv-tax', InvoxCalc.formatCurrency(totals.totalTax, currency));
    setText('qv-total', InvoxCalc.formatCurrency(totals.grandTotal, currency));
    setText('qv-terms', quotation.terms);
    setText('qv-notes', quotation.notes);
    document.getElementById('qv-terms-wrap')?.classList.toggle('hidden', !quotation.terms);
    document.getElementById('qv-notes-wrap')?.classList.toggle('hidden', !quotation.notes);
  }

  function validateQuotation(quotation) {
    if (!quotation.quotationNumber) return 'Enter a quote number.';
    if (quotation.quotationNumber.length > 40) return 'Quote number must be 40 characters or fewer.';
    const duplicateNumber = InvoxStorage.getQuotations().some(saved =>
      saved.id !== quotation.id &&
      (saved.quotationNumber || '').toLowerCase() === quotation.quotationNumber.toLowerCase()
    );
    if (duplicateNumber) return 'That quote number is already in use.';
    if (!statuses.includes(quotation.status)) return 'Select a valid quotation status.';
    if (!isValidDate(quotation.quoteDate)) return 'Enter a valid quote date.';
    if (!isValidDate(quotation.validUntil)) return 'Enter a valid “valid until” date.';
    if (quotation.validUntil < quotation.quoteDate) return 'The valid-until date must be on or after the quote date.';
    if (quotation.validUntil < localDate() && quotation.status !== 'Expired') {
      return 'This quote is past its valid-until date and must remain Expired unless you extend its validity.';
    }
    const savedClient = InvoxStorage.getClients().find(client => client.id === quotation.client.id);
    if (!savedClient) return 'Select a saved client.';
    if (quotation.items.length === 0) return 'Add at least one line item.';

    for (let index = 0; index < quotation.items.length; index++) {
      const item = quotation.items[index];
      if (!item.description) return `Enter a description for item ${index + 1}.`;
      const row = document.querySelectorAll('.quotation-item-row')[index];
      const rawValue = field => row?.querySelector(`[data-field="${field}"]`)?.value.trim() || '';
      if (!rawValue('quantity') || !Number.isFinite(item.quantity) || item.quantity <= 0) return `Item ${index + 1} quantity must be greater than zero.`;
      if (!rawValue('rate') || !Number.isFinite(item.rate) || item.rate < 0) return `Item ${index + 1} rate is required and cannot be negative.`;
      if (!rawValue('taxRate') || !Number.isFinite(item.taxRate) || item.taxRate < 0 || item.taxRate > 100) return `Item ${index + 1} GST is required and must be between 0 and 100%.`;
      if (!rawValue('discountValue') || !Number.isFinite(item.discountValue) || item.discountValue < 0) return `Item ${index + 1} discount is required and cannot be negative.`;
      if (item.discountType === '%' && item.discountValue > 100) return `Item ${index + 1} percentage discount cannot exceed 100%.`;
      if (item.discountType !== '%' && item.discountValue > item.quantity * item.rate) return `Item ${index + 1} discount cannot exceed its line subtotal.`;
      const lineTotals = InvoxCalc.calculateLineItem({
        ...item,
        discountType: item.discountType === '%' ? '%' : 'fixed'
      });
      if (![lineTotals.rawBase, lineTotals.discountAmount, lineTotals.taxableAmount, lineTotals.taxAmount, lineTotals.total].every(Number.isFinite)) {
        return `Item ${index + 1} amounts are too large to calculate.`;
      }
    }
    const totals = calculateQuotation(quotation).totals;
    if (!Object.values(totals).every(Number.isFinite)) return 'Quotation totals are too large to calculate.';
    return '';
  }

  function saveCurrentQuotation() {
    if (!currentQuotation) return false;
    const quotation = readForm();
    const error = validateQuotation(quotation);
    if (error) {
      showValidationError(error);
      return false;
    }
    quotation.totals = calculateQuotation(quotation).totals;
    const saved = InvoxStorage.saveQuotation(quotation);
    if (!saved) {
      showValidationError('The quotation could not be saved. Check browser storage and try again.');
      return false;
    }
    currentQuotation = { ...saved.data, id: saved.id };
    document.getElementById('quotation-error')?.classList.add('hidden');
    updateNavigationCount();
    if (window.location.hash !== `#/quotations/${encodeURIComponent(saved.id)}/edit`) {
      navigate(`/${encodeURIComponent(saved.id)}/edit`);
    } else {
      fillEditor(currentQuotation);
      showEditor();
      renderList();
    }
    showToast(`Quotation ${saved.quotationNumber} saved.`, 'success');
    return true;
  }

  function showValidationError(message) {
    const element = document.getElementById('quotation-error');
    if (element) {
      element.textContent = message;
      element.classList.remove('hidden');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    showToast(message, 'error');
  }

  function duplicateQuotation(record) {
    const source = record.data;
    const today = localDate();
    const copy = {
      ...source,
      id: null,
      quotationNumber: generateQuotationNumber(),
      quoteDate: today,
      validUntil: addDays(today, 30),
      status: 'Draft',
      invoiceId: null,
      linkedInvoiceNumber: null,
      items: (source.items || []).map(item => ({ ...item, id: emptyItem().id }))
    };
    const saved = InvoxStorage.saveQuotation(copy);
    if (!saved) {
      showToast('Could not duplicate the quotation.', 'error');
      return;
    }
    updateNavigationCount();
    navigate(`/${encodeURIComponent(saved.id)}/edit`);
    showToast(`Created ${saved.quotationNumber} from ${record.quotationNumber}.`, 'success');
  }

  function openQuotationAction(record, action) {
    navigate(`/${encodeURIComponent(record.id)}/edit`);
    window.setTimeout(() => action(), 100);
  }

  async function downloadCurrentQuotation() {
    const quotation = readForm();
    try {
      const downloaded = await InvoxExporter.downloadPDF('quotation-preview-sheet', quotation.quotationNumber || 'QT-0001');
      if (downloaded) showToast(`Downloaded ${quotation.quotationNumber}.pdf`, 'success');
    } catch (error) {
      console.error('Quotation PDF generation failed', error);
      showToast('Could not generate the quotation PDF.', 'error');
    }
  }

  function printCurrentQuotation() {
    window.InvoxExporter.print();
  }

  function updateConvertButton() {
    const button = document.getElementById('btn-convert-quotation');
    if (!button) return;
    const visible = document.getElementById('quotation-status')?.value === 'Accepted';
    button.classList.toggle('hidden', !visible);
    button.classList.toggle('inline-flex', visible);
  }

  function convertCurrentQuotation() {
    if (!currentQuotation) return;
    const quotation = readForm();
    if (quotation.status !== 'Accepted') {
      showValidationError('Set the quotation status to Accepted before converting it.');
      return;
    }
    if (!saveCurrentQuotation()) return;
    window.InvoxApp?.convertQuotationToInvoice(currentQuotation.id);
  }

  function generateQuotationNumber() {
    const highest = InvoxStorage.getQuotations().reduce((max, quotation) => {
      const match = /^QT-(\d+)$/i.exec(quotation.quotationNumber || '');
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `QT-${String(highest + 1).padStart(4, '0')}`;
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  }

  function localDate() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : NaN;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value || '';
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    if (window.InvoxApp?.showToast) {
      window.InvoxApp.showToast(message, type);
    } else {
      console[type === 'error' ? 'error' : 'info'](message);
    }
  }
})();
