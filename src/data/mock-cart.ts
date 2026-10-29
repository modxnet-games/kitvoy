import type { MockProduct } from "./mock-products";
import { mockProducts } from "./mock-products";

export interface MockCartItem {
  product: MockProduct;
  quantity: number;
}

/** Placeholder mock cart for storefront UI display only. No real cart logic. */
export const mockCartItems: MockCartItem[] = [
  { product: mockProducts[0], quantity: 1 },
  { product: mockProducts[2], quantity: 2 },
  { product: mockProducts[3], quantity: 1 },
];

/** Empty cart for empty state demo. Use empty array for empty cart UI. */
export const mockEmptyCart: MockCartItem[] = [];
