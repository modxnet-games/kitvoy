import { prisma } from "@/lib/db";

const LOW_STOCK_THRESHOLD = 5;

export { LOW_STOCK_THRESHOLD };

/** Returns current stock for each product by id. */
export async function getStockForProducts(
  productIds: string[]
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, stock: true },
  });

  const result: Record<string, number> = {};
  for (const p of products) {
    result[p.id] = p.stock;
  }
  return result;
}

export interface StockValidationItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface StockValidationResult {
  valid: boolean;
  errorKey?: string;
  details?: { productName: string; available: number; requested: number }[];
}

/**
 * Validates that all items have sufficient stock.
 * Returns { valid: true } or { valid: false, errorKey, details }.
 */
export async function validateStockForCheckout(
  items: StockValidationItem[]
): Promise<StockValidationResult> {
  if (items.length === 0) {
    return { valid: false, errorKey: "order.errorEmptyCart" };
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const stockMap = await getStockForProducts(productIds);
  const issues: { productName: string; available: number; requested: number }[] =
    [];

  for (const item of items) {
    const available = stockMap[item.productId] ?? 0;
    if (available <= 0) {
      issues.push({
        productName: item.productName,
        available: 0,
        requested: item.quantity,
      });
    } else if (item.quantity > available) {
      issues.push({
        productName: item.productName,
        available,
        requested: item.quantity,
      });
    }
  }

  if (issues.length === 0) return { valid: true };

  const hasUnavailable = issues.some((i) => i.available <= 0);
  return {
    valid: false,
    errorKey: hasUnavailable ? "stock.itemUnavailable" : "stock.notEnoughStock",
    details: issues,
  };
}
