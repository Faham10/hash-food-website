import { ArrowLeft, Flame, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import OrderProgress from '../components/OrderProgress.jsx';
import PageMotion from '../components/PageMotion.jsx';
import { api } from '../lib/api.js';
import { ORDER_STATUSES, isOrderComplete } from '../lib/orderStatus.js';
import { markOrderCompleted, readLatestOrderId, readOrderHistory, readOrderToken, removeOrderTracking, subscribeToOrderStatus, subscribeToOrderTracking } from '../lib/tracking.js';

export default function Track() {
  const { id: routeId } = useParams();
  const [orderId, setOrderId] = useState(() => routeId || readLatestOrderId());
  const [order, setOrder] = useState(null);
  const [token, setToken] = useState(() => readOrderToken(routeId || readLatestOrderId()));
  const [loading, setLoading] = useState(Boolean(routeId || readLatestOrderId()));
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [history, setHistory] = useState(readOrderHistory);
  const orderRef = useRef(null);

  useEffect(() => subscribeToOrderTracking(() => setHistory(readOrderHistory())), []);

  useEffect(() => {
    const nextOrderId = routeId || readLatestOrderId();
    setOrderId(nextOrderId);
    setToken(nextOrderId ? readOrderToken(nextOrderId) : '');
    setOrder(null);
    orderRef.current = null;
    setError('');
  }, [routeId]);

  useEffect(() => {
    if (!orderId || !token) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    let requestSequence = 0;
    const refresh = async (initial = false) => {
      const requestId = ++requestSequence;
      if (initial) setLoading(true);
      try {
        const result = await api(`/api/orders/${encodeURIComponent(orderId)}`, { headers: { 'x-order-token': token } });
        if (mounted && requestId === requestSequence) {
          orderRef.current = result;
          setOrder(result);
          setError('');
          setLastUpdated(new Date());
          if (isOrderComplete(result.status)) markOrderCompleted(orderId, result);
        }
      } catch (requestError) {
        if (mounted && requestId === requestSequence) {
          setError(requestError.message);
          if (requestError.status === 404) {
            removeOrderTracking(orderId);
            orderRef.current = null;
            setToken('');
          }
        }
      } finally {
        if (mounted && requestId === requestSequence) setLoading(false);
      }
    };
    refresh(true);
    const stopStatusStream = subscribeToOrderStatus(orderId, token, ({ data }) => {
      if (!mounted || !ORDER_STATUSES.includes(data.status)) return;
      const current = orderRef.current;
      if (!current) {
        refresh();
        return;
      }
      requestSequence += 1;
      const updatedOrder = {
        ...current,
        status: data.status,
        updatedAt: data.updatedAt || current.updatedAt,
      };
      orderRef.current = updatedOrder;
      setOrder(updatedOrder);
      setLastUpdated(new Date());
      setError('');
    }, (streamError) => {
      if (mounted) setError(streamError.message);
    });
    const timer = window.setInterval(() => refresh(), 15000);
    return () => { mounted = false; window.clearInterval(timer); stopStatusStream(); };
  }, [orderId, token]);

  useEffect(() => {
    if (order && isOrderComplete(order.status)) markOrderCompleted(orderId, order);
  }, [orderId, order]);

  const showOrderDetails = Boolean(order && (routeId || !isOrderComplete(order.status)));
  const completedOrders = history.filter((entry) => entry.completedAt);

  return (
    <PageMotion className={`track-shell reference-track-shell ${showOrderDetails ? 'has-order-progress' : ''}`}>
      <div className="checkout-topline"><Link className="back-link" to="/"><ArrowLeft size={16} /> Back to menu</Link><span><MapPin size={15} /> Order tracking</span></div>
      {showOrderDetails && <OrderProgress order={order} lastUpdated={lastUpdated} />}
      {!order && (
        <section className="track-card panel-glass">
          <div className="track-heading"><span className="eyebrow"><Flame size={14} /> LIVE ORDER TRACKING</span><h1>Your order <span>status</span></h1><p>We’ll keep you updated automatically as your order moves through the kitchen.</p></div>
          {!orderId && <div className="empty-state"><h3>No recent order found</h3><p>Place an order first, then come back here to follow its progress.</p><Link className="button button-primary" to="/">Browse the menu</Link></div>}
          {orderId && !token && <div className="inline-note warning-note">We can’t verify this order on this device because its private tracking token isn’t saved here. Return to the device used to place the order.</div>}
          {loading && <div className="track-loading"><span className="loading-orbit" /><p>Finding your order…</p></div>}
          {error && !loading && <div className="error-panel" role="alert"><h3>We couldn’t refresh your order</h3><p>{error}</p><Link className="button button-outline" to="/">Back to home</Link></div>}
        </section>
      )}
      {order && isOrderComplete(order.status) && !routeId && (
        <section className="track-card panel-glass completed-history-intro">
          <div className="track-heading"><span className="eyebrow"><Flame size={14} /> ORDER HISTORY</span><h1>Your finished <span>orders</span></h1><p>This order is complete and saved to your history.</p></div>
        </section>
      )}
      {completedOrders.length > 0 && (
        <section className="order-history-section" aria-labelledby="order-history-heading">
          <div className="order-history-heading"><div><span className="reference-kicker">SAVED ON THIS DEVICE</span><h2 id="order-history-heading">Order history</h2></div><span>{completedOrders.length} completed</span></div>
          <div className="order-history-list">
            {completedOrders.map((entry) => (
              <article className="order-history-card" key={entry.orderId}>
                <div className="order-history-main">
                  <span className="order-history-check">✓</span>
                  <div><strong>Order #{entry.orderId}</strong><small>{entry.completedAt ? new Date(entry.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Completed'}</small></div>
                </div>
                <div className="order-history-summary"><span>{entry.items?.length || 0} items · {entry.orderType || 'Order'}</span><strong>{`Rs ${Number(entry.total || 0).toLocaleString('en-PK')}`}</strong></div>
                <Link className="button button-outline order-history-view" to={`/track/${encodeURIComponent(entry.orderId)}`}>View order</Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </PageMotion>
  );
}
