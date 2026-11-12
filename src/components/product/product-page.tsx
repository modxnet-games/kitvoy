"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BatteryCharging,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Hand,
  Info,
  LockKeyhole,
  Package,
  PawPrint,
  Play,
  Plus,
  Power,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Truck,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import "@/app/product-page.css";

import { SHIPPING_COUNTRY_CODES, type CatalogProduct, type CatalogVariant, type CountryCode } from "@/config/catalog";
import { processingText, storePolicies } from "@/config/policies";
import type { DemoLoop, GalleryImage, IconName, ProductContent } from "@/config/products/types";
import { trackAddToCart } from "@/lib/analytics/meta-pixel";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { formatPrice } from "@/lib/formatters";
import type { ReviewSummary } from "@/lib/reviews";
import { COUNTRY_RULES, isCountryCode } from "@/lib/us-address";
import { useCartStore, type CartItem } from "@/store/cart-store";
import { useStorefrontUI } from "@/store/storefront-ui";
import { withVariant, type ProductDisplay } from "@/types/product";
import { TrackViewContent } from "@/components/analytics/track-view-content";
import { CustomerReviews } from "@/components/landing/customer-reviews";
import { usePrefersReducedMotion } from "@/components/landing/use-reduced-motion";

export interface ProductPageProps {
  /** The database product (live price, stock, shippingTax, images); null if it isn't in the database yet */
  product: ProductDisplay | null;
  /** Tiers, colours, shipping per country, unit names */
  entry: CatalogProduct;
  /** All copy and media */
  content: ProductContent;
  /** The complete FAQ list, already assembled by the server page (product questions + shipping/returns) */
  faqs: { q: string; a: string }[];
  /** The reviews section is rendered only when there is at least one approved review */
  reviews?: ReviewSummary | null;
  /** Cloudflare's CF-IPCountry for this visitor, e.g. "US", "DE", or null */
  visitorCountry?: string | null;
}

const ICONS: Record<IconName, LucideIcon> = {
  sparkles: Sparkles,
  zap: Zap,
  shield: ShieldCheck,
  battery: BatteryCharging,
  paw: PawPrint,
  ruler: Ruler,
  truck: Truck,
  package: Package,
  power: Power,
  play: Play,
  hand: Hand,
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A photo that fills its (position: relative, fixed aspect ratio) parent. If
 * the file is missing or fails to load, a plain tinted block stands in for it,
 * so the page never shows a broken-image icon. next/image re-triggers an error
 * that happened before hydration when `onError` is set, so early failures are
 * caught too.
 */
function Photo({ src, alt, sizes, preload = false }: { src: string; alt: string; sizes: string; preload?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <span className="pp-image-fallback" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />;
  return <Image fill className="pp-cover" src={src} alt={alt} sizes={sizes} preload={preload} onError={() => setFailedSrc(src)} />;
}

/** Swipeable photo strip (native scroll-snap), with arrows and thumbnails on larger screens and dots on phones. */
function Gallery({ slides }: { slides: GalleryImage[] }) {
  const track = useRef<HTMLUListElement>(null);
  const frame = useRef(0);
  const [active, setActive] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const count = slides.length;

  const goTo = useCallback(
    (index: number) => {
      const el = track.current;
      if (!el) return;
      const target = Math.max(0, Math.min(index, count - 1));
      el.scrollTo({ left: target * el.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [count, reducedMotion],
  );

  // The slide in view follows the scroll position, whatever moved it: a swipe, the keyboard, an arrow or a thumbnail
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = track.current;
      if (el && el.clientWidth > 0) setActive(Math.round(el.scrollLeft / el.clientWidth));
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // A newly picked colour becomes the first photo: bring it into view
  const firstSrc = slides[0]?.src;
  const shownFirst = useRef(firstSrc);
  useEffect(() => {
    if (shownFirst.current === firstSrc) return;
    shownFirst.current = firstSrc;
    goTo(0);
  }, [firstSrc, goTo]);

  if (count === 0) return null;

  return (
    <div className="pp-gallery" role="region" aria-label="Product gallery">
      <div className="pp-gallery-stage">
        <ul ref={track} className="pp-gallery-track" tabIndex={0} onScroll={onScroll}>
          {slides.map((slide, i) => (
            <li key={i} className="pp-gallery-slide">
              <Photo key={slide.src} src={slide.src} alt={slide.alt} sizes="(max-width: 850px) 100vw, 52vw" preload={i === 0} />
            </li>
          ))}
        </ul>
        {count > 1 && (
          <>
            <button type="button" className="pp-gallery-arrow is-prev" aria-label="Previous product image" disabled={active === 0} onClick={() => goTo(active - 1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="pp-gallery-arrow is-next" aria-label="Next product image" disabled={active >= count - 1} onClick={() => goTo(active + 1)}>
              <ChevronRight aria-hidden="true" />
            </button>
            <div className="pp-gallery-dots" aria-hidden="true">
              {slides.map((_, i) => (
                <span key={i} className={i === active ? "is-active" : undefined} />
              ))}
            </div>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="pp-thumbs">
          {slides.map((slide, i) => (
            <button key={i} type="button" className="pp-thumb" aria-current={i === active ? "true" : undefined} onClick={() => goTo(i)}>
              <span className="pp-thumb-image">
                <Photo key={slide.src} src={slide.src} alt="" sizes="120px" />
              </span>
              <span className="pp-thumb-label">{slide.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A looping clip. It starts muted when it scrolls into view and pauses when it
 * leaves, rather than through the autoplay attribute: that way nothing plays
 * for a visitor who asked for reduced motion, who gets the poster and the
 * player's own controls instead.
 */
function DemoVideo({ loop, src }: { loop: DemoLoop; src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (reducedMotion) {
      video.pause();
      return;
    }
    video.muted = true;
    const play = () => {
      video.play().catch(() => {
        // The browser refused to start it (data saver, autoplay blocked): the poster stays
      });
    };
    if (!("IntersectionObserver" in window)) {
      play();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <video ref={ref} muted loop playsInline preload="metadata" poster={loop.poster} controls={reducedMotion} aria-label={loop.posterAlt}>
      {loop.webm && <source src={loop.webm} type="video/webm" />}
      <source src={src} type="video/mp4" />
    </video>
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

export function ProductPage({ product, entry, content, faqs, reviews, visitorCountry = null }: ProductPageProps) {
  const { tiers, variants } = entry;
  const largestPack = Math.max(1, ...tiers.map((tier) => tier.quantity));
  const hasColours = entry.hasColourChoice && variants.length > 0;

  // The 2-pack is the lead offer, so it starts selected when there is stock for it
  const [quantity, setQuantity] = useState(() => (product && product.stock >= 2 && tiers.some((tier) => tier.quantity === 2) ? 2 : (tiers[0]?.quantity ?? 1)));
  // One colour per unit of the largest pack; unit i starts on colour i, so three units start as one of each
  const [colours, setColours] = useState<string[]>(() => Array.from({ length: largestPack }, (_, i) => variants[i % Math.max(variants.length, 1)]?.key ?? ""));
  // The colour the customer picked last; its photo leads the gallery
  const [leadColour, setLeadColour] = useState<string | null>(null);
  const [pastBuyButton, setPastBuyButton] = useState(false);
  const buyButton = useRef<HTMLButtonElement>(null);

  const overlay = useStorefrontUI((s) => s.overlay);
  const openCart = useStorefrontUI((s) => s.openCart);
  const setOfferLines = useCartStore((s) => s.setOfferLines);

  const price = product?.price ?? null;
  const total = price == null ? null : getLineTotal(price, quantity, entry.slug);
  const canBuy = !!product && product.stock >= quantity;
  const selectedTier = tiers.find((tier) => tier.quantity === quantity);
  const variantFor = (index: number): CatalogVariant | undefined => variants.find((v) => v.key === colours[index]) ?? variants[index % Math.max(variants.length, 1)];
  const chosen = Array.from({ length: quantity }, (_, i) => variantFor(i)).filter((v): v is CatalogVariant => !!v);
  const unitName = capitalise(entry.unit.one);

  const leadVariant = leadColour ? variants.find((v) => v.key === leadColour) : undefined;
  const slides: GalleryImage[] =
    leadVariant?.image && content.gallery.length > 0
      ? [{ src: leadVariant.image, alt: `${content.name}, ${leadVariant.label}`, label: leadVariant.label }, ...content.gallery.slice(1)]
      : content.gallery;

  const notice = shippingNotice(entry, visitorCountry);
  const viewed = product ? { id: product.id, sku: variants[0]?.sku ?? product.sku, name: content.name, price: product.price, slug: entry.slug } : null;

  useEffect(() => {
    const button = buyButton.current;
    if (!button || !("IntersectionObserver" in window)) return;
    // The tall bottom margin counts "still below the fold" as intersecting, so the bar
    // shows only after the button has left through the top, also after an anchor jump
    const observer = new IntersectionObserver(([seen]) => setPastBuyButton(!seen.isIntersecting && seen.boundingClientRect.bottom < 0), { rootMargin: "0px 0px 100000px 0px" });
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  // A link that names a colour (the product feed's listings do: ?colour=blue) opens with it picked for the first unit
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("colour");
    if (!wanted || !hasColours || !variants.some((v) => v.key === wanted)) return;
    setColours((current) => current.map((colour, i) => (i === 0 ? wanted : colour)));
    setLeadColour(wanted);
    // Only on arrival: later picks are the customer's
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickColour(index: number, key: string) {
    setColours((current) => current.map((colour, i) => (i === index ? key : colour)));
    setLeadColour(key);
  }

  function addToCart() {
    if (!product || !canBuy || total == null) return;
    const lines = buildLines(product, quantity, hasColours ? chosen : null);
    setOfferLines(lines);
    trackAddToCart(lines, total);
    openCart();
  }

  const buyLabel = canBuy && total != null ? `Add ${quantity} to cart · ${formatPrice(total)}` : product ? "Unavailable in this quantity" : "Coming soon";

  return (
    <div className="kitvoy-home pp-page">
      <TrackViewContent product={viewed} />

      <section className="store-container pp-hero" aria-labelledby="pp-heading">
        <div className="pp-hero-copy">
          {/* One h1: the product name line (drawn as the eyebrow) and the headline */}
          <h1 id="pp-heading">
            <span className="eyebrow">{content.eyebrow}</span> <span className="pp-title">{content.headline}</span>
          </h1>
          <p className="pp-subhead">{content.subheadline}</p>
        </div>

        <Gallery slides={slides} />

        <ul className="pp-benefits">
          {content.benefits.map((benefit) => {
            const Icon = ICONS[benefit.icon];
            return (
              <li key={benefit.title}>
                <span className="pp-benefit-icon">
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <strong>{benefit.title}</strong>
                  <span>{benefit.text}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div id="bundles" className="pp-buybox" role="region" aria-labelledby="pp-bundle-heading">
          <p className="pp-price">
            {price == null ? (
              <span className="pp-price-unavailable">Coming soon</span>
            ) : (
              <>
                <strong>{formatPrice(price)}</strong>
                <span>1 {entry.unit.one} · USD</span>
              </>
            )}
          </p>
          <h2 id="pp-bundle-heading">{content.bundle.heading}</h2>
          <p className="pp-bundle-intro">{content.bundle.intro}</p>

          <div className="pp-tiers" role="radiogroup" aria-labelledby="pp-bundle-heading">
            {tiers.map((tier) => {
              const selected = quantity === tier.quantity;
              const unavailable = !product || product.stock < tier.quantity;
              const lineTotal = price == null ? null : getLineTotal(price, tier.quantity, entry.slug);
              // Real savings against buying the same number one at a time
              const savings = price == null ? 0 : getBundleSavings(price, tier.quantity, entry.slug);
              const note = content.bundle.tierNotes[tier.quantity];
              return (
                <label key={tier.quantity} className={`bundle-option pp-tier${selected ? " is-selected" : ""}${unavailable ? " is-unavailable" : ""}`}>
                  <input type="radio" name="pp-bundle" value={tier.quantity} checked={selected} disabled={unavailable} onChange={() => setQuantity(tier.quantity)} />
                  <span className="radio-indicator" aria-hidden="true">
                    {selected && <Check size={14} />}
                  </span>
                  <span className="bundle-option-copy pp-tier-copy">
                    {tier.badge && <em className="bundle-badge">{tier.badge}</em>}
                    <strong>{tier.label}</strong>
                    {note && <span>{note}</span>}
                  </span>
                  {lineTotal != null && (
                    <span className="pp-tier-price">
                      <b>{formatPrice(lineTotal)}</b>
                      {tier.quantity > 1 && <small>{formatPrice(Math.round((lineTotal * 100) / tier.quantity) / 100)} each</small>}
                      {savings > 0 && <em className="pp-save">Save {formatPrice(savings)}</em>}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {hasColours && (
            <div className="pp-colours" role="group" aria-labelledby="pp-colours-title">
              <p id="pp-colours-title" className="pp-colours-title">
                {quantity === 1 ? "Colour" : "Colours"}
              </p>
              {Array.from({ length: quantity }, (_, i) => {
                const current = variantFor(i);
                return (
                  <div key={i} className="pp-colour-row" role="radiogroup" aria-labelledby={`pp-colour-${i}`}>
                    <span id={`pp-colour-${i}`} className="pp-colour-label">
                      {unitName} {i + 1}
                    </span>
                    <div className="pp-swatches">
                      {variants.map((variant) => {
                        const selected = current?.key === variant.key;
                        return (
                          <label key={variant.key} className={`pp-swatch${selected ? " is-selected" : ""}`}>
                            <input type="radio" name={`pp-colour-${i}`} value={variant.key} checked={selected} onChange={() => pickColour(i, variant.key)} />
                            <span className="pp-swatch-dot" style={{ background: variant.swatch }} aria-hidden="true">
                              {selected && <Check size={12} strokeWidth={3} />}
                            </span>
                            <span>{variant.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button ref={buyButton} type="button" className="primary-button pp-add" disabled={!canBuy} onClick={addToCart}>
            {buyLabel}
            {canBuy && <ArrowRight size={18} aria-hidden="true" />}
          </button>

          {notice && (
            <p className="pp-shipping">
              <Truck aria-hidden="true" />
              {notice.kind === "ships" ? (
                <span>
                  <strong>Free tracked shipping to {notice.country}</strong> · arrives about {notice.days.min}–{notice.days.max} days after it ships
                </span>
              ) : (
                <span>
                  {/* The server and the browser may spell a country's name differently; either is fine */}
                  <strong>
                    We don&apos;t deliver to <span suppressHydrationWarning>{notice.country}</span> yet.
                  </strong>
                  {notice.shipsTo.length > 0 && <span className="pp-ships-to">We ship to {notice.shipsTo.join(", ")}.</span>}
                </span>
              )}
            </p>
          )}

          <ul className="pp-trust">
            <li>
              <Truck aria-hidden="true" />
              Free shipping
            </li>
            <li>
              <RotateCcw aria-hidden="true" />
              {storePolicies.returns.windowDays}-day returns
            </li>
            <li>
              <LockKeyhole aria-hidden="true" />
              Secure checkout
            </li>
          </ul>

          <p className="pp-fit-note" role="note">
            <TriangleAlert aria-hidden="true" />
            <span>{content.fitNote}</span>
          </p>
        </div>
      </section>

      <div className="store-container pp-service">
        <div className="service-strip">
          <div>
            <Truck aria-hidden="true" />
            <span>
              <strong>Ships in {processingText}</strong>
              <small>{notice?.kind === "ships" ? `Tracked delivery to ${notice.country}` : "Tracked delivery"}</small>
            </span>
          </div>
          <div>
            <Package aria-hidden="true" />
            <span>
              <strong>{storePolicies.returns.windowDays}-day returns</strong>
              <small>On unused items in original packaging</small>
            </span>
          </div>
          <Link href="/support">
            <CircleHelp aria-hidden="true" />
            <span>
              <strong>A question before you buy?</strong>
              <small>Get answers on our support page</small>
            </span>
            <ArrowRight className="service-arrow" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {content.demoLoops.length > 0 && (
        <section className="store-container pp-demos" aria-label={`${entry.shortName} in motion`}>
          <div className="pp-demo-row">
            {content.demoLoops.map((loop) => (
              <figure key={loop.id} className="pp-demo-card">
                <div className="pp-demo-media">
                  {loop.src ? <DemoVideo loop={loop} src={loop.src} /> : <Photo src={loop.poster} alt={loop.posterAlt} sizes="(max-width: 639px) 74vw, 33vw" />}
                </div>
                <figcaption>
                  <h3>{loop.title}</h3>
                  <p>{loop.caption}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section id="how" className="store-container pp-how" aria-labelledby="pp-how-heading">
        <h2 id="pp-how-heading">{content.howItWorks.heading}</h2>
        <ol className="pp-steps">
          {content.howItWorks.steps.map((step, i) => {
            const Icon = ICONS[step.icon];
            return (
              <li key={step.title}>
                <span className="pp-step-number" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="pp-step-copy">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                <Icon className="pp-step-icon" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
        {content.howItWorks.tip && (
          <p className="pp-tip" role="note">
            <Info aria-hidden="true" />
            <span>{content.howItWorks.tip}</span>
          </p>
        )}
      </section>

      {content.story.length > 0 && (
        <div className="store-container pp-story">
          {content.story.map((block, i) => (
            <section key={block.heading} className={`pp-story-row${i % 2 === 1 ? " is-flipped" : ""}`} aria-labelledby={`pp-story-${i}`}>
              <div className="pp-story-media">
                <Photo src={block.image} alt={block.imageAlt} sizes="(max-width: 639px) 100vw, 50vw" />
              </div>
              <div className="pp-story-copy">
                <h2 id={`pp-story-${i}`}>{block.heading}</h2>
                <p>{block.text}</p>
              </div>
            </section>
          ))}
        </div>
      )}

      {content.comparison.rows.length > 0 && (
        <section className="store-container pp-compare" aria-labelledby="pp-compare-heading">
          <h2 id="pp-compare-heading">{content.comparison.heading}</h2>
          <div className="pp-compare-wrap">
            <table className="pp-compare-table" aria-labelledby="pp-compare-heading">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="is-ours">
                    {content.comparison.ours}
                  </th>
                  <th scope="col">{content.comparison.theirs}</th>
                </tr>
              </thead>
              <tbody>
                {content.comparison.rows.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td className="is-ours">
                      <span className="pp-compare-ours">
                        <Check size={16} aria-hidden="true" />
                        {row.ours}
                      </span>
                    </td>
                    <td>{row.theirs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="store-container pp-included" aria-labelledby="pp-included-heading">
        <div className="pp-included-media">
          <Photo src={content.included.image} alt={content.included.imageAlt} sizes="(max-width: 639px) 100vw, 42vw" />
        </div>
        <div className="pp-included-copy">
          <h2 id="pp-included-heading">{content.included.heading}</h2>
          <h3 className="eyebrow">In the box</h3>
          <ul className="pp-box-list">
            {content.included.items.map((item) => (
              <li key={item}>
                <Check size={18} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {content.included.notIncluded.length > 0 && (
            <>
              <h3 className="eyebrow pp-not-included">Not in the box</h3>
              <ul className="pp-box-list is-not">
                {content.included.notIncluded.map((item) => (
                  <li key={item}>
                    <X size={18} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <div className="pp-closing">
        {reviews && reviews.count > 0 && <CustomerReviews summary={reviews} />}

        <section id="faq" className="store-container faq-section" aria-labelledby="faq-heading">
          <div>
            <p className="eyebrow">Good to know</p>
            <h2 id="faq-heading">
              Questions?
              <br />
              We&apos;ve got answers.
            </h2>
            <p>
              More questions?{" "}
              <Link className="text-link" href="/support#contact">
                Visit support <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </p>
          </div>
          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.q}>
                <summary>
                  {faq.q}
                  <Plus size={19} aria-hidden="true" />
                </summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      {product && pastBuyButton && !overlay && (
        <aside className="mobile-buy-bar pp-buy-bar" aria-label="Quick purchase">
          <div>
            <strong>{total != null && formatPrice(total)}</strong>
            <span>{[selectedTier?.label ?? `${quantity} ${quantity === 1 ? entry.unit.one : entry.unit.many}`, hasColours ? chosen.map((v) => v.label).join(", ") : ""].filter(Boolean).join(" · ")}</span>
          </div>
          <button type="button" className="primary-button" disabled={!canBuy} onClick={addToCart}>
            {canBuy ? "Add to cart" : "Unavailable"}
            {canBuy && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </aside>
      )}
    </div>
  );
}
