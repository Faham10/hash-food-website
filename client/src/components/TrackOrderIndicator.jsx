import { Clock3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import OrderStatusBadge from './OrderStatusBadge.jsx';
import { api } from '../lib/api.js';
import { playOrderNotificationSound } from '../lib/orderNotificationSound.js';
import { getStatusClass, isOrderComplete } from '../lib/orderStatus.js';
import { markOrderCompleted, readLatestOrderId, readOrderCompletedAt, readOrderToken, removeOrderTracking, subscribeToOrderStatus, subscribeToOrderTracking } from '../lib/tracking.js';
import { useApp } from '../state/AppState.jsx';

function getSavedOrder() {
  const orderId = readLatestOrderId();
  return { orderId, token: orderId ? readOrderToken(orderId) : '' };
}

export default function TrackOrderIndicator() {
  const { toast } = useApp();
  const [saved, setSaved] = useState(getSavedOrder);
  const savedRef = useRef(saved);
  const lastStatusRef = useRef(null);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [completedAt, setCompletedAt] = useState(() => saved.orderId ? readOrderCompletedAt(saved.orderId) : 0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => subscribeToOrderTracking(() => {
    const next = getSavedOrder();
    setCompletedAt(next.orderId ? readOrderCompletedAt(next.orderId) : 0);
    if (savedRef.current.orderId !== next.orderId || savedRef.current.token !== next.token) {
      savedRef.current = next;
      lastStatusRef.current = null;
      setSaved(next);
      setOrder(null);
      setError('');
    }
  }), []);

  useEffect(() => {
    if (!saved.orderId || !saved.token) return undefined;
    let mounted = true;
    let requestSequence = 0;
    const refresh = async () => {
      const requestId = ++requestSequence;
      try {
        const result = await api(`/api/orders/${encodeURIComponent(saved.orderId)}`, { headers: { 'x-order-token': saved.token } });
        if (mounted && requestId === requestSequence) {
          if (lastStatusRef.current && lastStatusRef.current !== result.status) {
            const messages = {
              Accepted: 'Your order has been accepted.',
              Preparing: 'The kitchen is preparing your order.',
              'Out for Delivery': 'Your order is out for delivery.',
              'Ready for Pickup': 'Your order is ready for pickup.',
              Delivered: 'Your order has been delivered.',
              Served: 'Your meal has been served.',
              Completed: 'Your order is complete.',
              Cancelled: 'Your order was cancelled.',
            };
            toast(messages[result.status] || `Your order status is now ${result.status}.`, result.status === 'Cancelled' ? 'error' : 'success');
            playOrderNotificationSound();
          }
          lastStatusRef.current = result.status;
          setOrder(result);
          setError('');
          if (isOrderComplete(result.status)) setCompletedAt(markOrderCompleted(saved.orderId, result));
        }
      } catch (requestError) {
        if (mounted && requestId === requestSequence && requestError.status === 404) {
          removeOrderTracking(saved.orderId);
          setOrder(null);
          setError('');
        } else if (mounted && requestId === requestSequence) {
          setError(requestError.message);
        }
      }
    };
    refresh();
    const stopStatusStream = subscribeToOrderStatus(saved.orderId, saved.token, () => refresh(), (streamError) => {
      if (mounted) setError(streamError.message);
    });
    const timer = window.setInterval(refresh, 15000);
    return () => { mounted = false; window.clearInterval(timer); stopStatusStream(); };
  }, [saved.orderId, saved.token, toast]);

  const hasTrackedOrder = Boolean(saved.orderId && saved.token);
  useEffect(() => {
    if (!completedAt) return undefined;
    const hideDelay = Math.max(0, completedAt + 60000 - Date.now());
    const timer = window.setTimeout(() => setNow(Date.now()), hideDelay);
    return () => window.clearTimeout(timer);
  }, [completedAt]);
  const completed = isOrderComplete(order?.status);
  const showCompletedStatus = completed && completedAt && now < completedAt + 60000;
  const showStatus = order?.status && (!completed || showCompletedStatus);

  return (
    <Link
      className={`header-track ${hasTrackedOrder && (!order || !completed || showCompletedStatus) ? 'has-current-order' : ''}`}
      to={hasTrackedOrder && (!order || !completed || showCompletedStatus) ? `/track/${encodeURIComponent(saved.orderId)}` : '/track'}
      aria-label={showStatus ? `Track order: ${order.status}` : 'Track your order and order history'}
      title={error ? 'Status update failed; retrying shortly' : undefined}
    >
      {hasTrackedOrder && (!order || !completed || showCompletedStatus)
        ? <span className={`track-order-light track-light-${getStatusClass(order?.status || 'Pending')} ${error ? 'has-error' : ''}`} aria-hidden="true" />
        : <Clock3 size={15} />}
      <span>Track order</span>
      {showStatus && <OrderStatusBadge status={order.status} className="track-order-status" />}
      {!order?.status && hasTrackedOrder && <strong className="track-order-status track-status-pending">{error ? 'Updating' : 'Checking…'}</strong>}
    </Link>
  );
}
