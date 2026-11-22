"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cartLineSavings, cartLineTotals, lineKey, productQuantity, useCartStore, getShippingForItems } from "@/store/cart-store";
import { getCatalogProduct, getCatalogVariant, productPath, variantLabel } from "@/config/catalog";
import { useLanguage } from "@/contexts/language-context";
import { formatPrice } from "@/lib/formatters";
import { getCartQuoteAction } from "@/app/cart/actions";
import { useMounted } from "@/hooks/use-mounted";
import { CodBadge } from "@/components/product/trust";
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

/**
 * The cart's lines and totals, shared by the drawer and the /cart page. One
 * line per product, colour and size; a product bought in several variants is
 * still one pack, so each of its lines carries its share of the pack price.
 */
export function CartContents({ onNavigate }: { onNavigate?: () => void }) {
  const { t, m, locale } = useLanguage();
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
  const money = (amount: number) => formatPrice(amount, locale);

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

  if (!mounted) return <div className="kv-cart"><div className="kv-cart-body"><div className="kv-cart-empty" role="status">{m.cart.loading}</div></div></div>;
  if (!items.length) {
    return (
      <div className="kv-cart">
        <div className="kv-cart-body">
          <div className="kv-cart-empty">
            <p className="kv-lede">{m.cart.empty}</p>
            <Link className="kv-btn kv-btn-primary" href="/" onClick={onNavigate}>{m.cart.browse}</Link>
          </div>
        </div>
      </div>
    );
  }

  const lineTotals = cartLineTotals(items);
  const lineSavings = cartLineSavings(items);
  const subtotal = Math.round(lineTotals.reduce((sum, v) => sum + v * 100, 0)) / 100;
  const savings = Math.round(lineSavings.reduce((sum, v) => sum + v * 100, 0)) / 100;
  const shipping = getShippingForItems(items);
  // Stock is per product, so a product's colours and sizes are counted together
  const overStock = (item: (typeof items)[number]) => productQuantity(items, item.product.id) > item.product.stock;
  const stockIssue = items.some(item => overStock(item) || item.product.stock < 1);
  const blocked = loading || quote.error || stockIssue;

  return (
    <div className="kv-cart">
      <div className="kv-cart-body">
        {loading && <p className="kv-cart-notice" role="status">{m.cart.checking}</p>}
        {quote.error && !loading && <div className="kv-cart-notice is-error" role="alert">{m.cart.quoteError} <button type="button" onClick={() => setRetry(n => n + 1)}>{m.cart.retry}</button></div>}
        {quote.changed && <p className="kv-cart-notice" role="status">{m.cart.refreshed}</p>}
        <ul className="kv-cart-lines">
          {items.map((item, index) => {
            const key = lineKey(item.product);
            const variant = getCatalogVariant(item.product.slug, item.product.variant?.key);
            const variantText = variant ? variantLabel(variant, locale) : null;
            const entry = getCatalogProduct(item.product.slug);
            const name = entry?.displayName[locale] ?? item.product.name;
            const label = variantText ? `${name} (${variantText})` : name;
            // How many of this product the cart holds across its variants: that is the pack being priced
            const inPack = productQuantity(items, item.product.id);
            const atStock = inPack >= item.product.stock;
            const total = lineTotals[index];
            const saved = lineSavings[index];
            // What one piece of this line costs inside its pack, never rounded up
            const unit = Math.floor(Math.round(total * 100) / item.quantity) / 100;
            return (
              <li key={key} className="kv-cart-line">
                <ProductLineImage className="kv-cart-thumb" imageUrl={item.product.images[0]} alt="" fallbackLetter="C" />
                <div className="kv-cart-info">
                  <div className="kv-cart-title-row">
                    <h3><Link href={productPath(item.product.slug)} onClick={onNavigate}>{name}</Link></h3>
                    <button type="button" className="kv-cart-remove" onClick={() => removeItem(key)} aria-label={t("cart.remove", { name: label })}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5.5M14 11v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                  <div className="kv-cart-unit">
                    {/* The struck figure is the same piece bought singly, at its real price */}
                    {saved > 0 && <s>{money(item.product.price)}</s>}
                    <strong>{money(unit)}</strong>
                    {inPack >= 2 && entry && (
                      <span className="kv-ring-tag">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12.5V4h8.5L21 13.5 13.5 21z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /><circle cx="8" cy="9" r="1.6" fill="currentColor" /></svg>
                        {inPack} {entry.unit[locale].many}
                      </span>
                    )}
                  </div>
                  {variantText && <p className="kv-cart-variant">{variantText}</p>}
                  <div className="kv-cart-qty-row">
                    <div className="kv-stepper" role="group" aria-label={t("cart.quantityFor", { name: label })}>
                      <button type="button" onClick={() => updateQuantity(key, item.quantity - 1)} aria-label={m.cart.decrease}>&minus;</button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(key, item.quantity + 1)} aria-label={m.cart.increase} disabled={atStock}>+</button>
                    </div>
                    <div className="kv-cart-line-total">
                      <div>
                        {saved > 0 && <s>{money(item.product.price * item.quantity)}</s>}
                        <strong>{money(total)}</strong>
                      </div>
                      {saved > 0 && <b>{t("cart.youSave", { amount: money(saved) })}</b>}
                    </div>
                  </div>
                  {overStock(item) && <p className="kv-cart-stock" role="alert">{item.product.stock === 0 ? m.cart.gone : t("cart.onlyLeft", { count: item.product.stock })}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="kv-cart-foot">
        <div className="kv-cart-sum">
          {savings > 0 && <div className="kv-cart-sum-row savings"><span>{m.cart.savings}</span><span>&minus; {money(savings)}</span></div>}
          <div className="kv-cart-sum-row shipping"><span>{m.cart.delivery}</span><span>{shipping === 0 ? m.cart.free : money(shipping)}</span></div>
          <div className="kv-cart-sum-row subtotal"><span>{m.cart.total}</span><span className="kv-cart-total" aria-live="polite">{money(subtotal + shipping)}</span></div>
        </div>
        {blocked ? (
          <button type="button" className="kv-btn kv-btn-primary kv-btn-block kv-cart-checkout" disabled>{loading ? m.cart.checkingCart : m.cart.review}</button>
        ) : (
          <Link className="kv-btn kv-btn-primary kv-btn-block kv-cart-checkout" href="/checkout" prefetch onClick={onNavigate}>{m.cart.checkout}</Link>
        )}
        <CodBadge title={m.product.codTitle} className="kv-cod-cart" />
        {/* On the cart page; in the drawer, closing it is the way back */}
        {!onNavigate && <Link className="kv-cart-continue" href="/">{m.cart.continue}</Link>}
      </div>
    </div>
  );
}
