"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductDisplay } from "@/types/product";
import { getLineTotal } from "@/lib/bundles";

export interface CartItem {
  product: ProductDisplay;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: ProductDisplay, quantity?: number) => void;
  setOffer: (product: ProductDisplay, quantity: number) => void;
  refreshCatalog: (products: { id: string; price: number; stock: number; shippingTax: number }[]) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  incrementItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getTotal: (shipping?: number) => number;
}

/** Shipping is free everywhere (included in product prices). Kept for API compatibility. */
export const SHIPPING_THRESHOLD = 0;
export function getShipping(subtotal: number): number {
  void subtotal; // Retained for callers of the legacy flat-shipping helper.
  return 0;
}

export function getShippingForItems(items: CartItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.product.shippingTax ?? 0) * item.quantity,
    0,
  );
}

/**
 * Set right before an add that goes straight to checkout, so the header
 * doesn't pop the cart drawer over the checkout page.
 */
export const cartDrawerControl = { skipNextOpen: false };

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      refreshCatalog: (products) => set(state => ({ items: state.items.map(item => {
        const current = products.find(product => product.id === item.product.id);
        return { ...item, product: current ? { ...item.product, ...current } : { ...item.product, stock: 0 } };
      }) })),

      // Explicitly replace this product's quantity with the selected bundle.
      // Never silently clamp an unavailable offer to a different quantity.
      setOffer: (product, quantity) => {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) return;
        set(state => ({ items: [...state.items.filter(i => i.product.id !== product.id), { product, quantity }] }));
      },

      addItem: (product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.product.id === product.id,
          );
          if (existing) {
            const newQty = Math.min(
              existing.quantity + quantity,
              product.stock,
            );
            if (newQty <= 0) return state;
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: newQty }
                  : i,
              ),
            };
          }
          const qty = Math.min(quantity, product.stock);
          if (qty <= 0) return state;
          return {
            items: [...state.items, { product, quantity: qty }],
          };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        set((state) => {
          const item = state.items.find((i) => i.product.id === productId);
          if (!item) return state;
          if (!Number.isInteger(quantity)) return state;
          // Let a customer reduce a now-unavailable quantity one at a time;
          // do not jump from their current quantity straight to new stock.
          const qty = Math.max(0, Math.min(quantity, Math.max(item.product.stock, item.quantity)));
          if (qty === 0) {
            return {
              items: state.items.filter((i) => i.product.id !== productId),
            };
          }
          return {
            items: state.items.map((i) =>
              i.product.id === productId ? { ...i, quantity: qty } : i,
            ),
          };
        });
      },

      incrementItem: (productId) => {
        const item = get().items.find((i) => i.product.id === productId);
        if (!item || item.quantity >= item.product.stock) return;
        get().updateQuantity(
          productId,
          Math.min(item.quantity + 1, item.product.stock),
        );
      },

      decrementItem: (productId) => {
        const item = get().items.find((i) => i.product.id === productId);
        if (!item) return;
        get().updateQuantity(productId, item.quantity - 1);
      },

      clearCart: () => set({ items: [] }),

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      getSubtotal: () =>
        get().items.reduce(
          (sum, i) => sum + getLineTotal(i.product.price, i.quantity),
          0,
        ),

      getTotal: (shipping?: number) => {
        const subtotal = get().getSubtotal();
        const s =
          shipping !== undefined ? shipping : getShipping(subtotal);
        return subtotal + s;
      },
    }),
    {
      name: "kitvoy-cart",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
