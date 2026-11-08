"use client";

import { useEffect, useState, type FormEvent } from "react";
import { loadStripe, type Stripe as StripeJs, type Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AlertCircle, Lock } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { formatPrice } from "@/lib/formatters";
import { CheckoutButton } from "./checkout-button";

interface StripePaymentProps {
  publishableKey: string;
  /** Store order created from the checkout details (amount lives server-side) */
  orderId: string;
  orderReference: string;
  /** The order's server total, shown on the pay button */
  total: number;
  /** Prefills the Payment Element's billing fields */
  billing: { name: string; email: string; phone: string; postalCode: string };
  onPaid: () => void;
  /** Lets the page lock the other payment option while a card payment runs */
  onProcessingChange?: (processing: boolean) => void;
  /** True while PayPal is confirming, so a second payment can't start here */
  disabled?: boolean;
}

// Stripe.js loads once per key, and only when the payment step shows
const stripePromises = new Map<string, Promise<StripeJs | null>>();
function getStripeJs(key: string) {
  let promise = stripePromises.get(key);
  if (!promise) {
    promise = loadStripe(key);
    stripePromises.set(key, promise);
  }
  return promise;
}

/** Server error codes map to a generic message; message keys (with a dot) pass through. */
const toMessageKey = (code: unknown) => (typeof code === "string" && code.includes(".") ? code : "checkout.paymentUnavailable");

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
    fontFamily: "Inter, system-ui, sans-serif",
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
 * Stripe Payment Element: cards, wallets and whatever else is turned on under
 * Dashboard → Settings → Payment methods (dynamic payment methods). The
 * PaymentIntent comes from /api/checkout/stripe; the webhook marks the order
 * paid, so this only confirms and moves the customer on.
 */
export function StripePayment({ publishableKey, orderId, orderReference, total, billing, onPaid, onProcessingChange, disabled }: StripePaymentProps) {
  const { t } = useLanguage();
  // Keyed by order, so a new order never shows the previous order's intent
  const [intent, setIntent] = useState<{ orderId: string; clientSecret?: string; errorKey?: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/checkout/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && typeof json?.clientSecret === "string") setIntent({ orderId, clientSecret: json.clientSecret });
        else setIntent({ orderId, errorKey: toMessageKey(json?.error) });
      })
      .catch(() => {
        if (active) setIntent({ orderId, errorKey: "checkout.paymentUnavailable" });
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  const current = intent?.orderId === orderId ? intent : null;
  const clientSecret = current?.clientSecret ?? null;

  if (current?.errorKey) {
    return (
      <p role="alert" className="flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3 text-sm font-medium text-[#8f2a1f]">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t(current.errorKey)}
      </p>
    );
  }

  if (!clientSecret) {
    // The Element's shape while Stripe prepares the payment, so nothing jumps
    return (
      <div className="space-y-3" role="status" aria-label={t("checkout.loadingPayment")}>
        {[0, 1, 2].map((i) => <div key={i} className="h-[52px] rounded-xl border border-[#eeece6] bg-[#f6f5f1] motion-safe:animate-pulse" />)}
        <div className="h-13 rounded-xl bg-[#c94b16]/20 motion-safe:animate-pulse" />
        <span className="sr-only">{t("checkout.loadingPayment")}</span>
      </div>
    );
  }

  return (
    <Elements
      key={clientSecret}
      stripe={getStripeJs(publishableKey)}
      options={{
        clientSecret,
        appearance,
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" }],
      }}
    >
      <PaymentForm orderReference={orderReference} total={total} billing={billing} onPaid={onPaid} onProcessingChange={onProcessingChange} disabled={disabled} />
    </Elements>
  );
}

function PaymentForm({ orderReference, total, billing, onPaid, onProcessingChange, disabled }: Pick<StripePaymentProps, "orderReference" | "total" | "billing" | "onPaid" | "onProcessingChange" | "disabled">) {
  const { t } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBusy = (busy: boolean) => {
    setSubmitting(busy);
    onProcessingChange?.(busy);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || submitting || disabled) return;
    setBusy(true);
    setError(null);

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
      // Card and validation messages are written for customers; anything else gets ours
      setError(
        confirmError.type === "card_error" || confirmError.type === "validation_error"
          ? confirmError.message ?? t("checkout.paymentFailed")
          : t("checkout.paymentFailed"),
      );
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      onPaid();
      return;
    }
    setBusy(false);
    setError(t("checkout.paymentFailed"));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={submitting}>
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3 text-sm font-medium text-[#8f2a1f]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
      <div className={!ready ? "min-h-[180px]" : undefined}>
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: { type: "accordion", defaultCollapsed: false, radios: "if_multiple", spacedAccordionItems: true },
            defaultValues: {
              billingDetails: {
                name: billing.name,
                email: billing.email,
                phone: billing.phone,
                address: { postal_code: billing.postalCode, country: "US" },
              },
            },
          }}
        />
      </div>
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
