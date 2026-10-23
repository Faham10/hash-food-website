import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatMoney, jsonBody, validateOrder } from '../lib/api.js';
import { ORDER_STATUSES } from '../lib/orderStatus.js';
import { useApp } from '../state/AppState.jsx';
import { saveOrderTracking, subscribeToOrderStatus } from '../lib/tracking.js';
import PageMotion from '../components/PageMotion.jsx';
import OrderProgress from '../components/OrderProgress.jsx';

const emptyForm = { customerName: '', phone: '', altPhone: '', address: '', instructions: '' };

export default function Checkout() {
  const { cart, clearCart, orderType, setOrderType, settings, setSettings, toast } = useApp();
  const [menu, setMenu] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);
  const [placed, setPlaced] = useState(null);
  const [lastStatusUpdated, setLastStatusUpdated] = useState(null);
  const [statusError, setStatusError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (!retryAfterSeconds) return undefined;
    const timer = window.setInterval(() => setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [retryAfterSeconds > 0]);

  useEffect(() => {
    Promise.all([api('/api/menu'), api('/api/settings')])
      .then(([items, remoteSettings]) => { setMenu(items); setSettings((current) => ({ ...current, ...remoteSettings })); })
      .catch((error) => toast(error.message, 'error'));
  }, [setSettings, toast]);
  useEffect(() => {
    if (settings.deliveryAvailable === 'false' && orderType === 'Delivery') setOrderType('Pick-Up');
  }, [settings.deliveryAvailable, orderType, setOrderType]);

  useEffect(() => {
    if (!placed?.orderId || !placed.trackingToken) return undefined;
    let mounted = true;
    const stopStatusStream = subscribeToOrderStatus(
      placed.orderId,
      placed.trackingToken,
      ({ data }) => {
        if (!mounted || !ORDER_STATUSES.includes(data.status)) return;
        setPlaced((current) => current?.orderId === placed.orderId
          ? { ...current, status: data.status, updatedAt: data.updatedAt || current.updatedAt }
          : current);
        setLastStatusUpdated(new Date());
        setStatusError('');
      },
      (error) => {
        if (mounted) setStatusError(error.message);
      },
    );
    return () => {
      mounted = false;
      stopStatusStream();
    };
  }, [placed?.orderId, placed?.trackingToken]);

  const lines = useMemo(() => cart.map((entry) => {
    const product = menu.find((item) => item.id === entry.id);
    const choice = entry.option ? product?.options?.items?.find((item) => item.name === entry.option) : null;
    return { ...entry, product, choice, unitPrice: choice?.price ?? (!entry.option ? product?.price : undefined) };
  }).filter((item) => item.product && item.unitPrice !== undefined), [cart, menu]);
  const subtotal = lines.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const deliveryFee = orderType === 'Delivery' && settings.deliveryAvailable !== 'false' ? 150 : 0;

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (submitting.current || retryAfterSeconds > 0) return;
    const nextErrors = validateOrder(form, cart);
    if (!lines.length || lines.length !== cart.length) nextErrors.cart = 'One or more items are unavailable. Return to the menu and update your bag.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (settings.acceptOrders === 'false') {
      toast('Online ordering is paused right now.', 'error');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const result = await api('/api/orders', {
        method: 'POST',
        body: jsonBody({
          ...form,
          orderType,
          paymentMethod: 'Cash',
          items: cart.map(({ id, qty, option }) => ({ id, qty, ...(option ? { option } : {}) })),
        }),
      });
      const placedOrder = {
        ...result,
        customerName: form.customerName,
        phone: form.phone,
        altPhone: form.altPhone,
        address: form.address,
        orderType,
        paymentMethod: 'Cash',
        createdAt: new Date().toISOString(),
        items: lines.map(({ qty, product, option, unitPrice }) => ({ name: option ? `${product.name} (${option})` : product.name, price: unitPrice, quantity: qty })),
      };
      saveOrderTracking(result.orderId, result.trackingToken, placedOrder);
      clearCart();
      setPlaced(placedOrder);
    } catch (error) {
      if (error.status === 429) setRetryAfterSeconds(error.retryAfter || 60);
      toast(error.message, 'error');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (placed) {
    return (
      <PageMotion className="checkout-shell">
        {statusError && <p className="inline-note warning-note" role="status">Live status connection is retrying. {statusError}</p>}
        <OrderProgress order={placed} lastUpdated={lastStatusUpdated} showTrackLink />
      </PageMotion>
    );
  }

  return (
    <PageMotion className="checkout-shell">
      <div className="checkout-topline"><Link className="back-link" to="/"><ArrowLeft size={16} /> Back to menu</Link><span><ShieldCheck size={15} /> Secure checkout</span></div>
      <div className="checkout-layout reference-checkout-layout">
        <form className="checkout-form panel-glass" onSubmit={submitOrder} noValidate>
          <div className="checkout-title"><span className="eyebrow">FRESH FROM OUR KITCHEN</span><h1>Checkout <span>&amp; Billing</span></h1><p>Complete your details to place your order.</p></div>
          {settings.acceptOrders === 'false' && <div className="inline-note warning-note">Online ordering is paused at the moment. Please check back soon.</div>}
          {errors.cart && <div className="inline-note warning-note" role="alert">{errors.cart}</div>}
          <fieldset className="checkout-fieldset"><legend>Choose your experience</legend><div className="choice-grid checkout-choices">
            {(settings.deliveryAvailable === 'false' ? ['Pick-Up', 'Dine-In'] : ['Delivery', 'Pick-Up', 'Dine-In']).map((type) => (
              <button type="button" key={type} className={`choice-chip ${orderType === type ? 'selected' : ''}`} onClick={() => setOrderType(type)}>
                <span>{type === 'Delivery' ? <MapPin size={16} /> : type === 'Pick-Up' ? <Clock3 size={16} /> : <span className="choice-emoji">✳</span>}{type}</span>
                <small>{type === 'Delivery' ? 'To your door' : type === 'Pick-Up' ? 'Collect when ready' : 'Enjoy it here'}</small>
              </button>
            ))}
          </div></fieldset>
          <fieldset className="checkout-fieldset"><legend>Your details</legend>
            <div className="form-grid"><label>Full name<input name="customerName" value={form.customerName} onChange={updateForm} autoComplete="name" placeholder="Your name" required aria-invalid={Boolean(errors.customerName)} />{errors.customerName && <small className="field-error">{errors.customerName}</small>}</label>
              <label>Phone number<input name="phone" value={form.phone} onChange={updateForm} autoComplete="tel" inputMode="tel" placeholder="03142049022" required aria-invalid={Boolean(errors.phone)} />{errors.phone && <small className="field-error">{errors.phone}</small>}</label></div>
            <label>Alternative phone <span className="muted">(optional)</span><input name="altPhone" value={form.altPhone} onChange={updateForm} inputMode="tel" placeholder="Another number we can reach you on" /></label>
            <label>Address<input name="address" value={form.address} onChange={updateForm} autoComplete="street-address" placeholder="House, street, area, city" required aria-invalid={Boolean(errors.address)} />{errors.address && <small className="field-error">{errors.address}</small>}</label>
            <label>Anything we should know? <span className="muted">(optional)</span><textarea name="instructions" value={form.instructions} onChange={updateForm} rows="3" maxLength="300" placeholder="Extra sauce? Ring the bell?" /></label>
          </fieldset>
          <div className="payment-note"><span className="cash-icon">Rs</span><div><b>{orderType === 'Delivery' ? 'Cash on delivery' : 'Cash payment'}</b><small>Pay {orderType === 'Delivery' ? 'when your order arrives' : 'when your order is ready'}.</small></div><span className="secure-check"><Check size={15} /></span></div>
          <aside className="checkout-summary panel-glass">
            <div className="summary-title"><div><span className="eyebrow">ORDER SUMMARY</span><h2>Bill breakdown</h2></div><span className="summary-count">{cart.reduce((n, item) => n + item.qty, 0)} items</span></div>
            {!lines.length ? <div className="empty-state"><p>Your bag is empty or still loading.</p><Link to="/" className="text-link">Add something delicious →</Link></div> : lines.map(({ lineId, id, qty, product, option, unitPrice }) => <div className="summary-line" key={lineId || id}><span><b>{qty}×</b> {product.name}{option ? ` (${option})` : ''}</span><strong>{formatMoney(unitPrice * qty)}</strong></div>)}
            <div className="summary-divider" /><div className="price-row"><span>Subtotal</span><b>{formatMoney(subtotal)}</b></div>
            <div className="price-row"><span>Delivery charges</span><b>{deliveryFee ? formatMoney(deliveryFee) : 'Free'}</b></div>
            <div className="price-row total-row"><span>Total amount · Cash</span><b>{formatMoney(subtotal + deliveryFee)}</b></div>
          </aside>
          <button className="button button-primary button-large full-width" type="submit" disabled={busy || retryAfterSeconds > 0 || settings.acceptOrders === 'false' || !cart.length}>{busy ? 'Placing your order…' : retryAfterSeconds > 0 ? `Try again in ${Math.floor(retryAfterSeconds / 60)}:${String(retryAfterSeconds % 60).padStart(2, '0')}` : <>Place order · {formatMoney(subtotal + deliveryFee)} <ArrowRight size={18} /></>}</button>
          {retryAfterSeconds > 0 && <p className="inline-note warning-note" role="status">Order attempts are temporarily limited. Please wait for the timer before retrying.</p>}
          <p className="checkout-disclaimer">By placing your order you agree to our order details and restaurant policies.</p>
        </form>
      </div>
    </PageMotion>
  );
}
