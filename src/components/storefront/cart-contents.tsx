"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cartLineSavings, cartLineTotals, lineKey, productQuantity, useCartStore, getShippingForItems } from "@/store/cart-store";
import { getCatalogProduct, productPath } from "@/config/catalog";
import { formatPrice } from "@/lib/formatters";
import { getCartQuoteAction } from "@/app/cart/actions";
import { useMounted } from "@/hooks/use-mounted";
import { PayBadges } from "@/components/payments/pay-badges";
import { ProductLineImage } from "./product-line-image";

type CartQuote = { id: string; price: number; stock: number; shippingTax: number }[];

/**
 * Current prices and stock for the cart. A plain route with a stable URL, so a
 * page that was loaded before a deploy still gets its answer afterwards; the
 * server action is kept as the fallback.
 */
async function fetchCartQuote(ids: string[]): Promise<CartQuote> {
  try {
    const res = await fetch("/api/cart/quote?ids=" + encodeURIComponent(ids.join(",")), { cache: "no-store" });
    if (res.ok) return (await res.json()) as CartQuote;
  } catch {
    // fall through
  }
  return getCartQuoteAction(ids);
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The cart's lines and totals, shared by the drawer and the /cart page. One
 * line per product and color; a product bought in several colors is still one
 * pack, so each of its lines carries its share of the pack price.
 */
export function CartContents({ onNavigate }: { onNavigate?: () => void }) {
  const mounted = useMounted();
  const items = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const removeItem = useCartStore(s => s.removeItem);
  const refreshCatalog = useCartStore(s => s.refreshCatalog);
  const ids = [...new Set(items.map(i => i.product.id))].sort().join(",");
  const [quote, setQuote] = useState({ key: "", error: false, changed: false });
  const [retry, setRetry] = useState(0);
  const quoteKey = ids + ":" + retry;
  const loading = items.length > 0 && quote.key !== quoteKey;

  useEffect(() => {
    if (!ids) return;
    let active = true;
    fetchCartQuote(ids.split(",")).then(products => {
      if (!active) return;
      const changed = useCartStore.getState().items.some(item => {
        const current = products.find(p => p.id === item.product.id);
        return current && (current.price !== item.product.price || current.shippingTax !== (item.product.shippingTax ?? 0));
      });
      refreshCatalog(products);
      setQuote({ key: quoteKey, error: false, changed: !!changed });
    }).catch(() => { if (active) setQuote({ key: quoteKey, error: true, changed: false }); });
    return () => { active = false; };
  }, [ids, quoteKey, refreshCatalog]);

  if (!mounted) return <div className="kv-cart"><div className="kv-cart-body"><div className="kv-cart-empty" role="status">Loading your cart…</div></div></div>;
  if (!items.length) {
    return (
      <div className="kv-cart">
        <div className="kv-cart-body">
          <div className="kv-cart-empty">
            <p className="kv-lede">Your cart is empty.</p>
            <Link className="kv-btn kv-btn-primary" href="/products" onClick={onNavigate}>Browse products</Link>
          </div>
        </div>
      </div>
    );
  }

  const lineTotals = cartLineTotals(items);
  const lineSavings = cartLineSavings(items);
  const subtotal = Math.round(lineTotals.reduce((sum, t) => sum + t * 100, 0)) / 100;
  const savings = Math.round(lineSavings.reduce((sum, s) => sum + s * 100, 0)) / 100;
  const shipping = getShippingForItems(items);
  // Stock is per product, so a product's colors are counted together
  const overStock = (item: (typeof items)[number]) => productQuantity(items, item.product.id) > item.product.stock;
  const stockIssue = items.some(item => overStock(item) || item.product.stock < 1);
  const blocked = loading || quote.error || stockIssue;

  return (
    <div className="kv-cart">
      <div className="kv-cart-body">
        {loading && <p className="kv-cart-notice" role="status">Checking current prices and availability…</p>}
        {quote.error && !loading && <div className="kv-cart-notice is-error" role="alert">We couldn&apos;t check availability. Your cart is saved. <button type="button" onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
        {quote.changed && <p className="kv-cart-notice" role="status">Prices have been refreshed. Please review your total.</p>}
        <ul className="kv-cart-lines">
          {items.map((item, index) => {
            const key = lineKey(item.product);
            const label = item.product.variant ? `${item.product.name} (${item.product.variant.label})` : item.product.name;
            const entry = getCatalogProduct(item.product.slug);
            // How many of this product the cart holds across its colors: that is the pack being priced
            const inPack = productQuantity(items, item.product.id);
            const atStock = inPack >= item.product.stock;
            const total = lineTotals[index];
            const saved = lineSavings[index];
            // What one unit of this line costs inside its pack, never rounded up
            const unit = Math.floor(Math.round(total * 100) / item.quantity) / 100;
            return (
              <li key={key} className="kv-cart-line">
                <ProductLineImage className="kv-cart-thumb" imageUrl={item.product.images[0]} alt="" fallbackLetter="K" />
                <div className="kv-cart-info">
                  <div className="kv-cart-title-row">
                    <h3><Link href={productPath(item.product.slug)} onClick={onNavigate}>{item.product.name}</Link></h3>
                    <button type="button" className="kv-cart-remove" onClick={() => removeItem(key)} aria-label={`Remove ${label} from cart`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5.5M14 11v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                  <div className="kv-cart-unit">
                    {/* The struck figure is the same item bought singly, at its real price */}
                    {saved > 0 && <s>{formatPrice(item.product.price)}</s>}
                    <strong>{formatPrice(unit)}</strong>
                    {inPack >= 2 && (
                      <span className="kv-ring-tag">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12.5V4h8.5L21 13.5 13.5 21z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /><circle cx="8" cy="9" r="1.6" fill="currentColor" /></svg>
                        {inPack} {capitalise(entry?.unit.many ?? "items")}
                      </span>
                    )}
                  </div>
                  {item.product.variant && <p className="kv-cart-variant">{item.product.variant.label}</p>}
                  <div className="kv-cart-qty-row">
                    <div className="kv-stepper" role="group" aria-label={"Quantity for " + label}>
                      <button type="button" onClick={() => updateQuantity(key, item.quantity - 1)} aria-label="Decrease quantity">&minus;</button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(key, item.quantity + 1)} aria-label="Increase quantity" disabled={atStock}>+</button>
                    </div>
                    <div className="kv-cart-line-total">
                      <div>
                        {saved > 0 && <s>{formatPrice(item.product.price * item.quantity)}</s>}
                        <strong>{formatPrice(total)}</strong>
                      </div>
                      {saved > 0 && <b>(You save {formatPrice(saved)})</b>}
                    </div>
                  </div>
                  {overStock(item) && <p className="kv-cart-stock" role="alert">{item.product.stock === 0 ? "This item is no longer available. Please remove it to continue." : `Only ${item.product.stock} available. Choose a lower quantity to continue.`}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="kv-cart-foot">
        <div className="kv-cart-sum">
          {savings > 0 && <div className="kv-cart-sum-row savings"><span>Savings</span><span>&minus; {formatPrice(savings)}</span></div>}
          <div className="kv-cart-sum-row shipping"><span>Shipping</span><span>{shipping === 0 ? "FREE" : formatPrice(shipping)}</span></div>
          <div className="kv-cart-sum-row subtotal"><span>{shipping === 0 ? "Subtotal" : "Total"}</span><span className="kv-cart-total" aria-live="polite">{formatPrice(subtotal + shipping)} USD</span></div>
        </div>
        {blocked ? (
          <button type="button" className="kv-btn kv-btn-primary kv-btn-block kv-cart-checkout" disabled>{loading ? "Checking your cart…" : "Review your cart to continue"}</button>
        ) : (
          <Link className="kv-btn kv-btn-primary kv-btn-block kv-cart-checkout" href="/checkout" prefetch onClick={onNavigate}>Check out</Link>
        )}
        <PayBadges />
        {/* On the cart page; in the drawer, closing it is the way back */}
        {!onNavigate && <Link className="kv-cart-continue" href="/products">Continue shopping</Link>}
      </div>
    </div>
  );
}
