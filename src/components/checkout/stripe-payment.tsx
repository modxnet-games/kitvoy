"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { loadStripe, type Stripe as StripeJs, type Appearance, type StripePaymentElementOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AlertCircle, Lock, RotateCw } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { formatPrice } from "@/lib/formatters";
import { CheckoutButton } from "./checkout-button";

/** What happened in the card form, for the checkout log. Never who. */
export type StripePaymentEvent = "stripe_ready" | "stripe_load_error" | "pay_clicked" | "pay_validation_error" | "pay_error" | "pay_succeeded";

interface StripePaymentProps {
  publishableKey: string;
  /** Store order created from the checkout details (amount lives server-side) */
  orderId: string;
  orderReference: string;
  /** The order's server total, shown on the pay button */
  total: number;
  /** Prefills the Payment Element's billing fields */
  billing: { name: string; email: string; phone: string; postalCode: string; country: string };
  /** The order's client secret when the page already has it (a restored checkout), which saves a round trip */
  initialClientSecret?: string | null;
  onPaid: () => void;
  /** Lets the page lock the other payment option while a card payment runs */
  onProcessingChange?: (processing: boolean) => void;
  onEvent?: (event: StripePaymentEvent, data?: { ms?: number; code?: string }) => void;
  /** True while PayPal is confirming, so a second payment can't start here */
  disabled?: boolean;
}

// Stripe.js loads once per key. A failed download is forgotten, so "Try again" really asks again.
const stripePromises = new Map<string, Promise<StripeJs | null>>();
function getStripeJs(key: string): Promise<StripeJs | null> {
  let promise = stripePromises.get(key);
  if (!promise) {
    promise = loadStripe(key);
    promise.then(
      (stripe) => {
        if (!stripe) stripePromises.delete(key);
      },
      () => stripePromises.delete(key),
    );
    stripePromises.set(key, promise);
  }
  return promise;
}

/** Starts downloading Stripe.js as soon as the checkout opens, so the card form is ready by the payment step. */
export function preloadStripe(key: string): void {
  getStripeJs(key).catch(() => {});
}

/** Server error codes map to a generic message; message keys (with a dot) pass through. */
const toMessageKey = (code: unknown) => (typeof code === "string" && code.includes(".") ? code : "checkout.cardFormFailed");

/** The Payment Element drawn like the rest of the checkout: same radius, borders, focus ring and brand color. */
const appearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#C94B16",
    colorText: "#171918",
    colorTextSecondary: "#666a67",
    colorTextPlaceholder: "#9a9d99",
    colorDanger: "#b3261e",
    colorBackground: "#ffffff",
    // The device's own font: nothing extra to download inside Stripe's frame
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSizeBase: "16px",
    fontWeightNormal: "500",
    borderRadius: "12px",
    spacingUnit: "4px",
    spacingGridRow: "16px",
    spacingGridColumn: "16px",
    focusBoxShadow: "0 0 0 4px rgba(201, 75, 22, 0.15)",
    focusOutline: "none",
  },
  rules: {
    ".Input": { padding: "13px 16px", border: "1px solid #dcd9d0", boxShadow: "none", transition: "border-color 0.2s, box-shadow 0.2s" },
    ".Input:hover": { borderColor: "#bdb9ae" },
    ".Input:focus": { borderColor: "#C94B16", boxShadow: "0 0 0 4px rgba(201, 75, 22, 0.15)" },
    ".Input--invalid": { borderColor: "#d13b2b", boxShadow: "none" },
    ".Label": { fontSize: "14px", fontWeight: "500", marginBottom: "6px" },
    ".Error": { fontSize: "13px", fontWeight: "500" },
    ".AccordionItem": { border: "1px solid #e7e5df", boxShadow: "none", padding: "14px 16px", transition: "border-color 0.2s, box-shadow 0.2s" },
    ".AccordionItem:hover": { borderColor: "#bdb9ae" },
    ".AccordionItem--selected": { borderColor: "#C94B16", boxShadow: "0 0 0 1px #C94B16", backgroundColor: "#fffaf6" },
    ".Tab, .Block": { border: "1px solid #e7e5df", boxShadow: "none" },
    ".Tab--selected": { borderColor: "#C94B16", boxShadow: "0 0 0 1px #C94B16" },
  },
};

/**
 * Phones get tabs: the chosen method's fields sit directly above the Pay
 * button, instead of a list of every other method in between. Wider screens
 * keep the roomier accordion.
 */
type ElementLayout = "tabs" | "accordion";
const pickLayout = (): ElementLayout =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches ? "tabs" : "accordion";

/**
 * The card form's usual height, reserved while it loads so the Pay button
 * doesn't move. Measured at each width with the store's payment methods; once
 * the form has loaded on a device its real height is remembered instead.
 */
function usualHeight(layout: ElementLayout): number {
  const width = typeof window === "undefined" ? 390 : window.innerWidth;
  if (layout === "tabs") return width < 380 ? 484 : 464;
  return width >= 1024 ? 553 : 468;
}
const HEIGHT_KEY = "kitvoy-card-form-height";
const heightSlot = (layout: ElementLayout) => `${layout}:${typeof window === "undefined" ? 0 : Math.round(window.innerWidth / 40)}`;

/** The height the form really had last time on this screen, else the usual one. */
function readReserve(layout: ElementLayout): number {
  try {
    const saved = (JSON.parse(localStorage.getItem(HEIGHT_KEY) ?? "{}") as Record<string, unknown>)[heightSlot(layout)];
    if (typeof saved === "number" && saved >= 200 && saved <= 1600) return saved;
  } catch {
    // ignore
  }
  return usualHeight(layout);
}

function rememberHeight(layout: ElementLayout, height: number): void {
  if (height < 200 || height > 1600) return;
  try {
    localStorage.setItem(HEIGHT_KEY, JSON.stringify({ [heightSlot(layout)]: Math.round(height) }));
  } catch {
    // ignore
  }
}

/** How long the card form may take before the customer is offered a retry. */
const SLOW_AFTER_MS = 12_000;
/** How long after "ready" the form keeps growing to its full height. */
const SETTLE_MS = 1500;

function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f3dcb0] bg-[#fdf6e7] px-4 py-3 text-sm text-[#7a5a12]">
      <p className="flex min-w-0 flex-1 items-start gap-3 font-medium">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[#e2c98f] bg-white px-4 text-sm font-semibold text-[#7a5a12] transition-colors duration-200 hover:bg-[#fbf1da] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c94b16]/40"
      >
        <RotateCw className="size-4" aria-hidden="true" />
        {t("checkout.cardFormRetry")}
      </button>
    </div>
  );
}

/** The form's shape while it loads: same height as the real one, so nothing below it jumps. */
function CardFormPlaceholder({ height, label }: { height: number; label: string }) {
  return (
    <div className="space-y-3 overflow-hidden" style={{ height }} role="status" aria-label={label}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[52px] rounded-xl border border-[#eeece6] bg-[#f6f5f1] motion-safe:animate-pulse" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Stripe Payment Element: cards, wallets and whatever else is turned on under
 * Dashboard → Settings → Payment methods (dynamic payment methods). The
 * PaymentIntent comes from /api/checkout/stripe; the webhook marks the order
 * paid, so this only confirms and moves the customer on.
 */
export function StripePayment({ publishableKey, orderId, orderReference, total, billing, initialClientSecret, onPaid, onProcessingChange, onEvent, disabled }: StripePaymentProps) {
  const { t } = useLanguage();
  // "Try again" bumps the attempt: Stripe.js, the intent and the Element all start over
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${orderId}:${attempt}`;
  const seededKey = useRef<string | null>(initialClientSecret ? `${orderId}:0` : null);
  // Keyed by order and attempt, so a new order never shows the previous order's intent
  const [intent, setIntent] = useState<{ key: string; clientSecret?: string; errorKey?: string } | null>(() =>
    initialClientSecret ? { key: `${orderId}:0`, clientSecret: initialClientSecret } : null,
  );
  const [stripeJs, setStripeJs] = useState<{ key: string; stripe?: StripeJs; failed?: boolean } | null>(null);
  const [layout] = useState<ElementLayout>(pickLayout);
  const [reserve] = useState(() => readReserve(layout));
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let active = true;
    const fail = () => {
      if (!active) return;
      setStripeJs({ key: requestKey, failed: true });
      onEventRef.current?.("stripe_load_error", { code: "script" });
    };
    getStripeJs(publishableKey).then((stripe) => {
      if (!active) return;
      if (stripe) setStripeJs({ key: requestKey, stripe });
      else fail();
    }, fail);
    return () => {
      active = false;
    };
  }, [publishableKey, requestKey]);

  useEffect(() => {
    // A restored checkout arrives with its client secret already
    if (seededKey.current === requestKey) return;
    let active = true;
    fetch("/api/checkout/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && typeof json?.clientSecret === "string") setIntent({ key: requestKey, clientSecret: json.clientSecret });
        else {
          setIntent({ key: requestKey, errorKey: toMessageKey(json?.error) });
          onEventRef.current?.("stripe_load_error", { code: typeof json?.error === "string" ? json.error.slice(0, 40) : "intent" });
        }
      })
      .catch(() => {
        if (!active) return;
        setIntent({ key: requestKey, errorKey: "checkout.cardFormFailed" });
        onEventRef.current?.("stripe_load_error", { code: "intent_network" });
      });
    return () => {
      active = false;
    };
  }, [orderId, requestKey]);

  const retry = () => {
    seededKey.current = null;
    setAttempt((n) => n + 1);
  };

  const current = intent?.key === requestKey ? intent : null;
  const loaded = stripeJs?.key === requestKey ? stripeJs : null;
  const clientSecret = current?.clientSecret ?? null;
  const failed = !!current?.errorKey || !!loaded?.failed;

  if (clientSecret && loaded?.stripe) {
    return (
      // Our own outline stands in while the form loads: Stripe's loader has a different height, which made the button jump
      <Elements key={`${clientSecret}:${attempt}`} stripe={loaded.stripe} options={{ clientSecret, appearance, loader: "never" }}>
        <PaymentForm
          orderReference={orderReference}
          total={total}
          billing={billing}
          layout={layout}
          reserve={reserve}
          onPaid={onPaid}
          onProcessingChange={onProcessingChange}
          onEvent={onEvent}
          onRetry={retry}
          disabled={disabled}
        />
      </Elements>
    );
  }

  // Same outline as the real form (fields, then the button), so the page doesn't move when it arrives
  return (
    <div className="space-y-5" data-card-form="loading">
      {failed ? (
        <RetryNotice message={t(current?.errorKey ?? "checkout.cardFormFailed")} onRetry={retry} />
      ) : (
        <CardFormPlaceholder height={reserve} label={t("checkout.loadingPayment")} />
      )}
      <CheckoutButton type="button" disabled>
        <Lock className="size-4" aria-hidden="true" />
        {t("checkout.payWithCard")} {formatPrice(total)}
      </CheckoutButton>
    </div>
  );
}

type PaymentFormProps = Pick<StripePaymentProps, "orderReference" | "total" | "billing" | "onPaid" | "onProcessingChange" | "onEvent" | "disabled"> & {
  layout: ElementLayout;
  reserve: number;
  onRetry: () => void;
};

function PaymentForm({ orderReference, total, billing, layout, reserve, onPaid, onProcessingChange, onEvent, onRetry, disabled }: PaymentFormProps) {
  const { t } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  // Stripe reports "ready" while its frame is still growing to full height; the reserved space is held until it has
  const [settled, setSettled] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [slow, setSlow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // A new object per failure, so the same message shown twice still scrolls into view twice
  const [error, setError] = useState<{ message: string } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(0);

  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  // Offered once the form has been loading for a while; it disappears if the form turns up after all
  useEffect(() => {
    if (ready || loadError) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [ready, loadError]);

  // The error sits right above the Pay button; bring it on screen and tell screen readers
  useEffect(() => {
    if (!error) return;
    const box = errorRef.current;
    if (!box) return;
    box.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    box.focus({ preventScroll: true });
  }, [error]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  // Remember how tall the form really is here, to reserve exactly that next time
  useEffect(() => {
    if (!settled) return;
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => rememberHeight(layout, frame.offsetHeight), 400);
    });
    observer.observe(frame);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [settled, layout]);

  const options = useMemo<StripePaymentElementOptions>(
    () => ({
      layout:
        layout === "tabs"
          ? { type: "tabs", defaultCollapsed: false }
          : { type: "accordion", defaultCollapsed: false, radios: "if_multiple", spacedAccordionItems: true },
      defaultValues: {
        billingDetails: {
          name: billing.name,
          email: billing.email,
          phone: billing.phone,
          address: { postal_code: billing.postalCode, country: billing.country },
        },
      },
    }),
    [layout, billing.name, billing.email, billing.phone, billing.postalCode, billing.country],
  );

  const setBusy = (busy: boolean) => {
    setSubmitting(busy);
    onProcessingChange?.(busy);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || submitting || disabled) return;
    setBusy(true);
    setError(null);
    onEvent?.("pay_clicked");

    // Methods that leave the page (bank redirects) come back to the success page,
    // which verifies the payment with the server; cards finish here without a redirect
    const returnUrl = `${window.location.origin}/checkout/success?ref=${encodeURIComponent(orderReference)}`;
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (confirmError) {
      setBusy(false);
      const validation = confirmError.type === "validation_error";
      onEvent?.(validation ? "pay_validation_error" : "pay_error", { code: (confirmError.decline_code ?? confirmError.code ?? confirmError.type ?? "").slice(0, 40) });
      // Card and validation messages are written for customers; anything else gets ours
      setError({
        message:
          confirmError.type === "card_error" || validation
            ? confirmError.message ?? t("checkout.paymentFailed")
            : t("checkout.paymentFailed"),
      });
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      onEvent?.("pay_succeeded");
      onPaid();
      return;
    }
    setBusy(false);
    onEvent?.("pay_error", { code: `status_${paymentIntent?.status ?? "unknown"}`.slice(0, 40) });
    setError({ message: t("checkout.paymentFailed") });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={submitting} data-card-form={ready ? "ready" : "loading"}>
      <div ref={frameRef} className="relative" style={settled || loadError ? undefined : { minHeight: reserve }}>
        {!ready && !loadError && (
          <div className="pointer-events-none absolute inset-0">
            <CardFormPlaceholder height={reserve} label={t("checkout.loadingPayment")} />
          </div>
        )}
        <PaymentElement
          onReady={() => {
            setReady(true);
            onEvent?.("stripe_ready", { ms: Math.round(performance.now() - mountedAt.current) });
          }}
          onLoadError={(event) => {
            setLoadError(true);
            onEvent?.("stripe_load_error", { code: (event.error?.code ?? event.error?.type ?? "element").slice(0, 40) });
          }}
          options={options}
        />
      </div>
      {loadError ? (
        <RetryNotice message={t("checkout.cardFormFailed")} onRetry={onRetry} />
      ) : slow && !ready ? (
        <RetryNotice message={t("checkout.cardFormSlow")} onRetry={onRetry} />
      ) : null}
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          data-payment-error
          className="flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3 text-sm font-medium text-[#8f2a1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d13b2b]/40"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error.message}</p>
        </div>
      )}
      <CheckoutButton type="submit" disabled={!stripe || !elements || !ready || disabled} loading={submitting} loadingLabel={t("checkout.processingPayment")}>
        <Lock className="size-4" aria-hidden="true" />
        {t("checkout.payWithCard")} {formatPrice(total)}
      </CheckoutButton>
      {submitting && (
        <p className="text-center text-xs text-[#666a67]" aria-live="polite">{t("checkout.keepPageOpen")}</p>
      )}
    </form>
  );
}
