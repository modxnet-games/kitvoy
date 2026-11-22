"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, ShoppingBag } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { getShippingForItems, useCartStore } from "@/store/cart-store";
import { countriesForCart, getCatalogProduct, type CountryCode } from "@/config/catalog";
import { Breadcrumbs, EmptyState } from "@/components/storefront";
import { CheckoutForm, OrderSummary } from "@/components/checkout";
import type { CheckoutFormData } from "@/components/checkout";
import { placeOrder } from "@/lib/client/place-order";
import { logCheckoutEvent } from "@/lib/client/checkout-log";
import { clearCheckoutRecord, readCheckoutRecord, saveCheckoutDraft, type CheckoutDraft } from "@/lib/client/checkout-storage";
import { isCountryCode } from "@/lib/us-address";
import { useMounted } from "@/hooks/use-mounted";
import { CheckoutSkeleton } from "@/components/checkout/checkout-skeleton";
import { formatPrice } from "@/lib/formatters";
import { toContents, trackInitiateCheckout, trackPurchase } from "@/lib/analytics/meta-pixel";
import { cn } from "@/lib/utils";

interface CheckoutClientProps {
  /** Where the visitor is browsing from (Cloudflare's CF-IPCountry header), to pre-select the shipping country */
  visitorCountry?: string | null;
}

const DRAFT_SAVE_DELAY_MS = 400;

/** Cart → Details, with the finished step ticked and the current one in brand color. */
function Steps() {
  const { t } = useLanguage();
  const steps = [t("checkout.stepCart"), t("checkout.stepDetails")];
  const current = 1;
  return (
    <nav aria-label="Checkout progress" className="checkout-progress mt-4">
      <ol className="flex items-center gap-2 text-sm sm:gap-3">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const circle = cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200",
            done && "bg-[#2f7d4f] text-white",
            active && "bg-[#1c5244] text-white",
            !done && !active && "border border-[#d8d1c0] bg-white text-[#5b6b64]",
          );
          const text = cn("font-medium", active ? "text-[#0f2a23]" : "text-[#5b6b64]");
          return (
            <li key={label} className="flex items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
              {i === 0 ? (
                <Link href="/cart" className="group flex items-center gap-2 rounded-md transition-colors duration-200 hover:text-[#0f2a23] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c5244]/40">
                  <span className={circle}>{done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}</span>
                  <span className={cn(text, "group-hover:text-[#0f2a23]")}>{label}</span>
                </Link>
              ) : (
                <>
                  <span className={circle}>{done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}</span>
                  <span className={text}>{label}</span>
                </>
              )}
              {i < steps.length - 1 && <span className="h-px w-6 bg-[#d8d1c0] sm:w-10" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * One step: the details form. Submitting it saves the order (POST /api/orders),
 * empties the cart and goes to the confirmation page. What is typed is kept in
 * local storage until then, so a reload doesn't wipe the form.
 */
export function CheckoutClient({ visitorCountry = null }: CheckoutClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.getSubtotal());
  // Details typed on an earlier visit to this page
  const [draft] = useState<CheckoutDraft | null>(() => (typeof window === "undefined" ? null : (readCheckoutRecord()?.draft ?? null)));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The same lock as `isSubmitting`, readable inside a submit handler before React has drawn the page again
  const submitting = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  // What is typed is saved as a draft until the order exists
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDraft = useRef<CheckoutFormData | null>(null);
  const flushDraft = useCallback(() => {
    clearTimeout(draftTimer.current);
    if (pendingDraft.current) saveCheckoutDraft(pendingDraft.current);
    pendingDraft.current = null;
  }, []);
  const handleDraftChange = useCallback(
    (values: CheckoutFormData) => {
      pendingDraft.current = values;
      clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(flushDraft, DRAFT_SAVE_DELAY_MS);
    },
    [flushDraft],
  );
  useEffect(() => {
    // An in-app browser can discard the page the moment the app goes to the background
    const onHide = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushDraft);
      flushDraft();
    };
  }, [flushDraft]);

  // The checkout log: opened once per page load
  const openedLogged = useRef(false);
  const hasItems = items.length > 0;
  useEffect(() => {
    if (!mounted || !hasItems || openedLogged.current) return;
    openedLogged.current = true;
    logCheckoutEvent("checkout_opened", { step: 1, code: draft ? "draft" : undefined });
  }, [mounted, hasItems, draft]);

  const handleDetails = async (data: CheckoutFormData) => {
    if (submitting.current) return;
    setError(null);
    submitting.current = true;
    setIsSubmitting(true);
    const result = await placeOrder(data, items);

    if (!result.ok) {
      submitting.current = false;
      setIsSubmitting(false);
      setError(t(result.errorKey));
      return;
    }

    // The order exists: nothing about this checkout stays in the browser
    pendingDraft.current = null;
    clearTimeout(draftTimer.current);
    clearCheckoutRecord();
    logCheckoutEvent("details_saved", { ref: result.orderReference, step: 1 });
    // Meta's events for the order, each once per order, with the order reference as their event_id
    trackInitiateCheckout(result.orderReference, items, result.totals.total);
    trackPurchase({ orderReference: result.orderReference, value: result.totals.total, contents: toContents(items) });
    clearCart();
    router.push(`/checkout/success?ref=${encodeURIComponent(result.orderReference)}`);
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

  // The address can only be in a country every item in the cart ships to
  const shipCountries = countriesForCart(items.map((i) => i.product.slug));
  const deliveryDays = Object.fromEntries(
    shipCountries.map((code) => {
      const quotes = items.flatMap((i) => { const q = getCatalogProduct(i.product.slug)?.shipping[code]; return q ? [q.days] : []; });
      return [code, quotes.length ? { min: Math.max(...quotes.map((q) => q.min)), max: Math.max(...quotes.map((q) => q.max)) } : undefined];
    }),
  ) as Partial<Record<CountryCode, { min: number; max: number }>>;
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const displayTotal = subtotal + getShippingForItems(items);
  const saved = draft ?? {};
  const formDefaults: Partial<CheckoutFormData> = { ...saved, country: isCountryCode(saved.country) ? saved.country : undefined };

  return (
    <div className="store-container checkout-page py-8 md:py-12">
      <header>
        <h1 className="font-serif text-4xl font-medium text-[#0f2a23] sm:text-5xl">{t("checkout.title")}</h1>
        <Steps />
      </header>

      {error && (
        <div ref={errorRef} role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3.5 text-sm font-medium text-[#8f2a1f]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {/* Phones: the order folds into one line with the total; tap to see the items */}
      <details className="group mt-6 rounded-2xl border border-[#e6e0d2] bg-white shadow-[0_1px_2px_rgba(15, 42, 35,0.04)] lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 text-sm transition-colors duration-200 hover:bg-[#fbf8f1] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-medium text-[#0f2a23]">
            <ShoppingBag className="size-4 text-[#467253]" aria-hidden="true" />
            {t("cart.orderSummary")}
            <span className="text-[#5b6b64]">· {itemCount} {itemCount === 1 ? "item" : "items"}</span>
            <ChevronDown className="size-4 text-[#5b6b64] transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </span>
          <strong className="text-base font-semibold text-[#0f2a23]">{formatPrice(displayTotal)}</strong>
        </summary>
        <div className="border-t border-[#f3eee2] px-5 py-5">
          <OrderSummary embedded />
        </div>
      </details>

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:items-start lg:gap-10">
        <div className="min-w-0 lg:col-span-7">
          <div className="rounded-2xl border border-[#e6e0d2] bg-white p-5 shadow-[0_1px_2px_rgba(15, 42, 35,0.04)] sm:p-8">
            <CheckoutForm
              onSubmit={handleDetails}
              onDraftChange={handleDraftChange}
              isSubmitting={isSubmitting}
              initialValues={formDefaults}
              countries={shipCountries}
              visitorCountry={visitorCountry}
              deliveryDays={deliveryDays}
            />
          </div>
        </div>

        <aside className="hidden lg:col-span-5 lg:block">
          <div className="sticky top-24">
            <OrderSummary />
          </div>
        </aside>
      </div>

      <p className="mt-8 text-center text-sm">
        <Link href="/cart" className="inline-flex min-h-11 items-center text-[#5b6b64] underline-offset-4 transition-colors duration-200 hover:text-[#0f2a23] hover:underline">
          {t("checkout.backToCart")}
        </Link>
      </p>
    </div>
  );
}
