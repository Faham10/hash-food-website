import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowDownUp, ArrowLeft, Check, ChevronDown, CircleDollarSign, Clock3, Eye, EyeOff, Flame, LayoutDashboard, LogOut, Menu, PackageCheck, Pencil, Plus, Printer, Save, Settings as SettingsIcon, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, formatMoney, jsonBody, ORDER_STATUSES } from '../lib/api.js';
import OrderStatusBadge from '../components/OrderStatusBadge.jsx';
import { getAllowedOrderStatuses } from '../lib/orderStatus.js';
import { useApp } from '../state/AppState.jsx';
import PageMotion from '../components/PageMotion.jsx';

const tabs = [
  { id: 'orders', label: 'Orders', icon: PackageCheck },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];
const blankMenu = { name: '', category: '', description: '', price: '', image: '', popular: false, active: true, options: null };
const baseSettings = { name: 'Hash Food', phone: '03142049022', address: 'Korangi No. 4, Kallu Chowk, Karachi', opening: '6:00 PM', closing: '3:00 AM', acceptOrders: 'true', deliveryAvailable: 'true' };

function useAdminSession() {
  const [session, setSession] = useState('checking');
  useEffect(() => {
    let mounted = true;
    api('/api/admin/session')
      .then((result) => { if (mounted) setSession(result.authenticated ? 'authenticated' : 'guest'); })
      .catch(() => { if (mounted) setSession('guest'); });
    return () => { mounted = false; };
  }, []);
  return session;
}

function ConfirmDialog({ open, title, children, confirmLabel, onCancel, onConfirm, busy = false }) {
  return <AnimatePresence>{open && <div className="modal-layer"><motion.button className="modal-backdrop" aria-label="Close dialog" onClick={onCancel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.section className="confirm-dialog panel-glass" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" initial={{ opacity: 0, scale: 0.95, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}><div className="confirm-icon"><Trash2 size={21} /></div><h2 id="confirm-title">{title}</h2><div className="confirm-copy">{children}</div><div className="confirm-actions"><button className="button button-outline" onClick={onCancel} disabled={busy}>Cancel</button><button className="button button-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button></div></motion.section></div>}</AnimatePresence>;
}

function OrderDetail({ order, onClose }) {
  return <AnimatePresence>{order && <div className="modal-layer"><motion.button className="modal-backdrop" aria-label="Close order detail" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.section className="detail-modal panel-glass" role="dialog" aria-modal="true" aria-labelledby="detail-title" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><div className="modal-heading"><div><span className="eyebrow">ORDER DETAILS</span><h2 id="detail-title">{order.id}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div><div className="detail-customer"><b>{order.customer}</b><span>{order.phone}</span><span>{order.address}</span><small>{order.type} · {order.paymentMethod} · {new Date(`${order.time}Z`).toLocaleString()}</small></div><div className="detail-items">{order.items.map((item, index) => <div className="summary-line" key={`${item.name}-${index}`}><span><b>{item.qty}×</b> {item.name}</span><strong>{formatMoney(item.price * item.qty)}</strong></div>)}</div><div className="price-row"><span>Subtotal</span><b>{formatMoney(order.subtotal)}</b></div><div className="price-row"><span>Delivery</span><b>{order.deliveryFee ? formatMoney(order.deliveryFee) : 'Free'}</b></div><div className="price-row total-row"><span>Total</span><b>{formatMoney(order.total)}</b></div>{order.instructions && <div className="detail-instructions"><span className="eyebrow">CUSTOMER NOTE</span><p>{order.instructions}</p></div>}</motion.section></div>}</AnimatePresence>;
}

function ReceiptPrint({ order, settings }) {
  if (!order) return null;
  return <div className="receipt-print-root" aria-hidden="true">
    <header className="receipt-heading">
      <img className="receipt-brand-logo" src="/hash-food-mark.png" alt="Hash Food logo" />
      <h1>{settings.name || 'Hash Food'}</h1>
      <p className="receipt-address">{settings.address || 'Korangi No. 4, Kallu Chowk, Karachi'}</p>
      <p>Tel: {settings.phone || '03142049022'}</p>
    </header>
    <div className="receipt-rule" />
    <div className="receipt-meta">
      <b>ORDER RECEIPT</b>
      <div><span>Order no.</span><strong>{order.id}</strong></div>
      <div><span>Date</span><strong>{new Date(`${order.time}Z`).toLocaleString()}</strong></div>
      <div><span>Order type</span><strong>{order.type}</strong></div>
      <div><span>Payment</span><strong>{order.paymentMethod}</strong></div>
      <div><span>Status</span><strong>{order.status}</strong></div>
    </div>
    <div className="receipt-rule" />
    <section className="receipt-customer">
      <b>CUSTOMER DETAILS</b>
      <strong>{order.customer}</strong>
      <span>Contact: {order.phone}</span>
      <span>Address: {order.address}</span>
      {order.instructions && <span>Order note: {order.instructions}</span>}
    </section>
    <div className="receipt-rule" />
    <div className="receipt-items">
      <div className="receipt-item receipt-item-heading"><b>Item</b><b>Qty</b><b>Price</b><b>Amount</b></div>
      {order.items.map((item, index) => <div className="receipt-item" key={`${item.name}-${index}`}>
        <span>{item.name}</span><span>{item.qty}</span><span>{formatMoney(item.price)}</span><span>{formatMoney(item.price * item.qty)}</span>
      </div>)}
    </div>
    <div className="receipt-rule" />
    <div className="receipt-total-line"><span>Subtotal</span><b>{formatMoney(order.subtotal)}</b></div>
    <div className="receipt-total-line"><span>Delivery fee</span><b>{order.deliveryFee ? formatMoney(order.deliveryFee) : 'Free'}</b></div>
    <div className="receipt-total-line receipt-grand-total"><span>Grand total</span><b>{formatMoney(order.total)}</b></div>
    <p className="receipt-thanks">Thank you for choosing {settings.name || 'Hash Food'}!</p>
    <p className="receipt-footer-contact">For help, call {settings.phone || '03142049022'}</p>
  </div>;
}

function OrdersPanel({ orders, onRefresh, onStatusChanged, toast, settings }) {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = orders.filter((order) => (filter === 'All' || order.status === filter) && `${order.id} ${order.customer} ${order.phone}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!printOrder) return undefined;
    const handleAfterPrint = () => setPrintOrder(null);
    window.addEventListener('afterprint', handleAfterPrint);
    const timer = window.setTimeout(() => window.print(), 100);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printOrder]);

  async function changeStatus(orderId, status) {
    try {
      await api(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: jsonBody({ status }) });
      onStatusChanged(orderId, status);
      toast(`Order ${orderId} is now ${status}.`, 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function clearCompleted() {
    setClearing(true);
    try {
      const result = await api('/api/admin/orders/completed', { method: 'DELETE' });
      toast(`${result.deleted} delivered, completed, or cancelled order(s) removed.`, 'success');
      setConfirmClear(false);
      onRefresh();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setClearing(false);
    }
  }

  return <section className="admin-content">
    <div className="admin-content-heading"><div><span className="eyebrow">YOUR KITCHEN, LIVE</span><h2>ORDER <span>BOARD</span></h2></div><button className="button button-outline" onClick={() => setConfirmClear(true)}><Trash2 size={15} /> Clear completed</button></div>
    <div className="admin-filter-bar"><div className="status-filters"><button className={filter === 'All' ? 'active' : ''} onClick={() => setFilter('All')}>All <b>{orders.length}</b></button>{ORDER_STATUSES.map((status) => <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status}</button>)}</div><input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order or customer" aria-label="Search orders" /></div>
    {!filtered.length ? <div className="admin-empty panel-glass"><PackageCheck size={29} /><h3>No orders in this view</h3><p>New orders will appear here automatically.</p></div> : <>
      <div className="orders-desktop panel-glass"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th><th className="order-action-heading">View</th><th className="order-action-heading">Print</th></tr></thead><tbody>{filtered.map((order) => <tr key={order.id}><td><button className="table-order-id" onClick={() => setSelected(order)}>{order.id}</button><small>{new Date(`${order.time}Z`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></td><td><b>{order.customer}</b><small>{order.phone}</small></td><td>{order.type}</td><td><b>{formatMoney(order.total)}</b></td><td><label className="status-select-wrap"><OrderStatusBadge status={order.status} /><select aria-label={`Change status for ${order.id}`} value={order.status} onChange={(event) => changeStatus(order.id, event.target.value)}>{getAllowedOrderStatuses(order.type, order.status).map((status) => <option key={status} value={status}>{status}</option>)}</select><ChevronDown size={13} /></label></td><td className="order-action-cell"><button className="icon-button small-icon-button" aria-label={`View ${order.id}`} onClick={() => setSelected(order)}><Eye size={16} /></button></td><td className="order-action-cell"><button className="button button-outline small-button receipt-print-button" aria-label={`Print receipt for ${order.id}`} onClick={() => setPrintOrder(order)}><Printer size={14} /> Print</button></td></tr>)}</tbody></table></div></div>
      <div className="orders-mobile">{filtered.map((order) => <article className="mobile-order-card panel-glass" key={order.id}><div className="row-between"><button className="table-order-id" onClick={() => setSelected(order)}>{order.id}</button><OrderStatusBadge status={order.status} /></div><b>{order.customer}</b><span>{order.phone} · {order.type}</span><div className="mobile-order-actions"><strong>{formatMoney(order.total)}</strong><button className="button button-outline small-button" onClick={() => setSelected(order)}><Eye size={14} /> Details</button><button className="button button-outline small-button receipt-print-button" aria-label={`Print receipt for ${order.id}`} onClick={() => setPrintOrder(order)}><Printer size={14} /> Print</button></div><select value={order.status} aria-label={`Change status for ${order.id}`} onChange={(event) => changeStatus(order.id, event.target.value)}>{getAllowedOrderStatuses(order.type, order.status).map((status) => <option key={status} value={status}>{status}</option>)}</select></article>)}</div>
    </>}
    <ConfirmDialog open={confirmClear} title="Clear completed orders?" confirmLabel="Delete orders" onCancel={() => setConfirmClear(false)} onConfirm={clearCompleted} busy={clearing}><p>This permanently deletes all <b>Delivered</b>, <b>Completed</b>, and <b>Cancelled</b> orders. This action cannot be undone.</p></ConfirmDialog>
    <OrderDetail order={selected} onClose={() => setSelected(null)} />
    <ReceiptPrint order={printOrder} settings={settings} />
  </section>;
}

function MenuPanel({ menu, categories, onRefresh, toast }) {
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [itemPendingDelete, setItemPendingDelete] = useState(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [draft, setDraft] = useState(blankMenu);
  const [saving, setSaving] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  function openForm(item = null) {
    setEditing(item);
    setEditorOpen(true);
    setDraft(item ? { name: item.name, category: item.category, description: item.description, price: item.price, image: item.image, popular: item.popular, active: item.active, options: item.options } : { ...blankMenu, category: categories[0]?.name ?? '' });
    setPreviewError(false);
  }

  function closeForm() {
    setEditorOpen(false);
    setEditing(null);
  }

  async function saveItem(event) {
    event.preventDefault();
    const price = Number(draft.price);
    if (!Number.isInteger(price) || price < 1 || price > 100000) {
      toast('Price must be an integer between Rs 1 and Rs 100,000.', 'error');
      return;
    }
    if (draft.options && (draft.options.items.length < 2 || draft.options.items.some((option) => !option.name.trim() || !Number.isInteger(Number(option.price)) || Number(option.price) < 1 || Number(option.price) > 100000))) {
      toast('Add at least two options and set a valid price for each.', 'error');
      return;
    }
    setSaving(true);
    const payload = { ...draft, price };
    try {
      await api(editing ? `/api/admin/menu/${editing.id}` : '/api/admin/menu', { method: editing ? 'PUT' : 'POST', body: jsonBody(payload) });
      toast(editing ? 'Menu item updated.' : 'New menu item added.', 'success');
      closeForm();
      onRefresh();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(event) {
    event.preventDefault();
    const name = categoryDraft.trim();
    if (name.length < 2) {
      toast('Category name must contain at least 2 characters.', 'error');
      return;
    }
    setSavingCategory(true);
    try {
      await api('/api/admin/menu/categories', { method: 'POST', body: jsonBody({ name }) });
      toast(`${name} category added.`, 'success');
      setCategoryDraft('');
      setCategoryEditorOpen(false);
      onRefresh();
    } catch (error) {
      const message = error.status === 404
        ? 'Category API is missing in the running backend. Stop and restart the app with npm run dev, then try again.'
        : error.message;
      toast(message, 'error');
    } finally {
      setSavingCategory(false);
    }
  }

  async function removeCategory(category) {
    try {
      await api(`/api/admin/menu/categories/${category.id}`, { method: 'DELETE' });
      toast(`${category.name} category removed.`, 'success');
      onRefresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function deleteItem() {
    if (!itemPendingDelete) return;
    setDeletingItem(true);
    try {
      await api(`/api/admin/menu/${itemPendingDelete.id}/permanent`, { method: 'DELETE' });
      toast(`${itemPendingDelete.name} permanently deleted.`, 'success');
      setItemPendingDelete(null);
      onRefresh();
    } catch (error) {
      const message = error.status === 404
        ? 'Delete API is missing in the running backend. Stop and restart the app with npm run dev, then try again.'
        : error.message;
      toast(message, 'error');
    } finally {
      setDeletingItem(false);
    }
  }

  async function toggle(item, key) {
    try {
      if (key === 'active' && item.active) {
        await api(`/api/admin/menu/${item.id}`, { method: 'DELETE' });
      } else {
        await api(`/api/admin/menu/${item.id}`, { method: 'PUT', body: jsonBody({ name: item.name, category: item.category, description: item.description, price: item.price, options: item.options, image: item.image, popular: key === 'popular' ? !item.popular : item.popular, active: key === 'active' ? true : item.active }) });
      }
      toast(key === 'active' ? item.active ? 'Item hidden from the storefront.' : 'Item shown on the storefront.' : 'Popular badge updated.', 'success');
      onRefresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function setOptionPreset(kind) {
    const presets = kind === 'pizza'
      ? { label: 'Size', items: ['Small', 'Medium', 'Large'].map((name) => ({ name, price: '' })) }
      : kind === 'broast'
        ? { label: 'Piece', items: ['Leg', 'Chest'].map((name) => ({ name, price: '' })) }
        : { label: 'Option', items: [{ name: '', price: '' }, { name: '', price: '' }] };
    setDraft((current) => ({ ...current, options: presets }));
  }

  function updateOption(index, key, value) {
    setDraft((current) => ({
      ...current,
      options: { ...current.options, items: current.options.items.map((option, optionIndex) => optionIndex === index ? { ...option, [key]: value } : option) },
    }));
  }

  const presetContext = `${draft.category} ${draft.name}`.toLowerCase();

  return <section className="admin-content">
    <div className="admin-content-heading"><div><span className="eyebrow">YOUR LINEUP</span><h2>MENU <span>STUDIO</span></h2></div><button type="button" className="button button-primary" onClick={() => openForm()}><Plus size={17} /> Add a dish</button></div>
    <section className="menu-category-manager panel-glass" aria-labelledby="menu-category-title">
      <div className="menu-category-manager-heading"><div><span className="eyebrow">ORGANIZE YOUR MENU</span><h3 id="menu-category-title">Product categories</h3></div><button type="button" className="button button-outline" onClick={() => setCategoryEditorOpen(true)}><Plus size={15} /> Add category</button></div>
      {categories.length ? <div className="menu-category-chips">{categories.map((category) => <div className="menu-category-chip" key={category.name}><span><b>{category.name}</b><small>{category.itemCount} {category.itemCount === 1 ? 'dish' : 'dishes'}</small></span><button type="button" aria-label={`Remove ${category.name} category`} title={category.itemCount ? 'Move dishes to another category before removing' : 'Remove category'} disabled={!category.id || category.itemCount > 0} onClick={() => removeCategory(category)}><Trash2 size={14} /></button></div>)}</div> : <p className="menu-category-empty">No categories yet. Add a category before creating your first dish.</p>}
    </section>
    <div className="menu-admin-grid">{menu.map((item) => <article className={`menu-admin-card panel-glass ${!item.active ? 'is-hidden' : ''}`} key={item.id}><div className="menu-admin-photo"><img src={item.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=70'; }} /><span className={`visibility-tag ${item.active ? 'visible' : ''}`}>{item.active ? <><Eye size={12} /> LIVE</> : <><EyeOff size={12} /> HIDDEN</>}</span></div><div className="menu-admin-copy"><span className="eyebrow">{item.category}{item.popular ? ' · POPULAR' : ''}</span><h3>{item.name}</h3><p>{item.description}</p><b>{item.options?.items?.length ? `From ${formatMoney(Math.min(...item.options.items.map((option) => option.price)))}` : formatMoney(item.price)}</b>{item.options?.items?.length > 0 && <small>{item.options.items.map((option) => `${option.name}: ${formatMoney(option.price)}`).join(' · ')}</small>}</div><div className="menu-admin-actions"><button className={`toggle-button ${item.popular ? 'toggle-on' : ''}`} onClick={() => toggle(item, 'popular')} title="Choose whether this dish appears in cart recommendations" aria-label={`${item.popular ? 'Remove' : 'Add'} ${item.name} ${item.popular ? 'from' : 'to'} cart recommendations`}><Flame size={15} /> Popular in cart</button><button className="icon-button" aria-label={`Edit ${item.name}`} onClick={() => openForm(item)}><Pencil size={16} /></button><button className="icon-button" aria-label={`${item.active ? 'Hide' : 'Show'} ${item.name}`} title={item.active ? 'Hide from storefront' : 'Show on storefront'} onClick={() => toggle(item, 'active')}>{item.active ? <EyeOff size={16} /> : <Eye size={16} />}</button><button className="icon-button menu-delete-button" aria-label={`Delete ${item.name}`} title="Delete dish" onClick={() => setItemPendingDelete(item)}><Trash2 size={16} /></button></div></article>)}</div>
    {!menu.length && <div className="admin-empty panel-glass"><UtensilsCrossed size={29} /><h3>Your menu is ready for a first dish</h3><button type="button" className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Add a dish</button></div>}
    <AnimatePresence>{editorOpen && <div className="modal-layer"><motion.button className="modal-backdrop" onClick={closeForm} aria-label="Close menu editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.form className="menu-editor panel-glass" onSubmit={saveItem} initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}><div className="modal-heading"><div><span className="eyebrow">MENU EDITOR</span><h2>{editing ? 'EDIT YOUR DISH' : 'ADD A DISH'}</h2></div><button type="button" className="icon-button" onClick={closeForm} aria-label="Close"><X /></button></div><div className="menu-preview">{draft.image && !previewError ? <img src={draft.image} alt="Menu image preview" onError={() => setPreviewError(true)} /> : <div className="preview-empty"><UtensilsCrossed size={22} /><span>Image preview</span></div>}<label className="preview-url">Image URL<input type="url" value={draft.image} onChange={(event) => { setPreviewError(false); setDraft({ ...draft, image: event.target.value }); }} placeholder="https://images.unsplash.com/…" required /></label></div><div className="form-grid"><label>Dish name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} minLength="2" maxLength="100" required /></label><label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label></div><label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} minLength="3" maxLength="300" rows="3" required /></label><label>Price in rupees<input type="number" min="1" max="100000" step="1" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} required /></label>
      <section className="admin-option-editor"><div className="row-between"><div><b>Customer options &amp; prices</b><p>Set prices for pizza sizes or broast pieces.</p></div>{draft.options && <button type="button" className="button button-outline small-button" onClick={() => setDraft((current) => ({ ...current, options: null }))}>Remove options</button>}</div>
        {draft.options ? <><label>Option prompt<input value={draft.options.label} onChange={(event) => setDraft((current) => ({ ...current, options: { ...current.options, label: event.target.value } }))} maxLength="40" placeholder="Size or piece" required /></label><div className="admin-option-rows">{draft.options.items.map((option, index) => <div className="admin-option-row" key={index}><label>Choice<input value={option.name} onChange={(event) => updateOption(index, 'name', event.target.value)} maxLength="40" placeholder="e.g. Medium" required /></label><label>Price (Rs)<input type="number" min="1" max="100000" step="1" value={option.price} onChange={(event) => updateOption(index, 'price', event.target.value)} required /></label><button type="button" className="icon-button" aria-label={`Remove option ${option.name || index + 1}`} onClick={() => setDraft((current) => ({ ...current, options: { ...current.options, items: current.options.items.filter((_, optionIndex) => optionIndex !== index) } }))}><X size={16} /></button></div>)}</div><button type="button" className="button button-outline small-button" disabled={draft.options.items.length >= 12} onClick={() => setDraft((current) => ({ ...current, options: { ...current.options, items: [...current.options.items, { name: '', price: '' }] } }))}><Plus size={14} /> Add choice</button></>
          : <div className="admin-option-presets">{presetContext.includes('pizza') && <button type="button" className="button button-outline small-button" onClick={() => setOptionPreset('pizza')}>Set Small / Medium / Large</button>}{presetContext.includes('broast') && <button type="button" className="button button-outline small-button" onClick={() => setOptionPreset('broast')}>Set Leg / Chest</button>}<button type="button" className="button button-outline small-button" onClick={() => setOptionPreset('custom')}><Plus size={14} /> Add custom options</button></div>}
      </section>
      <label className="check-control"><input type="checkbox" checked={draft.popular} onChange={(event) => setDraft({ ...draft, popular: event.target.checked })} /> Mark as a popular favourite</label><button className="button button-primary button-large full-width" disabled={saving || !categories.length}>{saving ? 'Saving…' : <><Save size={16} /> Save menu item</>}</button></motion.form></div>}</AnimatePresence>
    <AnimatePresence>{categoryEditorOpen && <div className="modal-layer"><motion.button className="modal-backdrop" onClick={() => setCategoryEditorOpen(false)} aria-label="Close category editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.form className="category-editor panel-glass" onSubmit={saveCategory} initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}><div className="modal-heading"><div><span className="eyebrow">MENU STUDIO</span><h2>ADD CATEGORY</h2></div><button type="button" className="icon-button" onClick={() => setCategoryEditorOpen(false)} aria-label="Close"><X /></button></div><p>Use categories to organize dishes. You can assign this category while adding a dish.</p><label>Category name<input autoFocus value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} minLength="2" maxLength="40" placeholder="e.g. Sandwiches" required /></label><button className="button button-primary button-large full-width" disabled={savingCategory}>{savingCategory ? 'Adding…' : <><Plus size={16} /> Add category</>}</button></motion.form></div>}</AnimatePresence>
    <ConfirmDialog open={Boolean(itemPendingDelete)} title={`Delete ${itemPendingDelete?.name}?`} confirmLabel="Delete dish" onCancel={() => setItemPendingDelete(null)} onConfirm={deleteItem} busy={deletingItem}><p>This permanently removes the dish from your menu. Existing orders will keep their saved item details.</p></ConfirmDialog>
  </section>;
}

function SettingsPanel({ toast }) {
  const [values, setValues] = useState(baseSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api('/api/settings')
      .then((result) => setValues((current) => ({ ...current, ...result })))
      .catch((error) => toast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/api/admin/settings', { method: 'PUT', body: jsonBody(values) });
      toast('Restaurant settings saved.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function field(name, value) { setValues((current) => ({ ...current, [name]: value })); }
  if (loading) return <div className="admin-empty panel-glass"><span className="loading-orbit" /></div>;
  return <section className="admin-content">
    <div className="admin-content-heading"><div><span className="eyebrow">THE HOUSE RULES</span><h2>STORE <span>SETTINGS</span></h2></div><span className="settings-saved"><Activity size={15} /> Connected to live store</span></div>
    <form className="settings-panel panel-glass" onSubmit={save}><div className="settings-section-heading"><div className="settings-section-icon"><SettingsIcon size={19} /></div><div><h3>Restaurant details</h3><p>These details appear on the storefront and customer order journey.</p></div></div><div className="form-grid"><label>Restaurant name<input value={values.name} onChange={(event) => field('name', event.target.value)} maxLength="300" /></label><label>Contact phone<input value={values.phone} onChange={(event) => field('phone', event.target.value)} maxLength="300" /></label></div><label>Restaurant address<input value={values.address} onChange={(event) => field('address', event.target.value)} maxLength="300" /></label><div className="form-grid"><label>Opening time<input value={values.opening} onChange={(event) => field('opening', event.target.value)} maxLength="300" /></label><label>Closing time<input value={values.closing} onChange={(event) => field('closing', event.target.value)} maxLength="300" /></label></div><div className="settings-section-heading settings-services-heading"><div className="settings-section-icon"><Clock3 size={19} /></div><div><h3>Service availability</h3><p>Switch services on or pause them on your public storefront.</p></div></div><label className="settings-toggle-row"><span><b>Accepting orders</b><small>When off, checkout is paused for customers.</small></span><input type="checkbox" checked={values.acceptOrders !== 'false'} onChange={(event) => field('acceptOrders', String(event.target.checked))} /><i /></label><label className="settings-toggle-row"><span><b>Delivery available</b><small>When off, customers can choose pickup or dine-in.</small></span><input type="checkbox" checked={values.deliveryAvailable !== 'false'} onChange={(event) => field('deliveryAvailable', String(event.target.checked))} /><i /></label><div className="settings-save-row"><span><Check size={14} /> Changes are saved to the live storefront.</span><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : <><Save size={16} /> Save settings</>}</button></div></form>
  </section>;
}

function AdminShell() {
  const navigate = useNavigate();
  const { toast, settings } = useApp();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const categoryApiWarningShown = useRef(false);
  const updateOrderStatus = useCallback((orderId, status) => {
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
  }, []);
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [nextOrders, nextMenu] = await Promise.all([api('/api/admin/orders'), api('/api/admin/menu')]);
      setOrders(nextOrders);
      setMenu(nextMenu);
      try {
        const nextCategories = await api('/api/admin/menu/categories');
        if (!Array.isArray(nextCategories)) throw new Error('Category API is not available');
        setCategories(nextCategories);
        categoryApiWarningShown.current = false;
      } catch (error) {
        if (error.status === 401) {
          navigate('/admin/login', { replace: true });
          return;
        }
        setCategories([...new Set(nextMenu.map((item) => item.category))].map((name) => ({
          id: null,
          name,
          itemCount: nextMenu.filter((item) => item.category === name).length,
        })));
        if (!categoryApiWarningShown.current) {
          const message = error.status === 404 || !error.status
            ? 'Category management API is unavailable. Restart the backend; existing dishes are still loaded.'
            : `Could not load categories: ${error.message}`;
          toast(message, 'error');
          categoryApiWarningShown.current = true;
        }
      }
    } catch (error) {
      if (error.status === 401) navigate('/admin/login', { replace: true });
      else toast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), 20000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function logout() {
    try {
      await api('/api/admin/logout', { method: 'POST' });
      navigate('/admin/login', { replace: true });
    } catch (error) {
      if (error.status === 401) navigate('/admin/login', { replace: true });
      else toast(error.message, 'error');
    }
  }

  const pending = orders.filter((order) => order.status === 'Pending').length;
  const sales = orders.filter((order) => order.status !== 'Cancelled').reduce((sum, order) => sum + Number(order.total), 0);
  const pageTitle = tabs.find((item) => item.id === tab)?.label;

  return <PageMotion className="admin-app">
    <aside className={`admin-sidebar ${mobileMenu ? 'sidebar-open' : ''}`}><div className="admin-sidebar-brand"><a className="brand" href="/"><span className="brand-mark"><img src="/hash-food-mark.png" alt="" /></span><span className="brand-name">HASH<span>FOOD</span></span></a><span className="admin-badge">CONTROL ROOM</span></div><nav className="admin-side-nav" aria-label="Admin navigation">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setMobileMenu(false); }}><Icon size={18} /><span>{label}</span>{id === 'orders' && pending > 0 && <b>{pending}</b>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-live"><span className="live-pulse" /><div><b>Kitchen is online</b><small>Live order updates</small></div></div><button className="logout-button" onClick={logout}><LogOut size={17} /> Sign out</button><a className="storefront-link" href="/"><ArrowLeft size={15} /> Back to storefront</a></div></aside>
    <div className="admin-main-area"><header className="admin-topbar"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Open navigation"><Menu /></button><div><span className="eyebrow">{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</span><h1>{pageTitle} <span>OVERVIEW</span></h1></div><div className="admin-topbar-right"><span className="topbar-live"><span className="live-pulse" /> LIVE</span><span className="admin-avatar">HF</span></div></header>
      <div className="admin-stats"><article className="admin-stat-card panel-glass"><span><PackageCheck size={17} /> Active orders</span><b>{orders.filter((order) => !['Delivered', 'Completed', 'Cancelled'].includes(order.status)).length}</b><small>{pending} need attention</small></article><article className="admin-stat-card panel-glass"><span><CircleDollarSign size={17} /> Order value</span><b>{formatMoney(sales)}</b><small>Across current orders</small></article><article className="admin-stat-card panel-glass"><span><UtensilsCrossed size={17} /> Menu items</span><b>{menu.filter((item) => item.active).length}</b><small>{menu.length} total in studio</small></article><article className="admin-stat-card panel-glass"><span><Activity size={17} /> Store status</span><b className="stat-live">LIVE</b><small>Auto-refresh every 20 sec</small></article></div>
      <div className="admin-tab-mobile">{tabs.map(({ id, label, icon: Icon }) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</div>
      {loading ? <div className="admin-empty admin-loading panel-glass"><span className="loading-orbit" /><p>Loading your control room…</p></div> : tab === 'orders' ? <OrdersPanel orders={orders} onRefresh={() => refresh(true)} onStatusChanged={updateOrderStatus} toast={toast} settings={settings} /> : tab === 'menu' ? <MenuPanel menu={menu} categories={categories} onRefresh={() => refresh(true)} toast={toast} /> : <SettingsPanel toast={toast} />}
      <footer className="admin-footer"><span>HASH FOOD · KORANGI</span><span><ArrowDownUp size={13} /> Orders sync live from your database</span></footer>
    </div>
    {mobileMenu && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
  </PageMotion>;
}

export default function Admin() {
  const session = useAdminSession();
  if (session === 'checking') return <div className="fullscreen-loader"><span className="loading-orbit" /><p>Checking your session…</p></div>;
  if (session !== 'authenticated') return <Navigate to="/admin/login" replace />;
  return <AdminShell />;
}
