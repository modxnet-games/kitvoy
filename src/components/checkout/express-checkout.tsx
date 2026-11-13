"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  AvailablePaymentMethods,
  Stripe as StripeJs,
  StripeElementsOptions,
  StripeExpressCheckoutElementClickEvent,
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementOptions,
  StripeExpressCheckoutElementShippingAddressChangeEvent,
} from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AlertCircle, Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import type { CountryCode } from "@/config/catalog";
import type { MetaContent } from "@/lib/analytics/meta-pixel";
import type { CheckoutEventName } from "@/lib/checkout/events";
import {
  canShipTo,
  checkExpressDetails,
  detailsFromWallet,
  expressShippingRate,
  sameTotal,
  walletConfirmOutcome,
  walletFailureReason,
  type WalletFailureReason,
} from "@/lib/checkout/express-details";
import type { PlaceOrderResult } from "@/lib/client/place-order";
import { isCountryCode, type CheckoutDetails } from "@/lib/us-address";
import { cn } from "@/lib/utils";
import { appearance, getStripeJs } from "./stripe-payment";

/** Whether a kind of express button will show: still finding out, yes, or no. */
export type ExpressStatus = "loading" | "ready" | "none";

/** The two kinds of express button: the wallets (Apple Pay, Google Pay) and PayPal. */
export type ExpressMethod = "wallet" | "paypal";

/** A paid order, as the confirmation step needs it. */
export interface PaidOrder {
  orderReference: string;
  /** The server's total for the order, which is the amount paid */
  total: number;
  /** What was bought, when the server reported it; otherwise the cart is used */
  contents?: MetaContent[];
}

/** What the checkout page gives every express button, so wallets and PayPal behave as one block. */
export interface ExpressHost {
  /**
   * True while the form is saving or an express payment is running: a button
   * that is clicked now must not start. Answers at once, so it is safe inside
   * a click handler with a time limit.
   */
  isLocked: () => boolean;
  /**
   * Takes the details step's lock for an express payment, once the buyer has
   * authorised or approved it. False when something else holds it: do not
   * continue. While it is held the form can't be edited or submitted and the
   * other express button can't be used.
   */
  acquire: (method: ExpressMethod) => boolean;
  /** Gives the lock back. Call it on every outcome except a completed payment. */
  release: (method: ExpressMethod) => void;
  /** Shows a message with the express buttons (and with the payment options if the buyer lands there); null clears it. */
  notify: (message: string | null) => void;
  /** The payment went through: counts the purchase, forgets the checkout and opens the confirmation page. */
  paid: (order: PaidOrder) => void;
  /** Checkout log: what happened, never who. */
  log: (event: CheckoutEventName, data?: { code?: string; ref?: string }) => void;
}

type SavedOrder = Extract<PlaceOrderResult, { ok: true }>;

interface ExpressCheckoutProps {
  /** Stripe publishable key, or null when card payments aren't configured: no wallet buttons then */
  publishableKey: string | null;
  /** The cart's own figures, in cents; the server prices the order again before anything is charged */
  subtotalCents: number;
  shippingCents: number;
  /** The countries every item in the cart ships to */
  countries: CountryCode[];
  /** Days in transit per country for this cart */
  deliveryDays: Partial<Record<CountryCode, { min: number; max: number }>>;
  host: ExpressHost;
  /** Who holds the details step's lock: the form while it saves, or one of the express methods */
  busy: "form" | ExpressMethod | null;
  /** A message about the last express attempt, already in the buyer's language */
  notice: string | null;
  /** Saves the order for details a wallet shared, as the form does, and stays on this step */
  saveOrder: (details: CheckoutDetails) => Promise<PlaceOrderResult>;
  /** The wallet's details can't be used as they are: the buyer corrects them in the form */
  onFixInForm: (details: CheckoutDetails, message: string) => void;
  /** The order is saved but the wallet payment didn't finish: the buyer pays on the payment step */
  onReviewPayment: (details: CheckoutDetails, order: SavedOrder, message: string, clientSecret?: string) => void;
  /**
   * PAYPAL EXPRESS SLOT. The PayPal express button goes here, under the wallet
   * buttons; leave it out (or null) where PayPal express isn't offered.
   */
  paypal?: ReactNode;
  /** Whether that button will show; it reports this itself as its script loads. Defaults to "ready" when a button is given. */
  paypalStatus?: ExpressStatus;
}

/** Height of every express button, the same as the checkout's own buttons. */
const BUTTON_HEIGHT = 52;
/** Stripe's smallest chargeable amount in US dollars. */
const MIN_AMOUNT_CENTS = 50;
/** How long the wallet buttons may take to report before their reserved space is given back. */
const WALLET_WAIT_MS = 10_000;

/**
 * Whether this browser could have a wallet at all. Without Apple Pay or the
 * Payment Request API (most Android in-app browsers) there is nothing to hold
 * space for; the buttons still appear if Stripe finds one after all.
 */
function browserCouldHaveWallet(): boolean {
  return typeof window !== "undefined" && ("ApplePaySession" in window || "PaymentRequest" in window);
}

function walletMethods(available: Partial<Pick<AvailablePaymentMethods, "applePay" | "googlePay">> | undefined): string[] {
  return [available?.applePay ? "apple_pay" : null, available?.googlePay ? "google_pay" : null].filter((m): m is string => m !== null);
}

type ClientSecretResult = { ok: true; clientSecret: string } | { ok: false; errorKey: string; code: string };

/** The client secret of the order's one PaymentIntent, from the same route the card form uses. */
async function fetchClientSecret(orderId: string): Promise<ClientSecretResult> {
  try {
    const res = await fetch("/api/checkout/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const json = (await res.json().catch(() => ({}))) as { clientSecret?: unknown; error?: unknown };
    if (res.ok && typeof json.clientSecret === "string") return { ok: true, clientSecret: json.clientSecret };
    const error = typeof json.error === "string" ? json.error : "";
    // Message keys (with a dot) pass through; server error codes get the generic message
    return { ok: false, errorKey: error.includes(".") ? error : "checkout.paymentFailed", code: error || `http_${res.status}` };
  } catch {
    return { ok: false, errorKey: "checkout.paymentFailed", code: "intent_network" };
  }
}

type WalletButtonsProps = Pick<ExpressCheckoutProps, "subtotalCents" | "shippingCents" | "countries" | "deliveryDays" | "host" | "saveOrder" | "onFixInForm" | "onReviewPayment"> & {
  /** The amount the wallet sheet shows and authorises */
  amountCents: number;
  /** The wallets this browser can show right now; an empty list when there are none */
  onAvailable: (methods: string[]) => void;
};

/**
 * Apple Pay and Google Pay through Stripe's Express Checkout Element. The
 * wallet shares the buyer's contact and shipping details when they authorise;
 * only then is the order saved (the same route the form uses) and its one
 * PaymentIntent confirmed. The webhook marks the order paid, as for a card.
 */
function WalletButtons({ amountCents, subtotalCents, shippingCents, countries, deliveryDays, host, saveOrder, onFixInForm, onReviewPayment, onAvailable }: WalletButtonsProps) {
  const { t } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  // A wallet sheet was opened and the buyer hasn't authorised yet
  const sheetOpen = useRef(false);
  // The buyer authorised and the payment is being confirmed
  const confirmingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);

  const rateFor = (country?: string) => {
    const code = country?.toUpperCase();
    return expressShippingRate({
      label: t(shippingCents > 0 ? "checkout.expressShipping" : "checkout.expressShippingFree"),
      shippingCents,
      days: isCountryCode(code) ? deliveryDays[code] : undefined,
    });
  };
  // The subtotal and the shipping rate add up to the amount the sheet charges
  const lineItems = [{ name: t("checkout.expressSubtotal"), amount: subtotalCents }];

  const options: StripeExpressCheckoutElementOptions = {
    buttonHeight: BUTTON_HEIGHT,
    buttonType: { applePay: "plain", googlePay: "plain" },
    // PayPal has its own button below, through the store's PayPal account
    paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
    emailRequired: true,
    phoneNumberRequired: true,
    shippingAddressRequired: true,
    billingAddressRequired: true,
    allowedShippingCountries: countries,
    shippingRates: [rateFor(countries.length === 1 ? countries[0] : undefined)],
    lineItems,
  };

  const setBusy = (busy: boolean) => {
    confirmingRef.current = busy;
    setConfirming(busy);
  };

  // Stripe gives a click handler one second to answer, so nothing here waits for anything
  const handleClick = (event: StripeExpressCheckoutElementClickEvent) => {
    if (confirmingRef.current || host.isLocked()) {
      event.reject();
      return;
    }
    sheetOpen.current = true;
    host.notify(null);
    host.log("express_clicked", { code: event.expressPaymentType });
    event.resolve({ lineItems, shippingRates: options.shippingRates });
  };

  const handleShippingAddressChange = (event: StripeExpressCheckoutElementShippingAddressChangeEvent) => {
    try {
      // Only the country and the state are known here; the street arrives when the buyer authorises
      if (!canShipTo(event.address, countries)) {
        event.reject();
        return;
      }
      event.resolve({ shippingRates: [rateFor(event.address.country)] });
    } catch {
      event.reject();
    }
  };

  const handleCancel = () => {
    // The sheet also closes after a payment or a failure; only leaving it without authorising is a cancel
    if (!sheetOpen.current) return;
    sheetOpen.current = false;
    host.log("express_failed", { code: "canceled" });
  };

  const handleConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (confirmingRef.current) return;
    sheetOpen.current = false;
    // The lock is taken when the buyer authorises, not when the sheet opens: a sheet that is
    // closed without a word from the wallet can then never leave the form disabled
    if (!host.acquire("wallet")) {
      event.paymentFailed({ reason: "fail" });
      host.log("express_failed", { code: "locked" });
      return;
    }
    setBusy(true);

    let saved: { details: CheckoutDetails; order: SavedOrder; clientSecret?: string } | null = null;
    let paid = false;
    const failed = (code: string, reason: WalletFailureReason = "fail") => {
      event.paymentFailed({ reason });
      host.log("express_failed", { code: code.slice(0, 48), ref: saved?.order.orderReference });
    };

    try {
      if (!stripe || !elements) {
        failed("not_ready");
        host.notify(t("checkout.paymentFailed"));
        return;
      }
      const { error: submitError } = await elements.submit();
      if (submitError) {
        failed(`submit:${submitError.code ?? submitError.type ?? "error"}`);
        host.notify(t("checkout.paymentFailed"));
        return;
      }

      // The wallet's data under the form's rules. Nothing is saved or charged unless it passes
      const details = detailsFromWallet(event);
      const { problem } = checkExpressDetails(details, countries);
      if (problem) {
        failed(`details_${problem}`, walletFailureReason(problem));
        onFixInForm(details, t("checkout.expressWalletDetails"));
        return;
      }

      const order = await saveOrder(details);
      if (!order.ok) {
        failed(`order:${order.errorKey}`, order.errorKey === "order.errorCountryUnavailable" ? "address_unserviceable" : "fail");
        host.notify(t(order.errorKey));
        return;
      }
      saved = { details, order };

      // The buyer authorised the cart's total. If the server prices the order differently, nothing is charged
      if (!sameTotal(order.totals.total, amountCents)) {
        failed("total_changed");
        onReviewPayment(details, order, t("checkout.expressTotalChanged"));
        return;
      }

      const intent = await fetchClientSecret(order.orderId);
      if (!intent.ok) {
        failed(`intent:${intent.code}`);
        onReviewPayment(details, order, t(intent.errorKey));
        return;
      }
      saved.clientSecret = intent.clientSecret;

      // The address is already on the PaymentIntent (the server set it from the order), so none is sent from here
      const returnUrl = `${window.location.origin}/checkout/success?ref=${encodeURIComponent(order.orderReference)}`;
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: intent.clientSecret,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });
      const outcome = walletConfirmOutcome({ errorType: confirmError ? confirmError.type ?? "unknown" : undefined, intentStatus: paymentIntent?.status });
      if (outcome === "paid") {
        paid = true;
        host.log("pay_succeeded", { code: event.expressPaymentType, ref: order.orderReference });
        host.paid({ orderReference: order.orderReference, total: order.totals.total });
        return;
      }
      failed(confirmError ? `confirm:${confirmError.decline_code ?? confirmError.code ?? confirmError.type ?? "error"}` : `status_${paymentIntent?.status ?? "unknown"}`);
      if (outcome === "refused") {
        // Stripe refused the payment, so nothing was taken. Its card and validation messages are written for
        // customers, and the card form opens on the intent the wallet just tried, without another round trip
        onReviewPayment(details, order, confirmError?.message ?? t("checkout.paymentFailed"), intent.clientSecret);
      } else {
        // What became of this attempt isn't known here (a connection or API error, a payment still waiting on
        // something): nothing is claimed, and no client secret is handed over, so the payment step asks the
        // server where the order stands before it takes anything
        onReviewPayment(details, order, t("order.errorGeneric"));
      }
    } catch {
      // Nothing after a completed payment may report it as failed
      if (paid) return;
      failed("exception");
      // With the order saved the buyer goes on to the payment step, which asks the server where the order stands
      // before taking anything (no client secret is handed over: what became of this attempt isn't known here)
      if (saved) onReviewPayment(saved.details, saved.order, t("order.errorGeneric"));
      else host.notify(t("checkout.paymentFailed"));
    } finally {
      // A paid checkout keeps the lock until the confirmation page opens
      if (!paid) {
        setBusy(false);
        host.release("wallet");
      }
    }
  };

  return (
    <>
      <ExpressCheckoutElement
        options={options}
        onReady={(event) => onAvailable(walletMethods(event.availablePaymentMethods))}
        onAvailablePaymentMethodsChange={(event) =>
          onAvailable(walletMethods({ applePay: event.paymentMethods?.applePay?.available, googlePay: event.paymentMethods?.googlePay?.available }))
        }
        onLoadError={(event) => {
          host.log("express_failed", { code: `load:${event.error?.code ?? event.error?.type ?? "element"}`.slice(0, 48) });
          onAvailable([]);
        }}
        onClick={handleClick}
        onShippingAddressChange={handleShippingAddressChange}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
      {confirming && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-white/90 text-sm font-medium text-[#666a67]" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("checkout.processingPayment")}
        </div>
      )}
    </>
  );
}

/**
 * The express block at the top of the details step: the wallet buttons this
 * device supports, the PayPal express button, and an "OR" before the form.
 *
 * It keeps its height while the buttons load, so the form below doesn't jump,
 * and folds away completely (label and divider too) when there is no express
 * method to offer. Nothing is saved or charged because it is on screen: an
 * order exists only once the buyer authorises a payment.
 */
export function ExpressCheckout({
  publishableKey,
  subtotalCents,
  shippingCents,
  countries,
  deliveryDays,
  host,
  busy,
  notice,
  saveOrder,
  onFixInForm,
  onReviewPayment,
  paypal = null,
  paypalStatus = "ready",
}: ExpressCheckoutProps) {
  const { t } = useLanguage();
  const amountCents = subtotalCents + shippingCents;
  const walletsOn = !!publishableKey && amountCents >= MIN_AMOUNT_CENTS;
  const [couldHaveWallet] = useState(browserCouldHaveWallet);
  const [stripeJs, setStripeJs] = useState<{ stripe?: StripeJs; failed?: boolean }>({});
  // What Stripe said about wallets, for the element as it is now: it starts over when the cart changes
  const elementKey = JSON.stringify([subtotalCents, shippingCents, countries, deliveryDays]);
  const [answer, setAnswer] = useState<{ key: string; methods: string[] } | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const shownLogged = useRef(false);

  useEffect(() => {
    if (!publishableKey) return;
    let active = true;
    const fail = () => {
      if (active) setStripeJs({ failed: true });
    };
    getStripeJs(publishableKey).then((stripe) => {
      if (!active) return;
      if (stripe) setStripeJs({ stripe });
      else fail();
    }, fail);
    return () => {
      active = false;
    };
  }, [publishableKey]);

  const current = answer?.key === elementKey ? answer : null;
  const walletStatus: ExpressStatus = !walletsOn || stripeJs.failed ? "none" : !current ? "loading" : current.methods.length ? "ready" : "none";

  // A wallet that never reports must not hold its space forever
  useEffect(() => {
    if (walletStatus !== "loading") return;
    const timer = setTimeout(() => setAnswer((now) => (now?.key === elementKey ? now : { key: elementKey, methods: [] })), WALLET_WAIT_MS);
    return () => clearTimeout(timer);
  }, [walletStatus, elementKey]);

  const hasPayPal = paypal !== null && paypal !== undefined && paypal !== false;
  const walletRow = walletStatus === "ready" || (walletStatus === "loading" && couldHaveWallet);
  const paypalRow = hasPayPal && paypalStatus !== "none";
  const visible = walletRow || paypalRow;
  const state: ExpressStatus = walletStatus === "loading" || (hasPayPal && paypalStatus === "loading") ? "loading" : visible ? "ready" : "none";
  const methods = [...(current?.methods ?? []), ...(hasPayPal && paypalStatus === "ready" ? ["paypal"] : [])].join(",");

  // Checkout log: which express methods this visit was offered, once the buttons have settled
  useEffect(() => {
    if (state !== "ready" || !methods || shownLogged.current) return;
    shownLogged.current = true;
    host.log("express_shown", { code: methods });
  }, [state, methods, host]);

  useEffect(() => {
    if (!notice) return;
    noticeRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [notice]);

  const elementsOptions: StripeElementsOptions = { mode: "payment", amount: amountCents, currency: "usd", appearance, loader: "never" };
  // While the form saves, or the other express method is paying, a row can't be used
  const walletInert = busy === "form" || busy === "paypal";
  const paypalInert = busy === "form" || busy === "wallet";

  return (
    <div data-express={state} className={visible || notice ? "mb-6" : undefined}>
      {visible && (
        <p id="express-checkout-label" className="text-center text-xs font-medium leading-4 text-[#666a67]">
          {t("checkout.expressTitle")}
        </p>
      )}
      <div className={visible ? "mt-3" : undefined} role={visible ? "group" : undefined} aria-labelledby={visible ? "express-checkout-label" : undefined}>
        {walletsOn && (
          <div
            data-express-wallets={walletStatus}
            className={cn("relative", walletRow ? "min-h-13" : "invisible h-0 overflow-hidden", walletRow && paypalRow && "mb-3", walletRow && walletInert && "opacity-50")}
            inert={!walletRow || walletInert}
          >
            {walletRow && walletStatus === "loading" && (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-13 rounded-xl border border-[#eeece6] bg-[#f6f5f1] motion-safe:animate-pulse" role="status" aria-label={t("checkout.expressLoading")} />
            )}
            {stripeJs.stripe && (
              <Elements stripe={stripeJs.stripe} options={elementsOptions}>
                <WalletButtons
                  key={elementKey}
                  amountCents={amountCents}
                  subtotalCents={subtotalCents}
                  shippingCents={shippingCents}
                  countries={countries}
                  deliveryDays={deliveryDays}
                  host={host}
                  saveOrder={saveOrder}
                  onFixInForm={onFixInForm}
                  onReviewPayment={onReviewPayment}
                  onAvailable={(found) => setAnswer({ key: elementKey, methods: found })}
                />
              </Elements>
            )}
          </div>
        )}
        {hasPayPal && (
          <div
            data-express-paypal={paypalStatus}
            className={cn("relative", paypalRow ? "min-h-13" : "invisible h-0 overflow-hidden", paypalRow && paypalInert && "opacity-50")}
            inert={!paypalRow || paypalInert}
          >
            {paypal}
          </div>
        )}
      </div>
      {notice && (
        <p ref={noticeRef} role="alert" className={cn("flex items-start gap-3 rounded-xl border border-[#f3dcb0] bg-[#fdf6e7] px-4 py-3 text-sm text-[#7a5a12]", visible && "mt-4")}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
      {visible && (
        <div className="relative mt-5" aria-hidden="true">
          <div className="absolute inset-x-0 top-1/2 border-t border-[#e7e5df]" />
          <p className="relative mx-auto w-fit bg-white px-3 text-xs font-medium uppercase leading-4 tracking-wider text-[#7d817d]">{t("checkout.expressOr")}</p>
        </div>
      )}
    </div>
  );
}
