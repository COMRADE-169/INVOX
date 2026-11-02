/**
 * INVOX - Firestore-backed storage with a user-scoped offline cache.
 */

const STORAGE_KEYS = {
  PROFILE: 'invox_business_profile',
  CLIENTS: 'invox_saved_clients',
  VENDORS: 'invox_saved_vendors',
  INVOICES: 'invox_saved_invoices',
  POS: 'invox_saved_purchase_orders',
  QUOTATIONS: 'invox_saved_quotations',
  DRAFT: 'invox_current_draft',
  PO_DRAFT: 'invox_po_draft',
  SETTINGS: 'invox_user_settings',
};
const firebase = window.firebase;

const InvoxStorage = {
  pendingWrites: new Set(),

  getUserScope() {
    return window.InvoxAuth?.getCurrentUser()?.uid || 'guest';
  },

  getKey(baseKey) {
    return `${baseKey}_${this.getUserScope()}`;
  },

  _getItem(baseKey) {
    return localStorage.getItem(this.getKey(baseKey));
  },

  _setItem(baseKey, value) {
    localStorage.setItem(this.getKey(baseKey), value);
  },

  _removeItem(baseKey) {
    localStorage.removeItem(this.getKey(baseKey));
  },

  _read(baseKey, fallback) {
    try {
      const value = this._getItem(baseKey);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(`Failed to read ${baseKey} from offline cache:`, error);
      return fallback;
    }
  },

  _write(baseKey, value) {
    this._setItem(baseKey, JSON.stringify(value));
  },

  _reportSyncError(error) {
    console.error('INVOX Firestore synchronization failed:', error);
    window.dispatchEvent(new CustomEvent('invox:api-error', { detail: { message: error.message } }));
  },

  _trackWrite(promise) {
    const tracked = promise.catch(error => {
      this._reportSyncError(error);
    }).finally(() => {
      this.pendingWrites.delete(tracked);
    });
    this.pendingWrites.add(tracked);
    return tracked;
  },

  _collection(name) {
    const user = window.InvoxAuth?.getCurrentUser();
    if (!user?.uid) throw new Error('You must be signed in to synchronize data.');
    return firebase.firestore().collection('users').doc(user.uid).collection(name);
  },

  _syncRecord(resource, record) {
    if (!record?.id) return;
    const collection = resource === 'purchase-orders' ? 'purchaseOrders' : resource;
    this._trackWrite(this._collection(collection).doc(record.id).set(record));
  },

  _deleteRecord(collection, id) {
    this._trackWrite(this._collection(collection).doc(id).delete());
  },

  async _flushQueue() {
    await Promise.all([...this.pendingWrites]);
  },

  async hydrate() {
    if (!window.InvoxAuth?.getCurrentUser()) return;
    const userRef = firebase.firestore().collection('users').doc(this.getUserScope());
    const [user, clients, vendors, invoices, purchaseOrders, quotations] = await Promise.all([
      userRef.get(),
      userRef.collection('clients').get(),
      userRef.collection('vendors').get(),
      userRef.collection('invoices').get(),
      userRef.collection('purchaseOrders').get(),
      userRef.collection('quotations').get()
    ]);
    const profile = user.exists ? user.data().businessProfile || null : null;
    this._write(STORAGE_KEYS.PROFILE, profile);
    this._write(STORAGE_KEYS.CLIENTS, clients.docs.map(doc => doc.data()));
    this._write(STORAGE_KEYS.VENDORS, vendors.docs.map(doc => doc.data()));
    this._write(STORAGE_KEYS.INVOICES, invoices.docs.map(doc => doc.data()));
    this._write(STORAGE_KEYS.POS, purchaseOrders.docs.map(doc => doc.data()));
    this._write(STORAGE_KEYS.QUOTATIONS, quotations.docs.map(doc => doc.data()));
    window.dispatchEvent(new CustomEvent('invox:storage-hydrated'));
  },

  async importLegacyUser(legacyUser) {
    if (!legacyUser?.uid || !legacyUser.email || !window.InvoxAuth?.getCurrentUser()) return false;
    if (legacyUser.email.toLowerCase() !== window.InvoxAuth.getCurrentUser().email.toLowerCase()) return false;
    const readLegacy = key => {
      try {
        const value = localStorage.getItem(`${key}_${legacyUser.uid}`);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error(`Failed to read legacy data ${key}:`, error);
        return null;
      }
    };
    const payload = {
      profile: readLegacy(STORAGE_KEYS.PROFILE) || legacyUser.businessProfile || null,
      clients: readLegacy(STORAGE_KEYS.CLIENTS) || [],
      vendors: readLegacy(STORAGE_KEYS.VENDORS) || [],
      invoices: readLegacy(STORAGE_KEYS.INVOICES) || [],
      purchaseOrders: readLegacy(STORAGE_KEYS.POS) || [],
      quotations: readLegacy(STORAGE_KEYS.QUOTATIONS) || []
    };
    this.saveBusinessProfile(payload.profile);
    ['clients', 'vendors', 'invoices', 'purchaseOrders', 'quotations'].forEach(collection => {
      (payload[collection] || []).forEach(record => this._syncRecord(collection, record));
    });
    await this._flushQueue();
    localStorage.removeItem('invox_auth_user_session');
    await this.hydrate();
    return true;
  },

  getBusinessProfile() {
    return this._read(STORAGE_KEYS.PROFILE, null) || window.InvoxAuth?.getCurrentUser()?.businessProfile || null;
  },

  saveBusinessProfile(profile) {
    try {
      this._write(STORAGE_KEYS.PROFILE, profile);
      if (window.InvoxAuth?.getCurrentUser()) {
        this._trackWrite(firebase.firestore().collection('users').doc(this.getUserScope())
          .set({ businessProfile: profile }, { merge: true }));
      }
      return true;
    } catch (error) {
      console.error('Failed to save business profile to offline cache:', error);
      return false;
    }
  },

  getClients() {
    return this._read(STORAGE_KEYS.CLIENTS, []);
  },

  saveClient(client) {
    try {
      const clients = this.getClients();
      const index = clients.findIndex(item =>
        (client.id && item.id === client.id) ||
        (client.name && item.name?.trim().toLowerCase() === client.name.trim().toLowerCase())
      );
      const record = {
        ...client,
        id: client.id || clients[index]?.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        updatedAt: new Date().toISOString()
      };
      if (index >= 0) clients[index] = { ...clients[index], ...record };
      else clients.unshift(record);
      this._write(STORAGE_KEYS.CLIENTS, clients);
      this._syncRecord('clients', record);
      return record;
    } catch (error) {
      console.error('Failed to save client to offline cache:', error);
      return null;
    }
  },

  deleteClient(id) {
    try {
      this._write(STORAGE_KEYS.CLIENTS, this.getClients().filter(client => client.id !== id));
      this._deleteRecord('clients', id);
      return true;
    } catch (error) {
      console.error('Failed to delete client from offline cache:', error);
      return false;
    }
  },

  getVendors() {
    return this._read(STORAGE_KEYS.VENDORS, []);
  },

  saveVendor(vendor) {
    try {
      const vendors = this.getVendors();
      const index = vendors.findIndex(item =>
        (vendor.id && item.id === vendor.id) ||
        (vendor.name && item.name?.trim().toLowerCase() === vendor.name.trim().toLowerCase())
      );
      const record = {
        ...vendor,
        id: vendor.id || vendors[index]?.id || `ven_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        updatedAt: new Date().toISOString()
      };
      if (index >= 0) vendors[index] = { ...vendors[index], ...record };
      else vendors.unshift(record);
      this._write(STORAGE_KEYS.VENDORS, vendors);
      this._syncRecord('vendors', record);
      return record;
    } catch (error) {
      console.error('Failed to save vendor to offline cache:', error);
      return null;
    }
  },

  deleteVendor(id) {
    try {
      this._write(STORAGE_KEYS.VENDORS, this.getVendors().filter(vendor => vendor.id !== id));
      this._deleteRecord('vendors', id);
      return true;
    } catch (error) {
      console.error('Failed to delete vendor from offline cache:', error);
      return false;
    }
  },

  getInvoices() {
    return this._read(STORAGE_KEYS.INVOICES, []);
  },

  getInvoiceById(id) {
    return this.getInvoices().find(invoice => invoice.id === id) || null;
  },

  saveInvoice(invoiceData) {
    try {
      const invoices = this.getInvoices();
      const index = invoices.findIndex(item =>
        item.id === invoiceData.id ||
        (item.invoiceNumber && item.invoiceNumber === invoiceData.invoiceNumber)
      );
      const id = invoiceData.id || invoices[index]?.id || `inv_${Date.now()}`;
      const record = {
        id,
        invoiceNumber: invoiceData.invoiceNumber || invoices[index]?.invoiceNumber || 'INV-001',
        clientName: invoiceData.client?.name || 'Unknown Client',
        quotationId: invoiceData.quotationId || null,
        quotationNumber: invoiceData.quotationNumber || null,
        issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoiceData.dueDate || '',
        currency: invoiceData.currency || 'INR',
        grandTotal: invoiceData.totals?.grandTotal || 0,
        status: invoiceData.status || 'Draft',
        updatedAt: new Date().toISOString(),
        data: invoiceData
      };
      if (index >= 0) invoices[index] = record;
      else invoices.unshift(record);
      this._write(STORAGE_KEYS.INVOICES, invoices);
      this._syncRecord('invoices', record);
      return record;
    } catch (error) {
      console.error('Failed to save invoice to offline cache:', error);
      return null;
    }
  },

  deleteInvoice(id) {
    try {
      this._write(STORAGE_KEYS.INVOICES, this.getInvoices().filter(invoice => invoice.id !== id));
      this._deleteRecord('invoices', id);
      return true;
    } catch (error) {
      console.error('Failed to delete invoice from offline cache:', error);
      return false;
    }
  },

  updateInvoiceStatus(id, newStatus) {
    const invoice = this.getInvoiceById(id);
    if (!invoice) return false;
    invoice.status = newStatus;
    if (invoice.data) invoice.data.status = newStatus;
    invoice.updatedAt = new Date().toISOString();
    this._write(STORAGE_KEYS.INVOICES, this.getInvoices());
    this._syncRecord('invoices', invoice);
    return true;
  },

  getQuotations() {
    const quotations = this._read(STORAGE_KEYS.QUOTATIONS, []);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let updated = false;
    quotations.forEach(quotation => {
      if (['Draft', 'Sent'].includes(quotation.status) && quotation.validUntil < today) {
        quotation.status = 'Expired';
        if (quotation.data) quotation.data.status = 'Expired';
        updated = true;
        this._syncRecord('quotations', quotation);
      }
    });
    if (updated) this._write(STORAGE_KEYS.QUOTATIONS, quotations);
    return quotations;
  },

  getQuotationById(id) {
    return this.getQuotations().find(quotation => quotation.id === id) || null;
  },

  saveQuotation(quotationData) {
    try {
      const quotations = this.getQuotations();
      const index = quotations.findIndex(item =>
        item.id === quotationData.id ||
        (item.quotationNumber && item.quotationNumber === quotationData.quotationNumber)
      );
      const id = quotationData.id || quotations[index]?.id || `qt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const data = { ...quotationData, id };
      const record = {
        id,
        quotationNumber: quotationData.quotationNumber,
        clientName: quotationData.client?.name || 'Unknown Client',
        quoteDate: quotationData.quoteDate,
        validUntil: quotationData.validUntil,
        currency: quotationData.currency || 'INR',
        grandTotal: quotationData.totals?.grandTotal || 0,
        status: quotationData.status || 'Draft',
        invoiceId: quotationData.invoiceId || null,
        updatedAt: new Date().toISOString(),
        data
      };
      if (index >= 0) quotations[index] = record;
      else quotations.unshift(record);
      this._write(STORAGE_KEYS.QUOTATIONS, quotations);
      this._syncRecord('quotations', record);
      return record;
    } catch (error) {
      console.error('Failed to save quotation to offline cache:', error);
      return null;
    }
  },

  updateQuotationStatus(id, newStatus) {
    const quotation = this.getQuotationById(id);
    if (!quotation) return false;
    quotation.status = newStatus;
    if (quotation.data) quotation.data.status = newStatus;
    quotation.updatedAt = new Date().toISOString();
    this._write(STORAGE_KEYS.QUOTATIONS, this.getQuotations());
    this._syncRecord('quotations', quotation);
    return true;
  },

  deleteQuotation(id) {
    try {
      this._write(STORAGE_KEYS.QUOTATIONS, this.getQuotations().filter(quotation => quotation.id !== id));
      this._deleteRecord('quotations', id);
      return true;
    } catch (error) {
      console.error('Failed to delete quotation from offline cache:', error);
      return false;
    }
  },

  getPurchaseOrders() {
    return this._read(STORAGE_KEYS.POS, []);
  },

  getPurchaseOrderById(id) {
    return this.getPurchaseOrders().find(order => order.id === id) || null;
  },

  savePurchaseOrder(poData) {
    try {
      const orders = this.getPurchaseOrders();
      const index = orders.findIndex(item =>
        item.id === poData.id || (item.poNumber && item.poNumber === poData.poNumber)
      );
      const id = poData.id || orders[index]?.id || `po_${Date.now()}`;
      const record = {
        id,
        poNumber: poData.poNumber || orders[index]?.poNumber || 'PO-001',
        vendorName: poData.vendor?.name || 'Unknown Vendor',
        vendorCompany: poData.vendor?.company || '',
        orderDate: poData.orderDate || new Date().toISOString().split('T')[0],
        deliveryDate: poData.deliveryDate || '',
        currency: poData.currency || 'INR',
        grandTotal: poData.totals?.grandTotal || 0,
        status: poData.status || 'Draft',
        updatedAt: new Date().toISOString(),
        data: poData
      };
      if (index >= 0) orders[index] = record;
      else orders.unshift(record);
      this._write(STORAGE_KEYS.POS, orders);
      this._syncRecord('purchase-orders', record);
      return record;
    } catch (error) {
      console.error('Failed to save purchase order to offline cache:', error);
      return null;
    }
  },

  updatePOStatus(id, newStatus) {
    const order = this.getPurchaseOrderById(id);
    if (!order) return false;
    order.status = newStatus;
    if (order.data) order.data.status = newStatus;
    order.updatedAt = new Date().toISOString();
    this._write(STORAGE_KEYS.POS, this.getPurchaseOrders());
    this._syncRecord('purchase-orders', order);
    return true;
  },

  deletePurchaseOrder(id) {
    try {
      this._write(STORAGE_KEYS.POS, this.getPurchaseOrders().filter(order => order.id !== id));
      this._deleteRecord('purchaseOrders', id);
      return true;
    } catch (error) {
      console.error('Failed to delete purchase order from offline cache:', error);
      return false;
    }
  },

  saveDraft(invoiceData) {
    try {
      this._write(STORAGE_KEYS.DRAFT, invoiceData);
      return true;
    } catch (error) {
      console.error('Failed to save invoice draft:', error);
      return false;
    }
  },

  getDraft() {
    return this._read(STORAGE_KEYS.DRAFT, null);
  },

  clearDraft() {
    try {
      this._removeItem(STORAGE_KEYS.DRAFT);
      return true;
    } catch (error) {
      console.error('Failed to clear invoice draft:', error);
      return false;
    }
  },

  savePODraft(poData) {
    try {
      this._write(STORAGE_KEYS.PO_DRAFT, poData);
      return true;
    } catch (error) {
      console.error('Failed to save purchase order draft:', error);
      return false;
    }
  },

  getPODraft() {
    return this._read(STORAGE_KEYS.PO_DRAFT, null);
  },

  clearPODraft() {
    try {
      this._removeItem(STORAGE_KEYS.PO_DRAFT);
      return true;
    } catch (error) {
      console.error('Failed to clear purchase order draft:', error);
      return false;
    }
  },

  exportAll() {
    return JSON.stringify({
      version: '2.0',
      userScope: this.getUserScope(),
      exportedAt: new Date().toISOString(),
      profile: this.getBusinessProfile(),
      clients: this.getClients(),
      vendors: this.getVendors(),
      invoices: this.getInvoices(),
      purchaseOrders: this.getPurchaseOrders(),
      quotations: this.getQuotations()
    }, null, 2);
  },

  importAll(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.profile) this.saveBusinessProfile(parsed.profile);
      if (Array.isArray(parsed.clients)) {
        this._write(STORAGE_KEYS.CLIENTS, parsed.clients);
        parsed.clients.forEach(record => this._syncRecord('clients', record));
      }
      if (Array.isArray(parsed.vendors)) {
        this._write(STORAGE_KEYS.VENDORS, parsed.vendors);
        parsed.vendors.forEach(record => this._syncRecord('vendors', record));
      }
      if (Array.isArray(parsed.invoices)) {
        this._write(STORAGE_KEYS.INVOICES, parsed.invoices);
        parsed.invoices.forEach(record => this._syncRecord('invoices', record));
      }
      if (Array.isArray(parsed.purchaseOrders)) {
        this._write(STORAGE_KEYS.POS, parsed.purchaseOrders);
        parsed.purchaseOrders.forEach(record => this._syncRecord('purchase-orders', record));
      }
      if (Array.isArray(parsed.quotations)) {
        this._write(STORAGE_KEYS.QUOTATIONS, parsed.quotations);
        parsed.quotations.forEach(record => this._syncRecord('quotations', record));
      }
      return true;
    } catch (error) {
      console.error('Invalid import data:', error);
      return false;
    }
  }
};

window.InvoxStorage = InvoxStorage;
window.dispatchEvent(new Event('invox:storage-ready'));
window.addEventListener('online', () => InvoxStorage._flushQueue());
window.addEventListener('invox:api-error', event => {
  const message = event.detail?.message || 'Could not synchronize data with the server.';
  window.InvoxApp?.showToast(message, 'error');
});
