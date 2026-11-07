"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { useCartStore } from "@/store/cart-store";
import { buttonVariants } from "@/components/ui/button";

function SuccessContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const orderReference = searchParams.get("ref") ?? "";
  // Set by Stripe when a payment method redirected away and back (status only;
  // the order itself is marked paid by the webhook)
  const redirectStatus = searchParams.get("redirect_status");
  const failed = redirectStatus === "failed";
  const clearCart = useCartStore((s) => s.clearCart);
  const audioPlayed = useRef(false);

  useEffect(() => {
    // Redirect-based payments leave the checkout page before it can clear the cart
    if (redirectStatus === "succeeded" || redirectStatus === "processing") clearCart();
  }, [redirectStatus, clearCart]);

  useEffect(() => {
    if (failed || audioPlayed.current) return;
    audioPlayed.current = true;
    const audio = new Audio("/confirm_order.mp3");
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }, [failed]);

  if (failed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg rounded-2xl border bg-background p-6 text-center shadow-2xl sm:p-8" role="alert">
          <XCircle className="mx-auto size-16 text-destructive" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">{t("checkout.paymentFailed")}</h1>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-background p-6 text-center shadow-2xl sm:p-8">
        <CheckCircle2 className="mx-auto size-16 text-green-500" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("order.successTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {redirectStatus === "processing" ? t("order.processingMessage") : t("order.successMessage")}
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
