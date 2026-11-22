import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { readOrderAttribution, type OrderAttribution } from "@/lib/analytics/attribution";
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
 * Validates the checkout details, prices the cart from the database and saves
 * it as a pending (unpaid) order. Every successful request creates one order.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = validateOrderInput(body);

    if (!validated.valid) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400 },
      );
    }

    // Which ad brought the customer, read from the request's cookies and headers
    const attribution: OrderAttribution = { ...readOrderAttribution(request.cookies, request.headers), ...trackingFromBody(body) };
    const created = await createOrder({ ...validated.data, attribution });
    if (!created.success) {
      return NextResponse.json(
        { error: created.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      orderId: created.orderId,
      orderReference: created.orderReference,
      totals: created.totals,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}
