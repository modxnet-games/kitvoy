"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getCatalogProduct, getCatalogVariant, variantLabel } from "@/config/catalog";
import { useLanguage } from "@/contexts/language-context";
import { toContents, trackInitiateCheckout, trackPurchase } from "@/lib/analytics/meta-pixel";
import { CHECKOUT_FIELDS, EMPTY_DETAILS, readCheckoutDetails, validateCheckoutDetails, type CheckoutDetails, type CheckoutField } from "@/lib/checkout-details";
import { logCheckoutEvent } from "@/lib/client/checkout-log";
import { placeOrder, rememberPlacedOrder } from "@/lib/client/place-order";
import { formatPrice } from "@/lib/formatters";
import { CITIES, parseMoroccanPhone } from "@/lib/morocco";
import { cartLineSavings, cartLineTotals, getShippingForItems, lineKey, productQuantity, useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";
import { CodBadge } from "@/components/product/trust";
import { ProductLineImage } from "@/components/storefront/product-line-image";

/*
 * The cash-on-delivery order form: name, phone, city and address beside the
 * order summary. Nothing is paid here; the button places the order and the
 * store calls back to confirm it. What is typed survives a reload (kept in the
 * tab's session storage until the order is placed).
 */

const DRAFT_KEY = "chrilik-checkout-draft";
const OTHER_CITY = "__other__";

function readDraft(): CheckoutDetails {
  try {
    return readCheckoutDetails(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}"));
  } catch {
    return EMPTY_DETAILS;
  }
}

export function CheckoutClient() {
  const { t, m, locale } = useLanguage();
  const router = useRouter();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const refreshCatalog = useCartStore((s) => s.refreshCatalog);
  const clearCart = useCartStore((s) => s.clearCart);

  // What was typed before a reload comes back. The form is not rendered until the page has mounted
  // (the placeholder below), so starting from the tab's storage cannot differ from the server's HTML
  const [details, setDetails] = useState<CheckoutDetails>(readDraft);
  // The city select offers the largest cities; "another city" opens a text field
  const [cityChoice, setCityChoice] = useState(() => {
    const { city } = readDraft();
    return city ? (CITIES.some((c) => c.fr === city) ? city : OTHER_CITY) : "";
  });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<CheckoutField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const placed = useRef(false);
  const opened = useRef(false);
  const fieldRefs = useRef<Partial<Record<CheckoutField, HTMLElement | null>>>({});
  const money = (amount: number) => formatPrice(amount, locale);

  useEffect(() => {
    if (!mounted || placed.current) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(details));
    } catch {
      // Private mode: the form simply starts empty after a reload
    }
  }, [details, mounted]);

  // Current prices and stock, so the total shown is the total the server will confirm
  const ids = [...new Set(items.map((i) => i.product.id))].sort().join(",");
  useEffect(() => {
    if (!ids) return;
    let active = true;
    fetch("/api/cart/quote?ids=" + encodeURIComponent(ids), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((products) => {
        if (active && Array.isArray(products)) refreshCatalog(products);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ids, refreshCatalog]);

  const lineTotals = cartLineTotals(items);
  const lineSavings = cartLineSavings(items);
  const subtotal = Math.round(lineTotals.reduce((sum, v) => sum + v * 100, 0)) / 100;
  const savings = Math.round(lineSavings.reduce((sum, v) => sum + v * 100, 0)) / 100;
  const shipping = getShippingForItems(items);
  const total = subtotal + shipping;
  const stockIssue = items.some((item) => item.product.stock < 1 || productQuantity(items, item.product.id) > item.product.stock);

  useEffect(() => {
    if (!mounted || opened.current || items.length === 0) return;
    opened.current = true;
    logCheckoutEvent("checkout_opened", { step: 1 });
    trackInitiateCheckout(items, total);
  }, [mounted, items, total]);

  const set = (field: CheckoutField, value: string) => {
    setDetails((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const clean = readCheckoutDetails(details);
    const found = validateCheckoutDetails(clean);
    const first = CHECKOUT_FIELDS.find((field) => found[field]);
    setErrors(found);
    setFailure(null);
    if (first) {
      logCheckoutEvent("order_invalid", { step: 1, code: first });
      fieldRefs.current[first]?.focus();
      return;
    }

    setSending(true);
    const started = Date.now();
    logCheckoutEvent("order_submitted", { step: 1 });
    const result = await placeOrder(clean, locale, items, website);
    if (!result.ok) {
      setSending(false);
      logCheckoutEvent("order_failed", { step: 1, code: result.errorKey, ms: Date.now() - started });
      if (result.fields) setErrors(result.fields);
      setFailure(t(result.errorKey));
      return;
    }

    placed.current = true;
    logCheckoutEvent("order_placed", { ref: result.orderReference, step: 2, ms: Date.now() - started });
    trackPurchase({ orderReference: result.orderReference, value: result.totals.total, contents: toContents(items) });
    rememberPlacedOrder({ reference: result.orderReference, name: clean.fullName, phone: parseMoroccanPhone(clean.phone)?.national ?? clean.phone, total: result.totals.total });
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to clear
    }
    router.replace(`/checkout/success?ref=${encodeURIComponent(result.orderReference)}`);
    clearCart();
  }

  if (!mounted) {
    return (
      <div className="kv-checkout kv-wrap" aria-busy="true">
        <p className="kv-checkout-loading" role="status">{m.common.loading}</p>
      </div>
    );
  }

  if (items.length === 0) {
    // After the order is placed the cart is emptied while the thank-you page loads, and `sending` is
    // still on (only a refusal turns it off): show nothing rather than "empty"
    if (sending) return <div className="kv-checkout kv-wrap" aria-busy="true" />;
    return (
      <div className="kv-checkout kv-wrap">
        <div className="kv-checkout-empty">
          <h1 className="kv-display">{m.checkout.emptyTitle}</h1>
          <Link className="kv-btn kv-btn-primary" href="/">{m.checkout.emptyCta}</Link>
        </div>
      </div>
    );
  }

  const errorCount = CHECKOUT_FIELDS.filter((field) => errors[field]).length;
  const field = (name: CheckoutField) => ({
    id: `co-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `co-${name}-error` : name === "phone" ? "co-phone-hint" : undefined,
  });
  const problem = (name: CheckoutField) => errors[name] && <p className="kv-field-error" id={`co-${name}-error`}>{t(errors[name]!)}</p>;

  return (
    <div className="kv-checkout kv-wrap">
      <ol className="kv-checkout-steps" aria-label={m.checkout.title}>
        <li><Link href="/cart">{m.checkout.stepCart}</Link></li>
        <li aria-current="step">{m.checkout.stepDetails}</li>
        <li>{m.checkout.stepDone}</li>
      </ol>
      <h1 className="kv-display kv-checkout-title">{m.checkout.title}</h1>
      <p className="kv-checkout-intro">{m.checkout.intro}</p>

      <div className="kv-checkout-grid">
        <form className="kv-checkout-form" onSubmit={submit} noValidate>
          <h2>{m.checkout.details}</h2>
          {errorCount > 0 && <p className="kv-checkout-alert" role="alert">{t("checkout.fixErrors", { count: errorCount })}</p>}
          {failure && <p className="kv-checkout-alert" role="alert">{failure}</p>}

          <div className="kv-field">
            <label htmlFor="co-fullName">{m.checkout.fullName}</label>
            <input {...field("fullName")} ref={(el) => { fieldRefs.current.fullName = el; }} type="text" name="name" autoComplete="name" enterKeyHint="next" placeholder={m.checkout.fullNamePlaceholder} value={details.fullName} onChange={(e) => set("fullName", e.target.value)} />
            {problem("fullName")}
          </div>

          <div className="kv-field">
            <label htmlFor="co-phone">{m.checkout.phone}</label>
            <input {...field("phone")} ref={(el) => { fieldRefs.current.phone = el; }} type="tel" name="tel" inputMode="tel" autoComplete="tel" dir="ltr" enterKeyHint="next" placeholder={m.checkout.phonePlaceholder} value={details.phone} onChange={(e) => set("phone", e.target.value)} />
            {problem("phone") || <p className="kv-field-hint" id="co-phone-hint">{m.checkout.phoneHint}</p>}
          </div>

          <div className="kv-field">
            <label htmlFor="co-city">{m.checkout.city}</label>
            <select
              {...field("city")}
              ref={(el) => { fieldRefs.current.city = el; }}
              name="city"
              autoComplete="address-level2"
              value={cityChoice}
              onChange={(e) => {
                setCityChoice(e.target.value);
                set("city", e.target.value === OTHER_CITY ? "" : e.target.value);
              }}
            >
              <option value="" disabled>{m.checkout.cityPlaceholder}</option>
              {CITIES.map((city) => (
                <option key={city.fr} value={city.fr}>{city[locale]}</option>
              ))}
              <option value={OTHER_CITY}>{m.checkout.cityOther}</option>
            </select>
            {cityChoice === OTHER_CITY && (
              <input className="kv-field-extra" type="text" aria-label={m.checkout.cityOtherLabel} placeholder={m.checkout.cityOtherLabel} autoComplete="address-level2" value={details.city} onChange={(e) => set("city", e.target.value)} />
            )}
            {problem("city")}
          </div>

          <div className="kv-field">
            <label htmlFor="co-address">{m.checkout.address}</label>
            <textarea {...field("address")} ref={(el) => { fieldRefs.current.address = el; }} name="address" rows={2} autoComplete="street-address" placeholder={m.checkout.addressPlaceholder} value={details.address} onChange={(e) => set("address", e.target.value)} />
            {problem("address")}
          </div>

          {/* Not for people: hidden from sight, the keyboard and screen readers */}
          <div className="kv-hp" aria-hidden="true">
            <label htmlFor="co-website">Website</label>
            <input id="co-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          <button type="submit" className="kv-btn kv-btn-primary kv-btn-block kv-checkout-submit" disabled={sending || stockIssue}>
            {sending ? m.checkout.submitting : t("checkout.submit", { price: money(total) })}
          </button>
          <CodBadge title={m.product.codTitle} sub={m.checkout.codNote} className="kv-cod-checkout" />
        </form>

        <aside className="kv-checkout-summary" aria-labelledby="co-summary">
          <div className="kv-checkout-summary-head">
            <h2 id="co-summary">{m.checkout.summary}</h2>
            <Link href="/cart" className="kv-checkout-edit">{m.checkout.edit}</Link>
          </div>
          <ul className="kv-checkout-lines">
            {items.map((item, index) => {
              const variant = getCatalogVariant(item.product.slug, item.product.variant?.key);
              return (
                <li key={lineKey(item.product)}>
                  <ProductLineImage className="kv-cart-thumb" imageUrl={item.product.images[0]} alt="" fallbackLetter="C" />
                  <div>
                    <strong>{getCatalogProduct(item.product.slug)?.displayName[locale] ?? item.product.name}</strong>
                    {variant && <span>{variantLabel(variant, locale)}</span>}
                    <span>{t("checkout.quantity", { count: item.quantity })}</span>
                  </div>
                  <b>{money(lineTotals[index])}</b>
                </li>
              );
            })}
          </ul>
          <dl className="kv-checkout-sums">
            {savings > 0 && (
              <div className="is-saving">
                <dt>{m.checkout.savings}</dt>
                <dd>&minus; {money(savings)}</dd>
              </div>
            )}
            <div>
              <dt>{m.checkout.delivery}</dt>
              <dd>{shipping === 0 ? <b className="kv-free-tag">{m.checkout.free}</b> : money(shipping)}</dd>
            </div>
            <div className="is-total">
              <dt>{m.checkout.total}</dt>
              <dd className="kv-checkout-total">{money(total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
