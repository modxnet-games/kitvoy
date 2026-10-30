"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";

import type { CartItem } from "@/store/cart-store";
import {
  useCartStore,
  getShippingForItems,
} from "@/store/cart-store";
import { useLanguage } from "@/contexts/language-context";
import {
  Breadcrumbs,
  EmptyState,
  QuantitySelector,
  Price,
  ProductLineImage,
} from "@/components/storefront";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getStockForProductsAction } from "./actions";
import { getLineTotal } from "@/lib/bundles";

function CartItemRow({
  item,
  availableStock,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  availableStock: Record<string, number>;
  onQuantityChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();
  const subtotal = getLineTotal(item.product.price, item.quantity);
  const maxQty = availableStock[item.product.id] ?? item.product.stock;

  return (
    <div className="flex gap-4 py-6 first:pt-0 last:pb-0">
      <ProductLineImage
        className="size-24 rounded-lg sm:size-28"
        imageUrl={item.product.images?.[0]}
        alt={item.product.name}
        fallbackLetter={item.product.category.name}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/"
              className="font-medium hover:underline"
            >
              {item.product.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              {item.product.category.name} · {item.product.sku}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
            <QuantitySelector
              value={item.quantity}
              onValueChange={onQuantityChange}
              max={Math.max(1, maxQty)}
            />
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                <Price value={subtotal} />
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRemove}
                aria-label={t("cart.removeItem")}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  const { t } = useLanguage();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const [availableStock, setAvailableStock] = useState<Record<string, number>>({});
  const [showQuantityAdjusted, setShowQuantityAdjusted] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setAvailableStock({});
      setShowQuantityAdjusted(false);
      return;
    }
    const ids = items.map((i) => i.product.id);
    getStockForProductsAction(ids).then((stock) => {
      setAvailableStock(stock);
      let adjusted = false;
      items.forEach((item) => {
        const avail = stock[item.product.id] ?? 0;
        if (avail <= 0) {
          removeItem(item.product.id);
          adjusted = true;
        } else if (item.quantity > avail) {
          updateQuantity(item.product.id, avail);
          adjusted = true;
        }
      });
      if (adjusted) setShowQuantityAdjusted(true);
    });
  }, [items, removeItem, updateQuantity]);

  const subtotal = getSubtotal();
  const shipping = getShippingForItems(items);
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-16">
        <Breadcrumbs items={[{ label: t("cart.title") }]} className="mb-8" />
        <EmptyState
          icon={ShoppingBag}
          title={t("empty.cartTitle")}
          description={t("empty.cartDescription")}
          action={{ label: t("empty.continueShopping"), href: "/" }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <Breadcrumbs items={[{ label: t("cart.title") }]} className="mb-8" />

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {t("cart.title")}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {t(
          items.length === 1 ? "cart.itemCount" : "cart.itemCountPlural",
          { count: items.length },
        )}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {showQuantityAdjusted && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            >
              {t("stock.quantityAdjusted")}
            </div>
          )}
          <div className="divide-y rounded-xl border bg-card">
            {items.map((item) => (
              <CartItemRow
                key={item.product.id}
                item={item}
                availableStock={availableStock}
                onQuantityChange={(qty) => {
                  const max =
                    availableStock[item.product.id] ?? item.product.stock;
                  updateQuantity(
                    item.product.id,
                    Math.min(qty, Math.max(1, max)),
                  );
                }}
                onRemove={() => removeItem(item.product.id)}
              />
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-xl border bg-card p-6">
            <h2 className="font-semibold">{t("cart.orderSummary")}</h2>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("cart.subtotal")}
                </span>
                <span>
                  <Price value={subtotal} />
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("cart.shipping")}
                </span>
                <span>
                  <Price value={shipping} />
                </span>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between font-semibold">
              <span>{t("cart.total")}</span>
              <span>
                <Price value={total} />
              </span>
            </div>
            <Link
              href="/checkout"
              className={cn(buttonVariants({ size: "lg" }), "mt-6 flex w-full items-center justify-center")}
            >
              {t("cart.checkout")}
            </Link>
            <Link
              href="/"
              className={cn(
                "mt-3 block text-center text-sm text-muted-foreground hover:text-foreground",
              )}
            >
              {t("cart.continueShopping")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
