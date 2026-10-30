"use client";

import Link from "next/link";

import type { CartItem } from "@/store/cart-store";
import { useCartStore, getShippingForItems } from "@/store/cart-store";
import { useLanguage } from "@/contexts/language-context";
import { Price, ProductLineImage } from "@/components/storefront";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getLineTotal, getBundleSavings } from "@/lib/bundles";

interface OrderSummaryProps {
  className?: string;
}

export function OrderSummary({ className }: OrderSummaryProps) {
  const { t } = useLanguage();
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const subtotal = getSubtotal();
  const shipping = getShippingForItems(items);
  const total = subtotal + shipping;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-6",
        className,
      )}
    >
      <Link href="/cart" className="text-link checkout-summary-edit">Edit cart</Link>
      <h2 className="flex min-h-11 items-center font-semibold">{t("cart.orderSummary")}</h2>

      <ul className="mt-4 max-h-60 space-y-3 overflow-y-auto">
        {items.map((item: CartItem) => (
          <li
            key={item.product.id}
            className="flex gap-3 text-sm"
          >
            <ProductLineImage
              className="size-16 rounded-lg bg-[#f0ede7]"
              imgClassName="!object-contain mix-blend-multiply"
              imageUrl={item.product.images?.[0]}
              alt={item.product.name}
              fallbackLetter={item.product.category.name}
            />
            <div className="min-w-0 flex-1">
              <Link
                href="/"
                className="font-medium hover:underline"
              >
                {item.product.name}
              </Link>
              <p className="text-muted-foreground">
                {t("cart.qty")} {item.quantity}
              </p>
              {getBundleSavings(item.product.price, item.quantity) > 0 && <p className="mt-1 text-xs text-muted-foreground">Bundle savings: <Price value={getBundleSavings(item.product.price, item.quantity)} /></p>}
            </div>
            <span className="shrink-0 font-medium">
              <Price value={getLineTotal(item.product.price, item.quantity)} />
            </span>
          </li>
        ))}
      </ul>

      <Separator className="my-4" />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("cart.subtotal")}</span>
          <span>
            <Price value={subtotal} />
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("cart.shipping")}</span>
          <span>
            {shipping === 0 ? "Free" : <Price value={shipping} />}
          </span>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="order-total flex justify-between font-semibold">
        <span>{t("cart.total")}</span>
        <span>
          <Price value={total} />
        </span>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">All totals in USD. Availability and prices are validated before payment.</p>
    </div>
  );
}
