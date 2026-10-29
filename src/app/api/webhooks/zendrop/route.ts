import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { recordFulfillment, sendOrderToZendrop } from "@/lib/fulfillment/zendrop";

function isAuthorized(request: Request): boolean {
  const secret = process.env.ZENDROP_WEBHOOK_SECRET?.trim();
  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!secret || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

/**
 * POST /api/webhooks/zendrop  { orderId }
 * Header: x-webhook-secret: $ZENDROP_WEBHOOK_SECRET
 *
 * Triggers Zendrop fulfillment for a paid order. Call it after a successful
 * payment (e.g. from the Stripe webhook) or to retry a failed hand-off.
 * Safe to call more than once: already-fulfilled orders are not resent.
 *
 * TODO(zendrop): also accept Zendrop's own status/tracking events here and
 * move orders to SHIPPED / DELIVERED with the tracking number.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!orderId) {
    return NextResponse.json({ error: "INVALID_ORDER_ID" }, { status: 400 });
  }

  try {
    const result = await sendOrderToZendrop(orderId);
    if (!result.ok) {
      const status = result.error === "ORDER_NOT_FOUND" ? 404 : result.error === "ORDER_NOT_PAID" ? 409 : 501;
      return NextResponse.json({ error: result.error }, { status });
    }
    if (!result.alreadyFulfilled) {
      await recordFulfillment(orderId, result.fulfillmentRef);
    }
    return NextResponse.json({ ok: true, fulfillmentRef: result.fulfillmentRef });
  } catch (err) {
    console.error("[webhooks/zendrop] error:", err);
    return NextResponse.json({ error: "FULFILLMENT_FAILED" }, { status: 500 });
  }
}
