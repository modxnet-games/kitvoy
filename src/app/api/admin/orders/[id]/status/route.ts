import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { serializeOrder, setOrderStatus } from "@/lib/data/admin-orders";

/**
 * PATCH /api/admin/orders/:id/status  { status }
 * → the order (with `warning` when the stock ran short), or 400/404 { error }.
 *
 * status: PENDING, NO_ANSWER, CONFIRMED, SHIPPED, DELIVERED, RETURNED or
 * CANCELED. Any status can follow any other. The change also stamps the
 * confirmation, shipment and delivery times, marks the order paid on
 * DELIVERED, and gives the stock back on CANCELED and RETURNED (taking it
 * again if such an order is brought back). Sending the status an order
 * already has changes nothing.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined;
  const status = typeof raw === "string" ? raw.trim().toUpperCase() : raw;

  try {
    const result = await setOrderStatus(id, status);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ...serializeOrder(result.order), ...(result.warning && { warning: result.warning }) });
  } catch (err) {
    console.error("[admin/orders] status change failed:", err);
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }
}
