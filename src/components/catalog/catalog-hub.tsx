import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Truck } from "lucide-react";

import "@/app/product-page.css";

import { FEATURED_NICHES, NICHES, type CatalogProduct, type NicheKey } from "@/config/catalog";
import { storePolicies } from "@/config/policies";
import { formatPrice } from "@/lib/formatters";
import type { ProductDisplay } from "@/types/product";

export interface CatalogCard {
  entry: CatalogProduct;
  /** The live database product, or null while the product hasn't been created there */
  product: ProductDisplay | null;
  /** Card photo */
  image: string;
}

type Variant = "hub" | "home";

/** "#01": the number the videos point to. */
const hubNumber = (n: number) => `#${String(n).padStart(2, "0")}`;

function ProductCard({ card, variant, first }: { card: CatalogCard; variant: Variant; first: boolean }) {
  const { entry, product, image } = card;
  return (
    <li>
      <Link href={entry.path} className="hub-card">
        <div className="hub-card-media">
          {/* Decorative here (the name is right beside it), and an empty alt means a missing photo leaves the plain tile, not a broken-image icon */}
          <Image
            fill
            src={image}
            alt=""
            sizes={variant === "hub" ? "(max-width: 639px) 120px, (max-width: 1100px) 46vw, 400px" : "(max-width: 639px) 100vw, (max-width: 1100px) 46vw, 610px"}
            preload={first}
          />
        </div>
        <div className="hub-card-body">
          <p className="hub-card-number">{hubNumber(entry.hubNumber)}</p>
          <h3>{entry.shortName}</h3>
          <p className="hub-card-tagline">{entry.tagline}</p>
          <div className="hub-card-meta">
            {product && <span className="hub-card-price">From {formatPrice(product.price)}</span>}
            <span className="hub-chip">
              <Truck aria-hidden="true" />
              Free shipping
            </span>
          </div>
        </div>
        <ArrowRight className="hub-card-arrow" aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * The catalog, grouped by niche. `hub` is /products, the page behind the
 * Instagram and TikTok bio link: a short header and numbered cards to tap.
 * `home` is the homepage: a brand hero, then the same sections with larger
 * cards. No hooks or browser APIs, so it renders on the server.
 */
export function CatalogHub({ cards, variant }: { cards: CatalogCard[]; variant: Variant }) {
  const sorted = [...cards].sort((a, b) => a.entry.hubNumber - b.entry.hubNumber);
  const inNiche = (key: NicheKey) => sorted.filter((card) => card.entry.niche === key);
  // The three featured niches always show, in order; any other niche shows once it has a product
  const otherNiches = (Object.keys(NICHES) as NicheKey[]).filter((key) => !FEATURED_NICHES.includes(key) && inNiche(key).length > 0);
  const sections = [...FEATURED_NICHES, ...otherNiches].map((key) => ({ key, niche: NICHES[key], cards: inNiche(key) }));
  const firstCard = sections.find((section) => section.cards.length > 0)?.cards[0];

  return (
    <div className={`kitvoy-home hub-page hub-page--${variant}`}>
      {variant === "hub" ? (
        <header className="store-container hub-header">
          <h1>Kitvoy finds</h1>
          <p>The products from our videos. Tap a number.</p>
        </header>
      ) : (
        <section className="store-container hub-hero" aria-labelledby="hub-hero-heading">
          <h1 id="hub-hero-heading">Useful little finds, shipped free.</h1>
          <p>The products from our videos, each with tracked delivery and {storePolicies.returns.windowDays}-day returns.</p>
          <Link href="/products" className="primary-button">
            See all finds <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      )}

      {sections.map(({ key, niche, cards: nicheCards }) => (
        <section key={key} className="store-container hub-niche" aria-labelledby={`hub-niche-${key}`}>
          <div className="hub-niche-head">
            <h2 id={`hub-niche-${key}`}>{niche.name}</h2>
            {variant === "home" && <p>{niche.blurb}</p>}
          </div>
          {nicheCards.length > 0 ? (
            <ul className="hub-grid">
              {nicheCards.map((card) => (
                <ProductCard key={card.entry.slug} card={card} variant={variant} first={card === firstCard} />
              ))}
            </ul>
          ) : (
            <p className="hub-soon">New finds coming soon</p>
          )}
        </section>
      ))}
    </div>
  );
}
