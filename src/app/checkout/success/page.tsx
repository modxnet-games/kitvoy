"use client";

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { mainProduct } from "@/config/catalog";
import { useLanguage } from "@/contexts/language-context";
import { parsePlacedOrder, readPlacedOrderText } from "@/lib/client/place-order";
import { formatPrice } from "@/lib/formatters";
import { formatMoroccanPhone } from "@/lib/morocco";

/** A phone number inside a sentence: kept on one line (no-break spaces) and left to right inside Arabic text (an isolate). */
const phoneForText = (national: string) => String.fromCharCode(0x2066) + formatMoroccanPhone(national).split(" ").join(String.fromCharCode(0xa0)) + String.fromCharCode(0x2069);

/** The saved order is written once, before this page opens: there is nothing to listen for. */
const neverChanges = () => () => {};

/**
 * Thank you: the order reference from the address, and (in the tab that placed
 * the order) the customer's name, the number we will call and the amount to
 * hand the courier. The checkout has already emptied the cart and counted the
 * order.
 */
function SuccessContent() {
  const { t, m, locale } = useLanguage();
  const reference = (useSearchParams().get("ref") ?? "").slice(0, 20);
  // The tab's saved order: nothing on the server and while the page hydrates, then what the checkout left
  const saved = useSyncExternalStore(neverChanges, readPlacedOrderText, () => null);
  const order = useMemo(() => parsePlacedOrder(saved, reference), [saved, reference]);
  useEffect(() => {
    // The order form was scrolled down to its button; this page starts at its top
    // Older phones reject "instant" outright; they get the plain call
    try {
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [reference]);
  const { min, max } = mainProduct.deliveryHours;
  const firstName = order?.name.split(" ")[0];

  if (!/^[A-Z]{2,5}-[A-Z0-9]{8}$/.test(reference)) {
    return (
      <div className="kv-thanks kv-wrap">
        <p className="kv-lede">{m.success.missing}</p>
        <Link href="/" className="kv-btn kv-btn-primary">{m.success.back}</Link>
      </div>
    );
  }

  return (
    <div className="kv-thanks kv-wrap">
      <span className="kv-thanks-check" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M5 12.500l4.500 4.500L19 7.500" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <p className="kv-eyebrow">{m.success.eyebrow}</p>
      <h1 className="kv-display">{firstName ? t("success.title", { name: firstName }) : m.success.titleNoName}</h1>
      <p className="kv-thanks-ref">
        {m.success.reference} <strong dir="ltr">{reference}</strong>
      </p>
      <ol className="kv-thanks-steps">
        <li>
          <h2>{m.success.next1Title}</h2>
          <p>{order ? t("success.next1", { phone: phoneForText(order.phone) }) : m.success.next1NoPhone}</p>
        </li>
        <li>
          <h2>{m.success.next2Title}</h2>
          <p>{t("success.next2", { min, max })}</p>
        </li>
        <li>
          <h2>{m.success.next3Title}</h2>
          <p>{order ? t("success.next3", { total: formatPrice(order.total, locale) }) : m.success.next3NoTotal}</p>
        </li>
      </ol>
      <Link href="/" className="kv-btn kv-btn-primary">{m.success.back}</Link>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="kv-thanks kv-wrap" />}>
      <SuccessContent />
    </Suspense>
  );
}
