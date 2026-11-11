import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * GET /api/cart/quote?ids=a,b
 *
 * Current price, stock and shipping for the products in a cart. A plain route
 * with a stable URL, so a page loaded before a deploy can still refresh its
 * cart afterwards. Order creation prices and validates again.
 */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);
  const products = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, price: true, stock: true, shippingTax: true },
      })
    : [];
  return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
}
