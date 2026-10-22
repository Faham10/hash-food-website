const TOKEN_KEY = 'hash-food-tracking-tokens';
const LATEST_ORDER_KEY = 'hash-food-latest-order';
const ORDER_HISTORY_KEY = 'hash-food-order-history';
const ORDER_SAVED_EVENT = 'hash-food-order-saved';

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function readOrderToken(orderId) {
  return readJson(TOKEN_KEY, {})[orderId] || '';
}

export function readLatestOrderId() {
  const latestOrderId = localStorage.getItem(LATEST_ORDER_KEY);
  if (latestOrderId) return latestOrderId;
  const savedOrderIds = Object.keys(readJson(TOKEN_KEY, {}));
  return savedOrderIds[savedOrderIds.length - 1] || '';
}

export function saveOrderTracking(orderId, trackingToken, orderSummary) {
  const tokens = readJson(TOKEN_KEY, {});
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...tokens, [orderId]: trackingToken }));
  localStorage.setItem(LATEST_ORDER_KEY, orderId);
  if (orderSummary) {
    const history = readJson(ORDER_HISTORY_KEY, []);
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify([
      { ...orderSummary, orderId, completedAt: null },
      ...history.filter((entry) => entry.orderId !== orderId),
    ].slice(0, 30)));
  }
  window.dispatchEvent(new Event(ORDER_SAVED_EVENT));
}

export function removeOrderTracking(orderId) {
  const tokens = readJson(TOKEN_KEY, {});
  if (!tokens[orderId]) return;
  delete tokens[orderId];
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  if (localStorage.getItem(LATEST_ORDER_KEY) === orderId) localStorage.removeItem(LATEST_ORDER_KEY);
  window.dispatchEvent(new Event(ORDER_SAVED_EVENT));
}

export function readOrderHistory() {
  const history = readJson(ORDER_HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
}

export function readOrderCompletedAt(orderId) {
  return readOrderHistory().find((entry) => entry.orderId === orderId)?.completedAt || 0;
}

export function markOrderCompleted(orderId, orderSummary) {
  const history = readOrderHistory();
  const existing = history.find((entry) => entry.orderId === orderId);
  if (existing?.completedAt) return existing.completedAt;
  const completedAt = Date.now();
  const summary = orderSummary
    ? { ...orderSummary, orderId }
    : existing;
  if (!summary) return completedAt;
  localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify([
    { ...summary, completedAt },
    ...history.filter((entry) => entry.orderId !== orderId),
  ].slice(0, 30)));
  window.dispatchEvent(new Event(ORDER_SAVED_EVENT));
  return completedAt;
}

export function subscribeToOrderTracking(callback) {
  window.addEventListener(ORDER_SAVED_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(ORDER_SAVED_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function subscribeToOrderStatus(orderId, trackingToken, onEvent, onError) {
  let active = true;
  let retryDelay = 1000;
  let retryTimer;
  let controller;

  const scheduleReconnect = () => {
    if (!active || retryTimer) return;
    const delay = retryDelay;
    retryDelay = Math.min(retryDelay * 2, 15000);
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const dispatchFrame = (frame) => {
    let type = 'message';
    const data = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith(':')) continue;
      const separator = line.indexOf(':');
      if (separator < 0) continue;
      const field = line.slice(0, separator);
      const value = line.slice(separator + 1).replace(/^ /, '');
      if (field === 'event') type = value;
      if (field === 'data') data.push(value);
    }
    if (!data.length) return;
    try {
      onEvent({ type, data: JSON.parse(data.join('\n')) });
    } catch (error) {
      onError?.(error);
    }
  };

  const connect = async () => {
    controller = new AbortController();
    let reconnect = true;
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/events`, {
        credentials: 'same-origin',
        headers: { Accept: 'text/event-stream', 'x-order-token': trackingToken },
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload.error || 'Live order updates are unavailable.');
        error.status = response.status;
        if (response.status === 401 || response.status === 404) reconnect = false;
        throw error;
      }
      if (!response.body) throw new Error('Live order updates are not supported by this browser.');
      retryDelay = 1000;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (active) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || '';
        frames.forEach(dispatchFrame);
      }
    } catch (error) {
      if (active && error.name !== 'AbortError') onError?.(error);
    } finally {
      if (active && reconnect) scheduleReconnect();
    }
  };

  connect();
  return () => {
    active = false;
    window.clearTimeout(retryTimer);
    controller?.abort();
  };
}
