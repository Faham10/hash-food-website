import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { enableOrderNotificationSound } from '../lib/orderNotificationSound.js';

const AppContext = createContext(null);
const CART_KEY = 'hash-food-cart';
const defaultSettings = {
  name: 'Hash Food',
  phone: '0300 1234567',
  address: 'Korangi No. 4, Kallu Chowk, Karachi',
  opening: '12:00 PM',
  closing: '2:00 AM',
  acceptOrders: 'true',
  deliveryAvailable: 'true',
};

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => Number.isInteger(item.id) && Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 20) : [];
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

  const addToCart = useCallback((product, quantity = 1) => {
    setCart((items) => {
      const current = items.find((item) => item.id === product.id);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || (current?.qty || 0) + quantity > 20) {
        toast('Maximum quantity is 20 per item.');
        return items;
      }
      toast(`${product.name}${quantity > 1 ? ` × ${quantity}` : ''} added to your cart.`, 'success');
      return current
        ? items.map((item) => item.id === product.id ? { ...item, qty: item.qty + quantity } : item)
        : [...items, { id: product.id, qty: quantity }];
    });
  }, [toast]);

  const setQuantity = useCallback((id, qty) => {
    setCart((items) => qty <= 0 ? items.filter((item) => item.id !== id) : items.map((item) => item.id === id ? { ...item, qty: Math.min(20, qty) } : item));
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
