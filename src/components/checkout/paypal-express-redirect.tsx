"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { readExpressApproval, rememberExpressApproval } from "@/lib/client/paypal-express";
import type { ProductDisplay } from "@/types/product";
import type { ExpressHost } from "./express-checkout";
import { PAYPAL_EXPRESS_ROUTE, cartPayload, createErrorKey, logCode, useExpressCompletion } from "./paypal-express";
import { PayWithPayPalLabel, paypalButtonClass } from "./paypal-redirect";

interface PayPalExpressRedirectProps {
  /** The cart: the server prices it again, the prices here are never used */
  items: { product: ProductDisplay; quantity: number }[];
  /** The cart as one string: an approval is only asked about again for the cart it was opened for */
  cartKey: string;
  /** The session token of a checkout this browser already started, so that checkout keeps its one order */
  sessionToken: string | null;
  host: ExpressHost;
  /**
   * Hands over, once, the PayPal order the buyer has just come back from
   * approving (the page read it from the URL and checked it against the
   * marker this browser kept); null when there is none, or it was taken.
   */
  takeArrival: () => string | null;
  /** That return has ended without a payment, or there was none to take: nothing more is shown for it */
  onArrivalDone: () => void;
  /**
   * The buyer came back from PayPal to a page with no cart (the web view
   * dropped it on the way): only the return is completed, from the cart the
   * PayPal order lists, and no button is offered.
   */
  returnOnly?: boolean;
}

/**
 * The approval this browser kept for this cart and never learned the outcome
 * of, if there is one: the buyer left for PayPal and came back some other way
 * than PayPal's own return (the back button, a reload), or the answer about
 * it was lost. The server is asked what became of it, so a payment the buyer
 * approved ends on its confirmation page and one they left unapproved is
 * dropped.
 */
function openApprovalFor(cartKey: string): string | null {
  const approval = readExpressApproval();
  return approval && approval.cart === cartKey ? approval.id : null;
}

/**
 * PayPal express for Meta's in-app browsers. PayPal's own button opens a
 * pop-up and waits for it to call back; in those browsers the page behind the
 * pop-up gets reloaded or thrown away and the approval is lost. Here the
 * whole page goes to PayPal and PayPal sends it back to /checkout, where the
 * server reads the address and the cart from the PayPal order, saves the
 * store order and takes the payment: the same call, and the same outcomes, as
 * the pop-up button.
 *
 * Before leaving, the browser notes which PayPal order it opened (the
 * approval marker). On the way back only that order is completed, so a link
 * naming some other PayPal order does nothing here. There is no check of the
 * address while the buyer is in PayPal (that needs PayPal's script); the
 * server's check after approval is the rule.
 */
export function PayPalExpressRedirect({ items, cartKey, sessionToken, host, takeArrival, onArrivalDone, returnOnly = false }: PayPalExpressRedirectProps) {
  const { t } = useLanguage();
  const { confirming, confirmingRef, needsPhone, phonePrompt, finishRef } = useExpressCompletion({ items, cartKey, sessionToken, host, onClosed: onArrivalDone });
  // The PayPal order is being opened, or the page is on its way to PayPal
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  // Page events and the first look at the marker read what is current from here
  const latest = useRef({ items, cartKey, sessionToken, host, t, takeArrival, onArrivalDone, returnOnly });
  useEffect(() => {
    latest.current = { items, cartKey, sessionToken, host, t, takeArrival, onArrivalDone, returnOnly };
  });

  const setBusy = (busy: boolean) => {
    leavingRef.current = busy;
    setLeaving(busy);
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Back from PayPal with an approval: the server completes it, whatever cart this page still holds
    const arrived = latest.current.takeArrival();
    if (arrived) {
      latest.current.host.log("paypal_returned", { code: "express_return" });
      void finishRef.current(arrived);
      return;
    }
    // No return to complete: an approval left open is asked about as the button appears. For this cart only,
    // unless the page has no cart at all (the web view dropped it): then whichever approval this browser kept
    const open = latest.current.returnOnly ? (readExpressApproval()?.id ?? null) : openApprovalFor(latest.current.cartKey);
    if (open) {
      void finishRef.current(open, { resumed: true });
      return;
    }
    latest.current.onArrivalDone();
  }, [finishRef]);

  // Back from PayPal through the browser's page cache (the back button): the button must work again,
  // and the approval the page left for is asked about
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (leavingRef.current) {
        leavingRef.current = false;
        setLeaving(false);
        latest.current.host.release("paypal");
      }
      const open = latest.current.returnOnly ? null : openApprovalFor(latest.current.cartKey);
      if (open) void finishRef.current(open, { resumed: true });
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [finishRef]);

  const start = async () => {
    const { host: now } = latest.current;
    // A press while the form is saving or another payment runs must not open PayPal
    if (leavingRef.current || confirmingRef.current || now.isLocked()) return;
    now.notify(null);
    // An earlier approval for this cart is still open (PayPal may be holding its payment): the server is
    // asked about that one again, and no second payment is opened beside it
    const earlier = openApprovalFor(latest.current.cartKey);
    if (earlier) {
      now.log("express_clicked", { code: "paypal_recheck" });
      void finishRef.current(earlier, { resumed: true });
      return;
    }
    // The details step is held from here: the form and the wallets wait while the page leaves
    if (!now.acquire("paypal")) return;
    setBusy(true);
    now.log("express_clicked", { code: "paypal_redirect" });

    // Nothing has been approved until the buyer is at PayPal, so a failure here took nothing
    const failed = (code: string, messageKey: string | null) => {
      setBusy(false);
      latest.current.host.release("paypal");
      latest.current.host.log("express_failed", { code: logCode(code) });
      latest.current.host.notify(latest.current.t(messageKey ?? "checkout.expressPaypalNotCompleted"));
    };
    try {
      const res = await fetch(PAYPAL_EXPRESS_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartPayload(latest.current.items), resumeToken: latest.current.sessionToken ?? undefined, mode: "redirect" }),
      });
      const json = (await res.json().catch(() => null)) as { paypalOrderId?: unknown; approveUrl?: unknown; error?: unknown } | null;
      if (!res.ok || typeof json?.paypalOrderId !== "string" || typeof json.approveUrl !== "string") {
        const key = createErrorKey(typeof json?.error === "string" ? json.error : "");
        failed(key ? `paypal:create:${key}` : "paypal:error", key);
        return;
      }
      // Kept across the trip: on the way back, only the PayPal order noted here is completed
      rememberExpressApproval(json.paypalOrderId, latest.current.cartKey);
      latest.current.host.log("paypal_redirected", { code: "express" });
      // The button stays busy: the page is on its way out
      window.location.assign(json.approveUrl);
    } catch {
      failed("paypal:create_network", null);
    }
  };

  if (needsPhone) return phonePrompt;

  if (confirming) {
    return (
      <div className="flex h-13 items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium text-[#666a67]" role="status" data-paypal-express-confirming>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t("checkout.expressPaypalConfirming")}
      </div>
    );
  }

  if (returnOnly) return null;

  return (
    <button type="button" onClick={start} disabled={leaving} aria-busy={leaving || undefined} data-paypal-express-redirect className={paypalButtonClass}>
      {leaving ? (
        <span className="inline-flex items-center gap-2.5" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          {t("checkout.paypalOpening")}
        </span>
      ) : (
        <PayWithPayPalLabel />
      )}
    </button>
  );
}
