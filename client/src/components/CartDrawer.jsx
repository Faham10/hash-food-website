import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Calculator, Minus, Plus, ShoppingBag, Sparkles, Trash2, Truck, X, ZoomIn } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatMoney } from '../lib/api.js';
import { useApp } from '../state/AppState.jsx';

export default function CartDrawer() {
  const { cart, cartCount, cartOpen, setCartOpen, setQuantity, orderType, setOrderType, settings, toast, addToCart } = useApp();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [zoomedProduct, setZoomedProduct] = useState(null);
  useEffect(() => {
    if (!cartOpen) return;
    setLoading(true);
    api('/api/menu')
      .then(setMenu)
      .catch((error) => toast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [cartOpen, toast]);
  useEffect(() => {
    if (settings.deliveryAvailable === 'false' && orderType === 'Delivery') setOrderType('Pick-Up');
  }, [settings.deliveryAvailable, orderType, setOrderType]);
  useEffect(() => {
    if (!cartOpen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (zoomedProduct) setZoomedProduct(null);
        else setCartOpen(false);
      }
    };
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [cartOpen, setCartOpen, zoomedProduct]);

  const lines = useMemo(() => cart.map((entry) => ({ ...entry, product: menu.find((item) => item.id === entry.id) })).filter((item) => item.product), [cart, menu]);
  const recommendations = useMemo(() => {
    const cartIds = new Set(cart.map((item) => item.id));
    return menu
      .filter((item) => !cartIds.has(item.id))
      .sort((a, b) => Number(b.popular) - Number(a.popular))
      .slice(0, 3);
  }, [cart, menu]);
  const subtotal = lines.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const deliveryFee = orderType === 'Delivery' && settings.deliveryAvailable !== 'false' ? 150 : 0;
  const estimatedDelivery = new Date(Date.now() + 50 * 60 * 1000);
  const deliveryDay = estimatedDelivery.getDate();
  const daySuffix = deliveryDay % 100 >= 11 && deliveryDay % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[deliveryDay % 10] || 'th');
  const deliveryDate = `${estimatedDelivery.toLocaleDateString('en-US', { month: 'long' })} ${deliveryDay}${daySuffix}, ${estimatedDelivery.getFullYear()}`;
  const deliveryTime = estimatedDelivery.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <AnimatePresence>
      {cartOpen && (
        <div className="drawer-layer">
          <motion.button className="drawer-backdrop" aria-label="Close cart" onClick={() => setCartOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
            <div className="drawer-heading">
              <h2 id="cart-title"><ShoppingBag size={19} /> Your Cart <span>({cartCount})</span></h2>
              <button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close cart"><X /></button>
            </div>
            <div className="cart-lines">
              {loading && <p className="muted">Loading your bag…</p>}
              {!loading && lines.length === 0 && (
                <div className="empty-state"><ShoppingBag size={32} /><h3>Your bag is waiting</h3><p>Add a favourite and make it a meal.</p><button className="button button-outline" onClick={() => setCartOpen(false)}>Explore menu</button></div>
              )}
              {!loading && cart.length > lines.length && <p className="inline-note">Some items are no longer on the menu. Remove them to continue.</p>}
              {lines.map(({ id, qty, product }) => (
                <article className="cart-line" key={id}>
                  <button className="cart-line-image-button" type="button" onClick={() => setZoomedProduct(product)} aria-label={`Zoom ${product.name} image`}><img src={product.image} alt={product.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=180&q=70'; }} /><span><ZoomIn size={15} /></span></button>
                  <div className="cart-line-info"><div className="row-between"><h3>{product.name}</h3><button className="bare-button danger-text" onClick={() => setQuantity(id, 0)} aria-label={`Remove ${product.name}`}><Trash2 size={15} /></button></div><p>{formatMoney(product.price)}</p><div className="stepper"><button aria-label={`Decrease ${product.name}`} onClick={() => setQuantity(id, qty - 1)}><Minus size={13} /></button><span>{qty}</span><button aria-label={`Increase ${product.name}`} onClick={() => setQuantity(id, qty + 1)} disabled={qty >= 20}><Plus size={13} /></button></div></div>
                  <strong className="cart-line-total">{formatMoney(product.price * qty)}</strong>
                </article>
              ))}
              {!loading && recommendations.length > 0 && (
                <section className="cart-recommendations" aria-labelledby="cart-recommendations-title">
                  <div className="cart-recommendations-heading"><div><span><Sparkles size={14} /> PAIR IT WITH</span><h3 id="cart-recommendations-title">You might also like</h3></div></div>
                  <div className="cart-recommendation-list">
                    {recommendations.map((product) => (
                      <article className="cart-recommendation" key={product.id}>
                        <button className="cart-recommendation-image-button" type="button" onClick={() => setZoomedProduct(product)} aria-label={`Zoom ${product.name} image`}>
                          <img src={product.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=180&q=70'; }} />
                          <span><ZoomIn size={14} /></span>
                        </button>
                        <div className="cart-recommendation-info"><h4>{product.name}</h4><span>{formatMoney(product.price)}</span></div>
                        <button type="button" className="cart-recommendation-add" onClick={() => addToCart(product)} aria-label={`Add ${product.name} to cart`}><Plus size={16} /><span>Add</span></button>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
            {lines.length > 0 && (
              <div className="drawer-bottom">
                <div className="cart-order-summary">
                  <div className="price-row"><span><Calculator size={15} /> Total</span><b>{formatMoney(subtotal)}</b></div>
                  <div className="price-row"><span><Truck size={15} /> {deliveryFee ? 'Delivery Fee' : 'Service'}</span><b>{deliveryFee ? formatMoney(deliveryFee) : 'Free'}</b></div>
                  <div className="price-row total-row"><span>Grand Total</span><b>{formatMoney(subtotal + deliveryFee)}</b></div>
                </div>
                {settings.acceptOrders === 'false' ? <p className="inline-note">Online ordering is currently paused.</p> : (
                  <Link className="button button-primary checkout-link" to="/checkout" onClick={() => setCartOpen(false)}>
                    Checkout <ArrowRight size={18} />
                  </Link>
                )}
                <div className="cart-delivery-estimate">
                  <p>Your order will be {orderType === 'Delivery' ? 'delivered' : 'ready'} in approximately <strong>50 minutes</strong></p>
                  <div><b>{deliveryDate}</b><span>at</span><strong>{deliveryTime}</strong></div>
                </div>
              </div>
            )}
          </motion.aside>
          {zoomedProduct && (
            <motion.div className="cart-image-zoom" role="dialog" aria-modal="true" aria-label={`${zoomedProduct.name} image`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button className="cart-image-zoom-backdrop" type="button" onClick={() => setZoomedProduct(null)} aria-label="Close product image zoom" />
              <motion.figure className="cart-image-zoom-content" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
                <button className="icon-button cart-image-zoom-close" type="button" onClick={() => setZoomedProduct(null)} aria-label="Close zoom"><X /></button>
                <img src={zoomedProduct.image} alt={zoomedProduct.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80'; }} />
                <figcaption>{zoomedProduct.name}</figcaption>
              </motion.figure>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
