"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { SHIPPING_COUNTRY_CODES, type CatalogProduct, type CatalogVariant, type CountryCode } from "@/config/catalog";
import { storePolicies } from "@/config/policies";
import type { GalleryBadge, GalleryImage, ProductContent } from "@/config/products/types";
import { siteConfig } from "@/config/site";
import { trackAddToCart } from "@/lib/analytics/meta-pixel";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { arrivalRange } from "@/lib/delivery-estimate";
import { formatPrice } from "@/lib/formatters";
import { COUNTRY_RULES, isCountryCode } from "@/lib/us-address";
import { useCartStore, type CartItem } from "@/store/cart-store";
import { useStorefrontUI } from "@/store/storefront-ui";
import { withVariant, type ProductDisplay } from "@/types/product";
import { TrackViewContent } from "@/components/analytics/track-view-content";
import { PayBadges, TrustIcon } from "@/components/payments/pay-badges";
import { BeforeAfter } from "./before-after";
import { ProductDiagram } from "./product-diagram";

/*
 * The product page template. Its layout is the owner's TreeAura product page,
 * section for section (styles in app/brand.css): gallery and buy box, a
 * before/after comparison, three steps beside a diagram, specifications, the
 * FAQ and a closing band, with a buy bar that slides in on phones.
 */

export interface ProductPageProps {
  /** The database product (live price, stock, shippingTax, images); null if it isn't in the database yet */
  product: ProductDisplay | null;
  /** Tiers, colours, shipping per country, unit names */
  entry: CatalogProduct;
  /** All copy and media */
  content: ProductContent;
  /** The complete FAQ list, already assembled by the server page (product questions + shipping/returns) */
  faqs: { q: string; a: string }[];
  /** Cloudflare's CF-IPCountry for this visitor, e.g. "US", "DE", or null */
  visitorCountry?: string | null;
  /** Today in the store's time zone (YYYY-MM-DD), from the server, for the delivery estimate */
  today?: string | null;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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
      {icon === "ring" && (<><circle {...p} cx="12" cy="12" r="8.5" strokeDasharray="5.2 2.6" /><circle {...p} cx="12" cy="12" r="3.6" /></>)}
      {icon === "reverse" && (<><path {...p} d="M20 4v16" /><path {...p} d="M4 9h8.500a3.500 3.500 0 010 7H7" /><path {...p} d="M9.500 13.500L7 16l2.500 2.500" /></>)}
      {icon === "shield" && (<><path {...p} d="M12 3l7 3v5c0 4.500-3 8.300-7 10-4-1.700-7-5.500-7-10V6z" /><path {...p} d="M9 12l2.200 2.200L15.200 10" /></>)}
      {icon === "bolt" && (<path {...p} d="M13 3L5 13.500h6L10 21l8-10.500h-6z" />)}
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
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);
  if (slides.length === 0) return null;

  const shown: Shown = preview ?? slides[Math.min(active, slides.length - 1)];
  const go = (dir: 1 | -1) => {
    onLeavePreview();
    setActive((i) => (i + dir + slides.length) % slides.length);
  };

  return (
    <div className="kv-gallery">
      <div
        className="kv-gallery-main"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40 && slides.length > 1) go(dx < 0 ? 1 : -1);
        }}
      >
        <Photo src={shown.src} alt={shown.alt} sizes="(min-width: 960px) 640px, 100vw" preload={!preview && active === 0} />
        <span className={`kv-gallery-mark${shown.dark ? " on-img-dark" : ""}`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown.dark ? siteConfig.wordmarkLight : siteConfig.wordmark} alt="" width={951} height={334} />
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
              aria-label={`Show image ${i + 1}: ${slide.alt}`}
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

type ShippingNotice =
  | { kind: "ships"; country: string; days: { min: number; max: number } }
  | { kind: "unavailable"; country: string; shipsTo: string[] };

/** The English name of a two-letter country code, or null when the browser or server doesn't know it. */
function regionName(code: string): string | null {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return name && name !== code && name !== "Unknown Region" ? name : null;
  } catch {
    return null;
  }
}

/**
 * What the page says about delivery to this visitor. A country the product
 * ships to gets its own transit time. Any other real country is told plainly
 * that we don't deliver there. No country (no Cloudflare header, or its "XX"
 * unknown and "T1" Tor markers) reads as the United States.
 */
function shippingNotice(entry: CatalogProduct, visitorCountry: string | null | undefined): ShippingNotice | null {
  const destinations = SHIPPING_COUNTRY_CODES.filter((code) => entry.shipping[code]);
  const ships = (code: CountryCode | undefined): ShippingNotice | null => {
    const shipping = code ? entry.shipping[code] : undefined;
    return code && shipping ? { kind: "ships", country: COUNTRY_RULES[code].name, days: shipping.days } : null;
  };

  const code = (visitorCountry ?? "").trim().toUpperCase();
  if (isCountryCode(code) && entry.shipping[code]) return ships(code);
  if (/^[A-Z]{2}$/.test(code) && code !== "XX") {
    const country = isCountryCode(code) ? COUNTRY_RULES[code].name : regionName(code);
    return { kind: "unavailable", country: country ?? "your country", shipsTo: destinations.map((c) => COUNTRY_RULES[c].name) };
  }
  return ships(entry.shipping.US ? "US" : destinations[0]);
}

/**
 * The pack as cart lines. With a colour choice there is one line per colour
 * (`chosen` holds the colour of each unit); without one, a single line.
 */
function buildLines(product: ProductDisplay, quantity: number, chosen: CatalogVariant[] | null): CartItem[] {
  if (!chosen) return [{ product, quantity }];
  const lines: CartItem[] = [];
  for (const variant of chosen) {
    const existing = lines.find((line) => line.product.variant?.key === variant.key);
    if (existing) existing.quantity += 1;
    else lines.push({ product: withVariant(product, variant), quantity: 1 });
  }
  return lines;
}

/** What one unit costs inside a pack, never rounded up: $49.99 for two reads $24.99 each. */
const perUnit = (total: number, quantity: number) => Math.floor(Math.round(total * 100) / quantity) / 100;

export function ProductPage({ product, entry, content, faqs, visitorCountry = null, today = null }: ProductPageProps) {
  const { tiers, variants } = entry;
  const largestPack = Math.max(1, ...tiers.map((tier) => tier.quantity));
  const hasColours = entry.hasColourChoice && variants.length > 0;

  // The 2-pack is the lead offer, so it starts selected when there is stock for it
  const [quantity, setQuantity] = useState(() => (product && product.stock >= 2 && tiers.some((tier) => tier.quantity === 2) ? 2 : (tiers[0]?.quantity ?? 1)));
  // One colour per unit of the largest pack; unit i starts on colour i, so three units start as one of each
  const [colours, setColours] = useState<string[]>(() => Array.from({ length: largestPack }, (_, i) => variants[i % Math.max(variants.length, 1)]?.key ?? ""));
  // The colour the customer picked last: its photo takes the gallery until they go back to the photos
  const [previewColour, setPreviewColour] = useState<string | null>(null);
  const [pastBuyButton, setPastBuyButton] = useState(false);
  const buyActions = useRef<HTMLDivElement>(null);

  const overlay = useStorefrontUI((s) => s.overlay);
  const openCart = useStorefrontUI((s) => s.openCart);
  const setOfferLines = useCartStore((s) => s.setOfferLines);

  const price = product?.price ?? null;
  const total = price == null ? null : getLineTotal(price, quantity, entry.slug);
  const unit = total == null ? null : perUnit(total, quantity);
  const canBuy = !!product && product.stock >= quantity;
  const variantFor = (index: number): CatalogVariant | undefined => variants.find((v) => v.key === colours[index]) ?? variants[index % Math.max(variants.length, 1)];
  const chosen = Array.from({ length: quantity }, (_, i) => variantFor(i)).filter((v): v is CatalogVariant => !!v);
  const unitName = capitalise(entry.unit.one);
  const unitsLabel = (n: number) => `${n} ${capitalise(n === 1 ? entry.unit.one : entry.unit.many)}`;
  const shippingTax = product?.shippingTax ?? 0;

  const gallery = content.gallery.slice(0, MAX_GALLERY_SLIDES);
  const previewVariant = previewColour ? variants.find((v) => v.key === previewColour) : undefined;
  const preview: Shown | null = previewVariant?.image ? { src: previewVariant.image, alt: `${content.name}, ${previewVariant.label}` } : null;

  const notice = shippingNotice(entry, visitorCountry);
  const arrival = notice?.kind === "ships" && today ? arrivalRange(today, notice.days) : null;
  const viewed = product ? { id: product.id, sku: variants[0]?.sku ?? product.sku, name: content.name, price: product.price, slug: entry.slug } : null;
  // The box contents have their own column, so the specification list leaves that row out
  const specs = content.seo.facts.filter((fact) => fact.name !== "In the box");

  useEffect(() => {
    // The buy bar is hidden while the Add to cart button is in view or still below, slides in
    // once it has been scrolled past, and hides again on the way back up to it
    const el = buyActions.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([seen]) => setPastBuyButton(!seen.isIntersecting && seen.boundingClientRect.top < 0), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A link that names a colour (the product feed's listings do: ?color=blue) opens with it picked for the first unit
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("color");
    if (!wanted || !hasColours || !variants.some((v) => v.key === wanted)) return;
    setColours((current) => current.map((colour, i) => (i === 0 ? wanted : colour)));
    setPreviewColour(wanted);
    // Only on arrival: later picks are the customer's
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickColour(index: number, key: string) {
    setColours((current) => current.map((colour, i) => (i === index ? key : colour)));
    setPreviewColour(key);
  }

  /** The chips under the price: one tap shows a colour and sets it for every unit of the pack. */
  function pickColourForAll(key: string) {
    setColours((current) => current.map(() => key));
    setPreviewColour(key);
  }
  // The colour every unit of the chosen pack has, when they all share one
  const sharedColour = chosen.length > 0 && chosen.every((v) => v.key === chosen[0].key) ? chosen[0].key : null;

  function addToCart() {
    if (!product || !canBuy || total == null) return;
    const lines = buildLines(product, quantity, hasColours ? chosen : null);
    setOfferLines(lines);
    trackAddToCart(lines, total);
    openCart();
  }

  const showBar = pastBuyButton && !overlay;
  const transformation = content.transformation;

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
                  <span className="kv-price-soon">Coming soon</span>
                ) : (
                  <>
                    <span className="kv-price">{formatPrice(unit)}</span>
                    {/* The struck figure is the real price of one unit bought singly */}
                    {unit < price && <s className="kv-price-was">{formatPrice(price)}</s>}
                    <span className="kv-price-note">
                      per {entry.unit.one} &middot; Shipping: {shippingTax === 0 ? <b className="kv-free-tag">FREE</b> : <b>{formatPrice(shippingTax)}</b>}
                    </span>
                  </>
                )}
              </div>

              {/* Where TreeAura previews a lighting mood: tap a color to see it, and to set it for the whole pack */}
              {hasColours && (
                <div className="kv-moods" role="radiogroup" aria-label={quantity > 1 ? `Color for all ${quantity} ${entry.unit.many}` : "Color"}>
                  {variants.map((variant) => {
                    const on = sharedColour === variant.key;
                    return (
                      <button key={variant.key} type="button" role="radio" aria-checked={on} className="kv-mood" onClick={() => pickColourForAll(variant.key)}>
                        <i style={{ background: variant.swatch, boxShadow: `0 0 8px ${variant.swatch}` }} />
                        {variant.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="kv-option-label" id="bundles">
                Choose your bundle
              </div>
              <div className="kv-bundles" role="radiogroup" aria-label="Bundle">
                {tiers.map((tier) => {
                  const on = quantity === tier.quantity;
                  const unavailable = !product || product.stock < tier.quantity;
                  const lineTotal = price == null ? null : getLineTotal(price, tier.quantity, entry.slug);
                  // Real savings against buying the same number one at a time
                  const savings = price == null ? 0 : getBundleSavings(price, tier.quantity, entry.slug);
                  return (
                    <button key={tier.quantity} type="button" role="radio" aria-checked={on} disabled={unavailable} className={`kv-bundle${on ? " on" : ""}`} onClick={() => setQuantity(tier.quantity)}>
                      {tier.badge && <span className="kv-bundle-flag">{tier.badge}</span>}
                      <span className="kv-bundle-radio" aria-hidden="true" />
                      <span className="kv-bundle-main">
                        <span className="kv-bundle-title">
                          {unitsLabel(tier.quantity)}
                          {savings > 0 && <em className="kv-save-pill">You save {formatPrice(savings)}</em>}
                        </span>
                        <span className="kv-bundle-sub">
                          {tier.quantity === 1 ? "Single" : `${tier.quantity}-Pack`}
                          {lineTotal != null && (
                            <>
                              {" "}
                              &middot; {formatPrice(perUnit(lineTotal, tier.quantity))} / {entry.unit.one}
                            </>
                          )}
                        </span>
                      </span>
                      {lineTotal != null && price != null && (
                        <span className="kv-bundle-price">
                          <strong>{formatPrice(lineTotal)}</strong>
                          {savings > 0 && <s>{formatPrice(price * tier.quantity)}</s>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* A pack of two or three can mix colors: one row per unit. A single unit is covered by the chips above */}
              {hasColours && quantity > 1 && (
                <>
                  <div className="kv-option-label">Mix your colors</div>
                  <div className="kv-colour-rows">
                    {Array.from({ length: quantity }, (_, i) => {
                      const current = variantFor(i);
                      const name = `${unitName} ${i + 1}`;
                      return (
                        <div key={i} className="kv-colour-row">
                          <span className="kv-colour-name">{name}</span>
                          <div className="kv-moods" role="radiogroup" aria-label={`Color of ${entry.unit.one} ${i + 1}`}>
                            {variants.map((variant) => {
                              const on = current?.key === variant.key;
                              return (
                                <button key={variant.key} type="button" role="radio" aria-checked={on} className="kv-mood" onClick={() => pickColour(i, variant.key)}>
                                  <i style={{ background: variant.swatch, boxShadow: `0 0 8px ${variant.swatch}` }} />
                                  {variant.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="kv-buy-actions" id="buy-cta" ref={buyActions}>
                <button id="buy-add" type="button" className="kv-btn kv-btn-primary kv-btn-block" disabled={!canBuy} onClick={addToCart}>
                  {canBuy && total != null ? <>Add to cart &middot; {formatPrice(total)}</> : product ? "Unavailable in this quantity" : "Coming soon"}
                </button>
              </div>

              <PayBadges className="kv-paybadges-pdp" />
              <ul className="kv-trust-row">
                <li><TrustIcon name="guarantee" /><span>{storePolicies.returns.windowDays}-Day Money-Back Guarantee</span></li>
                <li><TrustIcon name="truck" /><span>Free Tracked Shipping</span></li>
                <li><TrustIcon name={content.trust.icon} /><span>{content.trust.label}</span></li>
                <li><TrustIcon name="lock" /><span>Encrypted SSL Checkout</span></li>
              </ul>

              {notice && (
                <div className="kv-ship-note">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7-6.200-7-11.500A7 7 0 0112 2.500a7 7 0 017 7C19 14.800 12 21 12 21z" stroke="currentColor" strokeWidth="1.500" /><circle cx="12" cy="9.500" r="2.400" stroke="currentColor" strokeWidth="1.500" /></svg>
                  <span>
                    <strong>Shipping: FREE.</strong>{" "}
                    {notice.kind === "ships" ? (
                      <>
                        Tracked delivery to {notice.country} is included in the price.{" "}
                        {arrival ? <>Order today, estimated arrival {arrival}.</> : <>Arrives about {notice.days.min}&ndash;{notice.days.max} days after it ships.</>}
                      </>
                    ) : (
                      <>
                        {/* The server and the browser may spell a country's name differently; either is fine */}
                        Tracked delivery is included in every order. We&rsquo;re not delivering to <span suppressHydrationWarning>{notice.country}</span> yet
                        {notice.shipsTo.length > 0 && <>; we currently ship to {notice.shipsTo.join(", ")}</>}.
                      </>
                    )}
                  </span>
                </div>
              )}

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
            <BeforeAfter before={transformation.before} after={transformation.after} />
          </div>
        </section>
      )}

      {/* 3. How it works */}
      <section id="how" className="kv-section">
        <div className="kv-wrap">
          <div className="kv-section-head">
            <p className="kv-eyebrow">How it works</p>
            <h2 className="kv-display">{content.howItWorks.heading}</h2>
          </div>
          {content.diagram ? (
            <div className="kv-two-col kv-how-grid">
              <div className="kv-steps" style={{ gridTemplateColumns: "1fr" }}>
                {content.howItWorks.steps.map((step, i) => (
                  <div className="kv-step" key={step.title}>
                    <div className="kv-step-n">{String(i + 1).padStart(2, "0")}</div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                ))}
              </div>
              <div className="kv-diagram kv-how-diagram">
                <ProductDiagram id={content.diagram.id} />
                <p className="kv-caption" style={{ textAlign: "center", marginTop: 6 }}>
                  {content.diagram.caption}
                </p>
              </div>
            </div>
          ) : (
            <div className="kv-steps">
              {content.howItWorks.steps.map((step, i) => (
                <div className="kv-step" key={step.title}>
                  <div className="kv-step-n">{String(i + 1).padStart(2, "0")}</div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Specifications and what is in the box */}
      <section className="kv-section-tight" style={{ background: "var(--kv-ivory-2)" }}>
        <div className="kv-wrap kv-two-col" style={{ alignItems: "start" }}>
          <div>
            <p className="kv-eyebrow">Details</p>
            <h2 className="kv-display" style={{ fontSize: "clamp(30px,6vw,44px)", margin: "10px 0 20px" }}>Specifications</h2>
            <dl className="kv-specs">
              {specs.map((fact) => (
                <div className="kv-spec" key={fact.name}>
                  <dt>{fact.name}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div style={{ marginTop: 28 }}>
            <p className="kv-eyebrow">In the box</p>
            <h2 className="kv-display" style={{ fontSize: "clamp(30px,6vw,44px)", margin: "10px 0 20px" }}>What you receive</h2>
            <ul className="kv-feature-list">
              {content.included.items.map((item) => (
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
            <p className="kv-eyebrow">Questions</p>
            <h2 className="kv-display">Good to know.</h2>
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
          <p className="kv-eyebrow">{siteConfig.name}</p>
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
              {total != null && formatPrice(total)} {total != null && price != null && price * quantity > total && <s>{formatPrice(price * quantity)}</s>}
            </strong>
            <span>
              {unitsLabel(quantity)} &middot; {shippingTax === 0 ? "Free shipping included" : `${formatPrice(shippingTax)} shipping`}
            </span>
          </div>
          <button type="button" className="kv-btn kv-btn-primary" tabIndex={showBar ? 0 : -1} disabled={!canBuy} onClick={addToCart}>
            {canBuy ? "Add to cart" : "Unavailable"}
          </button>
        </div>
      )}
    </div>
  );
}
