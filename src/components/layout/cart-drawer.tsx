"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCartStore, getShippingForItems } from "@/store/cart-store";
import { useLanguage } from "@/contexts/language-context";
import { useMounted } from "@/hooks/use-mounted";
import { formatPrice } from "@/lib/formatters";
import { ProductLineImage } from "@/components/storefront";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getLineTotal } from "@/lib/bundles";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { t } = useLanguage();
  const mounted = useMounted();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const incrementItem = useCartStore((s) => s.incrementItem);
  const decrementItem = useCartStore((s) => s.decrementItem);
  const getSubtotal = useCartStore((s) => s.getSubtotal);

  const subtotal = mounted ? getSubtotal() : 0;
  const shipping = mounted ? getShippingForItems(items) : 0;
  const total = subtotal + shipping;

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [open, onClose]);


  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col bg-background shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-5">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="size-5" />
            <h2 className="text-lg font-bold">{t("cart.title")}</h2>
            {mounted && items.length > 0 && (
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {items.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {!mounted || items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-16">
              <ShoppingBag className="size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {t("empty.cartTitle")}
              </p>
              <Link href="/" onClick={onClose}>
                <Button variant="outline" size="sm">
                  {t("empty.continueShopping")}
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.product.id} className="flex gap-4 px-5 py-4">
                  <ProductLineImage
                    className="size-[72px] rounded-xl"
                    imageUrl={item.product.images?.[0]}
                    alt={item.product.name}
                    fallbackLetter={item.product.category?.name ?? "P"}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href="/"
                      onClick={onClose}
                      className="text-[15px] font-medium hover:underline line-clamp-2 leading-snug"
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-sm font-bold">
                      {formatPrice(getLineTotal(item.product.price, item.quantity))}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="inline-flex items-center rounded-xl border bg-muted/30">
                        <button
                          type="button"
                          onClick={() => decrementItem(item.product.id)}
                          className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => incrementItem(item.product.id)}
                          className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.product.id)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {mounted && items.length > 0 && (
          <div className="border-t px-5 py-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("cart.shipping")}</span>
                <span className="font-medium">{formatPrice(shipping)}</span>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between text-base font-bold">
              <span>{t("cart.total")}</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Link href="/checkout" onClick={onClose} className="block">
              <Button className="mt-5 w-full text-[15px] font-bold shadow-md" size="lg">
                {t("cart.checkout")}
              </Button>
            </Link>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              🔒 Secure checkout
            </p>
            <Link
              href="/cart"
              onClick={onClose}
              className="mt-2 block text-center text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {t("cart.continueShopping")}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
