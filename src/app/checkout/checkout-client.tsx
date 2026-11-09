"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, Lock, PencilLine, ShoppingBag } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { getShippingForItems, useCartStore } from "@/store/cart-store";
import { Breadcrumbs, EmptyState } from "@/components/storefront";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { CheckoutForm, OrderSummary } from "@/components/checkout";
import type { CheckoutFormData } from "@/components/checkout";
import { PayPalPayment } from "@/components/checkout/paypal-payment";
import { StripePayment } from "@/components/checkout/stripe-payment";
import type { OrderTotals } from "@/lib/payments/money";
import { placeOrder } from "@/lib/client/place-order";
import { US_STATES } from "@/lib/us-address";
import { useMounted } from "@/hooks/use-mounted";
import { CheckoutSkeleton } from "@/components/checkout/checkout-skeleton";
import { formatPrice } from "@/lib/formatters";
import { newEventId, toContents, trackInitiateCheckout, trackPurchase } from "@/lib/analytics/meta-pixel";
import { cn } from "@/lib/utils";

interface CheckoutClientProps {
  /** Public PayPal client id, or null when PayPal isn't configured */
  paypalClientId: string | null;
  /** Stripe publishable key, or null when card payments aren't configured */
  stripePublishableKey: string | null;
  /** The signed-in customer, whose order is saved to their account */
  customer: { email: string; fullName: string } | null;
}

/** `cartKey` is the cart the order was created from; its total is stale once the cart changes. */
type PendingOrder = { orderId: string; orderReference: string; cartKey: string; totals: OrderTotals };

/** Cart → Details → Payment, with the finished steps ticked and the current one in brand color. */
function Steps({ current }: { current: 1 | 2 }) {
  const { t } = useLanguage();
  const steps = [t("checkout.stepCart"), t("checkout.stepDetails"), t("checkout.stepPayment")];
  return (
    <nav aria-label="Checkout progress" className="checkout-progress mt-4">
      <ol className="flex items-center gap-2 text-sm sm:gap-3">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const circle = cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200",
            done && "bg-[#2f7d4f] text-white",
            active && "bg-[#c94b16] text-white",
            !done && !active && "border border-[#dcd9d0] bg-white text-[#666a67]",
          );
          const text = cn("font-medium", active ? "text-[#171918]" : "text-[#666a67]");
          return (
            <li key={label} className="flex items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
              {i === 0 ? (
                <Link href="/cart" className="group flex items-center gap-2 rounded-md transition-colors duration-200 hover:text-[#171918] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c94b16]/40">
                  <span className={circle}>{done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}</span>
                  <span className={cn(text, "group-hover:text-[#171918]")}>{label}</span>
                </Link>
              ) : (
                <>
                  <span className={circle}>{done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}</span>
                  <span className={text}>{label}</span>
                </>
              )}
              {i < steps.length - 1 && <span className="h-px w-6 bg-[#dcd9d0] sm:w-10" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Two steps: shipping details create a pending (unpaid) order, then the
 * inline Payment Element (Stripe) or PayPal collects payment for that order's
 * server-side total.
 */
export function CheckoutClient({ paypalClientId, stripePublishableKey, customer }: CheckoutClientProps) {
  const canPay = Boolean(paypalClientId || stripePublishableKey);
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
  // Which payment option is mid-flight, so the other one can't start a second payment
  const [processing, setProcessing] = useState<"stripe" | "paypal" | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // If the cart changes after the order was created, go back to the details step
  const cartKey = items.map((i) => `${i.product.id}x${i.quantity}`).join(",");
  const pending = created && created.cartKey === cartKey ? created : null;
  const cartChanged = !!created && !pending;

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  // Meta's InitiateCheckout when the customer arrives with a cart: once per
  // cart per tab, and its event_id travels with the order so the server copy
  // de-duplicates against it
  const checkoutEventId = useRef<string | null>(null);
  useEffect(() => {
    if (!mounted || items.length === 0) return;
    const key = `kitvoy-checkout-started:${cartKey}`;
    try {
      const seen = sessionStorage.getItem(key);
      if (seen) {
        checkoutEventId.current = seen;
        return;
      }
    } catch {
      // Storage unavailable: send it once per page load instead
    }
    const eventId = newEventId();
    checkoutEventId.current = eventId;
    trackInitiateCheckout(items, subtotal + getShippingForItems(items), eventId);
    try {
      sessionStorage.setItem(key, eventId);
    } catch {
      // ignore
    }
  }, [mounted, cartKey, items, subtotal]);

  const handleDetails = async (data: CheckoutFormData) => {
    if (isSubmitting) return;
    if (!canPay) { setError(t("checkout.paymentUnavailable")); return; }
    setError(null);
    setIsSubmitting(true);
    const result = await placeOrder(data, items, { initiateCheckoutEventId: checkoutEventId.current });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(t(result.errorKey));
      return;
    }
    setDetails(data);
    setCreated({ orderId: result.orderId, orderReference: result.orderReference, cartKey, totals: result.totals });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const handlePaid = () => {
    if (!pending) return;
    // The server's total for this order, which is the amount paid
    trackPurchase({ orderReference: pending.orderReference, value: pending.totals.total, contents: toContents(items) });
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
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const displayTotal = pending ? pending.totals.total : subtotal + getShippingForItems(items);
  const step: 1 | 2 = pending ? 2 : 1;

  return (
    <div className="store-container checkout-page py-8 md:py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-[#171918] sm:text-4xl">{t("checkout.title")}</h1>
        <Steps current={step} />
      </header>

      {!canPay && (
        <p className="mt-6 rounded-xl border border-[#e7e5df] bg-white p-4 text-sm text-[#666a67]" role="status">
          Online payment is temporarily unavailable. You can review your details, but no order will be created.
        </p>
      )}

      {error && (
        <div ref={errorRef} role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3.5 text-sm font-medium text-[#8f2a1f]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {cartChanged && (
        <p className="mt-6 flex items-start gap-3 rounded-xl border border-[#f3dcb0] bg-[#fdf6e7] px-4 py-3.5 text-sm text-[#7a5a12]" role="status">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("checkout.cartChanged")}
        </p>
      )}

      {/* Phones: the order folds into one line with the total; tap to see the items */}
      <details className="group mt-6 rounded-2xl border border-[#e7e5df] bg-white shadow-[0_1px_2px_rgba(23,25,24,0.04)] lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 text-sm transition-colors duration-200 hover:bg-[#faf9f6] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-medium text-[#171918]">
            <ShoppingBag className="size-4 text-[#a83d10]" aria-hidden="true" />
            {t("cart.orderSummary")}
            <span className="text-[#666a67]">· {itemCount} {itemCount === 1 ? "item" : "items"}</span>
            <ChevronDown className="size-4 text-[#666a67] transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </span>
          <strong className="text-base font-semibold text-[#171918]">{formatPrice(displayTotal)}</strong>
        </summary>
        <div className="border-t border-[#eeece6] px-5 py-5">
          <OrderSummary totals={pending?.totals} embedded />
        </div>
      </details>

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:items-start lg:gap-10">
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-[#e7e5df] bg-white p-6 shadow-[0_1px_2px_rgba(23,25,24,0.04)] sm:p-8">
            {pending && details ? (
              <div className="space-y-8">
                <section className="rounded-xl border border-[#e7e5df] bg-[#faf9f6] p-5" aria-labelledby="ship-to-heading">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[#2f7d4f]">
                        <span className="flex size-5 items-center justify-center rounded-full bg-[#2f7d4f] text-white"><Check className="size-3" aria-hidden="true" /></span>
                        {t("checkout.detailsSaved")}
                      </p>
                      <h2 id="ship-to-heading" className="mt-3 text-sm font-semibold text-[#171918]">{t("checkout.shipTo")}</h2>
                      <address className="mt-1 text-sm not-italic leading-relaxed text-[#666a67]">
                        {details.fullName}
                        <br />
                        {[details.address1, details.address2].filter(Boolean).join(", ")}
                        <br />
                        {details.city}, {stateName} {details.zip}
                        <br />
                        {details.email} · {details.phone}
                      </address>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreated(null)}
                      disabled={!!processing}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#a83d10] transition-all duration-200 hover:bg-[#fae6db] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c94b16]/40 disabled:opacity-50"
                    >
                      <PencilLine className="size-4" aria-hidden="true" />
                      {t("checkout.editDetails")}
                    </button>
                  </div>
                </section>

                <section className="space-y-5" aria-labelledby="payment-heading">
                  <div>
                    <h2 id="payment-heading" className="text-lg font-semibold tracking-tight text-[#171918]">{t("checkout.paymentTitle")}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-[#666a67]">
                      <Lock className="size-3.5" aria-hidden="true" />
                      {t("checkout.paymentSubtitle")}
                    </p>
                  </div>
                  {stripePublishableKey && (
                    <StripePayment
                      publishableKey={stripePublishableKey}
                      orderId={pending.orderId}
                      orderReference={pending.orderReference}
                      total={pending.totals.total}
                      billing={{ name: details.fullName, email: details.email, phone: details.phone, postalCode: details.zip }}
                      onPaid={handlePaid}
                      onProcessingChange={(busy) => setProcessing(busy ? "stripe" : null)}
                      disabled={processing === "paypal"}
                    />
                  )}
                  {stripePublishableKey && paypalClientId && (
                    <div className="relative py-2" aria-hidden="true">
                      <div className="absolute inset-x-0 top-1/2 border-t border-[#e7e5df]" />
                      <p className="relative mx-auto w-fit bg-white px-3 text-xs font-medium uppercase tracking-wider text-[#7d817d]">{t("checkout.payOr")}</p>
                    </div>
                  )}
                  {paypalClientId && (
                    <PayPalPayment
                      clientId={paypalClientId}
                      orderId={pending.orderId}
                      onPaid={handlePaid}
                      onProcessingChange={(busy) => setProcessing(busy ? "paypal" : null)}
                      disabled={processing === "stripe"}
                    />
                  )}
                  {!canPay && (
                    <p className="rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3 text-sm font-medium text-[#8f2a1f]">
                      {t("checkout.paymentUnavailable")}
                    </p>
                  )}
                </section>
              </div>
            ) : (
              <>
                {customer && (
                  <p className="mb-6 flex items-center gap-2 rounded-xl bg-[#faf9f6] px-4 py-3 text-sm text-[#666a67]">
                    <Check className="size-4 text-[#2f7d4f]" aria-hidden="true" />
                    {t("checkout.signedInAs", { email: customer.email })}
                  </p>
                )}
                <CheckoutForm
                  onSubmit={handleDetails}
                  isSubmitting={isSubmitting}
                  initialValues={details ?? (customer ? { email: customer.email, fullName: customer.fullName } : undefined)}
                  submitLabel={t("checkout.continueToPayment")}
                />
                {/* Guests fill the form straight away; Google is the optional shortcut below it */}
                {!customer && (
                  <div className="mt-8 space-y-4">
                    <div className="relative">
                      <div className="absolute inset-x-0 top-1/2 border-t border-[#e7e5df]" />
                      <p className="relative mx-auto w-fit bg-white px-3 text-xs font-medium uppercase tracking-wider text-[#7d817d]">{t("checkout.googleShortcut")}</p>
                    </div>
                    <GoogleSignInButton redirectUrl="/checkout" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <aside className="hidden lg:col-span-5 lg:block">
          <div className="sticky top-24">
            <OrderSummary totals={pending?.totals} />
          </div>
        </aside>
      </div>

      <p className="mt-8 text-center text-sm">
        <Link href="/cart" className="inline-flex min-h-11 items-center text-[#666a67] underline-offset-4 transition-colors duration-200 hover:text-[#171918] hover:underline">
          {t("checkout.backToCart")}
        </Link>
      </p>
    </div>
  );
}
