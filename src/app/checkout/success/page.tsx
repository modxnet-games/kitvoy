"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { useCartStore } from "@/store/cart-store";
import { buttonVariants } from "@/components/ui/button";
import { trackPurchase } from "@/lib/analytics/meta-pixel";
import { clearCheckoutRecord } from "@/lib/client/checkout-storage";
import { forgetCheckoutOnServer } from "@/lib/client/resume-checkout";

type StripeResult = { status: "paid" | "processing" | "open"; orderReference: string; total: number; contents: { id: string; quantity: number; item_price?: number }[] };

/**
 * Asks the server whether the Stripe payment the customer came back from
 * went through. Stripe's redirect_status alone proves nothing, so nothing is
 * trusted from the URL; "open" or an error shows the payment as not completed.
 */
function useStripeResult(intentId: string | null) {
  const [result, setResult] = useState<StripeResult | { status: "failed" } | null>(null);
  useEffect(() => {
    if (!intentId) return;
    let active = true;
    fetch(`/api/checkout/stripe?payment_intent=${encodeURIComponent(intentId)}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as StripeResult | null;
        if (!active) return;
        setResult(res.ok && json && (json.status === "paid" || json.status === "processing") ? json : { status: "failed" });
      })
      .catch(() => {
        if (active) setResult({ status: "failed" });
      });
    return () => {
      active = false;
    };
  }, [intentId]);
  return result;
}

function SuccessContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref") ?? "";
  // Added by Stripe when a payment method left the site and came back. Cards
  // and PayPal finish on the checkout page and arrive here with only ?ref=
  const intentId = searchParams.get("payment_intent");
  const stripe = useStripeResult(intentId);
  const checking = !!intentId && stripe === null;
  const failed = stripe?.status === "failed";
  const processing = stripe?.status === "processing" || searchParams.get("state") === "processing";
  const orderReference = stripe && stripe.status !== "failed" ? stripe.orderReference : refParam;
  const clearCart = useCartStore((s) => s.clearCart);
  const celebrated = useRef(false);

  useEffect(() => {
    // A redirect left the checkout page before it could clear the cart or count
    // the sale, so both happen here, once, after the server confirms it
    if (!stripe || stripe.status === "failed" || celebrated.current) return;
    celebrated.current = true;
    clearCart();
    trackPurchase({ orderReference: stripe.orderReference, value: stripe.total, contents: stripe.contents ?? [] });
  }, [stripe, clearCart]);

  // Paid (or settling): forget the checkout on this browser, so the next visit starts a fresh one
  const forgotten = useRef(false);
  useEffect(() => {
    if (checking || failed || forgotten.current) return;
    forgotten.current = true;
    clearCheckoutRecord();
    forgetCheckoutOnServer();
  }, [checking, failed]);

  const audioPlayed = useRef(false);
  useEffect(() => {
    if (checking || failed || audioPlayed.current) return;
    audioPlayed.current = true;
    const audio = new Audio("/confirm_order.mp3");
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }, [checking, failed]);

  if (checking) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border bg-background p-8 text-center shadow-2xl" role="status">
          <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">{t("checkout.paymentChecking")}</p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border bg-background p-6 text-center shadow-2xl sm:p-8" role="alert">
          <XCircle className="mx-auto size-16 text-destructive" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">{t("checkout.paymentNotCompleted")}</h1>
          <div className="mt-8 flex justify-center">
            <Link href="/checkout" className={buttonVariants({ size: "lg" })}>
              {t("checkout.title")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-background p-6 text-center shadow-2xl sm:p-8">
        <CheckCircle2 className="mx-auto size-16 text-green-500" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("order.successTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {processing ? t("order.processingMessage") : t("order.successMessage")}
        </p>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          {t("order.shippingMessage")}
        </p>
        {orderReference && (
          <p className="mt-4 rounded-lg bg-muted/50 px-4 py-2 font-mono text-sm">
            {t("order.orderReference")}: {orderReference}
          </p>
        )}
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className={buttonVariants({ size: "lg" })}
          >
            {t("order.continueShopping")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16" />}>
      <SuccessContent />
    </Suspense>
  );
}
