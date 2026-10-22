import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageMotion from '../components/PageMotion.jsx';
import { useApp } from '../state/AppState.jsx';
import { api, formatMoney } from '../lib/api.js';
import { categoryPath, productPath, Seo, slugify } from '../lib/seo.js';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80';
const SITE_ORIGIN = 'https://hash-food-website.onrender.com';

export default function ProductDetail() {
  const { id, slug } = useParams();
  const { addToCart, setCartOpen, toast } = useApp();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const product = menu.find((item) => String(item.id) === id && slugify(item.name) === slug);
  const category = product && { id: product.categoryId, name: product.category };
  const related = product ? menu.filter((item) => item.categoryId === product.categoryId && item.id !== product.id).slice(0, 3) : [];
  const canonical = product ? `${SITE_ORIGIN}${productPath(product)}` : `${SITE_ORIGIN}/product/${id}/${slug}`;

  useEffect(() => {
    let mounted = true;
    api('/api/menu')
      .then((items) => { if (mounted) setMenu(items); })
      .catch((requestError) => {
        if (mounted) {
          setError(requestError.message);
          toast(requestError.message, 'error');
        }
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [toast]);

  if (loading) {
    return <PageMotion><main className="storefront-main product-detail-page"><p className="product-detail-message">Loading menu item…</p></main></PageMotion>;
  }

  if (!product) {
    return <PageMotion><main className="storefront-main product-detail-page"><h1>Menu item unavailable</h1><p>{error || 'This item is no longer on the menu.'}</p><Link className="button button-outline" to="/menu"><ArrowLeft size={16} /> Browse the menu</Link></main></PageMotion>;
  }

  const description = `${product.description} Order ${product.name} from Hash Food in Karachi.`;
  return (
    <PageMotion>
      <Seo
        title={`${product.name} | Hash Food`}
        description={description}
        canonical={canonical}
        image={product.image}
        type="product"
        product={product}
      />
      <main className="storefront-main product-detail-page">
        <nav className="product-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link><ArrowRight size={14} /><Link to="/menu">Menu</Link><ArrowRight size={14} /><Link to={categoryPath(category)}>{product.category}</Link>
        </nav>
        <article className="product-detail-card">
          <div className="product-detail-image-wrap">
            <img src={product.image} alt={product.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_IMAGE; }} />
            {product.popular && <span className="popular-tag">TOP SELLER</span>}
          </div>
          <div className="product-detail-copy">
            <Link className="product-detail-category" to={categoryPath(category)}>{product.category}</Link>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
            <strong className="product-detail-price">{formatMoney(product.price)}</strong>
            <div className="product-detail-order">
              <div className="product-quick-view-quantity" aria-label={`Quantity: ${quantity}`}>
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Decrease quantity"><span aria-hidden="true">−</span></button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((current) => Math.min(20, current + 1))} disabled={quantity >= 20} aria-label="Increase quantity"><span aria-hidden="true">+</span></button>
              </div>
              <button className="button button-primary" type="button" onClick={() => { addToCart(product, quantity); setCartOpen(true); }}>
                <ShoppingBag size={17} /> Add to cart <span aria-hidden="true">|</span> {formatMoney(product.price * quantity)}
              </button>
            </div>
            <Link className="product-back-link" to={categoryPath(category)}><ArrowLeft size={16} /> More {product.category}</Link>
          </div>
        </article>
        {related.length > 0 && (
          <section className="product-related">
            <h2>More from {product.category}</h2>
            <ul>{related.map((item) => <li key={item.id}><Link to={productPath(item)}>{item.name} <span>{formatMoney(item.price)}</span></Link></li>)}</ul>
          </section>
        )}
      </main>
    </PageMotion>
  );
}
