"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, ChevronLeft, ChevronRight, CircleHelp, Gauge, LockKeyhole, Package, Plus, SlidersHorizontal, Truck } from "lucide-react";
import type { ProductDisplay } from "@/types/product";
import { BUNDLE_TIERS, getBundleSavings, getLineTotal } from "@/lib/bundles";
import { formatPrice } from "@/lib/formatters";
import { isVideoMediaUrl } from "@/lib/media-url";
import { useCartStore } from "@/store/cart-store";
import { useStorefrontUI } from "@/store/storefront-ui";

const SOURCE_PHOTO = "/kitvoy/inflator-front.png";
// Supplier graphics embed unsupported marketing claims. Show the authentic
// product photograph and clearly labeled detail crops of the same photograph.
const SUPPLIER_GRAPHICS = ["product-1793327827741-advdzp7z", "product-1793327831990-kd7g539e"];

function ProductGallery({ product }: { product: ProductDisplay | null }) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  const images = product?.images.filter(src => !isVideoMediaUrl(src) && !SUPPLIER_GRAPHICS.some(name => src.includes(name))) ?? [];
  const primary = images[0] || SOURCE_PHOTO;
  const slides = [
    { src: primary, label: "The inflator", detail: "Product view", crop: "overview" },
    { src: primary, label: "Display & controls", detail: "Detail of the product photo", crop: "controls" },
    { src: primary, label: "Air hose", detail: "Detail of the product photo", crop: "hose" },
    ...images.slice(1).map((src, i) => ({ src, label: `Product view ${i + 2}`, detail: "Product view", crop: "overview" })),
  ];
  const slide = slides[active] ?? slides[0];
  const select = (index: number) => { setActive((index + slides.length) % slides.length); setFailed(false); };

  return <div className="product-gallery" role="region" aria-label="Product gallery">
    <div className={`gallery-stage crop-${slide.crop}`}>
      <span className="gallery-kicker">Kitvoy / Cordless tire inflator</span>
      {!failed ? <Image width={468} height={476} key={slide.src} src={slide.src} alt={`${product?.name ?? "Cordless Tire Inflator"} — ${slide.label}`} className="gallery-product" fetchPriority="high" loading="eager" onError={() => setFailed(true)} /> : <div className="image-unavailable"><Package /><p>Product photo unavailable.</p><button className="text-link" onClick={() => setFailed(false)}>Try again</button></div>}
      <div className="gallery-caption"><span>{slide.detail}</span><span>{String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span></div>
      <div className="gallery-arrows"><button className="icon-button" aria-label="Previous product image" onClick={() => select(active - 1)}><ChevronLeft /></button><button className="icon-button" aria-label="Next product image" onClick={() => select(active + 1)}><ChevronRight /></button></div>
    </div>
    <div className="gallery-thumbnails" aria-label="Choose a product image">
      {slides.map((item, i) => <button key={`${item.label}-${i}`} className={`gallery-thumbnail crop-${item.crop}`} aria-label={`Show ${item.label.toLowerCase()}`} aria-pressed={active === i} onClick={() => select(i)}><span className="thumbnail-image"><Image width={468} height={476} src={item.src} alt="" /></span><span>{item.label}</span></button>)}
    </div>
  </div>;
}

export function StorefrontHome({ product }: { product: ProductDisplay | null }) {
  const [quantity, setQuantity] = useState(1);
  const [pastPurchase, setPastPurchase] = useState(false);
  const [bundlesVisible, setBundlesVisible] = useState(false);
  const mainPurchase = useRef<HTMLAnchorElement>(null);
  const bundlePurchase = useRef<HTMLDivElement>(null);
  const overlay = useStorefrontUI(s => s.overlay);
  const openCart = useStorefrontUI(s => s.openCart);
  const setOffer = useCartStore(s => s.setOffer);
  const price = product?.price;
  const canBuy = !!product && product.stock >= quantity;
  const total = price == null ? null : getLineTotal(price, quantity);
  const freeShipping = !!product && product.shippingTax === 0;

  useEffect(() => {
    const main = mainPurchase.current;
    const bundle = bundlePurchase.current;
    if (!main || !bundle) return;
    const mainObserver = new IntersectionObserver(([entry]) => setPastPurchase(!entry.isIntersecting && entry.boundingClientRect.bottom < 0));
    const bundleObserver = new IntersectionObserver(([entry]) => setBundlesVisible(entry.isIntersecting));
    mainObserver.observe(main); bundleObserver.observe(bundle);
    return () => { mainObserver.disconnect(); bundleObserver.disconnect(); };
  }, []);

  function addBundle() {
    if (!product || !canBuy) return;
    setOffer(product, quantity);
    openCart();
  }

  const faqs = [
    { q: "How much is shipping?", a: freeShipping ? "US shipping is included for this product. Your cart shows the shipping cost and total for your selection. Delivery estimates have not yet been published; check with support before ordering if you need it by a particular date." : "Shipping is shown in your cart before checkout. For delivery timing, check the shipping information or contact support." },
    { q: "Will it work with my tires?", a: "Check your tire’s valve type and required pressure against the product manual before use. Compatibility and pressure limits need confirmation for your particular tires. Do not use an inflator as a repair for a damaged tire." },
    { q: "What comes with my order?", a: "Choose one, two, or three cordless tire inflators. The product photograph shows the inflator and air hose. A verified packing list for cables and adapters is not yet available; contact support if you need a particular accessory." },
    { q: "How do the bundle savings work?", a: "Two inflators receive 15% off their combined price. Three or more receive 25% off. The price for your chosen quantity and the savings are shown before you add it to your cart." },
    { q: "What is the return policy?", a: "A confirmed return window and eligibility terms have not yet been published. Please check shipping & returns or contact support before you buy." },
  ];

  return <div className="kitvoy-home">
    <section className="store-container hero" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow">The cordless tire inflator</p>
        <h1 id="hero-heading">Low tire?{" "}<br />You&apos;re ready.</h1>
        <p className="hero-description">A little preparation.{" "}<br />A smoother start to your day.</p>
        <p className="hero-note">Your tire-care essential, ready to go.</p>
      </div>
      <ProductGallery product={product} />
      <div className="hero-purchase">
        <div className="hero-price">{price == null ? <span className="price-unavailable">Currently unavailable</span> : <><strong>{formatPrice(price)}</strong><span>1 inflator · USD</span></>}</div>
        <a ref={mainPurchase} id="hero-cta" className="primary-button hero-cta" href="#bundles">Choose my bundle <ArrowRight size={19} /></a>
        <a className="text-link hero-how" href="#how">See how it works</a>
        <div className="purchase-notes"><span><Truck />{freeShipping ? "Free US shipping" : "Shipping shown in cart"}</span><span><LockKeyhole />Payment at checkout</span></div>
      </div>
    </section>

    <div className="store-container"><div className="service-strip"><div><Truck /><span><strong>{freeShipping ? "US shipping included" : "Clear order totals"}</strong><small>{freeShipping ? "On every inflator bundle" : "Review before checkout"}</small></span></div><div><Package /><span><strong>Your kit. Your choice.</strong><small>One, two, or three inflators</small></span></div><Link href="/support"><CircleHelp /><span><strong>A question before you buy?</strong><small>Visit our help & information page</small></span><ArrowRight className="service-arrow" /></Link></div></div>

    <section id="how" className="store-container how-section" aria-labelledby="how-heading">
      <div className="how-visual"><Image width={468} height={476} src={SOURCE_PHOTO} alt="Kitvoy inflator with digital display, controls and air hose" loading="lazy" /><div><span className="eyebrow">A closer look</span><p>Small kit.<br />Everyday readiness.</p></div></div>
      <div className="how-copy"><p className="eyebrow">How it works</p><h2 id="how-heading">Ready in three<br className="desktop-break" /> simple steps.</h2><ol className="steps"><li><span>1</span><div><h3>Connect the hose</h3><p>Attach the hose to a compatible tire valve, following the product instructions.</p></div></li><li><span>2</span><div><h3>Set your pressure</h3><p>Use the controls to select the pressure recommended for your tires.</p></div></li><li><span>3</span><div><h3>Start inflating</h3><p>Press start and monitor the pressure. Follow the manual for safe use.</p></div></li></ol><p className="how-tip"><Gauge />For car tires, check the pressure label on your vehicle&apos;s door frame.</p></div>
    </section>

    <section className="store-container benefits" aria-label="Product features"><article><Gauge /><h3>Pressure at a glance</h3><p>A digital display keeps the pressure reading in view.</p></article><article><Package /><h3>A cordless format</h3><p>A standalone inflator and hose, together in one portable kit.</p></article><article><SlidersHorizontal /><h3>Controls within reach</h3><p>Front-facing buttons put the settings right where you need them.</p></article></section>

    <section id="bundles" className="bundle-section" aria-labelledby="bundle-heading"><div className="store-container bundle-layout">
      <div className="bundle-intro"><p className="eyebrow">Bundle & save</p><h2 id="bundle-heading">One for every<br />car in the driveway.</h2><p>A kit for you. Another for someone you care about. Choose the quantity that fits your day.</p><div className="bundle-photo"><Image width={468} height={476} src={SOURCE_PHOTO} alt="Cordless tire inflator" loading="lazy" /></div><p className="bundle-caption">The same inflator. More ways to be ready.</p></div>
      <div className="bundle-options"><fieldset><legend className="sr-only">Choose your inflator bundle</legend>{BUNDLE_TIERS.map((tier, _, tiers) => {
        // "Best value" is factual: the tier with the lowest price per unit
        const bestValue = tier.discount > 0 && tier.discount === Math.max(...tiers.map(t => t.discount));
        const lineTotal = price == null ? null : getLineTotal(price, tier.quantity);
        const savings = price == null ? 0 : getBundleSavings(price, tier.quantity);
        const unavailable = !product || product.stock < tier.quantity;
        return <label key={tier.quantity} className={`bundle-option ${quantity === tier.quantity ? "is-selected" : ""} ${unavailable ? "is-unavailable" : ""}`}><input type="radio" name="bundle" value={tier.quantity} checked={quantity === tier.quantity} disabled={unavailable} onChange={() => setQuantity(tier.quantity)} /><span className="bundle-thumb"><Image width={468} height={476} src={SOURCE_PHOTO} alt="" loading="lazy" /></span><span className="bundle-option-copy">{bestValue && <em className="bundle-badge">Best value</em>}<strong>{tier.quantity} {tier.quantity === 1 ? "inflator" : "inflators"}</strong><b>{lineTotal == null ? "Unavailable" : formatPrice(lineTotal)} <small>total</small></b><span>{unavailable ? "Currently unavailable" : savings > 0 ? `${formatPrice(lineTotal! / tier.quantity)} each · Save ${formatPrice(savings)}` : "For your daily drive."}</span></span><span className="radio-indicator" aria-hidden="true">{quantity === tier.quantity && <Check size={14} />}</span></label>;
      })}</fieldset><div ref={bundlePurchase} className="bundle-action"><button className="primary-button" disabled={!canBuy} onClick={addBundle}>{canBuy ? `Add ${quantity} to cart · ${formatPrice(total!)}` : product ? "Unavailable in this quantity" : "Currently unavailable"}<ArrowRight size={18} /></button><p className="bundle-selection-note">Your selected quantity becomes this product&apos;s cart quantity.</p></div><div className="bundle-footer-note"><Truck size={20} /><span>{freeShipping ? "Free US shipping included" : "Shipping calculated in your cart"}</span></div><Link className="text-link" href="/support#shipping-returns">Shipping & returns information</Link></div>
    </div></section>

    <section id="faq" className="store-container faq-section" aria-labelledby="faq-heading"><div><p className="eyebrow">Good to know</p><h2 id="faq-heading">A few things<br />before you go.</h2><p>More questions?<br /><Link className="text-link" href="/support#contact">Visit support <ArrowRight size={15} /></Link></p></div><div className="faq-list">{faqs.map(faq => <details key={faq.q}><summary>{faq.q}<Plus size={19} /></summary><p>{faq.a}</p></details>)}</div></section>

    {pastPurchase && !bundlesVisible && !overlay && <aside className="mobile-buy-bar" aria-label="Quick purchase"><div><strong>{total == null ? "Unavailable" : formatPrice(total)}</strong><span>{quantity} {quantity === 1 ? "inflator" : "inflators"}</span></div><a href="#bundles" className="primary-button">Choose bundle <ArrowRight size={17} /></a></aside>}
  </div>;
}
