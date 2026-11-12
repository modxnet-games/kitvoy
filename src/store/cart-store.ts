"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductDisplay } from "@/types/product";
import { lineSavings, priceLines } from "@/lib/bundles";

export interface CartItem {
  product: ProductDisplay;
  quantity: number;
}

/**
 * A cart line is one product in one colour. Products with no colour choice
 * have a single line, keyed by the product id as before.
 */
export function lineKey(product: { id: string; variant?: { key: string } }): string {
  return product.variant ? `${product.id}:${product.variant.key}` : product.id;
}

const toPricedLines = (items: CartItem[]) =>
  items.map((i) => ({ productId: i.product.id, slug: i.product.slug, unitPrice: i.product.price, quantity: i.quantity }));

/** Each line's total, in cart order. A product bought in several colours is priced as one bundle. */
export function cartLineTotals(items: CartItem[]): number[] {
  return priceLines(toPricedLines(items));
}

/** Each line's bundle savings, in cart order. */
export function cartLineSavings(items: CartItem[]): number[] {
  return lineSavings(toPricedLines(items));
}

export function cartSubtotal(items: CartItem[]): number {
  return Math.round(cartLineTotals(items).reduce((sum, t) => sum + t * 100, 0)) / 100;
}

/** How many of a product the cart holds, across its colours. */
export function productQuantity(items: CartItem[], productId: string): number {
  return items.reduce((sum, i) => (i.product.id === productId ? sum + i.quantity : sum), 0);
}

interface CartState {
  items: CartItem[];
  addItem: (product: ProductDisplay, quantity?: number) => void;
  /** Replaces everything the cart holds of this product with the chosen bundle (one line per colour) */
  setOffer: (product: ProductDisplay, quantity: number) => void;
  setOfferLines: (lines: CartItem[]) => void;
  refreshCatalog: (products: { id: string; price: number; stock: number; shippingTax: number }[]) => void;
  /** `key` is a line key (see lineKey) */
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  incrementItem: (key: string) => void;
  decrementItem: (key: string) => void;
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
      setOffer: (product, quantity) => get().setOfferLines([{ product, quantity }]),

      setOfferLines: (lines) => {
        const product = lines[0]?.product;
        if (!product || lines.some(l => l.product.id !== product.id || !Number.isInteger(l.quantity) || l.quantity < 1)) return;
        const total = lines.reduce((sum, l) => sum + l.quantity, 0);
        if (total > product.stock) return;
        // The same colour picked twice is one line
        const merged: CartItem[] = [];
        for (const line of lines) {
          const existing = merged.find(m => lineKey(m.product) === lineKey(line.product));
          if (existing) existing.quantity += line.quantity;
          else merged.push({ product: line.product, quantity: line.quantity });
        }
        set(state => ({ items: [...state.items.filter(i => i.product.id !== product.id), ...merged] }));
      },

      addItem: (product, quantity = 1) => {
        set((state) => {
          const key = lineKey(product);
          const existing = state.items.find((i) => lineKey(i.product) === key);
          // Stock is per product: its other colours in the cart count too
          const room = product.stock - productQuantity(state.items, product.id);
          const qty = Math.min(quantity, room);
          if (qty <= 0) return state;
          if (existing) {
            return {
              items: state.items.map((i) =>
                lineKey(i.product) === key ? { ...i, quantity: i.quantity + qty } : i,
              ),
            };
          }
          return {
            items: [...state.items, { product, quantity: qty }],
          };
        });
      },

      removeItem: (key) => {
        set((state) => ({
          items: state.items.filter((i) => lineKey(i.product) !== key),
        }));
      },

      updateQuantity: (key, quantity) => {
        set((state) => {
          const item = state.items.find((i) => lineKey(i.product) === key);
          if (!item) return state;
          if (!Number.isInteger(quantity)) return state;
          // Let a customer reduce a now-unavailable quantity one at a time;
          // do not jump from their current quantity straight to new stock.
          const others = productQuantity(state.items, item.product.id) - item.quantity;
          const qty = Math.max(0, Math.min(quantity, Math.max(item.product.stock - others, item.quantity)));
          if (qty === 0) {
            return {
              items: state.items.filter((i) => lineKey(i.product) !== key),
            };
          }
          return {
            items: state.items.map((i) =>
              lineKey(i.product) === key ? { ...i, quantity: qty } : i,
            ),
          };
        });
      },

      incrementItem: (key) => {
        const items = get().items;
        const item = items.find((i) => lineKey(i.product) === key);
        if (!item || productQuantity(items, item.product.id) >= item.product.stock) return;
        get().updateQuantity(key, item.quantity + 1);
      },

      decrementItem: (key) => {
        const item = get().items.find((i) => lineKey(i.product) === key);
        if (!item) return;
        get().updateQuantity(key, item.quantity - 1);
      },

      clearCart: () => set({ items: [] }),

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      getSubtotal: () => cartSubtotal(get().items),

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
