"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { formatPrice } from "@/lib/formatters";

interface StripeCheckoutButtonProps {
  /** Store order created from the checkout details (amount lives server-side) */
  orderId: string;
  /** The order's server total, shown on the button */
  total: number;
}

/** Server error codes map to a generic message; message keys (with a dot) pass through. */
const toMessageKey = (code: unknown) => (typeof code === "string" && code.includes(".") ? code : "checkout.paymentUnavailable");

/**
 * Opens Stripe Checkout, Stripe's hosted payment page, for the order: the
 * server creates the session from the order's own total and the browser is
 * sent to its URL. Cards, Apple Pay, Google Pay and Link are shown there as
 * turned on in the Stripe Dashboard. The webhook marks the order paid.
 */
export function StripeCheckoutButton({ orderId, total }: StripeCheckoutButtonProps) {
  const { t } = useLanguage();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proceed = async () => {
    if (redirecting) return;
    setRedirecting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && typeof json?.url === "string" && /^https:\/\/checkout\.stripe\.com\//.test(json.url)) {
        window.location.href = json.url;
        return; // the page is leaving; keep the button in its busy state
      }
      setError(t(toMessageKey(json?.error)));
    } catch {
      setError(t("checkout.paymentUnavailable"));
    }
    setRedirecting(false);
  };

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={proceed}
        disabled={redirecting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {redirecting ? (
          <span className="inline-flex items-center gap-2" role="status">
            <Loader2 className="size-4 animate-spin" />
            {t("checkout.redirectingToStripe")}
          </span>
        ) : (
          <>
            {t("checkout.proceedToCheckout")} · {formatPrice(total)}
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground">{t("checkout.stripeNote")}</p>
    </div>
  );
}
