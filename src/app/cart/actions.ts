"use server";

import { getStockForProducts } from "@/lib/stock";

export async function getStockForProductsAction(
  productIds: string[]
): Promise<Record<string, number>> {
  return getStockForProducts(productIds);
}
