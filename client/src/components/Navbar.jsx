import { ShoppingBag } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useApp } from '../state/AppState.jsx';
import TrackOrderIndicator from './TrackOrderIndicator.jsx';

const navItems = [
  { id: 'home', label: 'Home', href: '/', section: null },
  { id: 'menu', label: 'Menu', href: '/menu', section: 'menu' },
  { id: 'categories', label: 'Categories', href: '/menu#categories', section: 'categories' },
  { id: 'deals', label: 'Deals', href: '/#featured', section: 'featured' },
  { id: 'about', label: 'About', href: '/#story', section: 'story' },
  { id: 'contact', label: 'Contact', href: '/#contact', section: 'contact' },
];

function scrollToSection(sectionId, behavior = 'smooth') {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
  const top = Math.max(0, window.scrollY + section.getBoundingClientRect().top - headerHeight - 16);
  window.scrollTo({ top, behavior });
}

export default function Navbar() {
  const { cartCount, setCartOpen } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState(location.pathname === '/' ? 'home' : '');

  useEffect(() => {
    if (!['/', '/menu'].includes(location.pathname)) {
      setActiveNav('');
      return undefined;
    }

    const sectionForHash = navItems.find((item) => item.section === location.hash.slice(1));
    setActiveNav(sectionForHash?.id || (location.pathname === '/menu' ? 'menu' : 'home'));

    if (sectionForHash) {
      window.requestAnimationFrame(() => scrollToSection(sectionForHash.section, location.key === 'default' ? 'auto' : 'smooth'));
    } else {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: location.key === 'default' ? 'auto' : 'smooth' }));
    }

    let frame = 0;
    const updateFromScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const headerOffset = (document.querySelector('.site-header')?.getBoundingClientRect().height || 0) + 32;
        const contactSection = document.getElementById('contact');
        const contactIsVisible = contactSection
          && contactSection.getBoundingClientRect().top < window.innerHeight - headerOffset;
        if (contactIsVisible || window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
          setActiveNav('contact');
          return;
        }

        const currentSection = navItems
          .filter((item) => item.section)
          .map((item) => {
            const section = document.getElementById(item.section);
            return section ? { id: item.id, top: section.getBoundingClientRect().top } : null;
          })
          .filter((section) => section !== null)
          .sort((first, second) => first.top - second.top)
          .reduce((active, section) => section.top <= headerOffset ? section.id : active, location.pathname === '/menu' ? 'menu' : 'home');
        setActiveNav(currentSection);
      });
    };

    window.addEventListener('scroll', updateFromScroll, { passive: true });
    window.addEventListener('hashchange', updateFromScroll);
    const contentObserver = new ResizeObserver(updateFromScroll);
    contentObserver.observe(document.body);

    updateFromScroll();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateFromScroll);
      window.removeEventListener('hashchange', updateFromScroll);
      contentObserver.disconnect();
    };
  }, [location.pathname, location.hash, location.key]);

  useEffect(() => {
    const nav = document.querySelector('.main-nav');
    const activeLink = nav?.querySelector('a.active');
    if (!nav || !activeLink) return;

    const navBounds = nav.getBoundingClientRect();
    const linkBounds = activeLink.getBoundingClientRect();
    if (linkBounds.left < navBounds.left || linkBounds.right > navBounds.right) {
      nav.scrollTo({
        left: nav.scrollLeft + linkBounds.left - navBounds.left - (nav.clientWidth - activeLink.clientWidth) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  }, [activeNav]);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" to="/" aria-label="Hash Food home">
            <span className="brand-mark"><img src="/hash-food-mark.png" alt="" /></span>
            <span className="brand-lockup"><span className="brand-name">HASH <span>FOOD</span></span><small>Karachi legend</small></span>
          </Link>
          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const className = activeNav === item.id ? 'active' : '';
              return item.id === 'home'
                ? <Link key={item.id} to="/" className={className} aria-current={className ? 'page' : undefined} onClick={(event) => {
                  setActiveNav(item.id);
                  if (location.pathname === '/') {
                    event.preventDefault();
                    navigate('/');
                  }
                }}>{item.label}</Link>
                : <a key={item.id} href={item.href} className={className} aria-current={className ? 'location' : undefined} onClick={(event) => {
                  event.preventDefault();
                  setActiveNav(item.id);
                  navigate(item.href);
                }}>{item.label}</a>;
            })}
          </nav>
          <div className="header-actions">
            <TrackOrderIndicator />
            <button className="button header-cart" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${cartCount} items`}>
              <ShoppingBag size={17} /> <span>Cart</span><b className="cart-count">{cartCount}</b>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
