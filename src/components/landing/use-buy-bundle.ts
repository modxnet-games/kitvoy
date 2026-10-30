"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { useCartStore } from "@/store/cart-store";
import type { ProductDisplay } from "@/types/product";

/**
 * Whether the landing product can be bought right now. Before the product is
 * created in /admin the buttons say "Coming soon" instead of leading nowhere.
 */
export function getAvailability(product: ProductDisplay | null): { canBuy: boolean; unavailableLabel: string } {
  if (!product) return { canBuy: false, unavailableLabel: "Coming soon" };
  if (product.stock <= 0) return { canBuy: false, unavailableLabel: "Sold out" };
  return { canBuy: true, unavailableLabel: "" };
}

/** Puts exactly `quantity` of the product in the cart and goes to checkout. */
export function useBuyBundle(product: ProductDisplay | null) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  return useCallback(
    (quantity: number) => {
      if (!product || product.stock <= 0) return;
      const inCart = useCartStore
        .getState()
        .items.some((i) => i.product.id === product.id);
      if (inCart) updateQuantity(product.id, quantity);
      else addItem(product, quantity);
      router.push("/checkout");
    },
    [product, router, addItem, updateQuantity],
  );
}
