"use server";

import { getStockForProducts } from "@/lib/stock";
import { prisma } from "@/lib/db";

export async function getStockForProductsAction(
  productIds: string[]
): Promise<Record<string, number>> {
  return getStockForProducts(productIds);
}

/** Refresh the display quote; order creation still prices and validates again. */
export async function getCartQuoteAction(productIds: string[]) {
  return prisma.product.findMany({
    where: { id: { in: productIds.slice(0, 100) } },
    select: { id: true, price: true, stock: true, shippingTax: true },
  });
}
