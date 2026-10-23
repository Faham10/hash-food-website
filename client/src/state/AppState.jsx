import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { enableOrderNotificationSound } from '../lib/orderNotificationSound.js';

const AppContext = createContext(null);
const CART_KEY = 'hash-food-cart';
const defaultSettings = {
  name: 'Hash Food',
  phone: '03142049022',
  address: 'Korangi No. 4, Kallu Chowk, Karachi',
  opening: '6:00 PM',
  closing: '3:00 AM',
  acceptOrders: 'true',
  deliveryAvailable: 'true',
};

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => Number.isInteger(item.id) && Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 20)
        .map((item) => ({ ...item, lineId: item.lineId || `${item.id}:${encodeURIComponent(item.option || '')}` }))
      : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }) {
  const [cart, setCart] = useState(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderType, setOrderType] = useState('Delivery');
  const [toasts, setToasts] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => enableOrderNotificationSound(), []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const toast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4000);
  }, []);

  const addToCart = useCallback((product, quantity = 1, option = null) => {
    const lineId = `${product.id}:${encodeURIComponent(option || '')}`;
    setCart((items) => {
      const current = items.find((item) => (item.lineId || `${item.id}:${encodeURIComponent(item.option || '')}`) === lineId);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || (current?.qty || 0) + quantity > 20) {
        toast('Maximum quantity is 20 per item.');
        return items;
      }
      toast(`${product.name}${option ? ` (${option})` : ''}${quantity > 1 ? ` × ${quantity}` : ''} added to your cart.`, 'success');
      return current
        ? items.map((item) => (item.lineId || `${item.id}:${encodeURIComponent(item.option || '')}`) === lineId ? { ...item, qty: item.qty + quantity } : item)
        : [...items, { id: product.id, qty: quantity, option, lineId }];
    });
  }, [toast]);

  const setQuantity = useCallback((lineId, qty) => {
    setCart((items) => qty <= 0
      ? items.filter((item) => (item.lineId || `${item.id}:${encodeURIComponent(item.option || '')}`) !== lineId)
      : items.map((item) => (item.lineId || `${item.id}:${encodeURIComponent(item.option || '')}`) === lineId ? { ...item, qty: Math.min(20, qty) } : item));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);
  const value = useMemo(() => ({
    cart, cartOpen, setCartOpen, orderType, setOrderType, addToCart, setQuantity, clearCart,
    cartCount: cart.reduce((total, item) => total + item.qty, 0),
    toasts, toast, settings, setSettings,
  }), [cart, cartOpen, orderType, addToCart, setQuantity, clearCart, toasts, toast, settings]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
