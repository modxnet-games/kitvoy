"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { cartLineSavings, cartLineTotals, lineKey, productQuantity, useCartStore, getShippingForItems } from "@/store/cart-store";
import { getCatalogProduct, productPath } from "@/config/catalog";
import { formatPrice } from "@/lib/formatters";
import { getCartQuoteAction } from "@/app/cart/actions";
import { useMounted } from "@/hooks/use-mounted";
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

  if (!mounted) return <div className="cart-empty" role="status">Loading your cart…</div>;
  if (!items.length) return <div className="cart-empty"><ShoppingBag size={40} strokeWidth={1.4} /><h2>Your cart is empty.</h2><p>Browse our finds and pick the pack that suits you.</p><Link className="primary-button" href="/products" onClick={onNavigate}>Browse products <ArrowRight size={18} /></Link></div>;

  const lineTotals = cartLineTotals(items);
  const lineSavings = cartLineSavings(items);
  const subtotal = Math.round(lineTotals.reduce((sum, t) => sum + t * 100, 0)) / 100;
  const savings = Math.round(lineSavings.reduce((sum, s) => sum + s * 100, 0)) / 100;
  // Every product in the cart ships free to the US; other countries are confirmed at checkout
  const usOnly = items.every(item => { const entry = getCatalogProduct(item.product.slug); return !entry || Object.keys(entry.shipping).length === 1; });
  const shipping = getShippingForItems(items);
  // Stock is per product, so a product's colours are counted together
  const overStock = (item: (typeof items)[number]) => productQuantity(items, item.product.id) > item.product.stock;
  const stockIssue = items.some(item => overStock(item) || item.product.stock < 1);
  const blocked = loading || quote.error || stockIssue;

  return <div className="cart-contents">
    <div className="cart-body">
      {loading && <p className="cart-notice" role="status">Checking current prices and availability…</p>}
      {quote.error && !loading && <div className="cart-notice error-notice" role="alert">We couldn&apos;t check availability. Your cart is saved. <button className="text-link" onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
      {quote.changed && <p className="cart-notice" role="status">Prices have been refreshed. Please review your total.</p>}
      <ul className="cart-lines">{items.map((item, index) => {
        const key = lineKey(item.product);
        const label = item.product.variant ? `${item.product.name} (${item.product.variant.label})` : item.product.name;
        const atStock = productQuantity(items, item.product.id) >= item.product.stock;
        return <li key={key} className="cart-line">
        <ProductLineImage className="cart-product-image" imageUrl={item.product.images[0]} alt={label} fallbackLetter="K" />
        <div className="cart-line-content"><Link href={productPath(item.product.slug)} onClick={onNavigate} className="cart-product-name">{item.product.name}</Link>{item.product.variant && <p className="cart-line-variant">{item.product.variant.label}</p>}<p className="cart-line-price">{formatPrice(lineTotals[index])}<small>for {item.quantity}</small></p>
          {lineSavings[index] > 0 && <p className="cart-savings">Bundle savings: {formatPrice(lineSavings[index])}</p>}
          <div className="cart-line-actions"><div className="quantity-control" aria-label={"Quantity for " + label}><button aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => updateQuantity(key, item.quantity - 1)}><Minus size={16} /></button><span aria-live="polite">{item.quantity}</span><button aria-label="Increase quantity" disabled={atStock} onClick={() => updateQuantity(key, item.quantity + 1)}><Plus size={16} /></button></div><button className="remove-item" onClick={() => removeItem(key)}>Remove<span className="sr-only"> {label}</span></button></div>
          {overStock(item) && <p className="stock-error" role="alert">{item.product.stock === 0 ? "This item is no longer available. Please remove it to continue." : `Only ${item.product.stock} available. Choose a lower quantity to continue.`}</p>}
        </div>
      </li>; })}</ul>
      <div className="cart-shipping"><Truck size={25} /><span>{shipping === 0 ? (usOnly ? "Free US shipping included" : "Free tracked shipping included") : "Shipping: " + formatPrice(shipping)}</span></div>
    </div>
    <div className="cart-summary"><dl><div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>{savings > 0 && <div className="savings-row"><dt>Bundle savings included</dt><dd>{formatPrice(savings)}</dd></div>}<div><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : formatPrice(shipping)}</dd></div><div className="cart-total"><dt>Total <small>USD</small></dt><dd aria-live="polite">{formatPrice(subtotal + shipping)}</dd></div></dl>
      {blocked ? <button className="primary-button" disabled>{loading ? "Checking your cart…" : "Review your cart to continue"}</button> : <Link className="primary-button" href="/checkout" prefetch onClick={onNavigate}><LockKeyhole size={18} />Continue to checkout <ArrowRight size={18} /></Link>}
      <p className="cart-payment-note">Available payment options shown at checkout</p><Link className="text-link continue-shopping" href="/products" onClick={onNavigate}>Continue shopping</Link>
    </div>
  </div>;
}
