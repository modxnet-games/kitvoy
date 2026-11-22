"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { getCatalogVariant, variantKey, type CatalogColour, type CatalogProduct, type CatalogVariant } from "@/config/catalog";
import { storePolicies } from "@/config/policies";
import type { GalleryBadge, GalleryImage, ProductContent, ProductEntry } from "@/config/products/types";
import { siteConfig } from "@/config/site";
import { useLanguage } from "@/contexts/language-context";
import { trackAddToCart } from "@/lib/analytics/meta-pixel";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { formatPrice } from "@/lib/formatters";
import { useCartStore, type CartItem } from "@/store/cart-store";
import { useStorefrontUI } from "@/store/storefront-ui";
import { withVariant, type ProductDisplay } from "@/types/product";
import { TrackViewContent } from "@/components/analytics/track-view-content";
import { BeforeAfter } from "./before-after";
import { CodBadge, TrustIcon } from "./trust";

/*
 * The product page template. Its layout is the owner's TreeAura product page,
 * section for section (styles in app/brand.css): gallery and buy box, a
 * before/after comparison, three steps, the size guide, specifications, the
 * FAQ and a closing band, with a buy bar that slides in on phones. Every word
 * comes from the page's language (messages/, config/products/).
 */

export interface ProductPageProps {
  /** The database product (live price, stock, shippingTax, images); null if it isn't in the database yet */
  product: ProductDisplay | null;
  /** Pack prices, colours, sizes, unit names */
  entry: CatalogProduct;
  /** All copy and media, in the page's language */
  content: ProductContent;
  sizeGuide: ProductEntry["sizeGuide"];
  /** The product's own logo, for the closing band */
  productLogoLight: string;
  /** The complete FAQ list, already assembled by the server page (product questions + delivery, payment and exchange) */
  faqs: { q: string; a: string }[];
}

/** The gallery never shows more than this many photos, whatever the content file lists. */
const MAX_GALLERY_SLIDES = 5;

/**
 * A photo that fills its (position: relative, fixed aspect ratio) parent. If
 * the file is missing or fails to load, a plain tinted block stands in for it,
 * so the page never shows a broken-image icon. next/image re-triggers an error
 * that happened before hydration when `onError` is set, so early failures are
 * caught too.
 */
function Photo({ src, alt, sizes, preload = false }: { src: string; alt: string; sizes: string; preload?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <span className="kv-image-fallback" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />;
  return <Image fill src={src} alt={alt} sizes={sizes} preload={preload} fetchPriority={preload ? "high" : "auto"} onError={() => setFailedSrc(src)} />;
}

function BadgeIcon({ icon }: { icon: GalleryBadge["icon"] }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {icon === "support" && (<><path {...p} d="M12 3l7 3v5c0 4.500-3 8.300-7 10-4-1.700-7-5.500-7-10V6z" /><path {...p} d="M9 12l2.200 2.200L15.200 10" /></>)}
      {icon === "back" && (<><path {...p} d="M7 3v5.500a5 5 0 0010 0V3" /><path {...p} d="M5 14.500h14v5H5z" /><path {...p} d="M12 14.500v5" /></>)}
      {icon === "adjust" && (<><path {...p} d="M3 12h18" /><path {...p} d="M7 8l-4 4 4 4M17 8l4 4-4 4" /></>)}
      {icon === "shield" && (<path {...p} d="M12 3l7 3v5c0 4.500-3 8.300-7 10-4-1.700-7-5.500-7-10V6z" />)}
    </svg>
  );
}

/** What the main picture is showing: a gallery photo, or the photo of a colour the customer has just picked. */
type Shown = Pick<GalleryImage, "src" | "alt" | "badge" | "dark">;

/**
 * The gallery: one large photo, changed by a swipe or by its thumbnails, with
 * the brand mark, a feature callout on the photos that have one, and position
 * dots. While a picked colour's photo is on show no thumbnail is current;
 * choosing a thumbnail or swiping goes back to the gallery.
 */
function Gallery({ slides, preview, onLeavePreview }: { slides: GalleryImage[]; preview: Shown | null; onLeavePreview: () => void }) {
  const { t, dir } = useLanguage();
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);
  if (slides.length === 0) return null;

  const shown: Shown = preview ?? slides[Math.min(active, slides.length - 1)];
  const go = (step: 1 | -1) => {
    onLeavePreview();
    setActive((i) => (i + step + slides.length) % slides.length);
  };

  return (
    <div className="kv-gallery" aria-label={t("product.gallery")}>
      <div
        className="kv-gallery-main"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          // A swipe towards the start of the line brings the next photo: leftwards in French, rightwards in Arabic
          if (Math.abs(dx) > 40 && slides.length > 1) go((dx < 0) === (dir === "ltr") ? 1 : -1);
        }}
      >
        <Photo src={shown.src} alt={shown.alt} sizes="(min-width: 960px) 640px, 100vw" preload={!preview && active === 0} />
        <span className={`kv-gallery-mark${shown.dark ? " on-img-dark" : ""}`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.dark ? siteConfig.wordmarkLight : siteConfig.wordmark} alt="" width={420} height={108} />
        </span>
        {shown.badge && (
          <div className="kv-gallery-badge">
            <span className="kv-gallery-badge-ic">
              <BadgeIcon icon={shown.badge.icon} />
            </span>
            <span>
              <strong>{shown.badge.title}</strong>
              <small>{shown.badge.sub}</small>
            </span>
          </div>
        )}
        {slides.length > 1 && (
          <div className={`kv-gallery-dots${shown.dark ? "" : " on-img-light"}`} aria-hidden="true">
            {slides.map((_, i) => (
              <i key={i} className={!preview && i === active ? "on" : ""} />
            ))}
          </div>
        )}
      </div>
      {slides.length > 1 && (
        <div className="kv-thumbs">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              className="kv-thumb"
              aria-current={!preview && i === active}
              aria-label={t("product.showImage", { n: i + 1, alt: slide.alt })}
              onClick={() => {
                onLeavePreview();
                setActive(i);
              }}
            >
              <Image src={slide.src} alt="" width={64} height={64} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A colour's dot: a print (the leopard) shows its second colour as spots. */
function Swatch({ colour }: { colour: CatalogColour }) {
  const background = colour.swatchDots
    ? `radial-gradient(circle at 30% 30%, ${colour.swatchDots} 0 18%, transparent 20%), radial-gradient(circle at 70% 62%, ${colour.swatchDots} 0 16%, transparent 18%), radial-gradient(circle at 38% 78%, ${colour.swatchDots} 0 12%, transparent 14%), ${colour.swatch}`
    : colour.swatch;
  return <i style={{ background }} />;
}

/** The pack as cart lines: one line per colour and size. */
function buildLines(product: ProductDisplay, chosen: CatalogVariant[]): CartItem[] {
  const lines: CartItem[] = [];
  for (const variant of chosen) {
    const existing = lines.find((line) => line.product.variant?.key === variant.key);
    if (existing) existing.quantity += 1;
    else lines.push({ product: withVariant(product, variant), quantity: 1 });
  }
  return lines;
}

/** What one piece costs inside a pack, never rounded up. */
const perUnit = (total: number, quantity: number) => Math.floor(Math.round(total * 100) / quantity) / 100;

export function ProductPage({ product, entry, content, sizeGuide, productLogoLight, faqs }: ProductPageProps) {
  const { t, m, locale } = useLanguage();
  const { tiers, colours: palette, sizes: sizeList } = entry;
  const largestPack = Math.max(1, ...tiers.map((tier) => tier.quantity));
  const unitNames = entry.unit[locale];
  const money = (amount: number) => formatPrice(amount, locale);

  // The 2-pack is the lead offer, so it starts selected when there is stock for it
  const [quantity, setQuantity] = useState(() => (product && product.stock >= 2 && tiers.some((tier) => tier.quantity === 2) ? 2 : (tiers[0]?.quantity ?? 1)));
  // One colour per piece of the largest pack; piece i starts on colour i, so three pieces start as one of each
  const [colours, setColours] = useState<string[]>(() => Array.from({ length: largestPack }, (_, i) => palette[i % Math.max(palette.length, 1)]?.key ?? ""));
  // A size is never guessed: each piece has none until the customer picks one
  const [sizes, setSizes] = useState<(string | null)[]>(() => Array.from({ length: largestPack }, () => null));
  const [sizeMissing, setSizeMissing] = useState(false);
  // The colour the customer picked last: its photo takes the gallery until they go back to the photos
  const [previewColour, setPreviewColour] = useState<string | null>(null);
  const [pastBuyButton, setPastBuyButton] = useState(false);
  const buyActions = useRef<HTMLDivElement>(null);
  const sizeRow = useRef<HTMLDivElement>(null);

  const overlay = useStorefrontUI((s) => s.overlay);
  const openCart = useStorefrontUI((s) => s.openCart);
  const setOfferLines = useCartStore((s) => s.setOfferLines);

  const price = product?.price ?? null;
  const total = price == null ? null : getLineTotal(price, quantity, entry.slug);
  const unit = total == null ? null : perUnit(total, quantity);
  const canBuy = !!product && product.stock >= quantity;
  const shippingTax = product?.shippingTax ?? 0;
  const pieces = Array.from({ length: quantity }, (_, i) => i);
  const colourOf = (i: number) => palette.find((c) => c.key === colours[i]) ?? palette[i % Math.max(palette.length, 1)];
  const unitsLabel = (n: number) => `${n} ${n === 1 ? unitNames.one : unitNames.many}`;

  const gallery = content.gallery.slice(0, MAX_GALLERY_SLIDES);
  const previewed = previewColour ? palette.find((c) => c.key === previewColour) : undefined;
  const preview: Shown | null = previewed ? { src: previewed.image, alt: `${content.name}, ${previewed.label[locale]}` } : null;
  const viewed = product ? { id: product.id, sku: product.sku, name: content.name, price: product.price, slug: entry.slug } : null;

  useEffect(() => {
    // The buy bar is hidden while the order button is in view or still below, slides in
    // once it has been scrolled past, and hides again on the way back up to it
    const el = buyActions.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([seen]) => setPastBuyButton(!seen.isIntersecting && seen.boundingClientRect.top < 0), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A link that names a colour (an ad for the leopard one: ?color=leopard) opens with it picked for every piece
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("color");
    if (!wanted || !palette.some((c) => c.key === wanted)) return;
    setColours((current) => current.map(() => wanted));
    setPreviewColour(wanted);
    // Only on arrival: later picks are the customer's
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickColour(index: number, key: string) {
    setColours((current) => current.map((colour, i) => (i === index ? key : colour)));
    setPreviewColour(key);
  }
  /** The chips under the price: one tap shows a colour and sets it for every piece of the pack. */
  function pickColourForAll(key: string) {
    setColours((current) => current.map(() => key));
    setPreviewColour(key);
  }
  function pickSize(index: number, size: string) {
    setSizes((current) => current.map((s, i) => (i === index ? size : s)));
  }
  function pickSizeForAll(size: string) {
    setSizes((current) => current.map(() => size));
    setSizeMissing(false);
  }
  // The colour and the size every piece of the chosen pack has, when they all share one
  const sharedColour = pieces.every((i) => colourOf(i)?.key === colourOf(0)?.key) ? (colourOf(0)?.key ?? null) : null;
  const sharedSize = pieces.every((i) => sizes[i] && sizes[i] === sizes[0]) ? sizes[0] : null;
  const allSized = pieces.every((i) => !!sizes[i]);

  function order() {
    if (!product || !canBuy || total == null) return;
    if (!allSized) {
      setSizeMissing(true);
      sizeRow.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const chosen = pieces.flatMap((i) => {
      const colour = colourOf(i);
      const variant = colour && sizes[i] ? getCatalogVariant(entry.slug, variantKey(colour.key, sizes[i]!)) : undefined;
      return variant ? [variant] : [];
    });
    if (chosen.length !== quantity) return;
    const lines = buildLines(product, chosen);
    setOfferLines(lines);
    trackAddToCart(lines, total);
    openCart();
  }

  const showBar = pastBuyButton && !overlay;
  const transformation = content.transformation;
  const sizeError = sizeMissing && !allSized;

  return (
    <div className="kv-page">
      <TrackViewContent product={viewed} />

      {/* 1. Screen one: the gallery and the buy box */}
      <section id="shop" className="kv-shop-top" aria-label={content.name}>
        <div className="kv-wrap">
          <div className="kv-product-grid">
            <Gallery slides={gallery} preview={preview} onLeavePreview={() => setPreviewColour(null)} />

            <div className="kv-buy-box" id="buy">
              <p className="kv-buy-eyebrow">
                <span>{content.eyebrow}</span>
                <em>{content.tagline}</em>
              </p>
              <h1 className="kv-buy-title">{content.name}</h1>
              <p className="kv-buy-desc">{content.description}</p>
              <div className="kv-price-row">
                {unit == null || price == null ? (
                  <span className="kv-price-soon">{m.product.comingSoon}</span>
                ) : (
                  <>
                    <span className="kv-price">{money(unit)}</span>
                    {/* The struck figure is the real price of one piece bought singly */}
                    {unit < price && <s className="kv-price-was">{money(price)}</s>}
                    <span className="kv-price-note">
                      {t("product.per", { unit: unitNames.one })} &middot; {m.product.delivery}: {shippingTax === 0 ? <b className="kv-free-tag">{m.product.free}</b> : <b>{money(shippingTax)}</b>}
                    </span>
                  </>
                )}
              </div>

              {/* Where TreeAura previews a lighting mood: tap a colour to see it, and to set it for the whole pack */}
              {palette.length > 0 && (
                <>
                  <div className="kv-option-label">{quantity > 1 ? m.product.colourAll : m.product.colour}</div>
                  <div className="kv-moods" role="radiogroup" aria-label={quantity > 1 ? m.product.colourAll : m.product.colour}>
                    {palette.map((colour) => (
                      <button key={colour.key} type="button" role="radio" aria-checked={sharedColour === colour.key} className="kv-mood" onClick={() => pickColourForAll(colour.key)}>
                        <Swatch colour={colour} />
                        {colour.label[locale]}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="kv-option-label kv-size-label" ref={sizeRow} id="size">
                <span>{quantity > 1 ? m.product.sizeAll : m.product.size}</span>
                <a href="#sizes" className="kv-size-guide-link">{m.product.sizeGuide}</a>
              </div>
              <div className={`kv-sizes${sizeError ? " is-missing" : ""}`} role="radiogroup" aria-label={quantity > 1 ? m.product.sizeAll : m.product.size}>
                {sizeList.map((size) => (
                  <button key={size} type="button" role="radio" aria-checked={sharedSize === size} className="kv-size" onClick={() => pickSizeForAll(size)}>
                    {size}
                  </button>
                ))}
              </div>
              {sizeError && (
                <p className="kv-size-error" role="alert">
                  {m.product.sizeMissing}
                </p>
              )}

              <div className="kv-option-label" id="bundles">
                {m.product.chooseBundle}
              </div>
              <div className="kv-bundles" role="radiogroup" aria-label={m.product.bundle}>
                {tiers.map((tier) => {
                  const on = quantity === tier.quantity;
                  const unavailable = !product || product.stock < tier.quantity;
                  const lineTotal = price == null ? null : getLineTotal(price, tier.quantity, entry.slug);
                  // Real savings against buying the same number one at a time
                  const savings = price == null ? 0 : getBundleSavings(price, tier.quantity, entry.slug);
                  return (
                    <button key={tier.quantity} type="button" role="radio" aria-checked={on} disabled={unavailable} className={`kv-bundle${on ? " on" : ""}`} onClick={() => setQuantity(tier.quantity)}>
                      {tier.badge && <span className="kv-bundle-flag">{tier.badge === "popular" ? m.product.popular : m.product.best}</span>}
                      <span className="kv-bundle-radio" aria-hidden="true" />
                      <span className="kv-bundle-main">
                        <span className="kv-bundle-title">
                          {unitsLabel(tier.quantity)}
                          {savings > 0 && <em className="kv-save-pill">{t("product.youSave", { amount: money(savings) })}</em>}
                        </span>
                        <span className="kv-bundle-sub">
                          {tier.quantity === 1 ? m.product.single : t("product.packOf", { count: tier.quantity })}
                          {lineTotal != null && tier.quantity > 1 && (
                            <>
                              {" "}
                              &middot; {money(perUnit(lineTotal, tier.quantity))} / {unitNames.one}
                            </>
                          )}
                        </span>
                      </span>
                      {lineTotal != null && price != null && (
                        <span className="kv-bundle-price">
                          <strong>{money(lineTotal)}</strong>
                          {savings > 0 && <s>{money(price * tier.quantity)}</s>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* A pack of two or three can mix colours and sizes: one row per piece. A single piece is covered by the chips above */}
              {quantity > 1 && (
                <>
                  <div className="kv-option-label">{t("product.each", { unit: unitNames.one })}</div>
                  <div className="kv-colour-rows">
                    {pieces.map((i) => {
                      const current = colourOf(i);
                      return (
                        <div key={i} className="kv-colour-row">
                          <span className="kv-colour-name">{t("product.pieceN", { unit: unitNames.one, n: i + 1 })}</span>
                          <div className="kv-moods" role="radiogroup" aria-label={t("product.colourOf", { unit: unitNames.one, n: i + 1 })}>
                            {palette.map((colour) => (
                              <button key={colour.key} type="button" role="radio" aria-checked={current?.key === colour.key} className="kv-mood" onClick={() => pickColour(i, colour.key)}>
                                <Swatch colour={colour} />
                                {colour.label[locale]}
                              </button>
                            ))}
                          </div>
                          <select
                            className={`kv-size-select${sizeMissing && !sizes[i] ? " is-missing" : ""}`}
                            aria-label={t("product.sizeOf", { unit: unitNames.one, n: i + 1 })}
                            value={sizes[i] ?? ""}
                            onChange={(e) => pickSize(i, e.target.value)}
                          >
                            <option value="" disabled>
                              {m.product.size}
                            </option>
                            {sizeList.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="kv-buy-actions" id="buy-cta" ref={buyActions}>
                <button id="buy-add" type="button" className="kv-btn kv-btn-primary kv-btn-block" disabled={!canBuy} onClick={order}>
                  {canBuy && total != null ? t("product.order", { price: money(total) }) : product ? m.product.unavailable : m.product.comingSoon}
                </button>
              </div>

              <CodBadge title={m.product.codTitle} sub={m.product.codSub} className="kv-cod-pdp" />
              <ul className="kv-trust-row">
                <li><TrustIcon name="cash" /><span>{m.product.trustCod}</span></li>
                <li><TrustIcon name="truck" /><span>{m.product.trustDelivery}</span></li>
                <li><TrustIcon name="exchange" /><span>{t("product.trustExchange", { days: storePolicies.exchange.windowDays })}</span></li>
                <li><TrustIcon name="support" /><span>{content.trust}</span></li>
              </ul>

              <div className="kv-ship-note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7-6.200-7-11.500A7 7 0 0112 2.500a7 7 0 017 7C19 14.800 12 21 12 21z" stroke="currentColor" strokeWidth="1.500" /><circle cx="12" cy="9.500" r="2.500" stroke="currentColor" strokeWidth="1.500" /></svg>
                <span>
                  <strong>{m.product.shipStrong}</strong> {t("product.shipText", { min: entry.deliveryHours.min, max: entry.deliveryHours.max })}
                </span>
              </div>

              <ul className="kv-feature-list">
                {content.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Before and after */}
      {transformation && (
        <section id="before-after" className="kv-section kv-section-ink kv-on-dark">
          <div className="kv-wrap">
            <div className="kv-section-head">
              <p className="kv-eyebrow">{transformation.eyebrow}</p>
              <h2 className="kv-display">{transformation.heading}</h2>
              <p className="kv-lede">{transformation.lede}</p>
            </div>
            <BeforeAfter
              before={transformation.before}
              after={transformation.after}
              labels={{ before: transformation.beforeLabel, after: transformation.afterLabel, drag: m.product.dragCompare, hint: m.product.dragHint }}
            />
          </div>
        </section>
      )}

      {/* 3. How it works */}
      <section id="how" className="kv-section">
        <div className="kv-wrap">
          <div className="kv-section-head">
            <p className="kv-eyebrow">{m.product.how}</p>
            <h2 className="kv-display">{content.howItWorks.heading}</h2>
          </div>
          <div className="kv-steps">
            {content.howItWorks.steps.map((step, i) => (
              <div className="kv-step" key={step.title}>
                <div className="kv-step-n">{String(i + 1).padStart(2, "0")}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. The size guide */}
      <section id="sizes" className="kv-section-tight kv-size-guide">
        <div className="kv-wrap" style={{ maxWidth: 860 }}>
          <div className="kv-section-head">
            <p className="kv-eyebrow">{m.sizeGuide.eyebrow}</p>
            <h2 className="kv-display">{m.sizeGuide.heading}</h2>
            <p className="kv-lede">{m.sizeGuide.lede}</p>
          </div>
          <div className="kv-table-wrap" tabIndex={0} role="region" aria-label={m.sizeGuide.usual}>
            <table className="kv-size-table">
              <thead>
                <tr>
                  <th scope="col">{m.sizeGuide.size}</th>
                  <th scope="col">{m.sizeGuide.usual}</th>
                </tr>
              </thead>
              <tbody>
                {sizeGuide.rows.map((row) => (
                  <tr key={row.size}>
                    <th scope="row">{row.size}</th>
                    <td><bdi dir="ltr">{row.usual.join(" · ")}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="kv-size-tip">{m.sizeGuide.tip}</p>
          <h3 className="kv-size-sub">{m.sizeGuide.measureTitle}</h3>
          <p className="kv-size-text">{m.sizeGuide.measureText}</p>
          <div className="kv-table-wrap" tabIndex={0} role="region" aria-label={m.sizeGuide.underbust}>
            <table className="kv-size-table kv-size-table-bands">
              <tbody>
                <tr>
                  <th scope="row">{m.sizeGuide.underbust}</th>
                  {sizeGuide.bands.map((b) => (
                    <td key={b.band} dir="ltr">{b.underbust}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{m.sizeGuide.band}</th>
                  {sizeGuide.bands.map((b) => (
                    <td key={b.band} dir="ltr"><strong>{b.band}</strong></td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 5. Specifications and what is in the parcel */}
      <section className="kv-section-tight" style={{ background: "var(--kv-ivory-2)" }}>
        <div className="kv-wrap kv-two-col" style={{ alignItems: "start" }}>
          <div>
            <p className="kv-eyebrow">{m.product.details}</p>
            <h2 className="kv-display" style={{ fontSize: "clamp(30px,6vw,44px)", margin: "10px 0 20px" }}>{m.product.specs}</h2>
            <dl className="kv-specs">
              {content.facts.map((fact) => (
                <div className="kv-spec" key={fact.name}>
                  <dt>{fact.name}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div style={{ marginTop: 28 }}>
            <p className="kv-eyebrow">{m.product.inBoxEyebrow}</p>
            <h2 className="kv-display" style={{ fontSize: "clamp(30px,6vw,44px)", margin: "10px 0 20px" }}>{m.product.inBox}</h2>
            <ul className="kv-feature-list">
              {content.included.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="kv-section">
        <div className="kv-wrap" style={{ maxWidth: 860 }}>
          <div className="kv-section-head">
            <p className="kv-eyebrow">{m.product.questions}</p>
            <h2 className="kv-display">{m.product.goodToKnow}</h2>
          </div>
          <div className="kv-faq">
            {faqs.map((faq) => (
              <details key={faq.q}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing: back up to the buy box */}
      <section className="kv-section kv-section-dark kv-on-dark" style={{ textAlign: "center" }}>
        <div className="kv-wrap" style={{ maxWidth: 760 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="kv-product-logo" src={productLogoLight} alt="Sanadi" width={520} height={132} loading="lazy" />
          <h2 className="kv-display" style={{ margin: "12px 0 18px" }}>{content.closing.heading}</h2>
          <a href="#buy" className="kv-btn kv-btn-gold" id="order-up">
            {content.closing.cta}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        </div>
      </section>

      {/* The buy bar, on phones: fully inert until it is shown */}
      {product && (
        <div className={`kv-sticky-bar${showBar ? " show" : ""}`} aria-hidden={!showBar} inert={!showBar}>
          <div className="kv-sb-info">
            <strong>
              {total != null && money(total)} {total != null && price != null && price * quantity > total && <s>{money(price * quantity)}</s>}
            </strong>
            <span>
              {unitsLabel(quantity)} &middot; {m.product.stickyFree}
            </span>
          </div>
          <button type="button" className="kv-btn kv-btn-primary" tabIndex={showBar ? 0 : -1} disabled={!canBuy} onClick={order}>
            {canBuy ? m.product.orderShort : m.product.unavailableShort}
          </button>
        </div>
      )}
    </div>
  );
}
