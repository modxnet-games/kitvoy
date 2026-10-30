"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { useCartStore } from "@/store/cart-store";
import { Breadcrumbs, EmptyState } from "@/components/storefront";
import { CheckoutForm, OrderSummary } from "@/components/checkout";
import type { CheckoutFormData } from "@/components/checkout";
import { PayPalPayment } from "@/components/checkout/paypal-payment";
import { placeOrder } from "@/lib/client/place-order";
import { US_STATES } from "@/lib/us-address";

interface CheckoutClientProps {
  /** Public PayPal client id, or null when PayPal isn't configured */
  paypalClientId: string | null;
}

/** `cartKey` is the cart the order was created from; its total is stale once the cart changes. */
type PendingOrder = { orderId: string; orderReference: string; cartKey: string };

/**
 * Two steps: shipping details create a pending (unpaid) order, then PayPal
 * collects payment for that order's server-side total.
 */
export function CheckoutClient({ paypalClientId }: CheckoutClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const [details, setDetails] = useState<CheckoutFormData | null>(null);
  const [created, setCreated] = useState<PendingOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the cart changes after the order was created, go back to the details step
  const cartKey = items.map((i) => `${i.product.id}x${i.quantity}`).join(",");
  const pending = created && created.cartKey === cartKey ? created : null;

  const handleDetails = async (data: CheckoutFormData) => {
    setError(null);
    setIsSubmitting(true);
    const result = await placeOrder(data, items);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(t(result.errorKey));
      return;
    }
    setDetails(data);
    setCreated({ orderId: result.orderId, orderReference: result.orderReference, cartKey });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePaid = () => {
    if (!pending) return;
    clearCart();
    router.push(`/checkout/success?ref=${encodeURIComponent(pending.orderReference)}`);
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-16">
        <Breadcrumbs
          items={[{ label: t("cart.title"), href: "/cart" }, { label: t("checkout.title") }]}
          className="mb-8"
        />
        <EmptyState
          icon={ShoppingBag}
          title={t("empty.checkoutTitle")}
          description={t("empty.checkoutDescription")}
          action={{ label: t("empty.continueShopping"), href: "/" }}
        />
      </div>
    );
  }

  const stateName = details ? US_STATES.find((s) => s.code === details.state)?.name ?? details.state : "";

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <Breadcrumbs
        items={[{ label: t("cart.title"), href: "/cart" }, { label: t("checkout.title") }]}
        className="mb-8"
      />

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("checkout.title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("checkout.subtitle")}</p>

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
            {pending && details ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/60 p-4 text-sm">
                  <div>
                    <p className="font-semibold">{t("checkout.shipTo")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {details.fullName}
                      <br />
                      {[details.address1, details.address2].filter(Boolean).join(", ")}
                      <br />
                      {details.city}, {stateName} {details.zip}
                      <br />
                      {details.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreated(null)}
                    className="text-sm font-semibold text-brand hover:underline"
                  >
                    {t("checkout.edit")}
                  </button>
                </div>

                <section className="space-y-4">
                  <h2 className="text-base font-semibold">{t("checkout.paymentTitle")}</h2>
                  {paypalClientId ? (
                    <PayPalPayment clientId={paypalClientId} orderId={pending.orderId} onPaid={handlePaid} />
                  ) : (
                    <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                      {t("checkout.paymentUnavailable")}
                    </p>
                  )}
                </section>
              </div>
            ) : (
              <CheckoutForm
                onSubmit={handleDetails}
                isSubmitting={isSubmitting}
                initialValues={details ?? undefined}
                submitLabel={t("checkout.continueToPayment")}
              />
            )}
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
