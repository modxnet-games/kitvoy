import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { readOrderAttribution, type OrderAttribution } from "@/lib/analytics/attribution";
import { afterOrderPlaced } from "@/lib/order-events";
import { createOrder, validateOrderInput } from "@/lib/orders";

/** The page the customer is on, taken only in the shapes the checkout produces, without its query string. */
function trackingFromBody(body: unknown): Pick<OrderAttribution, "eventSourceUrl"> {
  const tracking = (body as { tracking?: Record<string, unknown> } | null)?.tracking;
  if (!tracking || typeof tracking !== "object") return {};
  const url = tracking.eventSourceUrl;
  if (typeof url === "string" && url.length <= 1000 && /^(\/|https?:\/\/)/.test(url)) return { eventSourceUrl: url.split(/[?#]/)[0] };
  return {};
}

/**
 * POST /api/orders
 *
 * Places a cash-on-delivery order: checks the delivery details, prices the
 * cart from the database, saves the order and takes its pieces out of stock.
 * The owner's phones, the owner's email and Meta are told once the customer
 * has their answer. Errors come back as message keys ("validation.phone").
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "order.errorGeneric" }, { status: 400 });
  }
  try {
    const validated = validateOrderInput(body);
    if (!validated.valid) return NextResponse.json({ error: validated.error, fields: validated.fields }, { status: 400 });

    // Which ad brought the customer, read from the request's cookies and headers
    const attribution: OrderAttribution = { ...readOrderAttribution(request.cookies, request.headers), ...trackingFromBody(body) };
    const created = await createOrder({ ...validated.data, attribution });
    if (!created.success) {
      return NextResponse.json({ error: created.error, fields: created.fields }, { status: created.error === "order.errorTooMany" ? 429 : 400 });
    }

    // A repeated submit got the order it already made: nobody is told twice
    if (!created.duplicate) after(() => afterOrderPlaced(created.orderId));
    return NextResponse.json({ orderId: created.orderId, orderReference: created.orderReference, totals: created.totals });
  } catch (err) {
    console.error("Order creation error:", err);
    return NextResponse.json({ error: "order.errorGeneric" }, { status: 500 });
  }
}
