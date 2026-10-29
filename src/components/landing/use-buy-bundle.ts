"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { useCartStore } from "@/store/cart-store";
import type { ProductDisplay } from "@/types/product";

/** Puts exactly `quantity` of the product in the cart and goes to checkout. */
export function useBuyBundle(product: ProductDisplay | null) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  return useCallback(
    (quantity: number) => {
      if (!product) {
        router.push("/shop");
        return;
      }
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
