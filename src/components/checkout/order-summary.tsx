"use client";

import Link from "next/link";
import { Package, ShieldCheck, Truck } from "lucide-react";

import type { CartItem } from "@/store/cart-store";
import { useCartStore, getShippingForItems } from "@/store/cart-store";
import { useLanguage } from "@/contexts/language-context";
import { storePolicies } from "@/config/policies";
import { Price, ProductLineImage } from "@/components/storefront";
import { cn } from "@/lib/utils";
import { getLineTotal, getBundleSavings } from "@/lib/bundles";
import type { OrderTotals } from "@/lib/payments/money";

interface OrderSummaryProps {
  className?: string;
  /** The created order's server figures; before that, the cart's */
  totals?: OrderTotals | null;
  /** Inside the phone's collapsible panel: no card chrome or heading of its own */
  embedded?: boolean;
}

export function OrderSummary({ className, totals, embedded = false }: OrderSummaryProps) {
  const { t } = useLanguage();
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const subtotal = totals?.subtotal ?? getSubtotal();
  const shipping = totals?.shippingCost ?? getShippingForItems(items);
  const total = totals?.total ?? subtotal + shipping;
  const savings = items.reduce((sum, item) => sum + getBundleSavings(item.product.price, item.quantity), 0);
  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className={cn(!embedded && "rounded-2xl border border-[#e7e5df] bg-white p-6 shadow-[0_1px_2px_rgba(23,25,24,0.04)] sm:p-7", className)}>
      {!embedded && (
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-[#171918]">{t("cart.orderSummary")}</h2>
          <Link href="/cart" className="text-sm font-medium text-[#a83d10] underline-offset-4 transition-colors duration-200 hover:text-[#8a2f0a] hover:underline">
            {t("checkout.editCart")}
          </Link>
        </div>
      )}

      <ul className={cn("divide-y divide-[#eeece6]", !embedded && "mt-5")}>
        {items.map((item: CartItem) => {
          const lineSavings = getBundleSavings(item.product.price, item.quantity);
          return (
            <li key={item.product.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              <div className="relative shrink-0">
                <ProductLineImage
                  className="size-[72px] rounded-xl bg-[#f0ede7]"
                  imgClassName="!object-contain mix-blend-multiply"
                  imageUrl={item.product.images?.[0]}
                  alt={item.product.name}
                  fallbackLetter={item.product.category.name}
                />
                <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#171918] px-1.5 text-xs font-semibold text-white" aria-label={`${t("cart.qty")} ${item.quantity}`}>
                  {item.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-semibold leading-snug text-[#171918]">{item.product.name}</p>
                <p className="mt-0.5 text-sm text-[#666a67]">
                  {item.quantity === 1 ? t("checkout.oneInflator") : t("checkout.manyInflators", { count: item.quantity })}
                </p>
                {lineSavings > 0 && (
                  <p className="mt-1 text-xs font-medium text-[#2f7d4f]">{t("checkout.bundleSavingsLabel")} <Price value={lineSavings} /></p>
                )}
              </div>
              <span className="shrink-0 pt-0.5 text-sm font-semibold text-[#171918]">
                <Price value={getLineTotal(item.product.price, item.quantity)} />
              </span>
            </li>
          );
        })}
      </ul>

      <dl className="mt-5 space-y-2.5 border-t border-[#eeece6] pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[#666a67]">{t("cart.subtotal")}{savings > 0 && <span className="text-[#7d817d]"> · {t("checkout.savingsIncluded")}</span>}</dt>
          <dd className="font-medium text-[#171918]"><Price value={subtotal} /></dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#666a67]">{t("cart.shipping")}</dt>
          <dd className="font-medium text-[#171918]">{shipping === 0 ? t("cart.free") : <Price value={shipping} />}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-[#eeece6] pt-4">
          <dt className="text-base font-semibold text-[#171918]">{t("cart.total")} <span className="text-xs font-normal text-[#7d817d]">USD</span></dt>
          <dd className="text-2xl font-bold tracking-tight text-[#171918]" aria-live="polite"><Price value={total} /></dd>
        </div>
      </dl>

      <ul className="mt-6 grid gap-3 border-t border-[#eeece6] pt-5 text-xs text-[#666a67]">
        <li className="flex items-center gap-3"><Truck className="size-4 shrink-0 text-[#a83d10]" aria-hidden="true" />{shipping === 0 ? t("checkout.trustShipping") : t("checkout.trustTracked")}</li>
        <li className="flex items-center gap-3"><Package className="size-4 shrink-0 text-[#a83d10]" aria-hidden="true" />{t("checkout.trustReturns", { days: storePolicies.returns.windowDays })}</li>
        <li className="flex items-center gap-3"><ShieldCheck className="size-4 shrink-0 text-[#a83d10]" aria-hidden="true" />{t("checkout.trustSecure")}</li>
      </ul>
      <p className="sr-only">{count} {count === 1 ? "item" : "items"}</p>
    </div>
  );
}
