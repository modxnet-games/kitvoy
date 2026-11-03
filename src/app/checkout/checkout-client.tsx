"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { getShippingForItems, useCartStore } from "@/store/cart-store";
import { Breadcrumbs, EmptyState } from "@/components/storefront";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { CheckoutForm, OrderSummary } from "@/components/checkout";
import type { CheckoutFormData } from "@/components/checkout";
import { PayPalPayment } from "@/components/checkout/paypal-payment";
import { placeOrder } from "@/lib/client/place-order";
import { US_STATES } from "@/lib/us-address";
import { useMounted } from "@/hooks/use-mounted";
import { CheckoutSkeleton } from "@/components/checkout/checkout-skeleton";
import { formatPrice } from "@/lib/formatters";
import { trackPurchase } from "@/lib/analytics/meta-pixel";

interface CheckoutClientProps {
  /** Public PayPal client id, or null when PayPal isn't configured */
  paypalClientId: string | null;
  /** The signed-in customer, whose order is saved to their account */
  customer: { email: string; fullName: string } | null;
}

/** `cartKey` is the cart the order was created from; its total is stale once the cart changes. */
type PendingOrder = { orderId: string; orderReference: string; cartKey: string };

/**
 * Two steps: shipping details create a pending (unpaid) order, then PayPal
 * collects payment for that order's server-side total.
 */
export function CheckoutClient({ paypalClientId, customer }: CheckoutClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const [details, setDetails] = useState<CheckoutFormData | null>(null);
  const [created, setCreated] = useState<PendingOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the cart changes after the order was created, go back to the details step
  const cartKey = items.map((i) => `${i.product.id}x${i.quantity}`).join(",");
  const pending = created && created.cartKey === cartKey ? created : null;

  const handleDetails = async (data: CheckoutFormData) => {
    if (isSubmitting) return;
    if (!paypalClientId) { setError(t("checkout.paymentUnavailable")); return; }
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
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const handlePaid = () => {
    if (!pending) return;
    // The cart priced this order with the same bundle rules the server charged, so its total is the amount paid
    trackPurchase({
      orderReference: pending.orderReference,
      value: subtotal + getShippingForItems(items),
      skus: items.map((i) => i.product.sku),
      quantity: items.reduce((n, i) => n + i.quantity, 0),
    });
    clearCart();
    router.push(`/checkout/success?ref=${encodeURIComponent(pending.orderReference)}`);
  };

  if (!mounted) return <CheckoutSkeleton />;

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
    <div className="store-container checkout-page checkout-compact py-6 md:py-10">
      {/* On phones the step line below says where you are; the heading stays for screen readers */}
      <h1 className="sr-only sm:not-sr-only sm:text-3xl sm:font-bold sm:tracking-tight">{t("checkout.title")}</h1>
      <div className="checkout-progress" aria-label="Checkout progress"><Link href="/cart" className="text-link">Cart</Link><span aria-hidden="true">/</span><strong aria-current={pending ? undefined : "step"}>Delivery details</strong><span aria-hidden="true">/</span><span aria-current={pending ? "step" : undefined}>Payment</span></div>
      {!paypalClientId && <p className="mt-5 rounded-lg border bg-white p-4 text-sm text-muted-foreground" role="status">Online payment is temporarily unavailable. You can review your details, but no order will be created.</p>}

      {error && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-destructive shadow-sm"
        >
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Phones: the order is one tappable line so the form starts near the top */}
      <details className="checkout-summary-mobile mt-4 lg:hidden">
        <summary>
          <span>{t("cart.orderSummary")} · {items.reduce((n, i) => n + i.quantity, 0)} {items.reduce((n, i) => n + i.quantity, 0) === 1 ? "item" : "items"}</span>
          <strong>{formatPrice(subtotal + getShippingForItems(items))}</strong>
        </summary>
        <OrderSummary className="mt-2" />
      </details>

      <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="checkout-form-card rounded-xl border bg-card p-6">
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
                    className="min-h-11 text-sm font-semibold text-brand hover:underline"
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
              <>
                {customer ? (
                  <p className="mb-6 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                    {t("checkout.signedInAs", { email: customer.email })}
                  </p>
                ) : (
                  null
                )}
                <CheckoutForm
                  onSubmit={handleDetails}
                  isSubmitting={isSubmitting}
                  initialValues={details ?? (customer ? { email: customer.email, fullName: customer.fullName } : undefined)}
                  submitLabel={t("checkout.continueToPayment")}
                />
                {/* Guests fill the form straight away; Google is the optional shortcut below it */}
                {!customer && (
                  <div className="mt-4 space-y-3">
                    <div className="relative">
                      <div className="absolute inset-x-0 top-1/2 border-t border-border" />
                      <p className="relative mx-auto w-fit bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">{t("checkout.googleDivider")}</p>
                    </div>
                    <GoogleSignInButton redirectUrl="/checkout" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="hidden lg:col-span-1 lg:block">
          <div className="sticky top-24">
            <OrderSummary />
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/cart" className="checkout-back hover:text-foreground">
          {t("checkout.backToCart")}
        </Link>
      </p>
    </div>
  );
}
