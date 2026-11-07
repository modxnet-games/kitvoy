"use client";

import { useEffect, useState, type FormEvent } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { formatPrice } from "@/lib/formatters";

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

/**
 * Stripe Payment Element: cards, wallets and whatever else is turned on under
 * Dashboard → Settings → Payment methods (dynamic payment methods). The
 * PaymentIntent comes from /api/checkout/stripe; the webhook marks the order
 * paid, so this only confirms and moves the customer on.
 */
export function StripePayment({ publishableKey, orderId, orderReference, total, billing, onPaid }: StripePaymentProps) {
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
      <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-medium text-destructive">
        {t(current.errorKey)}
      </p>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex min-h-[180px] items-center justify-center gap-2 rounded-xl border text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" />
        Loading secure payment…
      </div>
    );
  }

  return (
    <Elements
      key={clientSecret}
      stripe={getStripeJs(publishableKey)}
      options={{
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#C94B16", borderRadius: "8px" } },
      }}
    >
      <PaymentForm orderReference={orderReference} total={total} billing={billing} onPaid={onPaid} />
    </Elements>
  );
}

function PaymentForm({ orderReference, total, billing, onPaid }: Pick<StripePaymentProps, "orderReference" | "total" | "billing" | "onPaid">) {
  const { t } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);

    // Methods that leave the page (bank redirects) come back to the success page,
    // which reads Stripe's redirect_status; cards finish here without a redirect
    const returnUrl = `${window.location.origin}/checkout/success?ref=${encodeURIComponent(orderReference)}`;
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (confirmError) {
      setSubmitting(false);
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
    setSubmitting(false);
    setError(t("checkout.paymentFailed"));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}
      <div className="min-h-[180px]">
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: "tabs",
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
      <button
        type="submit"
        disabled={!stripe || !elements || !ready || submitting}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2" role="status">
            <Loader2 className="size-4 animate-spin" />
            {t("checkout.processing")}
          </span>
        ) : (
          `${t("checkout.payWithCard")} · ${formatPrice(total)}`
        )}
      </button>
    </form>
  );
}
