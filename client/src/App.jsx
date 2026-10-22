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

function CustomerLayout({ children }) {
  return <><BurgerVideoBackground /><Navbar />{children}<CartDrawer /></>;
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
