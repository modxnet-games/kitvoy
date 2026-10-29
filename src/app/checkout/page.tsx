"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { useCartStore } from "@/store/cart-store";
import { Breadcrumbs } from "@/components/storefront";
import {
  CheckoutForm,
  OrderSummary,
} from "@/components/checkout";
import type { CheckoutFormData } from "@/components/checkout";
import { EmptyState } from "@/components/storefront";
import { placeOrder } from "@/lib/client/place-order";

export default function CheckoutPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CheckoutFormData) => {
    setError(null);
    setIsSubmitting(true);

    // TODO(payments): after the order is created, confirm payment with
    // /api/checkout/stripe (card) or /api/checkout/paypal before redirecting.
    const result = await placeOrder(data, items);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(t(result.errorKey));
      return;
    }

    clearCart();
    router.push(`/checkout/success?ref=${encodeURIComponent(result.orderReference)}`);
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-16">
        <Breadcrumbs
          items={[
            { label: t("cart.title"), href: "/cart" },
            { label: t("checkout.title") },
          ]}
          className="mb-8"
        />
        <EmptyState
          icon={ShoppingBag}
          title={t("empty.checkoutTitle")}
          description={t("empty.checkoutDescription")}
          action={{ label: t("empty.continueShopping"), href: "/shop" }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: t("cart.title"), href: "/cart" },
          { label: t("checkout.title") },
        ]}
        className="mb-8"
      />

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {t("checkout.title")}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {t("checkout.subtitle")}
      </p>

      {error && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive shadow-sm"
        >
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <CheckoutForm
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <OrderSummary />
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/cart" className="hover:text-foreground">
          {t("checkout.backToCart")}
        </Link>
      </p>
    </div>
  );
}
