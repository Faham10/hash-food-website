import { Clock3, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppState.jsx';

export default function SiteFooter() {
  const { settings } = useApp();
  return (
    <footer className="site-footer" id="contact">
      <div className="footer-top">
        <div className="footer-brand"><Link className="brand" to="/"><span className="brand-mark">HF</span><span className="brand-name">HASH<span>FOOD</span></span></Link><p>Big flavour. No compromise.<br />Made to satisfy the fire in you.</p></div>
        <div><span className="eyebrow">Come hungry</span><p className="footer-detail"><MapPin size={16} />{settings.address}</p><p className="footer-detail"><Phone size={16} />{settings.phone}</p></div>
        <div><span className="eyebrow">Kitchen hours</span><p className="footer-detail"><Clock3 size={16} />Daily · {settings.opening} – {settings.closing}</p><p className="muted">Fresh off the grill, every day.</p></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} {settings.name}. Made with a little extra heat.</span><Link to="/admin/login">Team access</Link></div>
    </footer>
  );
}
