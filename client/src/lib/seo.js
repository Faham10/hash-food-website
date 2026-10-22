import { useEffect } from 'react';

export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

export function productPath(product) {
  return `/product/${product.id}/${slugify(product.name)}`;
}

export function categoryPath(category) {
  return `/menu/category/${category.id}/${slugify(category.name)}`;
}

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute('content', content);
}

export function Seo({ title, description, canonical, image, type = 'website', robots = 'index,follow', product }) {
  useSeo({ title, description, canonical, image, type, robots, product });
  return null;
}

export function useSeo({ title, description, canonical, image, type = 'website', robots = 'index,follow', product }) {
  useEffect(() => {
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', robots);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', image || `${window.location.origin}/hash-food-icon.svg`);
    setMeta('property', 'og:image:alt', title);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image || `${window.location.origin}/hash-food-icon.svg`);

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.append(canonicalLink);
    }
    canonicalLink.href = canonical;

    const oldStructuredData = document.head.querySelector('script[data-hash-food-product]');
    if (oldStructuredData) oldStructuredData.remove();
    if (product) {
      const structuredData = document.createElement('script');
      structuredData.type = 'application/ld+json';
      structuredData.dataset.hashFoodProduct = 'true';
      structuredData.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.image,
        category: product.category,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'PKR',
          price: product.price,
          url: canonical,
        },
      });
      document.head.append(structuredData);
    }
  }, [title, description, canonical, image, type, robots, product]);
}
