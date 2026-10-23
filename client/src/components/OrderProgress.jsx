import { motion } from 'framer-motion';
import { ArrowLeft, Bike, CheckCircle2, Clock3, Flame, Headset, MapPin, PackageCheck, Phone, Receipt, ShieldCheck, Truck, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/api.js';
import OrderStatusBadge from './OrderStatusBadge.jsx';
import { getOrderStatusFlow, getStatusClass, isOrderComplete } from '../lib/orderStatus.js';
import { useApp } from '../state/AppState.jsx';

const stageDetails = {
  Pending: { title: 'Order received', description: 'Your order has been added to the kitchen queue.', icon: Receipt },
  Accepted: { title: 'Order accepted', description: 'The restaurant has confirmed your order.', icon: CheckCircle2 },
  Preparing: { title: 'Preparing your food', description: 'Our kitchen is preparing your meal fresh.', icon: Flame },
  'Ready for Pickup': { title: 'Ready for pickup', description: 'Your meal is ready to collect.', icon: PackageCheck },
  'Out for Delivery': { title: 'Out for delivery', description: 'Your order is on its way to you.', icon: Truck },
  Delivered: { title: 'Delivered', description: 'Your order has been delivered. Enjoy your meal!', icon: PackageCheck },
  Served: { title: 'Served', description: 'Your meal has been served. Enjoy!', icon: UtensilsCrossed },
  Completed: { title: 'Completed', description: 'Thank you for ordering from Hash Food.', icon: PackageCheck },
};

export default function OrderProgress({ order, lastUpdated, showTrackLink = false }) {
  const { settings } = useApp();
  const delivery = order.orderType === 'Delivery';
  const stages = getOrderStatusFlow(order.orderType).map((status) => ({ status, ...stageDetails[status] }));
  const statusIndex = stages.findIndex((stage) => stage.status === order.status);
  const statusTone = getStatusClass(order.status);
  const supportPhone = settings.phone || '03142049022';
  const supportTel = supportPhone.replace(/[^\d+]/g, '');
  const cancelled = order.status === 'Cancelled';
  const isLive = !isOrderComplete(order.status) && !cancelled;
  const placedAt = order.createdAt
    ? new Date(order.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'Just placed';

  return (
    <motion.div className={`order-progress-view status-state-${statusTone} ${isLive ? 'is-live' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <section className="order-status-banner">
        <div className="order-status-copy">
          <span className="order-live-label"><i /> LIVE KITCHEN TRACKING</span>
          <h1>Order <span>#{order.orderId}</span></h1>
          <p>Placed {placedAt} · We’ll keep you updated as your order moves.</p>
        </div>
        <div className="order-current-status" aria-live="polite"><span className="current-status-label">CURRENT STATUS</span><OrderStatusBadge status={order.status} key={order.status} /></div>
      </section>

      <div className="order-details-grid">
        <section className="order-timeline-card">
          <div className="order-section-heading">
            <h2><Clock3 size={19} /> Live progress timeline</h2>
            <span><ShieldCheck size={14} /> Verified order</span>
          </div>
          {cancelled ? (
            <div className="order-cancelled"><h3>Order cancelled</h3><p>This order was cancelled. Contact Hash Food if you need help.</p></div>
          ) : (
            <div className="order-timeline">
              {stages.map(({ status, title, description, icon: Icon }, index) => {
                const active = index <= statusIndex;
                const current = index === statusIndex;
                return (
                  <div className={`order-timeline-step ${active ? 'complete' : ''} ${current ? 'current' : ''}`} key={status}>
                    <div className="order-step-icon"><Icon size={18} /></div>
                    {index < stages.length - 1 && <span className="order-step-line" />}
                    <div className="order-step-copy"><b>{title}</b><p>{description}</p></div>
                  </div>
                );
              })}
            </div>
          )}
          {lastUpdated && <p className="order-last-updated"><i /> Live updates · Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
        </section>

        <div className="order-side-cards">
          <section className="order-info-card">
            <h2><MapPin size={18} /> Order destination</h2>
            <dl>
              <div><dt>Customer name</dt><dd>{order.customerName}</dd></div>
              <div><dt>Phone number</dt><dd>{order.phone}</dd></div>
              {order.altPhone && <div><dt>Alternative phone</dt><dd>{order.altPhone}</dd></div>}
              <div><dt>{delivery ? 'Delivery address' : 'Pickup details'}</dt><dd>{order.address}</dd></div>
              <div><dt>Payment mode</dt><dd className="order-payment-mode">{delivery ? 'Cash on delivery' : 'Cash at pickup'}</dd></div>
            </dl>
          </section>

          <section className="order-info-card order-items-card">
            <h2><Receipt size={18} /> Ordered items</h2>
            <div className="ordered-items-list">
              {order.items.map((item, index) => (
                <div className="ordered-item" key={`${item.name}-${index}`}>
                  <span>{item.quantity}× {item.name}</span><strong>{formatMoney(item.price * item.quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="ordered-total"><span>Total bill amount</span><strong>{formatMoney(order.total)}</strong></div>
          </section>

          <section className="order-support-card">
            <div className="support-icon"><Headset size={19} /></div>
            <div className="support-copy"><h3>Need help?</h3><p>Call Hash Food support</p></div>
            <a href={`tel:${supportTel}`} aria-label={`Call Hash Food at ${supportPhone}`}><Phone size={17} /></a>
          </section>
        </div>
      </div>

      <div className="order-page-actions">
        {showTrackLink && <Link className="button button-primary" to={`/track/${encodeURIComponent(order.orderId)}`}><Bike size={17} /> Track this order</Link>}
        <Link className="button button-outline" to="/"><ArrowLeft size={16} /> Back to home</Link>
      </div>
    </motion.div>
  );
}
