"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { buttonVariants } from "@/components/ui/button";

/** Shows the order reference the checkout passed in ?ref=. The checkout page has already emptied the cart and counted the order. */
function SuccessContent() {
  const { t } = useLanguage();
  const orderReference = useSearchParams().get("ref") ?? "";

  const audioPlayed = useRef(false);
  useEffect(() => {
    if (audioPlayed.current) return;
    audioPlayed.current = true;
    const audio = new Audio("/confirm_order.mp3");
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-background p-6 text-center shadow-2xl sm:p-8">
        <CheckCircle2 className="mx-auto size-16 text-green-500" />
        <h1 className="mt-6 font-serif text-3xl font-medium sm:text-4xl">
          {t("order.successTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("order.successMessage")}
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
