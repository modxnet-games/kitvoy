"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";

interface PayPalRedirectProps {
  /** Store order created from the checkout details (amount lives server-side) */
  orderId: string;
  /** The checkout's session token: only its holder can start a redirect payment */
  sessionToken: string | null;
  /** Lets the page lock the card form while the browser is on its way to PayPal */
  onProcessingChange?: (processing: boolean) => void;
  /** Called just before the page leaves for PayPal */
  onRedirect?: () => void;
  /** True while a card payment runs, so a second payment can't start here */
  disabled?: boolean;
}

/**
 * The store's own PayPal button, for where PayPal's can't be used: PayPal's
 * yellow, at the size of the checkout's other buttons. The express block's
 * redirect button wears the same.
 */
export const paypalButtonClass =
  "inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#ffc439] px-6 text-[15px] font-semibold text-[#111111] transition-all duration-200 hover:bg-[#f2ba36] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0070e0]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

/** "Pay with PayPal", with PayPal's name in its two blues. */
export function PayWithPayPalLabel() {
  const { t } = useLanguage();
  return (
    <>
      {t("checkout.payWith")}
      <span className="text-[17px] font-extrabold italic tracking-tight">
        <span className="text-[#003087]">Pay</span>
        <span className="text-[#0070e0]">Pal</span>
      </span>
    </>
  );
}

/** Server error codes map to a generic message; message keys (with a dot) pass through. */
const toMessageKey = (code: string) => (code.includes(".") ? code : "checkout.paymentFailed");

/**
 * PayPal for Meta's in-app browsers. PayPal's own buttons open a pop-up and
 * wait for it to call back; in those browsers the page behind the pop-up gets
 * reloaded or thrown away, so the call never arrives. Here the whole page goes
 * to PayPal instead, and PayPal sends it back to /checkout, where the server
 * captures the payment. No pop-up, nothing to lose.
 */
export function PayPalRedirect({ orderId, sessionToken, onProcessingChange, onRedirect, disabled }: PayPalRedirectProps) {
  const { t } = useLanguage();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from PayPal through the browser's page cache: the button must work again
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setLeaving(false);
      onProcessingChange?.(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [onProcessingChange]);

  const start = async () => {
    if (leaving || disabled) return;
    setLeaving(true);
    setError(null);
    onProcessingChange?.(true);
    try {
      const res = await fetch("/api/checkout/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, redirect: true, resumeToken: sessionToken ?? undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json?.approveUrl !== "string") {
        throw new Error(typeof json?.error === "string" ? json.error : "");
      }
      onRedirect?.();
      // The button stays busy: the page is on its way out
      window.location.assign(json.approveUrl);
    } catch (err) {
      setLeaving(false);
      onProcessingChange?.(false);
      setError(toMessageKey((err as Error).message));
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3 text-sm font-medium text-[#8f2a1f]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t(error)}</p>
        </div>
      )}
      <button
        type="button"
        onClick={start}
        disabled={leaving || disabled}
        aria-busy={leaving || undefined}
        data-paypal-redirect
        className={paypalButtonClass}
      >
        {leaving ? (
          <span className="inline-flex items-center gap-2.5" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            {t("checkout.paypalOpening")}
          </span>
        ) : (
          <PayWithPayPalLabel />
        )}
      </button>
      <p className="text-center text-xs leading-relaxed text-[#666a67]">{t("checkout.paypalRedirectNote")}</p>
    </div>
  );
}
