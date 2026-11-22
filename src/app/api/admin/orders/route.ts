import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { listOrders, parseStatusFilter, serializeOrder } from "@/lib/data/admin-orders";

/**
 * GET /api/admin/orders?status=&q=&limit=
 * Cash-on-delivery orders, newest first, for the app (Bearer token) and the
 * dashboard (session cookie).
 * - status: PENDING, NO_ANSWER, CONFIRMED, SHIPPED, DELIVERED, RETURNED or
 *   CANCELED; several can be given separated by commas. Empty: every status.
 * - q: a reference, a customer name, a phone number or a city.
 * - limit: 300 unless given, 1000 at most.
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = parseStatusFilter(searchParams.get("status"));
    // A status that doesn't exist holds no orders
    if (!status) return NextResponse.json([]);

    const orders = await listOrders({ status, q: searchParams.get("q"), limit: searchParams.get("limit") });
    return NextResponse.json(orders.map(serializeOrder));
  } catch (err) {
    console.error("[admin/orders] list failed:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
