"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { useCartStore, getShippingForItems } from "@/store/cart-store";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { formatPrice } from "@/lib/formatters";
import { getCartQuoteAction } from "@/app/cart/actions";
import { useMounted } from "@/hooks/use-mounted";
import { ProductLineImage } from "./product-line-image";

export function CartContents({ onNavigate }: { onNavigate?: () => void }) {
  const mounted = useMounted();
  const items = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const removeItem = useCartStore(s => s.removeItem);
  const refreshCatalog = useCartStore(s => s.refreshCatalog);
  const ids = items.map(i => i.product.id).sort().join(",");
  const [quote, setQuote] = useState({ key: "", error: false, changed: false });
  const [retry, setRetry] = useState(0);
  const quoteKey = ids + ":" + retry;
  const loading = items.length > 0 && quote.key !== quoteKey;

  useEffect(() => {
    if (!ids) return;
    let active = true;
    getCartQuoteAction(ids.split(",")).then(products => {
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
  if (!items.length) return <div className="cart-empty"><ShoppingBag size={40} strokeWidth={1.4} /><h2>Your next trip starts here.</h2><p>Your cart is empty. Find the right bundle for you.</p><Link className="primary-button" href="/#bundles" onClick={onNavigate}>Explore bundles <ArrowRight size={18} /></Link></div>;

  const subtotal = items.reduce((sum, item) => sum + getLineTotal(item.product.price, item.quantity), 0);
  const savings = items.reduce((sum, item) => sum + getBundleSavings(item.product.price, item.quantity), 0);
  const shipping = getShippingForItems(items);
  const stockIssue = items.some(item => item.quantity > item.product.stock || item.product.stock < 1);
  const blocked = loading || quote.error || stockIssue;

  return <div className="cart-contents">
    <div className="cart-body">
      {loading && <p className="cart-notice" role="status">Checking current prices and availability…</p>}
      {quote.error && !loading && <div className="cart-notice error-notice" role="alert">We couldn&apos;t check availability. Your cart is saved. <button className="text-link" onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
      {quote.changed && <p className="cart-notice" role="status">Prices have been refreshed. Please review your total.</p>}
      <ul className="cart-lines">{items.map(item => <li key={item.product.id} className="cart-line">
        <ProductLineImage className="cart-product-image" imageUrl={item.product.images[0]} alt={item.product.name} fallbackLetter="K" />
        <div className="cart-line-content"><Link href="/#bundles" onClick={onNavigate} className="cart-product-name">{item.product.name}</Link><p className="cart-line-price">{formatPrice(getLineTotal(item.product.price, item.quantity))}<small>for {item.quantity}</small></p>
          {getBundleSavings(item.product.price, item.quantity) > 0 && <p className="cart-savings">Bundle savings: {formatPrice(getBundleSavings(item.product.price, item.quantity))}</p>}
          <div className="cart-line-actions"><div className="quantity-control" aria-label={"Quantity for " + item.product.name}><button aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => updateQuantity(item.product.id, item.quantity - 1)}><Minus size={16} /></button><span aria-live="polite">{item.quantity}</span><button aria-label="Increase quantity" disabled={item.quantity >= item.product.stock} onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus size={16} /></button></div><button className="remove-item" onClick={() => removeItem(item.product.id)}>Remove<span className="sr-only"> {item.product.name}</span></button></div>
          {item.quantity > item.product.stock && <p className="stock-error" role="alert">{item.product.stock === 0 ? "This item is no longer available. Please remove it to continue." : `Only ${item.product.stock} available. Choose a lower quantity to continue.`}</p>}
        </div>
      </li>)}</ul>
      <div className="cart-shipping"><Truck size={25} /><span>{shipping === 0 ? "Free US shipping included" : "Shipping: " + formatPrice(shipping)}</span></div>
    </div>
    <div className="cart-summary"><dl><div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>{savings > 0 && <div className="savings-row"><dt>Bundle savings included</dt><dd>{formatPrice(savings)}</dd></div>}<div><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : formatPrice(shipping)}</dd></div><div className="cart-total"><dt>Total <small>USD</small></dt><dd aria-live="polite">{formatPrice(subtotal + shipping)}</dd></div></dl>
      {blocked ? <button className="primary-button" disabled>{loading ? "Checking your cart…" : "Review your cart to continue"}</button> : <Link className="primary-button" href="/checkout" onClick={onNavigate}><LockKeyhole size={18} />Continue to checkout <ArrowRight size={18} /></Link>}
      <p className="cart-payment-note">Available payment options shown at checkout</p><Link className="text-link continue-shopping" href="/#bundles" onClick={onNavigate}>Continue shopping</Link>
    </div>
  </div>;
}
