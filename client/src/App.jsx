import { AnimatePresence } from 'framer-motion';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Admin from './pages/Admin.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Checkout from './pages/Checkout.jsx';
import Home from './pages/Home.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Track from './pages/Track.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import BurgerVideoBackground from './components/BurgerVideoBackground.jsx';
import Navbar from './components/Navbar.jsx';
import ToastViewport from './components/ToastViewport.jsx';
import { Seo } from './lib/seo.js';

const SITE_ORIGIN = 'https://hash-food-website.onrender.com';

function WhatsAppFloat() {
  return <a className="whatsapp-float" href="https://wa.me/923142049022?text=Hello%20Hash%20Food%2C%20I%20want%20to%20place%20an%20order." target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp with 03142049022">
    <span className="whatsapp-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img" focusable="false">
        <path d="M20.52 3.48A11.82 11.82 0 0 0 12.07 1C6.39 1 1.8 5.58 1.8 11.26c0 1.99.52 3.93 1.5 5.63L1.5 23l6.28-1.67A10.3 10.3 0 0 0 12.07 21c5.68 0 10.27-4.59 10.27-10.26 0-2.75-1.08-5.34-3.02-7.26Zm-8.45 15.66c-1.62 0-3.22-.44-4.63-1.27l-.33-.2-3.72.99 1-3.63-.22-.37a8.53 8.53 0 0 1 1.3-10.3A8.55 8.55 0 0 1 12.07 2.7c4.71 0 8.56 3.84 8.56 8.56 0 4.72-3.85 8.56-8.56 8.56Zm4.7-6.42c-.26-.13-1.53-.76-1.77-.84-.24-.09-.41-.13-.58.13-.17.26-.65.84-.8 1.01-.15.17-.29.19-.55.06-.26-.13-1.1-.41-2.08-1.31-.77-.68-1.29-1.52-1.44-1.77-.15-.26-.02-.4.11-.53.12-.12.26-.29.39-.43.13-.14.17-.24.26-.4.08-.17.04-.31-.02-.43-.06-.13-.58-1.39-.8-1.9-.21-.5-.43-.43-.58-.44h-.5c-.17 0-.45.06-.69.31-.24.26-.9.89-.9 2.14 0 1.25.92 2.47 1.06 2.65.13.17 1.82 2.8 4.43 3.92.62.27 1.11.43 1.49.55.62.2 1.18.17 1.63.1.5-.07 1.53-.63 1.74-1.24.21-.6.21-1.12.15-1.24-.07-.13-.24-.21-.5-.35Z" fill="currentColor"/>
      </svg>
    </span>
    <span className="whatsapp-text">03142049022</span>
  </a>;
}

function CustomerLayout({ children }) {
  return <><BurgerVideoBackground /><Navbar />{children}<CartDrawer /><WhatsAppFloat /></>;
}

function PrivatePage({ children, title }) {
  const location = useLocation();
  return <>
    <Seo title={title} description="Hash Food customer and account information." canonical={`${SITE_ORIGIN}${location.pathname}`} robots="noindex,nofollow" />
    {children}
  </>;
}

function NotFound() {
  return <CustomerLayout>
    <Seo title="Page not found | Hash Food" description="This Hash Food page could not be found." canonical={`${SITE_ORIGIN}${window.location.pathname}`} robots="noindex,nofollow" />
    <main className="storefront-main"><h1>Page not found</h1><p>That page does not exist. Browse our menu to find something delicious.</p><Link className="button button-outline" to="/menu">Browse the menu</Link></main>
  </CustomerLayout>;
}

export default function App() {
  const location = useLocation();
  return <>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<CustomerLayout><Home /></CustomerLayout>} />
        <Route path="/menu" element={<CustomerLayout><Home /></CustomerLayout>} />
        <Route path="/menu/category/:categoryId/:slug" element={<CustomerLayout><Home /></CustomerLayout>} />
        <Route path="/product/:id/:slug" element={<CustomerLayout><ProductDetail /></CustomerLayout>} />
        <Route path="/checkout" element={<PrivatePage title="Checkout | Hash Food"><CustomerLayout><Checkout /></CustomerLayout></PrivatePage>} />
        <Route path="/track" element={<PrivatePage title="Order tracking | Hash Food"><CustomerLayout><Track /></CustomerLayout></PrivatePage>} />
        <Route path="/track/:id" element={<PrivatePage title="Order tracking | Hash Food"><CustomerLayout><Track /></CustomerLayout></PrivatePage>} />
        <Route path="/admin/login" element={<PrivatePage title="Admin login | Hash Food"><AdminLogin /></PrivatePage>} />
        <Route path="/admin" element={<PrivatePage title="Admin dashboard | Hash Food"><Admin /></PrivatePage>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
    <ToastViewport />
  </>;
}
