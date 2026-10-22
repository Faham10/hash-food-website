import { AnimatePresence } from 'framer-motion';
import { Route, Routes, useLocation } from 'react-router-dom';
import Admin from './pages/Admin.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Checkout from './pages/Checkout.jsx';
import Home from './pages/Home.jsx';
import Track from './pages/Track.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import BurgerVideoBackground from './components/BurgerVideoBackground.jsx';
import Navbar from './components/Navbar.jsx';
import ToastViewport from './components/ToastViewport.jsx';

function CustomerLayout({ children }) {
  return <><BurgerVideoBackground /><Navbar />{children}<CartDrawer /></>;
}

export default function App() {
  const location = useLocation();
  return <>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<CustomerLayout><Home /></CustomerLayout>} />
        <Route path="/checkout" element={<CustomerLayout><Checkout /></CustomerLayout>} />
        <Route path="/track" element={<CustomerLayout><Track /></CustomerLayout>} />
        <Route path="/track/:id" element={<CustomerLayout><Track /></CustomerLayout>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<CustomerLayout><Home /></CustomerLayout>} />
      </Routes>
    </AnimatePresence>
    <ToastViewport />
  </>;
}
