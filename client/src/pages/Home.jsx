import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Award, Flame, Search, Bike, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, formatMoney } from '../lib/api.js';
import { useApp } from '../state/AppState.jsx';
import PageMotion from '../components/PageMotion.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import { categoryPath, productPath, Seo } from '../lib/seo.js';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80';
const SITE_ORIGIN = 'https://hash-food-website.onrender.com';

function ProductCard({ product, index, addToCart, quantity, onOpen }) {
  return (
    <motion.article className="product-card" role="button" tabIndex={0} aria-label={`View ${product.name} details`} onClick={(event) => {
      if (!event.target.closest('button')) onOpen(product);
    }} onKeyDown={(event) => {
      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onOpen(product);
      }
    }} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ delay: Math.min(index * 0.04, 0.16) }} whileHover={{ y: -4 }}>
      <button className="product-image-wrap" type="button" onClick={() => onOpen(product)} aria-label={`View ${product.name} details`}>
        <img className="product-image" src={product.image} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_IMAGE; }} />
        {product.popular && <span className="popular-tag">TOP SELLER</span>}
        <span className="product-category">{product.category}</span>
      </button>
      <div className="product-copy">
        <div className="product-title-row"><h3><Link className="product-title-button" to={productPath(product)} onClick={(event) => event.stopPropagation()}>{product.name}</Link></h3></div>
        <p>{product.description}</p>
        <div className="product-action-row">
          <div className="product-price"><span>Price</span><strong>{formatMoney(product.price)}</strong></div>
          {quantity > 0
            ? <div className="mini-quantity" aria-label={`${quantity} in cart`}><span>{quantity} in bag</span><button onClick={() => addToCart(product)} aria-label={`Add another ${product.name}`}>+</button></div>
            : <button className="add-button" onClick={() => addToCart(product)}>Add to cart <span>+</span></button>}
        </div>
      </div>
    </motion.article>
  );
}

function ProductQuickView({ product, onClose, onAdd }) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return undefined;
    setQuantity(1);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, onClose]);

  return (
    <AnimatePresence>
      {product && (
        <div className="modal-layer">
          <motion.button className="modal-backdrop" type="button" aria-label="Close product details" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.section className="product-quick-view panel-glass" role="dialog" aria-modal="true" aria-labelledby="product-quick-view-title" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <div className="product-quick-view-visual">
              <img className="product-quick-view-image" src={product.image} alt={product.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_IMAGE; }} />
              <div className="product-quick-view-image-caption">
                {product.popular && <span className="popular-tag">TOP SELLER</span>}
                <h2 id="product-quick-view-title">{product.name}</h2>
              </div>
            </div>
            <div className="product-quick-view-details">
              <div className="product-quick-view-topline">
                <span className="product-quick-view-category">{product.category}</span>
                <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X /></button>
              </div>
              <strong className="product-quick-view-price">{formatMoney(product.price)}</strong>
              <div className="product-quick-view-description-block">
                <h3>About this item</h3>
                <p className="product-quick-view-description">{product.description || 'Freshly prepared with quality ingredients, just for you.'}</p>
                <Link className="product-detail-link" to={productPath(product)} onClick={onClose}>View full details <ArrowRight size={15} /></Link>
              </div>
              <div className="product-quick-view-footer">
                <div className="product-quick-view-quantity" aria-label={`Quantity: ${quantity}`}>
                  <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity"><span aria-hidden="true">−</span></button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => setQuantity((current) => Math.min(20, current + 1))} disabled={quantity >= 20} aria-label="Increase quantity"><span aria-hidden="true">+</span></button>
                </div>
                <button className="button button-primary" type="button" onClick={() => onAdd(product, quantity)}>{formatMoney(product.price * quantity)} <span aria-hidden="true">|</span> Add to cart <ArrowRight size={17} /></button>
              </div>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function Home() {
  const { addToCart, cart, setCartOpen, setSettings, toast } = useApp();
  const location = useLocation();
  const { categoryId: routeCategoryId } = useParams();
  const isMenuPage = location.pathname !== '/';
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    Promise.all([api('/api/menu'), api('/api/settings')])
      .then(([items, nextSettings]) => { setMenu(items); setSettings((current) => ({ ...current, ...nextSettings })); })
      .catch((error) => { setMenuError(error.message); toast(error.message, 'error'); })
      .finally(() => setLoading(false));
  }, [setSettings, toast]);

  const categories = useMemo(() => {
    const byId = new Map(menu.map((item) => [item.categoryId, { id: item.categoryId, name: item.category }]));
    return [...byId.values()].sort((first, second) => first.name.localeCompare(second.name));
  }, [menu]);
  const selectedCategory = categories.find((item) => String(item.id) === routeCategoryId);
  const selectedCategoryPath = selectedCategory ? categoryPath(selectedCategory) : null;
  const MenuHeading = isMenuPage ? 'h1' : 'h2';
  const pageTitle = selectedCategory
    ? `${selectedCategory.name} Menu | Hash Food Karachi`
    : isMenuPage ? 'Hash Food Menu | Order Burgers, Broast & More' : 'Hash Food | Karachi’s legendary taste, delivered hot';
  const pageDescription = selectedCategory
    ? `Explore ${selectedCategory.name} at Hash Food in Karachi. See current dishes, descriptions and prices, and order online.`
    : isMenuPage
      ? 'Explore the Hash Food menu in Karachi. Browse current dishes, descriptions and prices, and order online.'
      : 'Big flavour, freshly made in Karachi. Explore the Hash Food menu and order burgers, broast, fries and more.';
  const canonicalPath = selectedCategoryPath || (isMenuPage ? '/menu' : '/');
  const popular = menu.filter((item) => item.popular);
  const featured = (popular.length ? popular : menu).slice(0, 3);
  const heroIndex = featured.length ? activeHeroIndex % featured.length : 0;
  const heroProduct = featured[heroIndex];
  const heroSecondProduct = featured.length > 1 ? featured[(heroIndex + 1) % featured.length] : null;
  const filtered = menu.filter((item) => (!routeCategoryId || String(item.categoryId) === routeCategoryId) && `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  const cartQuantities = new Map(cart.map((item) => [item.id, item.qty]));

  useEffect(() => {
    if (featured.length < 2 || reduceMotion) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveHeroIndex((index) => (index + 1) % featured.length);
      }
    }, 5200);
    return () => window.clearInterval(timer);
  }, [featured.length, reduceMotion]);

  const showHeroSlide = (index) => {
    setActiveHeroIndex((index + featured.length) % featured.length);
  };

  return (
    <PageMotion>
      <Seo title={pageTitle} description={pageDescription} canonical={`${SITE_ORIGIN}${canonicalPath}`} />
      <div className="storefront-main">
        {!isMenuPage && <section className="home-hero">
          <div className="home-hero-art" aria-label="Featured menu items">
            <div className="hero-food-glow" />
            {heroSecondProduct && <img key={`next-${heroSecondProduct.id}`} className="hero-food-backdrop" src={heroSecondProduct.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_IMAGE; }} />}
            <AnimatePresence mode="wait">
              {heroProduct && (
                <motion.button
                  key={heroProduct.id}
                  id="hero-featured-product"
                  className="hero-featured-image"
                  type="button"
                  onClick={() => setSelectedProduct(heroProduct)}
                  aria-label={`View ${heroProduct.name} details`}
                  initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: -18, scale: 0.98 }}
                  transition={{ duration: reduceMotion ? 0 : 0.38, ease: 'easeOut' }}
                >
                  <img className="hero-food-main" src={heroProduct.image || FALLBACK_IMAGE} alt={heroProduct.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_IMAGE; }} />
                </motion.button>
              )}
            </AnimatePresence>
            {heroProduct && (
              <div className="hero-food-caption" key={`caption-${heroProduct.id}`}>
                <div><span>{heroProduct.popular ? 'POPULAR PICK' : heroProduct.category.toUpperCase()}</span><strong>{heroProduct.name}</strong></div>
                <b>{formatMoney(heroProduct.price)}</b>
              </div>
            )}
            <span className="hero-food-sticker"><Flame size={15} /> Fresh pick</span>
            {featured.length > 1 && (
              <>
                <button className="hero-slide-arrow hero-slide-previous" type="button" onClick={() => showHeroSlide(heroIndex - 1)} aria-label="Previous featured item"><ChevronLeft size={18} /></button>
                <button className="hero-slide-arrow hero-slide-next" type="button" onClick={() => showHeroSlide(heroIndex + 1)} aria-label="Next featured item"><ChevronRight size={18} /></button>
              </>
            )}
          </div>
          <div className="home-hero-copy">
            <h1>Karachi's legendary taste,<br />delivered <span>hot.</span></h1>
            <p>Smash burgers, crispy broast, and the kind of heat that brings everyone to the table. Freshly made, ready for your order.</p>
            <div className="home-hero-actions">
              <a className="home-order-button" href="#menu">Order from menu <ArrowRight size={18} /></a>
              <div className="home-delivery-note"><Bike size={23} /><span>Lightning fast delivery<strong>Hot and fresh to your door</strong></span></div>
            </div>
            {featured.length > 1 && (
              <div className="hero-slide-selectors" role="tablist" aria-label="Choose a featured menu item">
                {featured.map((product, index) => (
                  <button key={product.id} className={`hero-slide-selector ${index === heroIndex ? 'active' : ''}`} type="button" role="tab" aria-label={`Show ${product.name}`} aria-selected={index === heroIndex} aria-controls="hero-featured-product" onClick={() => showHeroSlide(index)}>
                    <span className="hero-slide-selector-progress" />
                    <span className="hero-slide-selector-name">{product.name}</span>
                  </button>
                ))}
                <span className="hero-slide-count">{String(heroIndex + 1).padStart(2, '0')} <i /> {String(featured.length).padStart(2, '0')}</span>
              </div>
            )}
          </div>
        </section>}

        {!isMenuPage && <section className="home-highlights" aria-label="Why order from Hash Food">
          <article className="home-highlight"><span><Flame size={22} /></span><div><h2>Made fresh, every order</h2><p>Big flavour, prepared fresh for you.</p></div></article>
          <article className="home-highlight"><span><Bike size={22} /></span><div><h2>Fast Karachi delivery</h2><p>Hot food brought right to your door.</p></div></article>
          <article className="home-highlight"><span><Award size={22} /></span><div><h2>Local favourites</h2><p>Made with love in Korangi, Karachi.</p></div></article>
        </section>}

        <section className="menu-section" id="menu">
          <div className="menu-panel-heading">
            <div><span className="reference-kicker">FRESH FROM OUR KITCHEN</span><MenuHeading>{selectedCategory ? `${selectedCategory.name} at Hash Food` : isMenuPage ? 'Hash Food Menu' : 'Explore the menu'}</MenuHeading><p>{selectedCategory ? `Browse our current ${selectedCategory.name.toLowerCase()} selection.` : 'Pick a favourite and we’ll get it cooking.'}</p></div>
            <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the menu…" aria-label="Search menu" /></label>
          </div>
          <div className="menu-category-panel" id="categories">
            <div className="menu-category-heading">
              <span className="reference-kicker">FIND YOUR FAVOURITE</span>
              <h3>Browse by category</h3>
              <p>Choose a category to explore the menu.</p>
            </div>
            <div className="menu-toolbar">
              <div className="category-tabs" aria-label="Menu categories">
                <Link to="/menu" aria-current={isMenuPage && !routeCategoryId ? 'page' : undefined} className={`category-tab ${isMenuPage && !routeCategoryId ? 'active' : ''}`}>All items</Link>
                {categories.map((item) => {
                  const href = categoryPath(item);
                  const active = String(item.id) === routeCategoryId;
                  return <Link key={item.id} to={href} aria-current={active ? 'page' : undefined} className={`category-tab ${active ? 'active' : ''}`}>{item.name}</Link>;
                })}
              </div>
              <span className="menu-count">{loading ? 'Loading menu' : `${filtered.length} items`}</span>
            </div>
          </div>
          {loading ? <div className="product-grid">{Array.from({ length: 6 }, (_, index) => <div className="product-skeleton" key={index}><div /><span /><span /></div>)}</div>
            : menuError ? <div className="error-panel"><h3>Menu unavailable</h3><p>{menuError}</p><button className="button button-outline" onClick={() => window.location.reload()}>Try again</button></div>
              : filtered.length ? <div className="product-grid">{filtered.map((product, index) => <ProductCard key={product.id} product={product} index={index} addToCart={addToCart} quantity={cartQuantities.get(product.id) || 0} onOpen={setSelectedProduct} />)}</div>
                : <div className="empty-state menu-empty"><Search size={25} /><h3>No items found</h3><p>Try another search or category.</p></div>}
        </section>

        {!isMenuPage && <section className="featured-menu" id="featured">
          <div className="reference-section-heading">
            <div><span className="reference-kicker">CUSTOMER FAVOURITES</span><h2>Featured Hash Food specials</h2></div>
            <a href="#menu">View full menu <ArrowRight size={16} /></a>
          </div>
          {loading ? <div className="product-grid featured-grid">{Array.from({ length: 3 }, (_, index) => <div className="product-skeleton" key={index}><div /><span /><span /></div>)}</div>
            : featured.length ? <div className="product-grid featured-grid">{featured.map((product, index) => <ProductCard key={`featured-${product.id}`} product={product} index={index} addToCart={addToCart} quantity={cartQuantities.get(product.id) || 0} onOpen={setSelectedProduct} />)}</div>
              : <p className="home-empty">The menu is being prepared. Please check back soon.</p>}
        </section>}

        {!isMenuPage && <section className="story-section" id="story">
          <div className="story-image"><img src={menu.find((item) => item.popular)?.image || FALLBACK_IMAGE} alt="Freshly made Hash Food meal" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_IMAGE; }} /><span className="story-image-label">HOT. FRESH. HASH.</span></div>
          <div className="story-copy"><span className="reference-kicker">A LITTLE ABOUT US</span><h2>Not just food.<br /><span>A whole mood.</span></h2><p id="story-copy">We started with one simple idea: food should make you feel something. So we fire up every order fresh, stack it high, and never hold back on flavour.</p><div className="story-stats"><div><b>100%</b><span>Freshly made</span></div><div><b>BIG</b><span>On flavour</span></div><div><b>LOCAL</b><span>From Korangi</span></div></div></div>
        </section>}
      </div>
      <SiteFooter />
      <ProductQuickView product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(product, quantity) => { addToCart(product, quantity); setSelectedProduct(null); setCartOpen(true); }} />
    </PageMotion>
  );
}
