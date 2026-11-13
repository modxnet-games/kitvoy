"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, Lock, PencilLine, ShoppingBag } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { cartDrawerControl, getShippingForItems, lineKey, useCartStore, type CartItem } from "@/store/cart-store";
import { countriesForCart, getCatalogProduct, type CountryCode } from "@/config/catalog";
import { Breadcrumbs, EmptyState } from "@/components/storefront";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { CheckoutForm, OrderSummary } from "@/components/checkout";
import type { CheckoutFormData } from "@/components/checkout";
import { ExpressCheckout, type ExpressHost, type ExpressMethod, type ExpressStatus, type PaidOrder } from "@/components/checkout/express-checkout";
import { PayPalExpress } from "@/components/checkout/paypal-express";
import { PayPalExpressRedirect } from "@/components/checkout/paypal-express-redirect";
import { OpenInBrowser } from "@/components/checkout/open-in-browser";
import { PayPalPayment } from "@/components/checkout/paypal-payment";
import { PayPalRedirect } from "@/components/checkout/paypal-redirect";
import { StripePayment, preloadStripe } from "@/components/checkout/stripe-payment";
import { toCents, type OrderTotals } from "@/lib/payments/money";
import { placeOrder, type PlaceOrderResult } from "@/lib/client/place-order";
import { logCheckoutEvent } from "@/lib/client/checkout-log";
import {
  expressArrival,
  expressReturnFromUrl,
  forgetExpressApproval,
  readExpressApproval,
  stripExpressReturnFromAddressBar,
  type ExpressArrival,
} from "@/lib/client/paypal-express";
import { forgetCheckoutOnServer, resumeCheckout, type ResumeResponse } from "@/lib/client/resume-checkout";
import {
  clearCheckoutRecord,
  hasResumeCookieFlag,
  paypalReturnFromUrl,
  readCheckoutRecord,
  resumeLinkFromUrl,
  saveCheckoutDraft,
  saveCheckoutOrder,
  stripResumeLinkFromAddressBar,
  type CheckoutDraft,
} from "@/lib/client/checkout-storage";
import { detectInAppBrowser } from "@/lib/in-app-browser";
import { paypalMode } from "@/lib/checkout/payment-options";
import { COUNTRY_RULES, US_STATES, isCountryCode } from "@/lib/us-address";
import { useMounted } from "@/hooks/use-mounted";
import { CheckoutSkeleton } from "@/components/checkout/checkout-skeleton";
import { formatPrice } from "@/lib/formatters";
import { toContents, trackInitiateCheckout, trackPurchase } from "@/lib/analytics/meta-pixel";
import { cn } from "@/lib/utils";

interface CheckoutClientProps {
  /** Public PayPal client id, or null when PayPal isn't configured */
  paypalClientId: string | null;
  /** Stripe publishable key, or null when card payments aren't configured */
  stripePublishableKey: string | null;
  /** The signed-in customer, whose order is saved to their account */
  customer: { email: string; fullName: string } | null;
  /** The server saw this browser's checkout cookie, so a started checkout is probably about to be restored */
  resumeHint?: boolean;
  /** Where the visitor is browsing from (Cloudflare's CF-IPCountry header), to pre-select the shipping country */
  visitorCountry?: string | null;
  /** The PayPal express button at the top of the details step; off when PAYPAL_EXPRESS=off on the server */
  paypalExpress?: boolean;
}

/** `cartKey` is the cart the order was created from; its total is stale once the cart changes. */
type PendingOrder = { orderId: string; orderReference: string; cartKey: string; totals: OrderTotals };

/** The server's answer once the details are saved as an order. */
type SavedOrder = Extract<PlaceOrderResult, { ok: true }>;

/** The cart as one comparable string, whatever order its lines are in. */
const cartKeyOf = (items: { product: { id: string; variant?: { key: string } }; quantity: number }[]) =>
  items
    .map((i) => `${lineKey(i.product)}x${i.quantity}`)
    .sort()
    .join(",");

/** What this browser already knows about a started checkout when the page opens. */
interface Boot {
  /** A short-lived token from the URL (open-in-browser hand-off, PayPal return, recovery email) */
  link: string | null;
  /** The session token kept in local storage once an order exists */
  token: string | null;
  orderReference: string | null;
  /** Details typed before any order existed */
  draft: CheckoutDraft | null;
  /** PayPal just sent the customer back: after approving, or after backing out */
  paypal: "return" | "cancel" | null;
  /** PayPal sent an express buyer back (redirect mode), checked against the marker this browser kept when it left */
  express: ExpressArrival | null;
  /** Worth asking the server before showing the form */
  restore: boolean;
}

function readBoot(): Boot {
  if (typeof window === "undefined") return { link: null, token: null, orderReference: null, draft: null, paypal: null, express: null, restore: false };
  const record = readCheckoutRecord();
  const link = resumeLinkFromUrl(window.location.href);
  const token = record?.token ?? null;
  const express = expressArrival(expressReturnFromUrl(window.location.href), readExpressApproval());
  return {
    link,
    token,
    orderReference: record?.orderReference ?? null,
    draft: record?.draft ?? null,
    paypal: paypalReturnFromUrl(window.location.href),
    express,
    // Back from approving an express payment: the details step stays, where that payment is completed.
    // The checkout's own order, if it has one, is found by the server from its cookie
    restore: express?.kind !== "return" && !!(link || token || hasResumeCookieFlag()),
  };
}

/** A slow or unreachable server must not hold the checkout hostage. */
const RESTORE_TIMEOUT_MS = 8000;
const DRAFT_SAVE_DELAY_MS = 400;

/** Cart → Details → Payment, with the finished steps ticked and the current one in brand color. */
function Steps({ current }: { current: 1 | 2 }) {
  const { t } = useLanguage();
  const steps = [t("checkout.stepCart"), t("checkout.stepDetails"), t("checkout.stepPayment")];
  return (
    <nav aria-label="Checkout progress" className="checkout-progress mt-4">
      <ol className="flex items-center gap-2 text-sm sm:gap-3">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const circle = cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200",
            done && "bg-[#2f7d4f] text-white",
            active && "bg-[#c94b16] text-white",
            !done && !active && "border border-[#dcd9d0] bg-white text-[#666a67]",
          );
          const text = cn("font-medium", active ? "text-[#171918]" : "text-[#666a67]");
          return (
            <li key={label} className="flex items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
              {i === 0 ? (
                <Link href="/cart" className="group flex items-center gap-2 rounded-md transition-colors duration-200 hover:text-[#171918] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c94b16]/40">
                  <span className={circle}>{done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}</span>
                  <span className={cn(text, "group-hover:text-[#171918]")}>{label}</span>
                </Link>
              ) : (
                <>
                  <span className={circle}>{done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}</span>
                  <span className={text}>{label}</span>
                </>
              )}
              {i < steps.length - 1 && <span className="h-px w-6 bg-[#dcd9d0] sm:w-10" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Two steps: shipping details save a pending (unpaid) order, then the inline
 * Payment Element (Stripe) or PayPal collects payment for that order's
 * server-side total. Above the details form, the express buttons do both at
 * once: the wallet or PayPal shares the address, and the buyer pays there.
 *
 * A started checkout survives a reload, an in-app browser discarding the
 * page, and a move to another browser: the order's session token (local
 * storage and an HttpOnly cookie) brings back the payment step, and saving
 * the details again updates that same order instead of creating another.
 */
export function CheckoutClient({ paypalClientId, stripePublishableKey, customer, resumeHint = false, visitorCountry = null, paypalExpress = false }: CheckoutClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const [boot] = useState(readBoot);
  // The express approval the buyer has just come back from (redirect mode): completed once, by the redirect button
  const arrival = useRef<string | null>(boot.express?.kind === "return" ? boot.express.id : null);
  // Until that return has ended, a page with no cart still shows it being completed (the web view may have dropped the cart)
  // So does a page reloaded while an approval was being confirmed (the return parameters are gone by then, the marker isn't)
  const [returnPending, setReturnPending] = useState(() => boot.express?.kind === "return" || readExpressApproval() !== null);
  const [phase, setPhase] = useState<"restoring" | "ready">(() => (boot.restore ? "restoring" : "ready"));
  const [details, setDetails] = useState<CheckoutFormData | null>(null);
  const [created, setCreated] = useState<PendingOrder | null>(null);
  // A restored checkout comes with its card intent's client secret, so the form loads without another round trip
  const [restoredIntent, setRestoredIntent] = useState<{ orderId: string; clientSecret: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which payment option is mid-flight, so the other one can't start a second payment.
  // The two express ones run from the details step, and hold the form while they do
  const [processing, setProcessing] = useState<"stripe" | "paypal" | "express_wallet" | "express_paypal" | null>(null);
  // Who holds the details step right now: the form while it saves, or an express payment. The same lock as
  // `isSubmitting` and `processing`, readable inside a click handler before React has drawn the page again
  const step1Lock = useRef<"form" | ExpressMethod | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const paymentTopRef = useRef<HTMLElement>(null);
  // The checkout's session token: sent when the details are saved again, so the same order is updated
  const [sessionToken, setSessionToken] = useState<string | null>(boot.token);
  // Said once after coming back from PayPal without a payment
  const [notice, setNotice] = useState<string | null>(null);
  // What became of the last express attempt, shown with the express buttons or, once on the payment step, above the ways to pay
  // A buyer who backed out of PayPal (redirect mode) is told so as the page opens
  const [expressNotice, setExpressNotice] = useState<string | null>(() => (boot.express?.kind === "cancel" ? t("checkout.expressPaypalNotCompleted") : null));
  // Details a wallet shared that didn't pass the form's rules: the form starts over with them, problems marked
  const [walletPrefill, setWalletPrefill] = useState(0);
  const [markFormErrors, setMarkFormErrors] = useState(false);
  // Once the customer has typed or submitted, a late answer from the server no longer rearranges the page
  const userActed = useRef(false);

  // Meta's in-app browsers reload pages behind the customer's back and can't keep a pop-up connected
  const inApp = mounted ? detectInAppBrowser(navigator.userAgent) : null;
  // PayPal's pop-up buttons lose their callback there, so PayPal becomes a full-page redirect instead
  const paypal = paypalMode({ paypalConfigured: !!paypalClientId, inAppBrowser: !!inApp });
  const canPay = Boolean(paypal || stripePublishableKey);
  // PayPal express: PayPal's pop-up button where pop-ups work, and in Meta's in-app browsers a full-page trip to PayPal and back
  const paypalExpressOn = paypalExpress && paypal !== null && !!paypalClientId;
  // What that button says about itself while PayPal's script loads
  const [paypalExpressStatus, setPaypalExpressStatus] = useState<ExpressStatus>("loading");

  // The card form's connections and script start as soon as the checkout opens, not at the payment step
  if (stripePublishableKey) {
    preconnect("https://js.stripe.com");
    preconnect("https://api.stripe.com");
    preconnect("https://m.stripe.network");
  }
  useEffect(() => {
    if (stripePublishableKey) preloadStripe(stripePublishableKey);
  }, [stripePublishableKey]);

  // If the cart changes after the order was created, go back to the details step
  const cartKey = cartKeyOf(items);
  const pending = created && created.cartKey === cartKey ? created : null;
  const cartChanged = !!created && !pending;

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  /** Puts a checkout the server knows about back on the page. Returns "leaving" when it navigates away instead. */
  const applyResume = useCallback(
    (res: ResumeResponse | null): "leaving" | undefined => {
      // Unreachable server: keep the token; saving the details again still updates the same order
      if (!res) return undefined;

      if (res.status === "none") {
        setSessionToken(null);
        if (boot.token) clearCheckoutRecord();
        return undefined;
      }

      if (res.status !== "pending") {
        // Paid, or settling. Only celebrate the checkout this visit is about, not one paid on an earlier day
        const thisCheckout = !!boot.link || boot.orderReference === res.orderReference || res.recent;
        setSessionToken(null);
        clearCheckoutRecord();
        if (!thisCheckout) return undefined;
        // This checkout is finished: an express approval still waiting for its answer has it now
        forgetExpressApproval();
        logCheckoutEvent(boot.paypal ? "paypal_approved" : "checkout_restored", { ref: res.orderReference, code: res.status });
        trackPurchase({ orderReference: res.orderReference, value: res.total, contents: res.contents });
        clearCart();
        router.replace(`/checkout/success?ref=${encodeURIComponent(res.orderReference)}${res.status === "processing" ? "&state=processing" : ""}`);
        return "leaving";
      }

      // Still to pay. On another browser (or after storage was wiped) the cart comes back from the order
      const cart = useCartStore.getState();
      if (cart.items.length === 0) {
        // One call per product: its colours are lines of the same bundle
        const byProduct = new Map<string, CartItem[]>();
        for (const item of res.items) byProduct.set(item.product.id, [...(byProduct.get(item.product.id) ?? []), item]);
        for (const lines of byProduct.values()) {
          cartDrawerControl.skipNextOpen = true;
          cart.setOfferLines(lines);
        }
        cartDrawerControl.skipNextOpen = false;
      }
      if (res.resumeToken) {
        setSessionToken(res.resumeToken);
        saveCheckoutOrder(res.resumeToken, res.orderReference);
      }
      logCheckoutEvent("checkout_restored", { ref: res.orderReference, step: 2, code: boot.link ? "link" : boot.token ? "session" : "cookie" });
      // Back from PayPal and still unpaid: say so, next to the ways to pay
      if (boot.paypal) {
        logCheckoutEvent("paypal_returned", { ref: res.orderReference, step: 2, code: boot.paypal });
        setNotice(boot.paypal === "cancel" ? "checkout.paymentCanceled" : "checkout.paypalNotCompleted");
      }
      setDetails({ ...res.details, paymentMethod: "paypal" });
      setCreated({ orderId: res.orderId, orderReference: res.orderReference, cartKey: cartKeyOf(res.items), totals: res.totals });
      setRestoredIntent(res.clientSecret ? { orderId: res.orderId, clientSecret: res.clientSecret } : null);
      return undefined;
    },
    [boot, clearCart, router],
  );

  // PayPal sent an express buyer back: its parameters leave the address bar, and a buyer who backed out is told so
  const expressReturnHandled = useRef(false);
  useEffect(() => {
    if (expressReturnHandled.current) return;
    expressReturnHandled.current = true;
    stripExpressReturnFromAddressBar();
    const back = boot.express;
    if (!back || back.kind === "return") return;
    if (back.kind === "cancel") {
      // Nothing was approved, so nothing can be taken: the marker of that PayPal order goes
      forgetExpressApproval();
      logCheckoutEvent("paypal_returned", { step: 1, code: "express_cancel" });
      return;
    }
    // A return naming a PayPal order this browser didn't open (or no longer remembers): nothing is completed or claimed
    logCheckoutEvent("paypal_returned", { step: 1, code: `express_${back.code}` });
  }, [boot]);

  const restoreStarted = useRef(false);
  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    stripResumeLinkFromAddressBar();
    if (!boot.restore) return;

    let gaveUp = false;
    const giveUp = setTimeout(() => {
      gaveUp = true;
      setPhase("ready");
    }, RESTORE_TIMEOUT_MS);
    void resumeCheckout({ token: boot.token, link: boot.link }).then((res) => {
      clearTimeout(giveUp);
      // The form is already showing and in use: leave it alone
      if (gaveUp && userActed.current) return;
      if (applyResume(res) !== "leaving") setPhase("ready");
    });
  }, [boot, applyResume]);

  // What is typed is saved as a draft until the order exists (after that the browser keeps no details)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDraft = useRef<CheckoutFormData | null>(null);
  const flushDraft = useCallback(() => {
    clearTimeout(draftTimer.current);
    if (pendingDraft.current) saveCheckoutDraft(pendingDraft.current);
    pendingDraft.current = null;
  }, []);
  const handleDraftChange = useCallback(
    (values: CheckoutFormData) => {
      userActed.current = true;
      pendingDraft.current = values;
      clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(flushDraft, DRAFT_SAVE_DELAY_MS);
    },
    [flushDraft],
  );
  useEffect(() => {
    // An in-app browser can discard the page the moment the app goes to the background
    const onHide = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushDraft);
      flushDraft();
    };
  }, [flushDraft]);

  // The payment step opens with the card form on screen: on phones that means scrolling to it, not to the page top
  const paymentOrderId = pending?.orderId ?? null;
  useEffect(() => {
    if (!paymentOrderId) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    } else {
      paymentTopRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [paymentOrderId]);

  // The checkout log: opened once per page load, and every time the payment step is hidden or shown again
  // (an in-app browser going to the background is what used to lose the checkout)
  const openedLogged = useRef(false);
  const paymentReference = pending?.orderReference ?? null;
  const hasItems = items.length > 0;
  useEffect(() => {
    if (!mounted || phase !== "ready" || !hasItems || openedLogged.current) return;
    openedLogged.current = true;
    logCheckoutEvent("checkout_opened", { ref: paymentReference ?? undefined, step: paymentReference ? 2 : 1, code: boot.draft ? "draft" : undefined });
  }, [mounted, phase, hasItems, paymentReference, boot]);
  useEffect(() => {
    if (!paymentReference) return;
    let since = performance.now();
    const onVisibility = () => {
      const now = performance.now();
      logCheckoutEvent(document.visibilityState === "hidden" ? "payment_hidden" : "payment_visible", { ref: paymentReference, step: 2, ms: Math.round(now - since) });
      since = now;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [paymentReference]);

  /** The order now exists on the server: what the browser keeps, logs and tells Meta, whichever way the details arrived. */
  const rememberOrder = (result: SavedOrder) => {
    // From here the browser keeps only the token and the order reference; the typed draft is dropped
    pendingDraft.current = null;
    clearTimeout(draftTimer.current);
    if (result.resumeToken) {
      setSessionToken(result.resumeToken);
      saveCheckoutOrder(result.resumeToken, result.orderReference);
    }
    setNotice(null);
    logCheckoutEvent("details_saved", { ref: result.orderReference, step: 1, code: result.reused ? "reused" : "new" });
    // Meta's InitiateCheckout: once per order, with the order reference as its event_id (the server sends the same)
    trackInitiateCheckout(result.orderReference, items, result.totals.total);
    setRestoredIntent(null);
  };

  /** Opens the payment step for a saved order. */
  const showPaymentStep = (data: CheckoutFormData, result: SavedOrder) => {
    setMarkFormErrors(false);
    setDetails(data);
    setCreated({ orderId: result.orderId, orderReference: result.orderReference, cartKey, totals: result.totals });
  };

  const handleDetails = async (data: CheckoutFormData) => {
    if (isSubmitting || step1Lock.current) return;
    if (!canPay) { setError(t("checkout.paymentUnavailable")); return; }
    userActed.current = true;
    setError(null);
    step1Lock.current = "form";
    setIsSubmitting(true);
    // With this checkout's token the server updates its open order instead of creating a second one
    const result = await placeOrder(data, items, { resumeToken: sessionToken });
    step1Lock.current = null;
    setIsSubmitting(false);

    if (!result.ok) {
      setError(t(result.errorKey));
      return;
    }
    rememberOrder(result);
    setExpressNotice(null);
    showPaymentStep(data, result);
  };

  /** A payment went through, on either step: `order` carries the server's reference and total for it. */
  const handlePaid = (order: PaidOrder) => {
    // The server's total for this order, which is the amount paid
    trackPurchase({ orderReference: order.orderReference, value: order.total, contents: order.contents ?? toContents(items) });
    // Paid: nothing about this checkout stays in the browser, an express approval still waiting for its answer included
    setSessionToken(null);
    clearCheckoutRecord();
    forgetExpressApproval();
    forgetCheckoutOnServer();
    clearCart();
    router.push(`/checkout/success?ref=${encodeURIComponent(order.orderReference)}`);
  };

  /** Hands the express approval the buyer came back from to the redirect button, once. */
  const takeArrival = () => {
    const id = arrival.current;
    arrival.current = null;
    return id;
  };

  /** What every express button (wallets, PayPal) is given: the details step's lock, the notice and the way to finish. */
  const expressHost: ExpressHost = {
    isLocked: () => step1Lock.current !== null,
    acquire: (method) => {
      if (step1Lock.current) return false;
      step1Lock.current = method;
      userActed.current = true;
      setProcessing(method === "wallet" ? "express_wallet" : "express_paypal");
      setError(null);
      setExpressNotice(null);
      return true;
    },
    release: (method) => {
      if (step1Lock.current !== method) return;
      step1Lock.current = null;
      setProcessing((now) => (now === "express_wallet" || now === "express_paypal" ? null : now));
    },
    notify: (message) => {
      // Every express button clears the notice as it is pressed, so this is the buyer using the page:
      // a late answer about an earlier checkout must not rearrange it under an open wallet sheet or PayPal window
      userActed.current = true;
      setExpressNotice(message);
    },
    paid: handlePaid,
    log: (event, data) => logCheckoutEvent(event, { step: 1, ...data }),
  };

  /** Saves the order for details a wallet shared, exactly as the form does, without leaving the details step. */
  const saveExpressOrder = async (data: CheckoutFormData) => {
    const result = await placeOrder(data, items, { resumeToken: sessionToken });
    if (result.ok) rememberOrder(result);
    return result;
  };

  if (!mounted || phase !== "ready") {
    const restoring = mounted ? boot.restore : resumeHint;
    return <CheckoutSkeleton variant={restoring ? "payment" : "details"} label={mounted && boot.restore ? t("checkout.restoring") : undefined} />;
  }

  if (items.length === 0 && returnPending && paypalExpressOn && paypal === "redirect") {
    return (
      <div className="store-container checkout-page py-8 md:py-12">
        <div className="mx-auto max-w-md space-y-4">
          <PayPalExpressRedirect
            items={items}
            cartKey={cartKey}
            sessionToken={sessionToken}
            host={expressHost}
            takeArrival={takeArrival}
            onArrivalDone={() => setReturnPending(false)}
            returnOnly
          />
          {expressNotice && (
            <p role="alert" className="rounded-xl border border-[#f3dcb0] bg-[#fdf6e7] px-4 py-3 text-sm text-[#7a5a12]">
              {expressNotice}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-16">
        {expressNotice && (
          <p role="alert" className="mx-auto mb-8 max-w-md rounded-xl border border-[#f3dcb0] bg-[#fdf6e7] px-4 py-3 text-sm text-[#7a5a12]">
            {expressNotice}
          </p>
        )}
        <Breadcrumbs
          items={[{ label: t("cart.title"), href: "/cart" }, { label: t("checkout.title") }]}
          className="mb-8"
        />
        <EmptyState
          icon={ShoppingBag}
          title={t("empty.checkoutTitle")}
          description={t("empty.checkoutDescription")}
          action={{ label: t("empty.continueShopping"), href: "/" }}
        />
      </div>
    );
  }

  const stateName = details ? US_STATES.find((s) => s.code === details.state)?.name ?? details.state : "";
  const detailsCountry: CountryCode = details?.country ?? "US";
  // Shown after the address when it isn't a US one
  const countrySuffix = detailsCountry === "US" ? "" : `, ${COUNTRY_RULES[detailsCountry].name}`;
  // The address can only be in a country every item in the cart ships to
  const shipCountries = countriesForCart(items.map((i) => i.product.slug));
  const deliveryDays = Object.fromEntries(
    shipCountries.map((code) => {
      const quotes = items.flatMap((i) => { const q = getCatalogProduct(i.product.slug)?.shipping[code]; return q ? [q.days] : []; });
      return [code, quotes.length ? { min: Math.max(...quotes.map((q) => q.min)), max: Math.max(...quotes.map((q) => q.max)) } : undefined];
    }),
  ) as Partial<Record<CountryCode, { min: number; max: number }>>;
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const displayTotal = pending ? pending.totals.total : subtotal + getShippingForItems(items);
  const step: 1 | 2 = pending ? 2 : 1;
  const draft = boot.draft ?? {};
  const formDefaults: Partial<CheckoutFormData> =
    details ?? { ...(customer ? { email: customer.email, fullName: customer.fullName } : {}), ...draft, country: isCountryCode(draft.country) ? draft.country : undefined };
  // The cart's own figures: what an express sheet shows before the server has priced the order
  const subtotalCents = toCents(subtotal);
  const shippingCents = toCents(getShippingForItems(items));
  const expressBusy = isSubmitting ? "form" : processing === "express_wallet" ? "wallet" : processing === "express_paypal" ? "paypal" : null;

  return (
    <div className="store-container checkout-page py-8 md:py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[#171918] sm:text-4xl">{t("checkout.title")}</h1>
        <Steps current={step} />
      </header>

      {!canPay && (
        <p className="mt-6 rounded-xl border border-[#e7e5df] bg-white p-4 text-sm text-[#666a67]" role="status">
          Online payment is temporarily unavailable. You can review your details, but no order will be created.
        </p>
      )}

      {error && (
        <div ref={errorRef} role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3.5 text-sm font-medium text-[#8f2a1f]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {cartChanged && (
        <p className="mt-6 flex items-start gap-3 rounded-xl border border-[#f3dcb0] bg-[#fdf6e7] px-4 py-3.5 text-sm text-[#7a5a12]" role="status">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("checkout.cartChanged")}
        </p>
      )}

      {/* Phones: the order folds into one line with the total; tap to see the items */}
      <details className="group mt-6 rounded-2xl border border-[#e7e5df] bg-white shadow-[0_1px_2px_rgba(23,25,24,0.04)] lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 text-sm transition-colors duration-200 hover:bg-[#faf9f6] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-medium text-[#171918]">
            <ShoppingBag className="size-4 text-[#a83d10]" aria-hidden="true" />
            {t("cart.orderSummary")}
            <span className="text-[#666a67]">· {itemCount} {itemCount === 1 ? "item" : "items"}</span>
            <ChevronDown className="size-4 text-[#666a67] transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </span>
          <strong className="text-base font-semibold text-[#171918]">{formatPrice(displayTotal)}</strong>
        </summary>
        <div className="border-t border-[#eeece6] px-5 py-5">
          <OrderSummary totals={pending?.totals} embedded />
        </div>
      </details>

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:items-start lg:gap-10">
        <div className="min-w-0 lg:col-span-7">
          <div className="rounded-2xl border border-[#e7e5df] bg-white p-5 shadow-[0_1px_2px_rgba(23,25,24,0.04)] sm:p-8">
            {pending && details ? (
              <div className="space-y-6 sm:space-y-8">
                {/* Phones get one compact row, so the card form and the Pay button sit high on the screen */}
                <section ref={paymentTopRef} className="scroll-mt-3 rounded-xl border border-[#e7e5df] bg-[#faf9f6] px-4 py-3 sm:p-5" aria-labelledby="ship-to-heading">
                  <div className="flex items-center justify-between gap-3 sm:items-start sm:gap-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[#2f7d4f]">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2f7d4f] text-white"><Check className="size-3" aria-hidden="true" /></span>
                        <span className="sm:hidden">{t("checkout.detailsSavedShort")}</span>
                        <span className="hidden sm:inline">{t("checkout.detailsSaved")}</span>
                      </p>
                      <h2 id="ship-to-heading" className="sr-only sm:not-sr-only sm:mt-3 sm:text-sm sm:font-semibold sm:text-[#171918]">{t("checkout.shipTo")}</h2>
                      <p className="mt-1 truncate text-sm text-[#666a67] sm:hidden">
                        {details.fullName} · {details.address1}, {details.city}, {[details.state, details.zip].filter(Boolean).join(" ")}{countrySuffix}
                      </p>
                      <address className="mt-1 hidden text-sm not-italic leading-relaxed text-[#666a67] sm:block">
                        {details.fullName}
                        <br />
                        {[details.address1, details.address2].filter(Boolean).join(", ")}
                        <br />
                        {details.city}, {[stateName, details.zip].filter(Boolean).join(" ")}{countrySuffix}
                        <br />
                        {details.email} · {details.phone}
                      </address>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExpressNotice(null);
                        setCreated(null);
                      }}
                      disabled={!!processing}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#a83d10] transition-all duration-200 hover:bg-[#fae6db] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c94b16]/40 disabled:opacity-50"
                    >
                      <PencilLine className="size-4" aria-hidden="true" />
                      {t("checkout.editDetails")}
                    </button>
                  </div>
                </section>

                <section className="space-y-4 sm:space-y-5" aria-labelledby="payment-heading">
                  <div>
                    <h2 id="payment-heading" className="text-lg font-semibold tracking-tight text-[#171918]">{t("checkout.paymentTitle")}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#666a67] sm:text-sm">
                      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                      {t("checkout.paymentSubtitle")}
                    </p>
                  </div>
                  {/* An express payment that didn't finish brought the buyer here: say why, above the ways to pay */}
                  {expressNotice && (
                    <p role="alert" className="flex items-start gap-3 rounded-xl border border-[#f3dcb0] bg-[#fdf6e7] px-4 py-3 text-sm text-[#7a5a12]">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {expressNotice}
                    </p>
                  )}
                  {stripePublishableKey && (
                    <StripePayment
                      publishableKey={stripePublishableKey}
                      orderId={pending.orderId}
                      orderReference={pending.orderReference}
                      total={pending.totals.total}
                      billing={{ name: details.fullName, email: details.email, phone: details.phone, postalCode: details.zip, country: detailsCountry }}
                      initialClientSecret={restoredIntent?.orderId === pending.orderId ? restoredIntent.clientSecret : null}
                      onPaid={() => handlePaid({ orderReference: pending.orderReference, total: pending.totals.total })}
                      onProcessingChange={(busy) => setProcessing(busy ? "stripe" : null)}
                      onEvent={(event, data) => logCheckoutEvent(event, { ref: pending.orderReference, step: 2, ...data })}
                      disabled={processing === "paypal"}
                    />
                  )}
                  {notice && (
                    <p role="status" className="flex items-start gap-3 rounded-xl border border-[#f3dcb0] bg-[#fdf6e7] px-4 py-3 text-sm text-[#7a5a12]">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {t(notice)}
                    </p>
                  )}
                  {stripePublishableKey && paypal && (
                    <div className="relative py-2" aria-hidden="true">
                      <div className="absolute inset-x-0 top-1/2 border-t border-[#e7e5df]" />
                      <p className="relative mx-auto w-fit bg-white px-3 text-xs font-medium uppercase tracking-wider text-[#7d817d]">{t("checkout.payOr")}</p>
                    </div>
                  )}
                  {paypal === "redirect" && (
                    <PayPalRedirect
                      orderId={pending.orderId}
                      sessionToken={sessionToken}
                      onProcessingChange={(busy) => setProcessing(busy ? "paypal" : null)}
                      onRedirect={() => logCheckoutEvent("paypal_redirected", { ref: pending.orderReference, step: 2 })}
                      disabled={processing === "stripe"}
                    />
                  )}
                  {paypal === "buttons" && paypalClientId && (
                    <PayPalPayment
                      clientId={paypalClientId}
                      orderId={pending.orderId}
                      onPaid={() => handlePaid({ orderReference: pending.orderReference, total: pending.totals.total })}
                      onProcessingChange={(busy) => setProcessing(busy ? "paypal" : null)}
                      onEvent={(event) => logCheckoutEvent(event, { ref: pending.orderReference, step: 2 })}
                      disabled={processing === "stripe"}
                    />
                  )}
                  {!canPay && (
                    <p className="rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3 text-sm font-medium text-[#8f2a1f]">
                      {t("checkout.paymentUnavailable")}
                    </p>
                  )}
                  {/* The way out of an in-app browser: the same payment step in the phone's own browser */}
                  {inApp && (
                    <OpenInBrowser app={inApp} sessionToken={sessionToken} onOpen={() => logCheckoutEvent("open_in_browser", { ref: pending.orderReference, step: 2 })} />
                  )}
                </section>
              </div>
            ) : (
              <>
                {/* Express checkout: pay with a wallet or PayPal, which also supplies the address. Details step only */}
                {canPay && (
                  <ExpressCheckout
                    publishableKey={stripePublishableKey}
                    subtotalCents={subtotalCents}
                    shippingCents={shippingCents}
                    countries={shipCountries}
                    deliveryDays={deliveryDays}
                    host={expressHost}
                    busy={expressBusy}
                    notice={expressNotice}
                    saveOrder={saveExpressOrder}
                    onFixInForm={(data, message) => {
                      // The form's own placeholder for "how to pay": that is chosen on the next step
                      setDetails({ ...data, paymentMethod: "paypal" });
                      setMarkFormErrors(true);
                      setWalletPrefill((n) => n + 1);
                      setExpressNotice(message);
                    }}
                    onReviewPayment={(data, order, message, clientSecret) => {
                      // The card form opens on the intent the wallet just tried, without another round trip
                      if (clientSecret) setRestoredIntent({ orderId: order.orderId, clientSecret });
                      setExpressNotice(message);
                      showPaymentStep(data, order);
                    }}
                    // PAYPAL EXPRESS SLOT: PayPal supplies the address. In Meta's in-app browsers, where a pop-up loses its
                    // page, the whole page goes to PayPal and back; elsewhere PayPal's pop-up button. Not without PayPal,
                    // and not when it is switched off
                    paypal={
                      paypalExpressOn && paypal === "redirect" ? (
                        <PayPalExpressRedirect
                          items={items}
                          cartKey={cartKey}
                          sessionToken={sessionToken}
                          host={expressHost}
                          takeArrival={takeArrival}
                          onArrivalDone={() => setReturnPending(false)}
                        />
                      ) : paypalExpressOn && paypalClientId ? (
                        <PayPalExpress
                          clientId={paypalClientId}
                          items={items}
                          cartKey={cartKey}
                          sessionToken={sessionToken}
                          countries={shipCountries}
                          host={expressHost}
                          onStatus={setPaypalExpressStatus}
                        />
                      ) : null
                    }
                    paypalStatus={paypal === "redirect" ? "ready" : paypalExpressStatus}
                  />
                )}
                {customer && (
                  <p className="mb-6 flex items-center gap-2 rounded-xl bg-[#faf9f6] px-4 py-3 text-sm text-[#666a67]">
                    <Check className="size-4 text-[#2f7d4f]" aria-hidden="true" />
                    {t("checkout.signedInAs", { email: customer.email })}
                  </p>
                )}
                <CheckoutForm
                  key={walletPrefill}
                  onSubmit={handleDetails}
                  onDraftChange={handleDraftChange}
                  isSubmitting={isSubmitting}
                  locked={processing === "express_wallet" || processing === "express_paypal"}
                  showErrorsAtOnce={markFormErrors}
                  initialValues={formDefaults}
                  submitLabel={t("checkout.continueToPayment")}
                  countries={shipCountries}
                  visitorCountry={visitorCountry}
                  deliveryDays={deliveryDays}
                />
                {/* Guests fill the form straight away; Google is the optional shortcut below it */}
                {!customer && (
                  <div className="mt-8 space-y-4">
                    <div className="relative">
                      <div className="absolute inset-x-0 top-1/2 border-t border-[#e7e5df]" />
                      <p className="relative mx-auto w-fit bg-white px-3 text-xs font-medium uppercase tracking-wider text-[#7d817d]">{t("checkout.googleShortcut")}</p>
                    </div>
                    <GoogleSignInButton redirectUrl="/checkout" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <aside className="hidden lg:col-span-5 lg:block">
          <div className="sticky top-24">
            <OrderSummary totals={pending?.totals} />
          </div>
        </aside>
      </div>

      <p className="mt-8 text-center text-sm">
        <Link href="/cart" className="inline-flex min-h-11 items-center text-[#666a67] underline-offset-4 transition-colors duration-200 hover:text-[#171918] hover:underline">
          {t("checkout.backToCart")}
        </Link>
      </p>
    </div>
  );
}
