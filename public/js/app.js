/**
 * INVOX - Main Application Logic & Reactive Controller
 * Unified Studio for Invoices, Purchase Orders, and Quotations
 */

(function () {
  'use strict';

  // --- APPLICATION STATE ---
  let activeModule = 'invoices'; // 'invoices' | 'pos' | 'quotations'
  let invoiceViewMode = 'list';  // 'list' | 'editor'
  let currentInvoiceStatusFilter = 'All';
  let poViewMode = 'list';       // 'list' | 'editor'
  let currentPOStatusFilter = 'All';

  // Invoice State
  let invoiceData = {
    id: null,
    theme: 'indigo',
    currency: 'INR',
    sender: {
      name: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
      website: '',
      logo: null
    },
    client: {
      id: null,
      name: '',
      company: '',
      email: '',
      phone: '',
      billingAddress: '',
      shippingAddress: '',
      sameAddress: true,
      taxId: ''
    },
    invoiceNumber: 'INV-2026-001',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    poNumber: '',
    status: 'Pending',
    items: [],
    taxType: 'intra', // 'intra' (CGST+SGST), 'inter' (IGST), 'single'
    extraDiscountValue: 0,
    extraDiscountType: '%',
    shippingCharges: 0,
    autoRoundOff: true,
    bank: {
      name: '',
      accountName: '',
      accountNumber: '',
      ifsc: '',
      upiId: '',
      showUpiQr: true
    },
    notes: 'Thank you for your business. We look forward to working together again!',
    terms: '1. Please pay within the specified due date.\n2. In case of delayed payment, interest may be applied.\n3. Make all payments to the bank details provided above.',
    signatoryName: 'Authorized Signatory',
    signature: null
  };

  // Purchase Order State
  let poData = {
    id: null,
    theme: 'indigo',
    currency: 'INR',
    poNumber: 'PO-2026-001',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    paymentTerms: 'Net 30 Days after goods receipt and inspection',
    status: 'Sent',
    vendor: {
      id: null,
      name: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      taxId: ''
    },
    deliveryAddress: '',
    sameAsBusinessAddress: true,
    items: [],
    taxType: 'intra',
    extraDiscountValue: 0,
    extraDiscountType: '%',
    shippingCharges: 0,
    autoRoundOff: true,
    notes: 'Please attach PO number on all shipping labels and delivery challans.',
    terms: '1. Goods are subject to inspection and approval upon delivery.\n2. Any damaged or defective items must be replaced by vendor immediately.\n3. Make deliveries to the designated shipping address only.',
    signatoryName: 'Procurement Officer'
  };

  let zoomLevel = 0.85;
  let poZoomLevel = 0.85;
  let saveDraftDebounceTimer = null;
  let savePODraftDebounceTimer = null;

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    await window.InvoxAuth?.whenReady();
    if (!window.InvoxAuth?.getCurrentUser()) return;
    document.body.classList.remove('auth-route-pending');

    initDefaultDates();
    loadSavedBusinessProfile();
    loadDraftOrDefaults();
    loadPODraftOrDefaults();
    bindEventListeners();
    updateClientDropdown();
    updateVendorDropdown();
    updateBadges();
    renderAll();
    renderInvoiceTable();
    renderPOTable();
    switchInvoiceView(invoiceViewMode);
    lucide.createIcons();
  });

  function initDefaultDates() {
    const today = new Date();
    const issueStr = today.toISOString().split('T')[0];
    const due = new Date(today);
    due.setDate(due.getDate() + 15);
    const dueStr = due.toISOString().split('T')[0];

    invoiceData.issueDate = issueStr;
    invoiceData.dueDate = dueStr;

    poData.orderDate = issueStr;
    poData.deliveryDate = dueStr;

    setValue('invoice-issue-date', issueStr);
    setValue('invoice-due-date', dueStr);
    setValue('po-order-date', issueStr);
    setValue('po-delivery-date', dueStr);
  }

  function loadSavedBusinessProfile() {
    const profile = InvoxStorage.getBusinessProfile();
    if (profile) {
      invoiceData.sender = { ...invoiceData.sender, ...profile };
      if (profile.bank) {
        invoiceData.bank = { ...invoiceData.bank, ...profile.bank };
      }
      if (profile.signatoryName) {
        invoiceData.signatoryName = profile.signatoryName;
      }
      if (profile.address && poData.sameAsBusinessAddress) {
        poData.deliveryAddress = profile.address;
        setValue('po-delivery-address', profile.address);
      }
    }
  }

  function loadDraftOrDefaults() {
    const draft = InvoxStorage.getDraft();
    if (draft && draft.items && draft.items.length > 0) {
      invoiceData = { ...invoiceData, ...draft };
    } else {
      if (!invoiceData.items || invoiceData.items.length === 0) {
        invoiceData.items = [
          {
            id: 'item_' + Date.now(),
            description: 'Professional Web Development & UI Design Services',
            quantity: 1,
            rate: 25000,
            taxRate: 18,
            discountValue: 0,
            discountType: '%'
          }
        ];
      }
    }
    syncFormInputsFromState();
  }

  function loadPODraftOrDefaults() {
    const draft = InvoxStorage.getPODraft();
    if (draft && draft.items && draft.items.length > 0) {
      poData = { ...poData, ...draft };
    } else {
      if (!poData.items || poData.items.length === 0) {
        poData.items = [
          {
            id: 'po_item_' + Date.now(),
            description: 'Enterprise Server Rackmount Chassis & Accessories',
            quantity: 2,
            rate: 45000,
            taxRate: 18,
            discountValue: 0,
            discountType: '%'
          }
        ];
      }
      if (invoiceData.sender.address && poData.sameAsBusinessAddress) {
        poData.deliveryAddress = invoiceData.sender.address;
      }
    }
    syncPOFormInputsFromState();
  }

  // --- BINDING EVENTS ---
  function bindEventListeners() {
    // Brand Logo Click (goes to invoices)
    document.getElementById('nav-brand-logo')?.addEventListener('click', () => switchModule('invoices'));

    // Primary Module Tabs
    document.getElementById('nav-tab-invoices')?.addEventListener('click', () => switchModule('invoices'));
    document.getElementById('nav-tab-pos')?.addEventListener('click', () => switchModule('pos'));
    document.getElementById('nav-tab-quotations')?.addEventListener('click', () => switchModule('quotations'));

    // Currency Switcher
    document.getElementById('currency-select')?.addEventListener('change', handleCurrencyChange);

    // INVOICE TOP ACTIONS
    document.getElementById('btn-download-pdf')?.addEventListener('click', handleDownloadPDF);
    document.getElementById('btn-print')?.addEventListener('click', handlePrint);
    document.getElementById('btn-toggle-invoice-view')?.addEventListener('click', toggleInvoiceView);
    document.getElementById('btn-invoice-create-new')?.addEventListener('click', () => {
      switchInvoiceView('editor');
    });
    document.getElementById('btn-back-to-invoice-list')?.addEventListener('click', () => switchInvoiceView('list'));
    document.getElementById('btn-new-invoice')?.addEventListener('click', () => {
      if (handleNewInvoice()) {
        switchInvoiceView('editor');
      }
    });
    document.getElementById('btn-save-invoice')?.addEventListener('click', handleSaveInvoice);
    document.getElementById('btn-load-sample')?.addEventListener('click', () => {
      loadSampleData();
      switchInvoiceView('editor');
    });
    document.getElementById('btn-open-clients')?.addEventListener('click', () => openModal('modal-clients', renderSavedClientsList));
    document.getElementById('btn-open-invoices')?.addEventListener('click', () => openModal('modal-invoices', renderSavedInvoicesList));

    // PO TOP ACTIONS
    document.getElementById('btn-toggle-po-view')?.addEventListener('click', togglePOView);
    document.getElementById('btn-po-create-new')?.addEventListener('click', () => {
      switchPOView('editor');
    });
    document.getElementById('btn-back-to-po-list')?.addEventListener('click', () => switchPOView('list'));
    document.getElementById('btn-open-vendors')?.addEventListener('click', () => openModal('modal-vendors', renderSavedVendorsList));
    document.getElementById('btn-load-po-sample')?.addEventListener('click', loadSamplePO);
    document.getElementById('btn-download-po-pdf')?.addEventListener('click', handleDownloadPOPDF);
    document.getElementById('btn-print-po')?.addEventListener('click', handlePrintPO);
    document.getElementById('btn-new-po')?.addEventListener('click', handleNewPO);
    document.getElementById('btn-save-po')?.addEventListener('click', handleSavePO);

    // Modals
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) closeModal();
    });

    // Mobile tabs
    document.getElementById('mobile-tab-edit')?.addEventListener('click', () => switchMobileTab('edit'));
    document.getElementById('mobile-tab-preview')?.addEventListener('click', () => switchMobileTab('preview'));

    // Business profile save
    document.getElementById('btn-save-business-profile')?.addEventListener('click', handleSaveBusinessProfile);

    // Logo dropzone
    const logoDropzone = document.getElementById('logo-dropzone');
    const logoInput = document.getElementById('logo-file-input');
    logoDropzone?.addEventListener('click', () => logoInput?.click());
    logoInput?.addEventListener('change', handleLogoFileSelect);
    document.getElementById('btn-remove-logo')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRemoveLogo();
    });

    // Signature input
    document.getElementById('signature-file-input')?.addEventListener('change', handleSignatureFileSelect);

    // Client actions
    document.getElementById('btn-save-current-client')?.addEventListener('click', handleSaveCurrentClient);
    document.getElementById('quick-select-client')?.addEventListener('change', handleQuickClientSelect);
    document.getElementById('client-same-address')?.addEventListener('change', handleSameAddressToggle);

    // Vendor actions
    document.getElementById('btn-save-current-vendor')?.addEventListener('click', handleSaveCurrentVendor);
    document.getElementById('quick-select-vendor')?.addEventListener('change', handleQuickVendorSelect);
    document.getElementById('po-same-address-toggle')?.addEventListener('change', handlePOSameAddressToggle);

    // Invoice meta actions
    document.getElementById('btn-next-inv-no')?.addEventListener('click', generateNextInvoiceNumber);
    document.querySelectorAll('.due-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.getAttribute('data-days') || '0', 10);
        applyDuePresetDays(days);
      });
    });

    // PO meta actions
    document.getElementById('btn-next-po-no')?.addEventListener('click', generateNextPONumber);
    document.querySelectorAll('.po-due-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.getAttribute('data-days') || '0', 10);
        applyPODeliveryPresetDays(days);
      });
    });

    // Items actions
    document.getElementById('btn-add-item')?.addEventListener('click', () => addItem());
    document.getElementById('btn-clear-items')?.addEventListener('click', handleClearAllItems);

    document.getElementById('btn-add-po-item')?.addEventListener('click', () => addPOItem());
    document.getElementById('btn-clear-po-items')?.addEventListener('click', handleClearAllPOItems);

    // Zoom controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => changeZoom(0.05));
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => changeZoom(-0.05));
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => resetZoom());

    document.getElementById('btn-po-zoom-in')?.addEventListener('click', () => changePOZoom(0.05));
    document.getElementById('btn-po-zoom-out')?.addEventListener('click', () => changePOZoom(-0.05));
    document.getElementById('btn-po-zoom-reset')?.addEventListener('click', () => resetPOZoom());

    // Themes
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        setTheme(theme);
      });
    });

    document.querySelectorAll('.po-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        setPOTheme(theme);
      });
    });

    // Search filters
    document.getElementById('client-search-input')?.addEventListener('input', (e) => {
      renderSavedClientsList(e.target.value);
    });
    document.getElementById('vendor-search-input')?.addEventListener('input', (e) => {
      renderSavedVendorsList(e.target.value);
    });
    document.getElementById('invoice-search-input')?.addEventListener('input', (e) => {
      renderInvoiceTable(e.target.value);
    });
    document.getElementById('modal-invoice-search-input')?.addEventListener('input', (e) => {
      renderSavedInvoicesList(e.target.value);
    });
    document.getElementById('po-search-input')?.addEventListener('input', (e) => {
      renderPOTable(e.target.value);
    });

    // Invoice Status Filter Buttons
    document.querySelectorAll('.invoice-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.invoice-filter-btn').forEach(b => {
          b.classList.remove('bg-indigo-600', 'text-white', 'font-semibold');
          b.classList.add('text-slate-400');
        });
        btn.classList.add('bg-indigo-600', 'text-white', 'font-semibold');
        btn.classList.remove('text-slate-400');

        currentInvoiceStatusFilter = btn.getAttribute('data-status') || 'All';
        renderInvoiceTable(document.getElementById('invoice-search-input')?.value || '');
      });
    });

    // PO Status Filter Buttons
    document.querySelectorAll('.po-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.po-filter-btn').forEach(b => {
          b.classList.remove('bg-indigo-600', 'text-white', 'font-semibold');
          b.classList.add('text-slate-400');
        });
        btn.classList.add('bg-indigo-600', 'text-white', 'font-semibold');
        btn.classList.remove('text-slate-400');

        currentPOStatusFilter = btn.getAttribute('data-status') || 'All';
        renderPOTable(document.getElementById('po-search-input')?.value || '');
      });
    });

    // Backup import / export
    document.getElementById('btn-export-backup')?.addEventListener('click', handleExportBackup);
    document.getElementById('import-json-input')?.addEventListener('change', handleImportBackup);

    // Form inputs live sync listener
    const invoiceEditor = document.getElementById('editor-container');
    invoiceEditor?.addEventListener('input', handleInvoiceFormInput);
    invoiceEditor?.addEventListener('change', handleInvoiceFormInput);

    const poEditor = document.getElementById('po-editor-container');
    poEditor?.addEventListener('input', handlePOFormInput);
    poEditor?.addEventListener('change', handlePOFormInput);
  }

  // --- MODULE NAVIGATION ---
  function switchModule(moduleName) {
    activeModule = moduleName;

    const modInvoices = document.getElementById('module-invoices');
    const modPOs = document.getElementById('module-pos');
    const modQuotations = document.getElementById('module-quotations');
    const btnInvoices = document.getElementById('nav-tab-invoices');
    const btnPOs = document.getElementById('nav-tab-pos');
    const btnQuotations = document.getElementById('nav-tab-quotations');
    const invToolbar = document.getElementById('invoice-toolbar-actions');
    const poToolbar = document.getElementById('po-toolbar-actions');
    const mobileTabSwitcher = document.getElementById('mobile-tab-switcher');

    if (moduleName === 'invoices') {
      modInvoices?.classList.remove('hidden');
      modPOs?.classList.add('hidden');
      modQuotations?.classList.add('hidden');
      invToolbar?.classList.remove('hidden');
      poToolbar?.classList.add('hidden');
      mobileTabSwitcher?.classList.toggle('hidden', invoiceViewMode !== 'editor');
      const currencySelector = document.getElementById('currency-select');
      if (currencySelector) currencySelector.value = invoiceData.currency || 'INR';

      btnInvoices?.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      btnInvoices?.classList.remove('text-slate-400');
      btnPOs?.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
      btnPOs?.classList.add('text-slate-400');
      btnQuotations?.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
      btnQuotations?.classList.add('text-slate-400');

      renderInvoiceTable();
      if (invoiceViewMode === 'editor') {
        recalculateAndRenderPreview();
      }
    } else if (moduleName === 'pos') {
      modInvoices?.classList.add('hidden');
      modPOs?.classList.remove('hidden');
      modQuotations?.classList.add('hidden');
      invToolbar?.classList.add('hidden');
      poToolbar?.classList.remove('hidden');
      mobileTabSwitcher?.classList.toggle('hidden', poViewMode !== 'editor');
      const currencySelector = document.getElementById('currency-select');
      if (currencySelector) currencySelector.value = poData.currency || 'INR';

      btnPOs?.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      btnPOs?.classList.remove('text-slate-400');
      btnInvoices?.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
      btnInvoices?.classList.add('text-slate-400');
      btnQuotations?.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
      btnQuotations?.classList.add('text-slate-400');

      renderPOTable();
      if (poViewMode === 'editor') {
        recalculateAndRenderPOPreview();
      }
    } else if (moduleName === 'quotations') {
      modInvoices?.classList.add('hidden');
      modPOs?.classList.add('hidden');
      modQuotations?.classList.remove('hidden');
      invToolbar?.classList.add('hidden');
      poToolbar?.classList.add('hidden');
      mobileTabSwitcher?.classList.add('hidden');

      btnQuotations?.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
      btnQuotations?.classList.remove('text-slate-400');
      btnInvoices?.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
      btnInvoices?.classList.add('text-slate-400');
      btnPOs?.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
      btnPOs?.classList.add('text-slate-400');

      window.InvoxQuotations?.renderList();
    }

    [
      [btnInvoices, moduleName === 'invoices'],
      [btnPOs, moduleName === 'pos'],
      [btnQuotations, moduleName === 'quotations']
    ].forEach(([button, isActive]) => {
      if (!button) return;
      button.setAttribute('aria-pressed', String(isActive));
      button.classList.toggle('bg-indigo-600', isActive);
      button.classList.toggle('text-white', isActive);
      button.classList.toggle('shadow-sm', isActive);
      button.classList.toggle('text-slate-400', !isActive);
      const badge = button.querySelector('span[id^="badge-nav-"]');
      badge?.classList.toggle('bg-white/20', isActive);
      badge?.classList.toggle('text-white', isActive);
      badge?.classList.toggle('bg-slate-800', !isActive);
      badge?.classList.toggle('text-slate-300', !isActive);
    });

    lucide.createIcons();
  }

  function toggleInvoiceView() {
    if (invoiceViewMode === 'list') {
      switchInvoiceView('editor');
    } else {
      switchInvoiceView('list');
    }
  }

  function switchInvoiceView(view) {
    invoiceViewMode = view;
    const listView = document.getElementById('invoice-list-view');
    const editorPreviewView = document.getElementById('invoice-editor-preview-view');
    const toggleText = document.getElementById('invoice-view-toggle-text');

    if (view === 'list') {
      listView?.classList.remove('hidden');
      editorPreviewView?.classList.add('hidden');
      document.getElementById('mobile-tab-switcher')?.classList.add('hidden');
      if (toggleText) toggleText.textContent = '+ Create Invoice';
      renderInvoiceTable();
    } else {
      listView?.classList.add('hidden');
      editorPreviewView?.classList.remove('hidden');
      document.getElementById('mobile-tab-switcher')?.classList.toggle('hidden', activeModule !== 'invoices');
      if (toggleText) toggleText.textContent = 'All Invoices';
      recalculateAndRenderPreview();
      resetZoom();
    }

    lucide.createIcons();
  }

  function togglePOView() {
    if (poViewMode === 'list') {
      switchPOView('editor');
    } else {
      switchPOView('list');
    }
  }

  function switchPOView(view) {
    poViewMode = view;
    const listView = document.getElementById('po-list-view');
    const editorPreviewView = document.getElementById('po-editor-preview-view');
    const toggleText = document.getElementById('po-view-toggle-text');

    if (view === 'list') {
      listView?.classList.remove('hidden');
      editorPreviewView?.classList.add('hidden');
      document.getElementById('mobile-tab-switcher')?.classList.add('hidden');
      if (toggleText) toggleText.textContent = '+ Create PO';
      renderPOTable();
    } else {
      listView?.classList.add('hidden');
      editorPreviewView?.classList.remove('hidden');
      document.getElementById('mobile-tab-switcher')?.classList.toggle('hidden', activeModule !== 'pos');
      if (toggleText) toggleText.textContent = 'All Orders';
      recalculateAndRenderPOPreview();
      resetPOZoom();
    }

    lucide.createIcons();
  }

  // --- INVOICE LIVE FORM SYNC ---
  function handleInvoiceFormInput(e) {
    readFormInputsIntoState();
    recalculateAndRenderPreview();
    scheduleDraftSave();
  }

  function readFormInputsIntoState() {
    invoiceData.sender.name = document.getElementById('sender-name')?.value || '';
    invoiceData.sender.email = document.getElementById('sender-email')?.value || '';
    invoiceData.sender.phone = document.getElementById('sender-phone')?.value || '';
    invoiceData.sender.address = document.getElementById('sender-address')?.value || '';
    invoiceData.sender.taxId = document.getElementById('sender-tax-id')?.value || '';
    invoiceData.sender.website = document.getElementById('sender-website')?.value || '';

    invoiceData.client.name = document.getElementById('client-name')?.value || '';
    invoiceData.client.company = document.getElementById('client-company')?.value || '';
    invoiceData.client.email = document.getElementById('client-email')?.value || '';
    invoiceData.client.phone = document.getElementById('client-phone')?.value || '';
    invoiceData.client.billingAddress = document.getElementById('client-billing-address')?.value || '';
    invoiceData.client.taxId = document.getElementById('client-tax-id')?.value || '';
    invoiceData.client.sameAddress = document.getElementById('client-same-address')?.checked || false;
    invoiceData.client.shippingAddress = invoiceData.client.sameAddress
      ? invoiceData.client.billingAddress
      : document.getElementById('client-shipping-address')?.value || '';

    invoiceData.invoiceNumber = document.getElementById('invoice-number')?.value || 'INV-001';
    invoiceData.issueDate = document.getElementById('invoice-issue-date')?.value || '';
    invoiceData.dueDate = document.getElementById('invoice-due-date')?.value || '';
    invoiceData.poNumber = document.getElementById('invoice-po-number')?.value || '';
    invoiceData.status = document.getElementById('invoice-status')?.value || 'Pending';

    invoiceData.taxType = document.getElementById('tax-type-select')?.value || 'intra';
    invoiceData.extraDiscountValue = parseFloat(document.getElementById('extra-discount-val')?.value) || 0;
    invoiceData.extraDiscountType = document.getElementById('extra-discount-type')?.value || '%';
    invoiceData.shippingCharges = parseFloat(document.getElementById('shipping-charges')?.value) || 0;
    invoiceData.autoRoundOff = document.getElementById('auto-roundoff-toggle')?.checked || false;

    invoiceData.bank.name = document.getElementById('bank-name')?.value || '';
    invoiceData.bank.accountName = document.getElementById('bank-account-name')?.value || '';
    invoiceData.bank.accountNumber = document.getElementById('bank-account-number')?.value || '';
    invoiceData.bank.ifsc = document.getElementById('bank-ifsc')?.value || '';
    invoiceData.bank.upiId = document.getElementById('upi-id')?.value || '';
    invoiceData.bank.showUpiQr = document.getElementById('show-upi-qr-toggle')?.checked || false;

    invoiceData.notes = document.getElementById('invoice-notes')?.value || '';
    invoiceData.terms = document.getElementById('invoice-terms')?.value || '';
    invoiceData.signatoryName = document.getElementById('signatory-name')?.value || '';
  }

  function syncFormInputsFromState() {
    const curSelect = document.getElementById('currency-select');
    if (curSelect) curSelect.value = invoiceData.currency || 'INR';

    setValue('sender-name', invoiceData.sender.name);
    setValue('sender-email', invoiceData.sender.email);
    setValue('sender-phone', invoiceData.sender.phone);
    setValue('sender-address', invoiceData.sender.address);
    setValue('sender-tax-id', invoiceData.sender.taxId);
    setValue('sender-website', invoiceData.sender.website);

    updateLogoPreviewUI(invoiceData.sender.logo);

    setValue('client-name', invoiceData.client.name);
    setValue('client-company', invoiceData.client.company);
    setValue('client-email', invoiceData.client.email);
    setValue('client-phone', invoiceData.client.phone);
    setValue('client-billing-address', invoiceData.client.billingAddress);
    setValue('client-tax-id', invoiceData.client.taxId);
    
    const sameBox = document.getElementById('client-same-address');
    if (sameBox) {
      sameBox.checked = invoiceData.client.sameAddress;
      handleSameAddressToggle();
    }
    setValue('client-shipping-address', invoiceData.client.shippingAddress);

    setValue('invoice-number', invoiceData.invoiceNumber);
    setValue('invoice-issue-date', invoiceData.issueDate);
    setValue('invoice-due-date', invoiceData.dueDate);
    setValue('invoice-po-number', invoiceData.poNumber);
    setValue('invoice-status', invoiceData.status);

    setValue('tax-type-select', invoiceData.taxType);
    setValue('extra-discount-val', invoiceData.extraDiscountValue || '');
    setValue('extra-discount-type', invoiceData.extraDiscountType);
    setValue('shipping-charges', invoiceData.shippingCharges || '');
    
    const roundToggle = document.getElementById('auto-roundoff-toggle');
    if (roundToggle) roundToggle.checked = invoiceData.autoRoundOff;

    setValue('bank-name', invoiceData.bank.name);
    setValue('bank-account-name', invoiceData.bank.accountName);
    setValue('bank-account-number', invoiceData.bank.accountNumber);
    setValue('bank-ifsc', invoiceData.bank.ifsc);
    setValue('upi-id', invoiceData.bank.upiId);

    const upiToggle = document.getElementById('show-upi-qr-toggle');
    if (upiToggle) upiToggle.checked = invoiceData.bank.showUpiQr;

    setValue('invoice-notes', invoiceData.notes);
    setValue('invoice-terms', invoiceData.terms);
    setValue('signatory-name', invoiceData.signatoryName);

    setTheme(invoiceData.theme || 'indigo', false);
    renderLineItemRows();
  }

  // --- PURCHASE ORDER LIVE FORM SYNC ---
  function handlePOFormInput(e) {
    readPOFormInputsIntoState();
    recalculateAndRenderPOPreview();
    schedulePODraftSave();
  }

  function readPOFormInputsIntoState() {
    poData.vendor.name = document.getElementById('po-vendor-name')?.value || '';
    poData.vendor.company = document.getElementById('po-vendor-company')?.value || '';
    poData.vendor.email = document.getElementById('po-vendor-email')?.value || '';
    poData.vendor.phone = document.getElementById('po-vendor-phone')?.value || '';
    poData.vendor.address = document.getElementById('po-vendor-address')?.value || '';
    poData.vendor.taxId = document.getElementById('po-vendor-tax-id')?.value || '';

    poData.poNumber = document.getElementById('po-number')?.value || 'PO-001';
    poData.orderDate = document.getElementById('po-order-date')?.value || '';
    poData.deliveryDate = document.getElementById('po-delivery-date')?.value || '';
    poData.paymentTerms = document.getElementById('po-payment-terms')?.value || '';
    poData.status = document.getElementById('po-status')?.value || 'Sent';

    poData.sameAsBusinessAddress = document.getElementById('po-same-address-toggle')?.checked || false;
    if (poData.sameAsBusinessAddress) {
      poData.deliveryAddress = invoiceData.sender.address || 'Company Headquarters';
    } else {
      poData.deliveryAddress = document.getElementById('po-delivery-address')?.value || '';
    }

    poData.taxType = document.getElementById('po-tax-type-select')?.value || 'intra';
    poData.extraDiscountValue = parseFloat(document.getElementById('po-extra-discount-val')?.value) || 0;
    poData.extraDiscountType = document.getElementById('po-extra-discount-type')?.value || '%';
    poData.shippingCharges = parseFloat(document.getElementById('po-shipping-charges')?.value) || 0;
    poData.autoRoundOff = document.getElementById('po-auto-roundoff-toggle')?.checked || false;

    poData.notes = document.getElementById('po-notes')?.value || '';
    poData.terms = document.getElementById('po-terms')?.value || '';
    poData.signatoryName = document.getElementById('po-signatory-name')?.value || '';
  }

  function syncPOFormInputsFromState() {
    setValue('po-vendor-name', poData.vendor.name);
    setValue('po-vendor-company', poData.vendor.company);
    setValue('po-vendor-email', poData.vendor.email);
    setValue('po-vendor-phone', poData.vendor.phone);
    setValue('po-vendor-address', poData.vendor.address);
    setValue('po-vendor-tax-id', poData.vendor.taxId);

    setValue('po-number', poData.poNumber);
    setValue('po-order-date', poData.orderDate);
    setValue('po-delivery-date', poData.deliveryDate);
    setValue('po-payment-terms', poData.paymentTerms);
    setValue('po-status', poData.status);

    const sameAddrBox = document.getElementById('po-same-address-toggle');
    if (sameAddrBox) {
      sameAddrBox.checked = poData.sameAsBusinessAddress;
      handlePOSameAddressToggle();
    }
    setValue('po-delivery-address', poData.deliveryAddress);

    setValue('po-tax-type-select', poData.taxType);
    setValue('po-extra-discount-val', poData.extraDiscountValue || '');
    setValue('po-extra-discount-type', poData.extraDiscountType);
    setValue('po-shipping-charges', poData.shippingCharges || '');

    const poRoundToggle = document.getElementById('po-auto-roundoff-toggle');
    if (poRoundToggle) poRoundToggle.checked = poData.autoRoundOff;

    setValue('po-notes', poData.notes);
    setValue('po-terms', poData.terms);
    setValue('po-signatory-name', poData.signatoryName);

    setPOTheme(poData.theme || 'indigo', false);
    renderPOLineItemRows();
  }

  function handlePOSameAddressToggle() {
    const box = document.getElementById('po-same-address-toggle');
    const addrField = document.getElementById('po-delivery-address');
    if (!box || !addrField) return;

    if (box.checked) {
      poData.sameAsBusinessAddress = true;
      poData.deliveryAddress = invoiceData.sender.address || 'Same as Business Address';
      addrField.value = poData.deliveryAddress;
      addrField.setAttribute('disabled', 'true');
    } else {
      poData.sameAsBusinessAddress = false;
      addrField.removeAttribute('disabled');
    }
    recalculateAndRenderPOPreview();
    schedulePODraftSave();
  }

  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }

  // --- INVOICE LINE ITEMS ---
  function renderLineItemRows() {
    const container = document.getElementById('line-items-container');
    if (!container) return;

    container.innerHTML = '';
    const itemsCountEl = document.getElementById('items-count');
    if (itemsCountEl) itemsCountEl.textContent = invoiceData.items.length;

    if (invoiceData.items.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
          <p class="text-xs text-slate-400">No items added yet. Click "+ Add Item" below to add line items.</p>
        </div>
      `;
      return;
    }

    invoiceData.items.forEach((item) => {
      const calc = InvoxCalc.calculateLineItem(item);
      const row = document.createElement('div');
      row.className = 'p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 flex flex-col gap-2.5 transition hover:border-slate-700';
      row.dataset.itemId = item.id;

      row.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <input type="text" class="item-field invox-input !py-1 text-xs font-semibold" data-prop="description" placeholder="Item name or service description *" value="${escapeHtml(item.description)}">
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-dup-item p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition" title="Duplicate item">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" class="btn-del-item p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition" title="Delete item">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center text-xs">
          <div>
            <label class="text-[10px] text-slate-400 font-medium block mb-0.5">Quantity</label>
            <input type="number" class="item-field invox-input !py-1 text-xs font-mono" data-prop="quantity" min="0" step="any" placeholder="1" value="${item.quantity}">
          </div>

          <div>
            <label class="text-[10px] text-slate-400 font-medium block mb-0.5">Rate / Price</label>
            <input type="number" class="item-field invox-input !py-1 text-xs font-mono" data-prop="rate" min="0" step="any" placeholder="0" value="${item.rate}">
          </div>

          <div>
            <label class="text-[10px] text-slate-400 font-medium block mb-0.5">Tax / GST</label>
            <select class="item-field invox-select !py-1 !px-1.5 text-xs w-full" data-prop="taxRate">
              <option value="0" ${item.taxRate == 0 ? 'selected' : ''}>0% (Exempt)</option>
              <option value="5" ${item.taxRate == 5 ? 'selected' : ''}>5%</option>
              <option value="12" ${item.taxRate == 12 ? 'selected' : ''}>12%</option>
              <option value="18" ${item.taxRate == 18 ? 'selected' : ''}>18%</option>
              <option value="28" ${item.taxRate == 28 ? 'selected' : ''}>28%</option>
            </select>
          </div>

          <div>
            <label class="text-[10px] text-slate-400 font-medium block mb-0.5">Discount</label>
            <div class="flex gap-1">
              <input type="number" class="item-field invox-input !py-1 text-xs font-mono" data-prop="discountValue" min="0" step="any" placeholder="0" value="${item.discountValue || 0}">
              <select class="item-field invox-select !py-1 !px-1 text-xs w-12" data-prop="discountType">
                <option value="%" ${item.discountType === '%' ? 'selected' : ''}>%</option>
                <option value="flat" ${item.discountType === 'flat' ? 'selected' : ''}>${InvoxCalc.CURRENCIES[invoiceData.currency]?.symbol || '₹'}</option>
              </select>
            </div>
          </div>

          <div class="col-span-2 sm:col-span-1 text-right sm:text-right pt-2 sm:pt-0">
            <span class="text-[10px] text-slate-400 font-medium block mb-0.5">Total</span>
            <span class="font-mono font-bold text-slate-200 text-xs">${InvoxCalc.formatCurrency(calc.total, invoiceData.currency)}</span>
          </div>
        </div>
      `;

      row.querySelectorAll('.item-field').forEach(field => {
        field.addEventListener('input', () => {
          const prop = field.dataset.prop;
          let val = field.value;
          if (['quantity', 'rate', 'taxRate', 'discountValue'].includes(prop)) {
            val = parseFloat(val) || 0;
          }
          item[prop] = val;
          recalculateAndRenderPreview();
          scheduleDraftSave();
        });
      });

      row.querySelector('.btn-dup-item')?.addEventListener('click', () => {
        duplicateItem(item.id);
      });

      row.querySelector('.btn-del-item')?.addEventListener('click', () => {
        removeItem(item.id);
      });

      container.appendChild(row);
    });

    lucide.createIcons();
  }

  function addItem(customData = null) {
    const newItem = customData || {
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      description: '',
      quantity: 1,
      rate: 0,
      taxRate: 18,
      discountValue: 0,
      discountType: '%'
    };

    invoiceData.items.push(newItem);
    renderLineItemRows();
    recalculateAndRenderPreview();
    scheduleDraftSave();

    const inputs = document.querySelectorAll('#line-items-container input[data-prop="description"]');
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
  }

  function removeItem(itemId) {
    invoiceData.items = invoiceData.items.filter(i => i.id !== itemId);
    renderLineItemRows();
    recalculateAndRenderPreview();
    scheduleDraftSave();
  }

  function duplicateItem(itemId) {
    const item = invoiceData.items.find(i => i.id === itemId);
    if (!item) return;

    const dup = {
      ...item,
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      description: item.description + ' (Copy)'
    };

    const index = invoiceData.items.findIndex(i => i.id === itemId);
    invoiceData.items.splice(index + 1, 0, dup);
    renderLineItemRows();
    recalculateAndRenderPreview();
    scheduleDraftSave();
    showToast('Line item duplicated', 'info');
  }

  function handleClearAllItems() {
    if (invoiceData.items.length === 0) return;
    if (confirm('Clear all line items?')) {
      invoiceData.items = [];
      renderLineItemRows();
      recalculateAndRenderPreview();
      scheduleDraftSave();
      showToast('All items cleared', 'info');
    }
  }

  // --- PURCHASE ORDER LINE ITEMS ---
  function renderPOLineItemRows() {
    const container = document.getElementById('po-line-items-container');
    if (!container) return;

    container.innerHTML = '';
    const itemsCountEl = document.getElementById('po-items-count');
    if (itemsCountEl) itemsCountEl.textContent = poData.items.length;

    if (poData.items.length === 0) {
      container.innerHTML = `
        <div class="text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
          <p class="text-xs text-slate-400">No items added to this PO. Click "+ Add Item" below.</p>
        </div>
      `;
      return;
    }

    poData.items.forEach((item) => {
      const calc = InvoxCalc.calculateLineItem(item);
      const row = document.createElement('div');
      row.className = 'p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 flex flex-col gap-2.5 transition hover:border-slate-700';
      row.dataset.itemId = item.id;

      row.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <input type="text" class="po-item-field invox-input !py-1 text-xs font-semibold" data-prop="description" placeholder="Item name, part number or specification *" value="${escapeHtml(item.description)}">
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-dup-po-item p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition" title="Duplicate item">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" class="btn-del-po-item p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition" title="Delete item">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center text-xs">
          <div>
            <label class="text-[10px] text-slate-400 font-medium block mb-0.5">Quantity</label>
            <input type="number" class="po-item-field invox-input !py-1 text-xs font-mono" data-prop="quantity" min="0" step="any" placeholder="1" value="${item.quantity}">
          </div>

          <div>
            <label class="text-[10px] text-slate-400 font-medium block mb-0.5">Unit Rate</label>
            <input type="number" class="po-item-field invox-input !py-1 text-xs font-mono" data-prop="rate" min="0" step="any" placeholder="0" value="${item.rate}">
          </div>

          <div>
            <label class="text-[10px] text-slate-400 font-medium block mb-0.5">Tax / GST</label>
            <select class="po-item-field invox-select !py-1 !px-1.5 text-xs w-full" data-prop="taxRate">
              <option value="0" ${item.taxRate == 0 ? 'selected' : ''}>0% (Exempt)</option>
              <option value="5" ${item.taxRate == 5 ? 'selected' : ''}>5%</option>
              <option value="12" ${item.taxRate == 12 ? 'selected' : ''}>12%</option>
              <option value="18" ${item.taxRate == 18 ? 'selected' : ''}>18%</option>
              <option value="28" ${item.taxRate == 28 ? 'selected' : ''}>28%</option>
            </select>
          </div>

          <div>
            <label class="text-[10px] text-slate-400 font-medium block mb-0.5">Discount</label>
            <div class="flex gap-1">
              <input type="number" class="po-item-field invox-input !py-1 text-xs font-mono" data-prop="discountValue" min="0" step="any" placeholder="0" value="${item.discountValue || 0}">
              <select class="po-item-field invox-select !py-1 !px-1 text-xs w-12" data-prop="discountType">
                <option value="%" ${item.discountType === '%' ? 'selected' : ''}>%</option>
                <option value="flat" ${item.discountType === 'flat' ? 'selected' : ''}>${InvoxCalc.CURRENCIES[poData.currency]?.symbol || '₹'}</option>
              </select>
            </div>
          </div>

          <div class="col-span-2 sm:col-span-1 text-right sm:text-right pt-2 sm:pt-0">
            <span class="text-[10px] text-slate-400 font-medium block mb-0.5">Total</span>
            <span class="font-mono font-bold text-slate-200 text-xs">${InvoxCalc.formatCurrency(calc.total, poData.currency)}</span>
          </div>
        </div>
      `;

      row.querySelectorAll('.po-item-field').forEach(field => {
        field.addEventListener('input', () => {
          const prop = field.dataset.prop;
          let val = field.value;
          if (['quantity', 'rate', 'taxRate', 'discountValue'].includes(prop)) {
            val = parseFloat(val) || 0;
          }
          item[prop] = val;
          recalculateAndRenderPOPreview();
          schedulePODraftSave();
        });
      });

      row.querySelector('.btn-dup-po-item')?.addEventListener('click', () => {
        duplicatePOItem(item.id);
      });

      row.querySelector('.btn-del-po-item')?.addEventListener('click', () => {
        removePOItem(item.id);
      });

      container.appendChild(row);
    });

    lucide.createIcons();
  }

  function addPOItem(customData = null) {
    const newItem = customData || {
      id: 'po_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      description: '',
      quantity: 1,
      rate: 0,
      taxRate: 18,
      discountValue: 0,
      discountType: '%'
    };

    poData.items.push(newItem);
    renderPOLineItemRows();
    recalculateAndRenderPOPreview();
    schedulePODraftSave();

    const inputs = document.querySelectorAll('#po-line-items-container input[data-prop="description"]');
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
  }

  function removePOItem(itemId) {
    poData.items = poData.items.filter(i => i.id !== itemId);
    renderPOLineItemRows();
    recalculateAndRenderPOPreview();
    schedulePODraftSave();
  }

  function duplicatePOItem(itemId) {
    const item = poData.items.find(i => i.id === itemId);
    if (!item) return;

    const dup = {
      ...item,
      id: 'po_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      description: item.description + ' (Copy)'
    };

    const index = poData.items.findIndex(i => i.id === itemId);
    poData.items.splice(index + 1, 0, dup);
    renderPOLineItemRows();
    recalculateAndRenderPOPreview();
    schedulePODraftSave();
    showToast('PO item duplicated', 'info');
  }

  function handleClearAllPOItems() {
    if (poData.items.length === 0) return;
    if (confirm('Clear all PO items?')) {
      poData.items = [];
      renderPOLineItemRows();
      recalculateAndRenderPOPreview();
      schedulePODraftSave();
      showToast('All PO items cleared', 'info');
    }
  }

  // --- RECALCULATE & RENDER INVOICE PREVIEW ---
  function recalculateAndRenderPreview() {
    const totals = InvoxCalc.calculateInvoiceTotals(invoiceData);
    invoiceData.totals = totals;

    setPreviewText('pv-sender-name', invoiceData.sender.name || 'Your Business Name');
    setPreviewText('pv-sender-address', invoiceData.sender.address || '123 Business Street, Tech District, City');
    
    const contactParts = [invoiceData.sender.email, invoiceData.sender.phone].filter(Boolean);
    setPreviewText('pv-sender-contact', contactParts.join(' | ') || 'contact@yourbusiness.com');

    const pvTax = document.getElementById('pv-sender-tax');
    if (pvTax) {
      if (invoiceData.sender.taxId) {
        pvTax.textContent = `GSTIN/Tax ID: ${invoiceData.sender.taxId.toUpperCase()}`;
        pvTax.style.display = 'block';
      } else {
        pvTax.style.display = 'none';
      }
    }

    const pvWeb = document.getElementById('pv-sender-website');
    if (pvWeb) {
      if (invoiceData.sender.website) {
        pvWeb.textContent = invoiceData.sender.website;
        pvWeb.style.display = 'block';
      } else {
        pvWeb.style.display = 'none';
      }
    }

    const logoContainer = document.getElementById('pv-logo-container');
    const logoImg = document.getElementById('pv-logo-img');
    if (logoContainer && logoImg) {
      if (invoiceData.sender.logo) {
        logoImg.src = invoiceData.sender.logo;
        logoContainer.classList.remove('hidden');
      } else {
        logoContainer.classList.add('hidden');
      }
    }

    setPreviewText('pv-invoice-number', invoiceData.invoiceNumber || 'INV-001');
    setPreviewText('pv-issue-date', formatDate(invoiceData.issueDate));
    setPreviewText('pv-due-date', formatDate(invoiceData.dueDate) || 'Due on Receipt');

    const poRow = document.getElementById('pv-po-row');
    if (poRow) {
      if (invoiceData.poNumber) {
        poRow.classList.remove('hidden');
        setPreviewText('pv-po-number', invoiceData.poNumber);
      } else {
        poRow.classList.add('hidden');
      }
    }

    const stamp = document.getElementById('pv-status-stamp');
    if (stamp) {
      stamp.textContent = invoiceData.status.toUpperCase();
      stamp.className = 'mt-3 px-3 py-0.5 rounded-full border text-[11px] font-black uppercase tracking-wider ';
      if (invoiceData.status === 'Paid') {
        stamp.className += 'border-emerald-500 bg-emerald-50 text-emerald-700';
      } else if (invoiceData.status === 'Draft') {
        stamp.className += 'border-slate-400 bg-slate-50 text-slate-600';
      } else {
        stamp.className += 'border-amber-500 bg-amber-50 text-amber-700';
      }
    }

    setPreviewText('pv-client-name', invoiceData.client.name || 'Client Name');
    const pvComp = document.getElementById('pv-client-company');
    if (pvComp) {
      pvComp.textContent = invoiceData.client.company || '';
      pvComp.style.display = invoiceData.client.company ? 'block' : 'none';
    }

    setPreviewText('pv-client-billing-address', invoiceData.client.billingAddress || 'Client Address, City, State, Country');
    const clientContactParts = [invoiceData.client.email, invoiceData.client.phone].filter(Boolean);
    setPreviewText('pv-client-contact', clientContactParts.join(' | ') || '');

    const pvClientTax = document.getElementById('pv-client-tax');
    if (pvClientTax) {
      if (invoiceData.client.taxId) {
        pvClientTax.textContent = `GSTIN: ${invoiceData.client.taxId.toUpperCase()}`;
        pvClientTax.style.display = 'block';
      } else {
        pvClientTax.style.display = 'none';
      }
    }

    const shipBox = document.getElementById('pv-ship-to-box');
    const shipText = document.getElementById('pv-client-shipping-address');
    if (shipBox && shipText) {
      if (invoiceData.client.sameAddress) {
        shipText.textContent = 'Same as billing address';
      } else {
        shipText.textContent = invoiceData.client.shippingAddress || 'Same as billing address';
      }
    }

    const tbody = document.getElementById('pv-line-items-body');
    if (tbody) {
      tbody.innerHTML = '';
      if (invoiceData.items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="py-6 text-center text-slate-400 italic">No line items added</td>
          </tr>
        `;
      } else {
        invoiceData.items.forEach((item, idx) => {
          const c = InvoxCalc.calculateLineItem(item);
          const tr = document.createElement('tr');
          tr.className = 'border-b border-slate-100 hover:bg-slate-50/50';

          const discStr = c.discountAmount > 0 
            ? (item.discountType === '%' ? `${item.discountValue}%` : InvoxCalc.formatCurrency(c.discountAmount, invoiceData.currency)) 
            : '-';

          const taxStr = c.taxRate > 0 ? `${c.taxRate}%` : '-';

          tr.innerHTML = `
            <td class="py-3 px-3 font-mono text-slate-400">${idx + 1}</td>
            <td class="py-3 px-3">
              <span class="font-semibold text-slate-800 block">${escapeHtml(item.description || 'Item Description')}</span>
            </td>
            <td class="py-3 px-2 text-right font-mono text-slate-700">${item.quantity}</td>
            <td class="py-3 px-3 text-right font-mono text-slate-700">${InvoxCalc.formatCurrency(item.rate, invoiceData.currency)}</td>
            <td class="py-3 px-2 text-right font-mono text-slate-500">${taxStr}</td>
            <td class="py-3 px-2 text-right font-mono text-emerald-600">${discStr}</td>
            <td class="py-3 px-3 text-right font-mono font-bold text-slate-900">${InvoxCalc.formatCurrency(c.total, invoiceData.currency)}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    setPreviewText('pv-items-subtotal', InvoxCalc.formatCurrency(totals.itemsSubtotal, invoiceData.currency));

    const discRow = document.getElementById('pv-item-discount-row');
    if (discRow) {
      if (totals.totalItemDiscounts > 0) {
        discRow.classList.remove('hidden');
        setPreviewText('pv-items-discount', `-${InvoxCalc.formatCurrency(totals.totalItemDiscounts, invoiceData.currency)}`);
      } else {
        discRow.classList.add('hidden');
      }
    }

    const extraDiscRow = document.getElementById('pv-extra-discount-row');
    if (extraDiscRow) {
      if (totals.overallDiscountAmount > 0) {
        extraDiscRow.classList.remove('hidden');
        setPreviewText('pv-extra-discount', `-${InvoxCalc.formatCurrency(totals.overallDiscountAmount, invoiceData.currency)}`);
      } else {
        extraDiscRow.classList.add('hidden');
      }
    }

    const taxContainer = document.getElementById('pv-tax-breakdown-container');
    if (taxContainer) {
      taxContainer.innerHTML = '';
      if (totals.taxSlabs.length === 0) {
        taxContainer.innerHTML = `
          <div class="flex justify-between py-0.5 text-slate-400">
            <span>Tax (0%):</span>
            <span class="font-mono">${InvoxCalc.formatCurrency(0, invoiceData.currency)}</span>
          </div>
        `;
      } else {
        totals.taxSlabs.forEach(slab => {
          if (invoiceData.taxType === 'intra') {
            const halfRate = slab.rate / 2;
            const halfTax = slab.taxAmount / 2;
            taxContainer.innerHTML += `
              <div class="flex justify-between py-0.5">
                <span class="text-slate-600">CGST (${halfRate}%):</span>
                <span class="font-mono text-slate-800">${InvoxCalc.formatCurrency(halfTax, invoiceData.currency)}</span>
              </div>
              <div class="flex justify-between py-0.5">
                <span class="text-slate-600">SGST (${halfRate}%):</span>
                <span class="font-mono text-slate-800">${InvoxCalc.formatCurrency(halfTax, invoiceData.currency)}</span>
              </div>
            `;
          } else if (invoiceData.taxType === 'inter') {
            taxContainer.innerHTML += `
              <div class="flex justify-between py-0.5">
                <span class="text-slate-600">IGST (${slab.rate}%):</span>
                <span class="font-mono text-slate-800">${InvoxCalc.formatCurrency(slab.taxAmount, invoiceData.currency)}</span>
              </div>
            `;
          } else {
            taxContainer.innerHTML += `
              <div class="flex justify-between py-0.5">
                <span class="text-slate-600">Tax (${slab.rate}%):</span>
                <span class="font-mono text-slate-800">${InvoxCalc.formatCurrency(slab.taxAmount, invoiceData.currency)}</span>
              </div>
            `;
          }
        });
      }
    }

    const shippingRow = document.getElementById('pv-shipping-row');
    if (shippingRow) {
      if (totals.shipping > 0) {
        shippingRow.classList.remove('hidden');
        setPreviewText('pv-shipping-amount', InvoxCalc.formatCurrency(totals.shipping, invoiceData.currency));
      } else {
        shippingRow.classList.add('hidden');
      }
    }

    const roundRow = document.getElementById('pv-roundoff-row');
    if (roundRow) {
      if (totals.roundOff !== 0) {
        roundRow.classList.remove('hidden');
        const sign = totals.roundOff > 0 ? '+' : '';
        setPreviewText('pv-roundoff-amount', `${sign}${InvoxCalc.formatCurrency(totals.roundOff, invoiceData.currency)}`);
      } else {
        roundRow.classList.add('hidden');
      }
    }

    setPreviewText('pv-grand-total', InvoxCalc.formatCurrency(totals.grandTotal, invoiceData.currency));
    setPreviewText('pv-amount-in-words', InvoxCalc.amountToWords(totals.grandTotal, invoiceData.currency));

    setPreviewText('pv-bank-name', invoiceData.bank.name || 'Not Provided');
    setPreviewText('pv-account-name', invoiceData.bank.accountName || invoiceData.sender.name || 'Not Provided');
    setPreviewText('pv-account-no', invoiceData.bank.accountNumber || 'Not Provided');
    setPreviewText('pv-ifsc', invoiceData.bank.ifsc || 'Not Provided');

    const upiRow = document.getElementById('pv-upi-row');
    const qrWrapper = document.getElementById('pv-upi-qr-wrapper');
    const qrImg = document.getElementById('pv-upi-qr-img');

    if (invoiceData.bank.upiId) {
      if (upiRow) upiRow.style.display = 'block';
      setPreviewText('pv-upi-id', invoiceData.bank.upiId);

      if (invoiceData.bank.showUpiQr && qrWrapper && qrImg) {
        qrWrapper.style.display = 'flex';
        const upiUri = `upi://pay?pa=${encodeURIComponent(invoiceData.bank.upiId)}&pn=${encodeURIComponent(invoiceData.bank.accountName || invoiceData.sender.name || 'Merchant')}&am=${totals.grandTotal.toFixed(2)}&cu=${invoiceData.currency}&tn=${encodeURIComponent(invoiceData.invoiceNumber)}`;
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUri)}`;
      } else if (qrWrapper) {
        qrWrapper.style.display = 'none';
      }
    } else {
      if (upiRow) upiRow.style.display = 'none';
      if (qrWrapper) qrWrapper.style.display = 'none';
    }

    const notesBox = document.getElementById('pv-notes-box');
    if (notesBox) {
      if (invoiceData.notes) {
        notesBox.style.display = 'block';
        setPreviewText('pv-notes-text', invoiceData.notes);
      } else {
        notesBox.style.display = 'none';
      }
    }

    const termsBox = document.getElementById('pv-terms-box');
    if (termsBox) {
      if (invoiceData.terms) {
        termsBox.style.display = 'block';
        setPreviewText('pv-terms-text', invoiceData.terms);
      } else {
        termsBox.style.display = 'none';
      }
    }

    setPreviewText('pv-signatory-name', invoiceData.signatoryName || 'Authorized Signatory');

    const sigImg = document.getElementById('pv-signature-img');
    if (sigImg) {
      if (invoiceData.signature) {
        sigImg.src = invoiceData.signature;
        sigImg.classList.remove('hidden');
      } else {
        sigImg.classList.add('hidden');
      }
    }
  }

  // --- RECALCULATE & RENDER PURCHASE ORDER PREVIEW ---
  function recalculateAndRenderPOPreview() {
    const totals = InvoxCalc.calculateInvoiceTotals(poData);
    poData.totals = totals;

    // Sender details in PO
    setPreviewText('pv-po-sender-name', invoiceData.sender.name || 'Your Business Name');
    setPreviewText('pv-po-sender-address', invoiceData.sender.address || '123 Business Street, Tech District, City');
    
    const contactParts = [invoiceData.sender.email, invoiceData.sender.phone].filter(Boolean);
    setPreviewText('pv-po-sender-contact', contactParts.join(' | ') || 'contact@yourbusiness.com');

    const pvPoTax = document.getElementById('pv-po-sender-tax');
    if (pvPoTax) {
      if (invoiceData.sender.taxId) {
        pvPoTax.textContent = `GSTIN: ${invoiceData.sender.taxId.toUpperCase()}`;
        pvPoTax.style.display = 'block';
      } else {
        pvPoTax.style.display = 'none';
      }
    }

    const poLogoContainer = document.getElementById('pv-po-logo-container');
    const poLogoImg = document.getElementById('pv-po-logo-img');
    if (poLogoContainer && poLogoImg) {
      if (invoiceData.sender.logo) {
        poLogoImg.src = invoiceData.sender.logo;
        poLogoContainer.classList.remove('hidden');
      } else {
        poLogoContainer.classList.add('hidden');
      }
    }

    // PO Meta
    setPreviewText('pv-po-number', poData.poNumber || 'PO-001');
    setPreviewText('pv-po-order-date', formatDate(poData.orderDate));
    setPreviewText('pv-po-delivery-date', formatDate(poData.deliveryDate) || 'Immediate');

    // PO Status Stamp
    const poStamp = document.getElementById('pv-po-status-stamp');
    if (poStamp) {
      poStamp.textContent = poData.status.toUpperCase();
      poStamp.className = 'mt-3 px-3 py-0.5 rounded-full border text-[11px] font-black uppercase tracking-wider ';
      
      const poStampStyles = {
        Draft: 'border-slate-400 bg-slate-50 text-slate-700',
        Sent: 'border-sky-500 bg-sky-50 text-sky-700',
        Approved: 'border-emerald-500 bg-emerald-50 text-emerald-700',
        Received: 'border-indigo-500 bg-indigo-50 text-indigo-700',
        Closed: 'border-teal-500 bg-teal-50 text-teal-700',
        Cancelled: 'border-rose-500 bg-rose-50 text-rose-700'
      };
      poStamp.className += poStampStyles[poData.status] || poStampStyles.Sent;
    }

    // Vendor info in PO
    setPreviewText('pv-po-vendor-name', poData.vendor.name || 'Vendor Name');
    const pvPoVenComp = document.getElementById('pv-po-vendor-company');
    if (pvPoVenComp) {
      pvPoVenComp.textContent = poData.vendor.company || '';
      pvPoVenComp.style.display = poData.vendor.company ? 'block' : 'none';
    }

    setPreviewText('pv-po-vendor-address', poData.vendor.address || 'Vendor Address, City, State');
    const venContactParts = [poData.vendor.email, poData.vendor.phone].filter(Boolean);
    setPreviewText('pv-po-vendor-contact', venContactParts.join(' | ') || '');

    const pvPoVenTax = document.getElementById('pv-po-vendor-tax');
    if (pvPoVenTax) {
      if (poData.vendor.taxId) {
        pvPoVenTax.textContent = `GSTIN: ${poData.vendor.taxId.toUpperCase()}`;
        pvPoVenTax.style.display = 'block';
      } else {
        pvPoVenTax.style.display = 'none';
      }
    }

    // Delivery destination & Payment terms
    setPreviewText('pv-po-delivery-address', poData.deliveryAddress || invoiceData.sender.address || 'Company Headquarters');
    setPreviewText('pv-po-payment-terms', poData.paymentTerms || 'Net 30 Days');

    // PO Line Items
    const tbody = document.getElementById('pv-po-line-items-body');
    if (tbody) {
      tbody.innerHTML = '';
      if (poData.items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="py-6 text-center text-slate-400 italic">No items added to this PO</td>
          </tr>
        `;
      } else {
        poData.items.forEach((item, idx) => {
          const c = InvoxCalc.calculateLineItem(item);
          const tr = document.createElement('tr');
          tr.className = 'border-b border-slate-100 hover:bg-slate-50/50';

          const discStr = c.discountAmount > 0 
            ? (item.discountType === '%' ? `${item.discountValue}%` : InvoxCalc.formatCurrency(c.discountAmount, poData.currency)) 
            : '-';

          const taxStr = c.taxRate > 0 ? `${c.taxRate}%` : '-';

          tr.innerHTML = `
            <td class="py-3 px-3 font-mono text-slate-400">${idx + 1}</td>
            <td class="py-3 px-3">
              <span class="font-semibold text-slate-800 block">${escapeHtml(item.description || 'Item Description')}</span>
            </td>
            <td class="py-3 px-2 text-right font-mono text-slate-700">${item.quantity}</td>
            <td class="py-3 px-3 text-right font-mono text-slate-700">${InvoxCalc.formatCurrency(item.rate, poData.currency)}</td>
            <td class="py-3 px-2 text-right font-mono text-slate-500">${taxStr}</td>
            <td class="py-3 px-2 text-right font-mono text-emerald-600">${discStr}</td>
            <td class="py-3 px-3 text-right font-mono font-bold text-slate-900">${InvoxCalc.formatCurrency(c.total, poData.currency)}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    // Totals
    setPreviewText('pv-po-items-subtotal', InvoxCalc.formatCurrency(totals.itemsSubtotal, poData.currency));

    const poDiscRow = document.getElementById('pv-po-item-discount-row');
    if (poDiscRow) {
      if (totals.totalItemDiscounts > 0) {
        poDiscRow.classList.remove('hidden');
        setPreviewText('pv-po-items-discount', `-${InvoxCalc.formatCurrency(totals.totalItemDiscounts, poData.currency)}`);
      } else {
        poDiscRow.classList.add('hidden');
      }
    }

    const poExtraDiscRow = document.getElementById('pv-po-extra-discount-row');
    if (poExtraDiscRow) {
      if (totals.overallDiscountAmount > 0) {
        poExtraDiscRow.classList.remove('hidden');
        setPreviewText('pv-po-extra-discount', `-${InvoxCalc.formatCurrency(totals.overallDiscountAmount, poData.currency)}`);
      } else {
        poExtraDiscRow.classList.add('hidden');
      }
    }

    const poTaxContainer = document.getElementById('pv-po-tax-breakdown-container');
    if (poTaxContainer) {
      poTaxContainer.innerHTML = '';
      if (totals.taxSlabs.length === 0) {
        poTaxContainer.innerHTML = `
          <div class="flex justify-between py-0.5 text-slate-400">
            <span>Tax (0%):</span>
            <span class="font-mono">${InvoxCalc.formatCurrency(0, poData.currency)}</span>
          </div>
        `;
      } else {
        totals.taxSlabs.forEach(slab => {
          if (poData.taxType === 'intra') {
            const halfRate = slab.rate / 2;
            const halfTax = slab.taxAmount / 2;
            poTaxContainer.innerHTML += `
              <div class="flex justify-between py-0.5">
                <span class="text-slate-600">CGST (${halfRate}%):</span>
                <span class="font-mono text-slate-800">${InvoxCalc.formatCurrency(halfTax, poData.currency)}</span>
              </div>
              <div class="flex justify-between py-0.5">
                <span class="text-slate-600">SGST (${halfRate}%):</span>
                <span class="font-mono text-slate-800">${InvoxCalc.formatCurrency(halfTax, poData.currency)}</span>
              </div>
            `;
          } else if (poData.taxType === 'inter') {
            poTaxContainer.innerHTML += `
              <div class="flex justify-between py-0.5">
                <span class="text-slate-600">IGST (${slab.rate}%):</span>
                <span class="font-mono text-slate-800">${InvoxCalc.formatCurrency(slab.taxAmount, poData.currency)}</span>
              </div>
            `;
          } else {
            poTaxContainer.innerHTML += `
              <div class="flex justify-between py-0.5">
                <span class="text-slate-600">Tax (${slab.rate}%):</span>
                <span class="font-mono text-slate-800">${InvoxCalc.formatCurrency(slab.taxAmount, poData.currency)}</span>
              </div>
            `;
          }
        });
      }
    }

    const poShippingRow = document.getElementById('pv-po-shipping-row');
    if (poShippingRow) {
      if (totals.shipping > 0) {
        poShippingRow.classList.remove('hidden');
        setPreviewText('pv-po-shipping-amount', InvoxCalc.formatCurrency(totals.shipping, poData.currency));
      } else {
        poShippingRow.classList.add('hidden');
      }
    }

    const poRoundRow = document.getElementById('pv-po-roundoff-row');
    if (poRoundRow) {
      if (totals.roundOff !== 0) {
        poRoundRow.classList.remove('hidden');
        const sign = totals.roundOff > 0 ? '+' : '';
        setPreviewText('pv-po-roundoff-amount', `${sign}${InvoxCalc.formatCurrency(totals.roundOff, poData.currency)}`);
      } else {
        poRoundRow.classList.add('hidden');
      }
    }

    setPreviewText('pv-po-grand-total', InvoxCalc.formatCurrency(totals.grandTotal, poData.currency));
    setPreviewText('pv-po-amount-in-words', InvoxCalc.amountToWords(totals.grandTotal, poData.currency));

    setPreviewText('pv-po-notes-text', poData.notes || 'No special shipping notes provided.');
    setPreviewText('pv-po-terms-text', poData.terms || 'Standard procurement terms apply.');
    setPreviewText('pv-po-signatory-name', poData.signatoryName || 'Procurement Officer');
  }

  // --- INVOICE DIRECTORY / LIST PAGE ---
  function renderInvoiceTable(searchTerm = '') {
    const tbody = document.getElementById('invoice-table-body');
    if (!tbody) return;

    const invoices = InvoxStorage.getInvoices();
    const term = (searchTerm || '').toLowerCase();

    // Calculate status counts
    const counts = { All: invoices.length, Draft: 0, Pending: 0, Sent: 0, Paid: 0, Overdue: 0, Cancelled: 0 };
    invoices.forEach(inv => {
      if (counts[inv.status] !== undefined) counts[inv.status]++;
    });

    setPreviewText('inv-count-all', counts.All);
    setPreviewText('inv-count-draft', counts.Draft);
    setPreviewText('inv-count-pending', counts.Pending);
    setPreviewText('inv-count-sent', counts.Sent);
    setPreviewText('inv-count-paid', counts.Paid);
    setPreviewText('inv-count-overdue', counts.Overdue);
    setPreviewText('inv-count-cancelled', counts.Cancelled);

    const invTotalBadge = document.getElementById('invoice-total-badge');
    if (invTotalBadge) invTotalBadge.textContent = `${invoices.length} Invoices`;

    // Also update nav badges
    const badgeInvCount = document.getElementById('badge-invoice-count');
    if (badgeInvCount) badgeInvCount.textContent = invoices.length;
    const badgeNavInvCount = document.getElementById('badge-nav-invoice-count');
    if (badgeNavInvCount) badgeNavInvCount.textContent = invoices.length;

    // Filter by search & active status
    const filtered = invoices.filter(inv => {
      const matchStatus = currentInvoiceStatusFilter === 'All' || inv.status === currentInvoiceStatusFilter;
      const matchSearch = !term ||
        (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(term)) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(term)) ||
        (inv.data?.client?.email && inv.data.client.email.toLowerCase().includes(term));
      return matchStatus && matchSearch;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-500">
            <div class="flex flex-col items-center justify-center gap-2">
              <i data-lucide="file-search" class="w-8 h-8 text-slate-600"></i>
              <p class="text-sm font-semibold">${invoices.length === 0 ? 'No invoices created yet.' : 'No invoices match your filter criteria.'}</p>
              ${invoices.length === 0 ? `
                <div class="flex items-center gap-2 mt-2">
                  <button type="button" class="btn-table-create-inv px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition">Create First Invoice</button>
                  <button type="button" class="btn-table-sample-inv px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Load Sample Invoice</button>
                </div>
              ` : ''}
            </div>
          </td>
        </tr>
      `;

      tbody.querySelector('.btn-table-create-inv')?.addEventListener('click', () => switchInvoiceView('editor'));
      tbody.querySelector('.btn-table-sample-inv')?.addEventListener('click', () => {
        loadSampleData();
        switchInvoiceView('editor');
      });
      lucide.createIcons();
      return;
    }

    filtered.forEach(inv => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-950/40 transition border-b border-slate-800/40';

      const statusBadgeStyles = {
        Draft: 'bg-slate-700/40 text-slate-300 border-slate-600',
        Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        Sent: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        Paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        Overdue: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        Cancelled: 'bg-slate-700/40 text-slate-400 border-slate-600'
      };

      const clientCompany = inv.data?.client?.company || '';

      tr.innerHTML = `
        <td class="py-3.5 px-4 font-mono">
          <span class="font-bold text-white text-xs block">${escapeHtml(inv.invoiceNumber)}</span>
          <span class="text-[11px] text-slate-400 font-sans">${formatDate(inv.issueDate)}</span>
        </td>
        <td class="py-3.5 px-4">
          <span class="font-semibold text-slate-200 block text-xs">${escapeHtml(inv.clientName)}</span>
          ${clientCompany ? `<span class="text-[11px] text-slate-400">${escapeHtml(clientCompany)}</span>` : ''}
        </td>
        <td class="py-3.5 px-3 text-slate-300 text-xs font-mono">
          ${formatDate(inv.dueDate) || '<span class="text-slate-500 italic">No due date</span>'}
        </td>
        <td class="py-3.5 px-4 text-right font-mono font-bold text-white text-xs">
          ${InvoxCalc.formatCurrency(inv.grandTotal, inv.currency)}
        </td>
        <td class="py-3.5 px-4">
          <select class="inv-status-inline-select invox-select !py-1 !px-2 !text-xs font-semibold ${statusBadgeStyles[inv.status] || ''}" data-inv-id="${inv.id}">
            <option value="Draft" ${inv.status === 'Draft' ? 'selected' : ''}>Draft</option>
            <option value="Pending" ${inv.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Sent" ${inv.status === 'Sent' ? 'selected' : ''}>Sent</option>
            <option value="Paid" ${inv.status === 'Paid' ? 'selected' : ''}>Paid</option>
            <option value="Overdue" ${inv.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
            <option value="Cancelled" ${inv.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <!-- Edit Invoice -->
            <button type="button" class="btn-edit-inv p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Edit Invoice">
              <i data-lucide="edit-3" class="w-4 h-4 text-indigo-400"></i>
            </button>

            <!-- Download PDF -->
            <button type="button" class="btn-pdf-inv p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Download PDF">
              <i data-lucide="download" class="w-4 h-4"></i>
            </button>

            <!-- Print -->
            <button type="button" class="btn-print-inv p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Print Invoice">
              <i data-lucide="printer" class="w-4 h-4"></i>
            </button>

            <!-- Delete Invoice -->
            <button type="button" class="btn-delete-inv p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition" title="Delete Invoice">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;

      // Status Change Listener
      tr.querySelector('.inv-status-inline-select')?.addEventListener('change', (e) => {
        const newStatus = e.target.value;
        InvoxStorage.updateInvoiceStatus(inv.id, newStatus);
        renderInvoiceTable(document.getElementById('invoice-search-input')?.value || '');
        updateBadges();
        showToast(`Invoice ${inv.invoiceNumber} status updated to ${newStatus}`, 'success');
      });

      // Edit Button
      tr.querySelector('.btn-edit-inv')?.addEventListener('click', () => {
        loadSpecificInvoice(inv.id);
        switchInvoiceView('editor');
      });

      // Download PDF Button
      tr.querySelector('.btn-pdf-inv')?.addEventListener('click', async () => {
        loadSpecificInvoice(inv.id);
        recalculateAndRenderPreview();
        showToast(`Generating PDF for ${inv.invoiceNumber}...`, 'info');
        await InvoxExporter.downloadPDF('invoice-preview-sheet', inv.invoiceNumber);
        showToast(`Downloaded ${inv.invoiceNumber}.pdf`, 'success');
      });

      // Print Button
      tr.querySelector('.btn-print-inv')?.addEventListener('click', () => {
        loadSpecificInvoice(inv.id);
        recalculateAndRenderPreview();
        setTimeout(() => handlePrint(), 300);
      });

      // Delete Button
      tr.querySelector('.btn-delete-inv')?.addEventListener('click', () => {
        if (confirm(`Delete Invoice ${inv.invoiceNumber}?`)) {
          InvoxStorage.deleteInvoice(inv.id);
          renderInvoiceTable(document.getElementById('invoice-search-input')?.value || '');
          updateBadges();
          showToast(`Invoice ${inv.invoiceNumber} deleted`, 'info');
        }
      });

      tbody.appendChild(tr);
    });

    lucide.createIcons();
  }

  // --- PURCHASE ORDER DIRECTORY / LIST PAGE ---
  function renderPOTable(searchTerm = '') {
    const tbody = document.getElementById('po-table-body');
    if (!tbody) return;

    const pos = InvoxStorage.getPurchaseOrders();
    const term = (searchTerm || '').toLowerCase();

    // Calculate status counts
    const counts = { All: pos.length, Draft: 0, Sent: 0, Approved: 0, Received: 0, Closed: 0, Cancelled: 0 };
    pos.forEach(p => {
      if (counts[p.status] !== undefined) counts[p.status]++;
    });

    setPreviewText('count-all', counts.All);
    setPreviewText('count-draft', counts.Draft);
    setPreviewText('count-sent', counts.Sent);
    setPreviewText('count-approved', counts.Approved);
    setPreviewText('count-received', counts.Received);
    setPreviewText('count-closed', counts.Closed);
    setPreviewText('count-cancelled', counts.Cancelled);

    const poTotalBadge = document.getElementById('po-total-badge');
    if (poTotalBadge) poTotalBadge.textContent = `${pos.length} Orders`;

    // Filter by search & active status
    const filtered = pos.filter(p => {
      const matchStatus = currentPOStatusFilter === 'All' || p.status === currentPOStatusFilter;
      const matchSearch = !term ||
        (p.poNumber && p.poNumber.toLowerCase().includes(term)) ||
        (p.vendorName && p.vendorName.toLowerCase().includes(term)) ||
        (p.vendorCompany && p.vendorCompany.toLowerCase().includes(term));
      return matchStatus && matchSearch;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-500">
            <div class="flex flex-col items-center justify-center gap-2">
              <i data-lucide="package-search" class="w-8 h-8 text-slate-600"></i>
              <p class="text-sm font-semibold">${pos.length === 0 ? 'No purchase orders created yet.' : 'No purchase orders match your filter criteria.'}</p>
              ${pos.length === 0 ? `
                <div class="flex items-center gap-2 mt-2">
                  <button type="button" class="btn-table-create-po px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition">Create First PO</button>
                  <button type="button" class="btn-table-sample-po px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Load Sample PO</button>
                </div>
              ` : ''}
            </div>
          </td>
        </tr>
      `;

      tbody.querySelector('.btn-table-create-po')?.addEventListener('click', () => switchPOView('editor'));
      tbody.querySelector('.btn-table-sample-po')?.addEventListener('click', loadSamplePO);
      lucide.createIcons();
      return;
    }

    filtered.forEach(po => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-950/40 transition border-b border-slate-800/40';

      const statusBadgeStyles = {
        Draft: 'bg-slate-700/40 text-slate-300 border-slate-600',
        Sent: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        Approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        Received: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
        Closed: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
        Cancelled: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };

      tr.innerHTML = `
        <td class="py-3.5 px-4 font-mono">
          <span class="font-bold text-white text-xs block">${escapeHtml(po.poNumber)}</span>
          <span class="text-[11px] text-slate-400 font-sans">${formatDate(po.orderDate)}</span>
        </td>
        <td class="py-3.5 px-4">
          <span class="font-semibold text-slate-200 block text-xs">${escapeHtml(po.vendorName)}</span>
          ${po.vendorCompany ? `<span class="text-[11px] text-slate-400">${escapeHtml(po.vendorCompany)}</span>` : ''}
        </td>
        <td class="py-3.5 px-3 text-slate-300 text-xs font-mono">
          ${formatDate(po.deliveryDate) || '<span class="text-slate-500 italic">Immediate</span>'}
        </td>
        <td class="py-3.5 px-4 text-right font-mono font-bold text-white text-xs">
          ${InvoxCalc.formatCurrency(po.grandTotal, po.currency)}
        </td>
        <td class="py-3.5 px-4">
          <select class="po-status-inline-select invox-select !py-1 !px-2 !text-xs font-semibold ${statusBadgeStyles[po.status] || ''}" data-po-id="${po.id}">
            <option value="Draft" ${po.status === 'Draft' ? 'selected' : ''}>Draft</option>
            <option value="Sent" ${po.status === 'Sent' ? 'selected' : ''}>Sent</option>
            <option value="Approved" ${po.status === 'Approved' ? 'selected' : ''}>Approved</option>
            <option value="Received" ${po.status === 'Received' ? 'selected' : ''}>Received</option>
            <option value="Closed" ${po.status === 'Closed' ? 'selected' : ''}>Closed</option>
            <option value="Cancelled" ${po.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td class="py-3.5 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <!-- Edit PO -->
            <button type="button" class="btn-edit-po p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Edit PO">
              <i data-lucide="edit-3" class="w-4 h-4 text-sky-400"></i>
            </button>

            <!-- Convert to Invoice -->
            <button type="button" class="btn-convert-po px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 hover:border-indigo-500 text-indigo-300 hover:text-white transition flex items-center gap-1 shadow-sm" title="Convert this Purchase Order into an Invoice">
              <i data-lucide="arrow-right-left" class="w-3 h-3"></i>
              <span>Invoice</span>
            </button>

            <!-- Download PDF -->
            <button type="button" class="btn-pdf-po p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition" title="Download PDF">
              <i data-lucide="download" class="w-4 h-4"></i>
            </button>

            <!-- Delete PO -->
            <button type="button" class="btn-delete-po p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition" title="Delete PO">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;

      // Status Change Listener
      tr.querySelector('.po-status-inline-select')?.addEventListener('change', (e) => {
        const newStatus = e.target.value;
        InvoxStorage.updatePOStatus(po.id, newStatus);
        renderPOTable(document.getElementById('po-search-input')?.value || '');
        updateBadges();
        showToast(`PO ${po.poNumber} status updated to ${newStatus}`, 'success');
      });

      // Edit Button
      tr.querySelector('.btn-edit-po')?.addEventListener('click', () => {
        loadSpecificPO(po.id);
        switchPOView('editor');
      });

      // Convert to Invoice Button
      tr.querySelector('.btn-convert-po')?.addEventListener('click', () => {
        convertPOToInvoice(po.id);
      });

      // Download PDF Button
      tr.querySelector('.btn-pdf-po')?.addEventListener('click', async () => {
        loadSpecificPO(po.id);
        recalculateAndRenderPOPreview();
        showToast(`Generating PDF for ${po.poNumber}...`, 'info');
        await InvoxExporter.downloadPDF('po-preview-sheet', po.poNumber);
        showToast(`Downloaded ${po.poNumber}.pdf`, 'success');
      });

      // Delete Button
      tr.querySelector('.btn-delete-po')?.addEventListener('click', () => {
        if (confirm(`Delete Purchase Order ${po.poNumber}?`)) {
          InvoxStorage.deletePurchaseOrder(po.id);
          renderPOTable(document.getElementById('po-search-input')?.value || '');
          updateBadges();
          showToast(`Purchase Order ${po.poNumber} deleted`, 'info');
        }
      });

      tbody.appendChild(tr);
    });

    lucide.createIcons();
  }

  // --- CONVERT PO TO INVOICE (KEY FEATURE) ---
  function convertPOToInvoice(poId) {
    const record = InvoxStorage.getPurchaseOrderById(poId);
    if (!record || !record.data) {
      showToast('Purchase Order record not found', 'error');
      return;
    }

    const po = record.data;

    // Build new Invoice from PO
    invoiceData = {
      id: null,
      theme: po.theme || 'indigo',
      currency: po.currency || 'INR',
      sender: { ...invoiceData.sender },
      client: {
        id: po.vendor?.id || null,
        name: po.vendor?.name || 'Vendor Client',
        company: po.vendor?.company || '',
        email: po.vendor?.email || '',
        phone: po.vendor?.phone || '',
        billingAddress: po.vendor?.address || '',
        shippingAddress: po.deliveryAddress || po.vendor?.address || '',
        sameAddress: false,
        taxId: po.vendor?.taxId || ''
      },
      invoiceNumber: generateSequentialInvoiceNumber(),
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: po.deliveryDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 15);
        return d.toISOString().split('T')[0];
      })(),
      poNumber: po.poNumber || '',
      sourcePoId: record.id,
      status: 'Pending',
      items: (po.items || []).map(item => ({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        taxRate: item.taxRate,
        discountValue: item.discountValue,
        discountType: item.discountType
      })),
      taxType: po.taxType || 'intra',
      extraDiscountValue: po.extraDiscountValue || 0,
      extraDiscountType: po.extraDiscountType || '%',
      shippingCharges: po.shippingCharges || 0,
      autoRoundOff: po.autoRoundOff !== undefined ? po.autoRoundOff : true,
      bank: { ...invoiceData.bank },
      notes: `Converted from Purchase Order ${po.poNumber}. Thank you for your business.`,
      terms: invoiceData.terms || 'Payment due within 15 days.',
      signatoryName: invoiceData.signatoryName || 'Authorized Signatory',
      signature: invoiceData.signature
    };

    // Switch to invoices module
    switchModule('invoices');
    switchInvoiceView('editor');
    syncFormInputsFromState();
    recalculateAndRenderPreview();
    scheduleDraftSave();

    showToast(`Converted PO ${po.poNumber} to new Invoice ${invoiceData.invoiceNumber}!`, 'success');
  }

  function convertQuotationToInvoice(quotationId) {
    const record = InvoxStorage.getQuotationById(quotationId);
    if (!record?.data || record.status !== 'Accepted') {
      showToast('Only accepted quotations can be converted to invoices.', 'error');
      return false;
    }

    if (record.invoiceId) {
      const existingInvoice = InvoxStorage.getInvoiceById(record.invoiceId);
      if (existingInvoice) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        loadSpecificInvoice(existingInvoice.id);
        switchModule('invoices');
        switchInvoiceView('editor');
        showToast(`Quotation already converted to ${existingInvoice.invoiceNumber}.`, 'info');
        return true;
      }
    }

    const quotation = record.data;
    if (!quotation.client?.name || !Array.isArray(quotation.items) || quotation.items.length === 0) {
      showToast('This quotation is missing its client or line items and cannot be converted.', 'error');
      return false;
    }
    const today = new Date();
    const issueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 15);
    const dueDateString = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;

    invoiceData = {
      id: null,
      theme: invoiceData.theme || 'indigo',
      currency: quotation.currency || 'INR',
      sender: { ...invoiceData.sender },
      client: { ...quotation.client },
      invoiceNumber: generateSequentialInvoiceNumber(),
      issueDate,
      dueDate: dueDateString,
      poNumber: '',
      status: 'Pending',
      items: (quotation.items || []).map(item => ({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        taxRate: item.taxRate,
        discountValue: item.discountValue,
        discountType: item.discountType
      })),
      taxType: 'single',
      extraDiscountValue: 0,
      extraDiscountType: '%',
      shippingCharges: 0,
      autoRoundOff: false,
      bank: { ...invoiceData.bank },
      notes: [`Converted from quotation ${record.quotationNumber}.`, quotation.notes].filter(Boolean).join('\n'),
      terms: quotation.terms || '',
      signatoryName: invoiceData.signatoryName || 'Authorized Signatory',
      signature: invoiceData.signature || null,
      quotationId: record.id,
      quotationNumber: record.quotationNumber
    };
    invoiceData.totals = InvoxCalc.calculateInvoiceTotals(invoiceData);

    const savedInvoice = InvoxStorage.saveInvoice(invoiceData);
    if (!savedInvoice) {
      showToast('Could not save the invoice created from this quotation.', 'error');
      return false;
    }
    invoiceData.id = savedInvoice.id;

    const savedQuotation = InvoxStorage.saveQuotation({
      ...quotation,
      id: record.id,
      invoiceId: savedInvoice.id,
      linkedInvoiceNumber: savedInvoice.invoiceNumber
    });
    if (!savedQuotation) {
      InvoxStorage.deleteInvoice(savedInvoice.id);
      showToast('Could not link the invoice to its quotation.', 'error');
      return false;
    }

    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    switchModule('invoices');
    switchInvoiceView('editor');
    syncFormInputsFromState();
    recalculateAndRenderPreview();
    scheduleDraftSave();
    renderInvoiceTable();
    updateBadges();
    showToast(`Converted ${record.quotationNumber} to ${savedInvoice.invoiceNumber}.`, 'success');
    return true;
  }

  function loadSpecificPO(id) {
    const record = InvoxStorage.getPurchaseOrderById(id);
    if (!record || !record.data) return;

    poData = { ...record.data, id: record.id };
    syncPOFormInputsFromState();
    recalculateAndRenderPOPreview();
    showToast(`Loaded Purchase Order ${record.poNumber}`, 'success');
  }

  // --- SAVE PURCHASE ORDER ---
  function handleSavePO() {
    readPOFormInputsIntoState();

    if (!poData.vendor.name.trim()) {
      showToast('Please enter Vendor / Supplier Name', 'error');
      document.getElementById('po-vendor-name')?.focus();
      return;
    }

    if (!poData.items || poData.items.length === 0) {
      showToast('Please add at least one line item to this PO', 'error');
      return;
    }

    const saved = InvoxStorage.savePurchaseOrder(poData);
    if (saved) {
      poData.id = saved.id;
      updateBadges();
      renderPOTable();
      showToast(`Purchase Order ${saved.poNumber} saved successfully!`, 'success');
    }
  }

  function handleNewPO() {
    if (confirm('Create a new blank Purchase Order?')) {
      poData = {
        id: null,
        theme: poData.theme || 'indigo',
        currency: invoiceData.currency || 'INR',
        poNumber: generateSequentialPONumber(),
        orderDate: new Date().toISOString().split('T')[0],
        deliveryDate: '',
        paymentTerms: 'Net 30 Days after goods receipt and inspection',
        status: 'Draft',
        vendor: {
          id: null,
          name: '',
          company: '',
          email: '',
          phone: '',
          address: '',
          taxId: ''
        },
        deliveryAddress: invoiceData.sender.address || 'Company Headquarters',
        sameAsBusinessAddress: true,
        items: [
          {
            id: 'po_item_' + Date.now(),
            description: '',
            quantity: 1,
            rate: 0,
            taxRate: 18,
            discountValue: 0,
            discountType: '%'
          }
        ],
        taxType: 'intra',
        extraDiscountValue: 0,
        extraDiscountType: '%',
        shippingCharges: 0,
        autoRoundOff: true,
        notes: 'Please attach PO number on all shipping labels and delivery challans.',
        terms: '1. Goods are subject to inspection and approval upon delivery.\n2. Any damaged or defective items must be replaced by vendor immediately.',
        signatoryName: 'Procurement Officer'
      };

      const today = new Date();
      today.setDate(today.getDate() + 15);
      poData.deliveryDate = today.toISOString().split('T')[0];

      syncPOFormInputsFromState();
      recalculateAndRenderPOPreview();
      schedulePODraftSave();
      showToast('New Purchase Order initialized', 'success');
    }
  }

  function generateNextPONumber() {
    const nextNo = generateSequentialPONumber();
    poData.poNumber = nextNo;
    setValue('po-number', nextNo);
    recalculateAndRenderPOPreview();
    schedulePODraftSave();
    showToast(`PO # set to ${nextNo}`, 'info');
  }

  function generateSequentialPONumber() {
    const pos = InvoxStorage.getPurchaseOrders();
    const count = pos.length + 1;
    const year = new Date().getFullYear();
    const numStr = String(count).padStart(3, '0');
    return `PO-${year}-${numStr}`;
  }

  function applyPODeliveryPresetDays(days) {
    const orderVal = document.getElementById('po-order-date')?.value;
    const baseDate = orderVal ? new Date(orderVal) : new Date();
    
    baseDate.setDate(baseDate.getDate() + days);
    const dueStr = baseDate.toISOString().split('T')[0];

    poData.deliveryDate = dueStr;
    setValue('po-delivery-date', dueStr);
    recalculateAndRenderPOPreview();
    schedulePODraftSave();
  }

  // --- REUSABLE VENDORS SYSTEM ---
  function handleSaveCurrentVendor() {
    readPOFormInputsIntoState();
    if (!poData.vendor.name.trim()) {
      showToast('Please enter Vendor Name before saving', 'error');
      document.getElementById('po-vendor-name')?.focus();
      return;
    }

    const vendorRecord = {
      id: poData.vendor.id || null,
      name: poData.vendor.name,
      company: poData.vendor.company,
      email: poData.vendor.email,
      phone: poData.vendor.phone,
      address: poData.vendor.address,
      taxId: poData.vendor.taxId
    };

    const saved = InvoxStorage.saveVendor(vendorRecord);
    if (saved) {
      poData.vendor.id = saved.id;
      updateVendorDropdown();
      updateBadges();
      showToast(`Vendor "${saved.name}" saved to directory`, 'success');
    }
  }

  function updateVendorDropdown() {
    const select = document.getElementById('quick-select-vendor');
    if (!select) return;

    const vendors = InvoxStorage.getVendors();
    select.innerHTML = '<option value="">-- Load Saved Vendor --</option>';

    vendors.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.company ? `${v.name} (${v.company})` : v.name;
      select.appendChild(opt);
    });
  }

  function handleQuickVendorSelect(e) {
    const vendorId = e.target.value;
    if (!vendorId) return;

    const vendors = InvoxStorage.getVendors();
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      applyVendorData(vendor);
      showToast(`Loaded vendor: ${vendor.name}`, 'info');
    }
  }

  function applyVendorData(vendor) {
    poData.vendor = {
      id: vendor.id,
      name: vendor.name || '',
      company: vendor.company || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      taxId: vendor.taxId || ''
    };

    setValue('po-vendor-name', poData.vendor.name);
    setValue('po-vendor-company', poData.vendor.company);
    setValue('po-vendor-email', poData.vendor.email);
    setValue('po-vendor-phone', poData.vendor.phone);
    setValue('po-vendor-address', poData.vendor.address);
    setValue('po-vendor-tax-id', poData.vendor.taxId);

    recalculateAndRenderPOPreview();
    schedulePODraftSave();
  }

  function renderSavedVendorsList(searchTerm = '') {
    const listContainer = document.getElementById('saved-vendors-list');
    if (!listContainer) return;

    const vendors = InvoxStorage.getVendors();
    const term = (searchTerm || '').toLowerCase();
    const filtered = vendors.filter(v =>
      (v.name && v.name.toLowerCase().includes(term)) ||
      (v.company && v.company.toLowerCase().includes(term)) ||
      (v.email && v.email.toLowerCase().includes(term))
    );

    listContainer.innerHTML = '';

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="p-6 text-center text-slate-500 text-xs">
          ${term ? 'No vendors match your search' : 'No vendors saved yet.'}
        </div>
      `;
      return;
    }

    filtered.forEach(vendor => {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 transition hover:border-sky-500/50';

      card.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-xs font-bold text-white truncate">${escapeHtml(vendor.name)}</h4>
            ${vendor.company ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium truncate">${escapeHtml(vendor.company)}</span>` : ''}
          </div>
          <p class="text-[11px] text-slate-400 truncate mt-0.5">${escapeHtml(vendor.email || vendor.phone || vendor.address || 'No contact info')}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <button type="button" class="btn-use-vendor px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition">
            Use
          </button>
          <button type="button" class="btn-del-vendor p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition" title="Delete vendor">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;

      card.querySelector('.btn-use-vendor')?.addEventListener('click', () => {
        applyVendorData(vendor);
        closeModal();
        showToast(`Vendor applied: ${vendor.name}`, 'success');
      });

      card.querySelector('.btn-del-vendor')?.addEventListener('click', () => {
        if (confirm(`Delete vendor "${vendor.name}"?`)) {
          InvoxStorage.deleteVendor(vendor.id);
          renderSavedVendorsList(searchTerm);
          updateVendorDropdown();
          updateBadges();
          showToast('Vendor deleted', 'info');
        }
      });

      listContainer.appendChild(card);
    });

    lucide.createIcons();
  }

  // --- SAMPLE PO QUICK FILL ---
  function loadSamplePO() {
    poData = {
      id: null,
      theme: 'indigo',
      currency: 'INR',
      poNumber: 'PO-2026-0088',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 15);
        return d.toISOString().split('T')[0];
      })(),
      paymentTerms: 'Net 30 Days after equipment delivery and testing',
      status: 'Approved',
      vendor: {
        id: 'sample_ven_1',
        name: 'Suresh Raina',
        company: 'Apex Cloud Hardware & Technologies Pvt Ltd',
        email: 'sales@apexcloudhardware.in',
        phone: '+91 99000 11223',
        address: 'Hardware Park, Sector 4, Whitefield, Bengaluru, Karnataka 560066',
        taxId: '29AABCA9988C1Z4'
      },
      deliveryAddress: invoiceData.sender.address || 'Tower B, 4th Floor, Global Tech Village, Outer Ring Road, Bengaluru 560103',
      sameAsBusinessAddress: true,
      items: [
        {
          id: 'po_item_s1',
          description: 'Dell PowerEdge R750 2U Enterprise Rackmount Server (Dual Xeon Gold, 128GB RAM, 2x 960GB SSD)',
          quantity: 2,
          rate: 345000,
          taxRate: 18,
          discountValue: 5,
          discountType: '%'
        },
        {
          id: 'po_item_s2',
          description: 'Cisco Catalyst 9300 Series 48-Port PoE+ Managed Gigabit Switch',
          quantity: 3,
          rate: 115000,
          taxRate: 18,
          discountValue: 0,
          discountType: '%'
        },
        {
          id: 'po_item_s3',
          description: 'APC Smart-UPS On-Line 6kVA 230V Rackmount Uninterruptible Power Supply',
          quantity: 2,
          rate: 85000,
          taxRate: 18,
          discountValue: 0,
          discountType: '%'
        }
      ],
      taxType: 'intra',
      extraDiscountValue: 0,
      extraDiscountType: '%',
      shippingCharges: 4500,
      autoRoundOff: true,
      notes: 'All items must include manufacturer warranty certificates and serial number barcodes on delivery crates.',
      terms: '1. Inspection within 5 business days of delivery.\n2. Payment terms 30 days net from invoice date.\n3. Goods to be delivered to Server Room 4B.',
      signatoryName: 'Kavita Iyer (Head of Procurement)'
    };

    // Save vendor to directory for instant reusability
    InvoxStorage.saveVendor(poData.vendor);
    // Save PO
    InvoxStorage.savePurchaseOrder(poData);

    updateVendorDropdown();
    updateBadges();
    syncPOFormInputsFromState();
    recalculateAndRenderPOPreview();
    schedulePODraftSave();
    renderPOTable();
    switchPOView('editor');
    showToast('Loaded realistic sample Purchase Order!', 'success');
  }

  // --- PDF & PRINT FOR PO ---
  async function handleDownloadPOPDF() {
    readPOFormInputsIntoState();

    if (!poData.vendor.name.trim()) {
      showToast('Please enter Vendor Name before exporting', 'error');
      document.getElementById('po-vendor-name')?.focus();
      return;
    }

    showToast('Generating high-resolution PO PDF...', 'info');

    try {
      await InvoxExporter.downloadPDF('po-preview-sheet', poData.poNumber);
      showToast('PO PDF downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to download PDF. Opening print dialog...', 'error');
      window.print();
    }
  }

  function handlePrintPO() {
    readPOFormInputsIntoState();
    recalculateAndRenderPOPreview();
    InvoxExporter.print();
  }

  // --- PO THEMES & ZOOM ---
  function setPOTheme(themeName, shouldSave = true) {
    poData.theme = themeName;
    const sheet = document.getElementById('po-preview-sheet');
    if (sheet) sheet.setAttribute('data-theme', themeName);

    document.querySelectorAll('.po-theme-btn').forEach(btn => {
      if (btn.getAttribute('data-theme') === themeName) {
        btn.classList.add('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-slate-900');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-slate-900');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    if (shouldSave) schedulePODraftSave();
  }

  function changePOZoom(delta) {
    poZoomLevel = Math.max(0.4, Math.min(1.4, poZoomLevel + delta));
    applyPOZoom();
  }

  function resetPOZoom() {
    poZoomLevel = window.innerWidth < 1280 ? 0.75 : 0.85;
    applyPOZoom();
  }

  function applyPOZoom() {
    const sheet = document.getElementById('po-preview-sheet');
    const zoomText = document.getElementById('po-zoom-level-text');
    if (sheet) sheet.style.transform = `scale(${poZoomLevel})`;
    if (zoomText) zoomText.textContent = `${Math.round(poZoomLevel * 100)}%`;
  }

  // --- DRAFT AUTO-SAVE ---
  function scheduleDraftSave() {
    const statusText = document.getElementById('draft-status-text');
    if (statusText) statusText.textContent = 'Saving...';

    clearTimeout(saveDraftDebounceTimer);
    saveDraftDebounceTimer = setTimeout(() => {
      InvoxStorage.saveDraft(invoiceData);
      if (statusText) statusText.textContent = 'Auto-saved';
    }, 400);
  }

  function schedulePODraftSave() {
    const statusText = document.getElementById('po-draft-status-text');
    if (statusText) statusText.textContent = 'Saving...';

    clearTimeout(savePODraftDebounceTimer);
    savePODraftDebounceTimer = setTimeout(() => {
      InvoxStorage.savePODraft(poData);
      if (statusText) statusText.textContent = 'Auto-saved';
    }, 400);
  }

  // --- LOGO & SIGNATURE HANDLERS ---
  function handleLogoFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      invoiceData.sender.logo = event.target.result;
      updateLogoPreviewUI(invoiceData.sender.logo);
      recalculateAndRenderPreview();
      recalculateAndRenderPOPreview();
      scheduleDraftSave();
      showToast('Logo uploaded successfully', 'success');
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    invoiceData.sender.logo = null;
    const fileInput = document.getElementById('logo-file-input');
    if (fileInput) fileInput.value = '';
    updateLogoPreviewUI(null);
    recalculateAndRenderPreview();
    recalculateAndRenderPOPreview();
    scheduleDraftSave();
    showToast('Logo removed', 'info');
  }

  function updateLogoPreviewUI(dataUrl) {
    const placeholder = document.getElementById('logo-placeholder');
    const previewBox = document.getElementById('logo-preview-box');
    const previewImg = document.getElementById('logo-preview-img');

    if (dataUrl) {
      if (placeholder) placeholder.classList.add('hidden');
      if (previewBox) previewBox.classList.remove('hidden');
      if (previewImg) previewImg.src = dataUrl;
    } else {
      if (placeholder) placeholder.classList.remove('hidden');
      if (previewBox) previewBox.classList.add('hidden');
      if (previewImg) previewImg.src = '';
    }
  }

  function handleSignatureFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      invoiceData.signature = event.target.result;
      recalculateAndRenderPreview();
      scheduleDraftSave();
      showToast('Signature uploaded', 'success');
    };
    reader.readAsDataURL(file);
  }

  // --- SAVED BUSINESS PROFILE ---
  function handleSaveBusinessProfile() {
    readFormInputsIntoState();
    if (!invoiceData.sender.name.trim()) {
      showToast('Please enter Business Name before saving profile', 'error');
      document.getElementById('sender-name')?.focus();
      return;
    }

    const profile = {
      name: invoiceData.sender.name,
      email: invoiceData.sender.email,
      phone: invoiceData.sender.phone,
      address: invoiceData.sender.address,
      taxId: invoiceData.sender.taxId,
      website: invoiceData.sender.website,
      logo: invoiceData.sender.logo,
      bank: invoiceData.bank,
      signatoryName: invoiceData.signatoryName
    };

    InvoxStorage.saveBusinessProfile(profile);
    recalculateAndRenderPOPreview();
    showToast('Business profile saved as default!', 'success');
  }

  // --- SAVED CLIENTS SYSTEM ---
  function handleSaveCurrentClient() {
    readFormInputsIntoState();
    if (!invoiceData.client.name.trim()) {
      showToast('Please enter Client Name before saving', 'error');
      document.getElementById('client-name')?.focus();
      return;
    }

    const clientRecord = {
      id: invoiceData.client.id || null,
      name: invoiceData.client.name,
      company: invoiceData.client.company,
      email: invoiceData.client.email,
      phone: invoiceData.client.phone,
      billingAddress: invoiceData.client.billingAddress,
      shippingAddress: invoiceData.client.shippingAddress,
      taxId: invoiceData.client.taxId
    };

    const saved = InvoxStorage.saveClient(clientRecord);
    if (saved) {
      invoiceData.client.id = saved.id;
      updateClientDropdown();
      updateBadges();
      showToast(`Client "${saved.name}" saved to directory`, 'success');
    }
  }

  function updateClientDropdown() {
    const select = document.getElementById('quick-select-client');
    if (!select) return;

    const clients = InvoxStorage.getClients();
    select.innerHTML = '<option value="">-- Load Saved Client --</option>';

    clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.company ? `${c.name} (${c.company})` : c.name;
      select.appendChild(opt);
    });
  }

  function handleQuickClientSelect(e) {
    const clientId = e.target.value;
    if (!clientId) return;

    const clients = InvoxStorage.getClients();
    const client = clients.find(c => c.id === clientId);
    if (client) {
      applyClientData(client);
      showToast(`Loaded client: ${client.name}`, 'info');
    }
  }

  function applyClientData(client) {
    invoiceData.client = {
      ...invoiceData.client,
      id: client.id,
      name: client.name || '',
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      billingAddress: client.billingAddress || '',
      shippingAddress: client.shippingAddress || '',
      taxId: client.taxId || ''
    };

    setValue('client-name', invoiceData.client.name);
    setValue('client-company', invoiceData.client.company);
    setValue('client-email', invoiceData.client.email);
    setValue('client-phone', invoiceData.client.phone);
    setValue('client-billing-address', invoiceData.client.billingAddress);
    setValue('client-shipping-address', invoiceData.client.shippingAddress);
    setValue('client-tax-id', invoiceData.client.taxId);

    recalculateAndRenderPreview();
    scheduleDraftSave();
  }

  function handleSameAddressToggle() {
    const sameBox = document.getElementById('client-same-address');
    const shipInput = document.getElementById('client-shipping-address');
    if (!sameBox || !shipInput) return;

    if (sameBox.checked) {
      shipInput.classList.add('hidden');
      invoiceData.client.sameAddress = true;
      invoiceData.client.shippingAddress = invoiceData.client.billingAddress;
    } else {
      shipInput.classList.remove('hidden');
      invoiceData.client.sameAddress = false;
    }
    recalculateAndRenderPreview();
    scheduleDraftSave();
  }

  function renderSavedClientsList(searchTerm = '') {
    const listContainer = document.getElementById('saved-clients-list');
    if (!listContainer) return;

    const clients = InvoxStorage.getClients();
    const term = (searchTerm || '').toLowerCase();
    const filtered = clients.filter(c => 
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.company && c.company.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    );

    listContainer.innerHTML = '';

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="p-6 text-center text-slate-500 text-xs">
          ${term ? 'No clients match your search' : 'No clients saved yet.'}
        </div>
      `;
      return;
    }

    filtered.forEach(client => {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 transition hover:border-indigo-500/50';

      card.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-xs font-bold text-white truncate">${escapeHtml(client.name)}</h4>
            ${client.company ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium truncate">${escapeHtml(client.company)}</span>` : ''}
          </div>
          <p class="text-[11px] text-slate-400 truncate mt-0.5">${escapeHtml(client.email || client.phone || client.billingAddress || 'No contact info')}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <button type="button" class="btn-use-client px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition">
            Use
          </button>
          <button type="button" class="btn-del-client p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition" title="Delete client">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;

      card.querySelector('.btn-use-client')?.addEventListener('click', () => {
        applyClientData(client);
        closeModal();
        showToast(`Client applied: ${client.name}`, 'success');
      });

      card.querySelector('.btn-del-client')?.addEventListener('click', () => {
        if (confirm(`Delete client "${client.name}"?`)) {
          InvoxStorage.deleteClient(client.id);
          renderSavedClientsList(searchTerm);
          updateClientDropdown();
          updateBadges();
          showToast('Client deleted', 'info');
        }
      });

      listContainer.appendChild(card);
    });

    lucide.createIcons();
  }

  // --- SAVED INVOICES SYSTEM ---
  function handleSaveInvoice() {
    readFormInputsIntoState();

    if (!invoiceData.sender.name.trim()) {
      showToast('Please enter your Business Name', 'error');
      document.getElementById('sender-name')?.focus();
      return;
    }

    if (!invoiceData.client.name.trim()) {
      showToast('Please enter Client Name', 'error');
      document.getElementById('client-name')?.focus();
      return;
    }

    if (!invoiceData.items || invoiceData.items.length === 0) {
      showToast('Please add at least one line item', 'error');
      return;
    }

    const saved = InvoxStorage.saveInvoice(invoiceData);
    if (saved) {
      invoiceData.id = saved.id;
      if (invoiceData.quotationId) {
        const quotation = InvoxStorage.getQuotationById(invoiceData.quotationId);
        if (quotation?.data) {
          InvoxStorage.saveQuotation({
            ...quotation.data,
            id: quotation.id,
            invoiceId: saved.id,
            linkedInvoiceNumber: saved.invoiceNumber
          });
        }
      }
      updateBadges();
      renderInvoiceTable();
      showToast(`Invoice ${saved.invoiceNumber} saved successfully!`, 'success');
    }
  }

  function renderSavedInvoicesList(searchTerm = '') {
    const container = document.getElementById('saved-invoices-list');
    if (!container) return;

    const invoices = InvoxStorage.getInvoices();
    const term = (searchTerm || '').toLowerCase();
    const filtered = invoices.filter(i => 
      (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(term)) ||
      (i.clientName && i.clientName.toLowerCase().includes(term))
    );

    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 text-xs">
          ${term ? 'No invoices match your search' : 'No invoices saved yet.'}
        </div>
      `;
      return;
    }

    filtered.forEach(inv => {
      const card = document.createElement('div');
      card.className = 'p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition hover:border-amber-500/50';

      const statusColors = {
        Paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        Draft: 'bg-slate-700/40 text-slate-300 border-slate-600',
        Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      };

      const badgeClass = statusColors[inv.status] || statusColors.Pending;

      card.innerHTML = `
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-white font-mono">${escapeHtml(inv.invoiceNumber)}</span>
            <span class="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase border ${badgeClass}">${inv.status}</span>
          </div>
          <p class="text-xs font-semibold text-slate-300 truncate mt-1">${escapeHtml(inv.clientName)}</p>
          <div class="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
            <span>Date: ${formatDate(inv.issueDate)}</span>
            <span>•</span>
            <span class="text-slate-200 font-bold">${InvoxCalc.formatCurrency(inv.grandTotal, inv.currency)}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-center">
          <button type="button" class="btn-load-inv px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition">
            Load
          </button>
          <button type="button" class="btn-del-inv p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition" title="Delete invoice">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;

      card.querySelector('.btn-load-inv')?.addEventListener('click', () => {
        loadSpecificInvoice(inv.id);
        closeModal();
      });

      card.querySelector('.btn-del-inv')?.addEventListener('click', () => {
        if (confirm(`Delete invoice ${inv.invoiceNumber}?`)) {
          InvoxStorage.deleteInvoice(inv.id);
          renderSavedInvoicesList(searchTerm);
          updateBadges();
          showToast('Invoice deleted', 'info');
        }
      });

      container.appendChild(card);
    });

    lucide.createIcons();
  }

  function loadSpecificInvoice(id) {
    const record = InvoxStorage.getInvoiceById(id);
    if (!record || !record.data) return;

    invoiceData = { ...record.data, id: record.id };
    syncFormInputsFromState();
    recalculateAndRenderPreview();
    showToast(`Loaded invoice ${record.invoiceNumber}`, 'success');
  }

  // --- NEW INVOICE & RESET ---
  function handleNewInvoice() {
    if (confirm('Create a new invoice? This will reset the current invoice fields.')) {
      const currentSender = { ...invoiceData.sender };
      const currentBank = { ...invoiceData.bank };
      const currentSignatory = invoiceData.signatoryName;

      invoiceData = {
        id: null,
        theme: invoiceData.theme || 'indigo',
        currency: invoiceData.currency || 'INR',
        sender: currentSender,
        client: {
          id: null,
          name: '',
          company: '',
          email: '',
          phone: '',
          billingAddress: '',
          shippingAddress: '',
          sameAddress: true,
          taxId: ''
        },
        invoiceNumber: generateSequentialInvoiceNumber(),
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        poNumber: '',
        status: 'Pending',
        items: [
          {
            id: 'item_' + Date.now(),
            description: '',
            quantity: 1,
            rate: 0,
            taxRate: 18,
            discountValue: 0,
            discountType: '%'
          }
        ],
        taxType: 'intra',
        extraDiscountValue: 0,
        extraDiscountType: '%',
        shippingCharges: 0,
        autoRoundOff: true,
        bank: currentBank,
        notes: 'Thank you for your business. We look forward to working together again!',
        terms: '1. Please pay within the specified due date.\n2. In case of delayed payment, interest may be applied.',
        signatoryName: currentSignatory,
        signature: null
      };

      initDefaultDates();
      syncFormInputsFromState();
      recalculateAndRenderPreview();
      scheduleDraftSave();
      showToast('New blank invoice ready', 'success');
      return true;
    }
    return false;
  }

  function generateNextInvoiceNumber() {
    const nextNo = generateSequentialInvoiceNumber();
    invoiceData.invoiceNumber = nextNo;
    setValue('invoice-number', nextNo);
    recalculateAndRenderPreview();
    scheduleDraftSave();
    showToast(`Invoice # set to ${nextNo}`, 'info');
  }

  function generateSequentialInvoiceNumber() {
    const invoices = InvoxStorage.getInvoices();
    const count = invoices.length + 1;
    const year = new Date().getFullYear();
    const numStr = String(count).padStart(3, '0');
    return `INV-${year}-${numStr}`;
  }

  function applyDuePresetDays(days) {
    const issueVal = document.getElementById('invoice-issue-date')?.value;
    const baseDate = issueVal ? new Date(issueVal) : new Date();
    
    baseDate.setDate(baseDate.getDate() + days);
    const dueStr = baseDate.toISOString().split('T')[0];

    invoiceData.dueDate = dueStr;
    setValue('invoice-due-date', dueStr);
    recalculateAndRenderPreview();
    scheduleDraftSave();
  }

  // --- SAMPLE INVOICE DATA ---
  function loadSampleData() {
    invoiceData = {
      id: null,
      theme: 'indigo',
      currency: 'INR',
      sender: {
        name: 'Apex Digital Labs LLP',
        email: 'billing@apexdigital.in',
        phone: '+91 98765 43210',
        address: 'Tower B, 4th Floor, Global Tech Village, Outer Ring Road, Bengaluru, Karnataka 560103',
        taxId: '29AABCA1234F1Z5',
        website: 'https://apexdigital.in',
        logo: null
      },
      client: {
        id: 'sample_cli_1',
        name: 'Vikram Malhotra',
        company: 'Quantum Innovations Pvt. Ltd.',
        email: 'vikram@quantuminno.com',
        phone: '+91 98111 22334',
        billingAddress: 'Plot 45, Silicon Enclave, Electronic City Phase 1, Bengaluru, Karnataka 560100',
        shippingAddress: 'Plot 45, Silicon Enclave, Electronic City Phase 1, Bengaluru, Karnataka 560100',
        sameAddress: true,
        taxId: '29AAACQ4567M1Z2'
      },
      invoiceNumber: 'INV-2026-0042',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 15);
        return d.toISOString().split('T')[0];
      })(),
      poNumber: 'PO-QI-2026-981',
      status: 'Pending',
      items: [
        {
          id: 'item_sample_1',
          description: 'Full-Stack Web App Development (Sprint 1-3 Deliverables)',
          quantity: 1,
          rate: 55000,
          taxRate: 18,
          discountValue: 5,
          discountType: '%'
        },
        {
          id: 'item_sample_2',
          description: 'UI/UX Design System, Wireframes & High-Fidelity Mobile Figma Prototypes',
          quantity: 1,
          rate: 22000,
          taxRate: 18,
          discountValue: 0,
          discountType: '%'
        },
        {
          id: 'item_sample_3',
          description: 'Cloud Infrastructure & Automated CI/CD Deployment Pipeline Setup',
          quantity: 1,
          rate: 12000,
          taxRate: 18,
          discountValue: 0,
          discountType: '%'
        }
      ],
      taxType: 'intra',
      extraDiscountValue: 0,
      extraDiscountType: '%',
      shippingCharges: 0,
      autoRoundOff: true,
      bank: {
        name: 'HDFC Bank Ltd.',
        accountName: 'Apex Digital Labs LLP',
        accountNumber: '50200045892134',
        ifsc: 'HDFC0001234',
        upiId: 'apexdigital@okaxis',
        showUpiQr: true
      },
      notes: 'Thank you for partnering with Apex Digital Labs. Please verify deliverables within 7 business days.',
      terms: '1. Payment is due within 15 days of invoice date.\n2. Overdue balances may incur a 1.5% late fee per month.\n3. All disputes are subject to Bengaluru jurisdiction.',
      signatoryName: 'Arjun Mehta (Director)',
      signature: null
    };

    syncFormInputsFromState();
    recalculateAndRenderPreview();
    scheduleDraftSave();
    showToast('Loaded realistic sample invoice data!', 'success');
  }

  // --- CURRENCY SELECTOR ---
  function handleCurrencyChange(e) {
    const newCurr = e.target.value;
    if (activeModule === 'quotations') {
      window.InvoxQuotations?.setCurrency(newCurr);
      showToast(`Currency set to ${InvoxCalc.CURRENCIES[newCurr]?.name || newCurr}`, 'info');
      return;
    }

    invoiceData.currency = newCurr;
    poData.currency = newCurr;

    renderLineItemRows();
    renderPOLineItemRows();
    recalculateAndRenderPreview();
    recalculateAndRenderPOPreview();
    renderPOTable();
    scheduleDraftSave();
    schedulePODraftSave();
    showToast(`Currency set to ${InvoxCalc.CURRENCIES[newCurr]?.name || newCurr}`, 'info');
  }

  // --- THEME PICKER ---
  function setTheme(themeName, shouldSave = true) {
    invoiceData.theme = themeName;
    const sheet = document.getElementById('invoice-preview-sheet');
    if (sheet) sheet.setAttribute('data-theme', themeName);

    document.querySelectorAll('.theme-btn').forEach(btn => {
      if (btn.getAttribute('data-theme') === themeName) {
        btn.classList.add('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-slate-900');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('ring-2', 'ring-white', 'ring-offset-2', 'ring-offset-slate-900');
        btn.setAttribute('aria-pressed', 'false');
      }
    });

    if (shouldSave) scheduleDraftSave();
  }

  // --- ZOOM CONTROLS ---
  function changeZoom(delta) {
    zoomLevel = Math.max(0.4, Math.min(1.4, zoomLevel + delta));
    applyZoom();
  }

  function resetZoom() {
    zoomLevel = window.innerWidth < 1280 ? 0.75 : 0.85;
    applyZoom();
  }

  function applyZoom() {
    const sheet = document.getElementById('invoice-preview-sheet');
    const zoomText = document.getElementById('zoom-level-text');
    if (sheet) sheet.style.transform = `scale(${zoomLevel})`;
    if (zoomText) zoomText.textContent = `${Math.round(zoomLevel * 100)}%`;
  }

  // --- MOBILE TABS ---
  function switchMobileTab(tab) {
    const editor = document.getElementById('editor-container');
    const preview = document.getElementById('preview-container');
    const poEditor = document.getElementById('po-editor-container');
    const poPreview = document.getElementById('po-preview-container');
    const btnEdit = document.getElementById('mobile-tab-edit');
    const btnPreview = document.getElementById('mobile-tab-preview');

    if (tab === 'edit') {
      if (activeModule === 'invoices') {
        editor?.classList.remove('hidden');
        preview?.classList.add('hidden');
        preview?.classList.remove('flex');
      } else {
        poEditor?.classList.remove('hidden');
        poPreview?.classList.add('hidden');
        poPreview?.classList.remove('flex');
      }
      btnEdit?.classList.add('bg-indigo-600', 'text-white');
      btnEdit?.classList.remove('text-slate-400');
      btnPreview?.classList.remove('bg-indigo-600', 'text-white');
      btnPreview?.classList.add('text-slate-400');
    } else {
      if (activeModule === 'invoices') {
        editor?.classList.add('hidden');
        preview?.classList.remove('hidden');
        preview?.classList.add('flex');
        resetZoom();
      } else {
        poEditor?.classList.add('hidden');
        poPreview?.classList.remove('hidden');
        poPreview?.classList.add('flex');
        resetPOZoom();
      }
      btnPreview?.classList.add('bg-indigo-600', 'text-white');
      btnPreview?.classList.remove('text-slate-400');
      btnEdit?.classList.remove('bg-indigo-600', 'text-white');
      btnEdit?.classList.add('text-slate-400');
    }
  }

  // --- EXPORT PDF & PRINT FOR INVOICES ---
  async function handleDownloadPDF() {
    readFormInputsIntoState();

    if (!invoiceData.sender.name.trim()) {
      showToast('Please enter Business Name before exporting', 'error');
      document.getElementById('sender-name')?.focus();
      return;
    }

    if (!invoiceData.client.name.trim()) {
      showToast('Please enter Client Name before exporting', 'error');
      document.getElementById('client-name')?.focus();
      return;
    }

    showToast('Generating high-resolution PDF...', 'info');

    try {
      await InvoxExporter.downloadPDF('invoice-preview-sheet', invoiceData.invoiceNumber);
      showToast('PDF downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to download PDF. Opening print dialog...', 'error');
      window.print();
    }
  }

  function handlePrint() {
    readFormInputsIntoState();
    recalculateAndRenderPreview();
    InvoxExporter.print();
  }

  // --- BACKUP IMPORT & EXPORT ---
  function handleExportBackup() {
    const json = InvoxStorage.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INVOX-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  }

  function handleImportBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const success = InvoxStorage.importAll(event.target.result);
      if (success) {
        updateBadges();
        updateClientDropdown();
        updateVendorDropdown();
        renderSavedInvoicesList();
        renderSavedClientsList();
        renderSavedVendorsList();
        renderPOTable();
        window.InvoxQuotations?.renderList();
        showToast('Backup imported successfully!', 'success');
      } else {
        showToast('Invalid backup JSON file', 'error');
      }
    };
    reader.readAsText(file);
  }

  // --- MODALS HELPER ---
  function openModal(modalId, onOpenCallback = null) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    if (onOpenCallback) onOpenCallback();
    lucide.createIcons();
  }

  function closeModal() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.classList.add('hidden');
    });
  }

  function updateBadges() {
    const clients = InvoxStorage.getClients();
    const vendors = InvoxStorage.getVendors();
    const invoices = InvoxStorage.getInvoices();
    const pos = InvoxStorage.getPurchaseOrders();
    const quotations = InvoxStorage.getQuotations();

    const clientBadge = document.getElementById('badge-client-count');
    if (clientBadge) clientBadge.textContent = clients.length;

    const vendorBadge = document.getElementById('badge-vendor-count');
    if (vendorBadge) vendorBadge.textContent = vendors.length;

    const invoiceBadge = document.getElementById('badge-invoice-count');
    if (invoiceBadge) invoiceBadge.textContent = invoices.length;

    const poBadge = document.getElementById('badge-po-count');
    if (poBadge) poBadge.textContent = pos.length;

    const navInvBadge = document.getElementById('badge-nav-invoice-count');
    if (navInvBadge) navInvBadge.textContent = invoices.length;

    const navPOBadge = document.getElementById('badge-nav-po-count');
    if (navPOBadge) navPOBadge.textContent = pos.length;

    const navQuotationBadge = document.getElementById('badge-nav-quotation-count');
    if (navQuotationBadge) navQuotationBadge.textContent = quotations.length;
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>',
      error: '<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400"></i>',
      info: '<i data-lucide="info" class="w-4 h-4 text-sky-400"></i>'
    };

    const typeClasses = {
      success: 'toast-success',
      error: 'toast-error',
      info: 'toast-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${typeClasses[type] || 'toast-info'}`;
    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="flex-1">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 3200);
  }

  function renderAll() {
    renderLineItemRows();
    renderPOLineItemRows();
    recalculateAndRenderPreview();
    recalculateAndRenderPOPreview();
  }

  function setPreviewText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  // Global app exposure
  window.InvoxApp = {
    invoiceData,
    poData,
    showToast,
    switchModule,
    switchInvoiceView,
    switchPOView,
    convertPOToInvoice,
    convertQuotationToInvoice,
    openClients: () => openModal('modal-clients', renderSavedClientsList),
    recalculateAndRenderPreview,
    recalculateAndRenderPOPreview,
    renderInvoiceTable,
    addItem,
    addPOItem,
    setTheme,
    setPOTheme
  };

})();
