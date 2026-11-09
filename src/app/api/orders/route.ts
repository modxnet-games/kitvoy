import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createOrder, validateOrderInput } from "@/lib/orders";
import { getCustomer } from "@/lib/auth/customer-session";
import { saveSubscriberEmail } from "@/lib/subscribers";
import { readOrderAttribution, type OrderAttribution } from "@/lib/analytics/attribution";
import { sendInitiateCheckoutEvent } from "@/lib/analytics/meta-capi";

const EVENT_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

/** The browser's tracking ids, taken only in the shapes the pixel code produces. */
function trackingFromBody(body: unknown): Pick<OrderAttribution, "initiateCheckoutEventId" | "eventSourceUrl"> {
  const tracking = (body as { tracking?: Record<string, unknown> } | null)?.tracking;
  if (!tracking || typeof tracking !== "object") return {};
  const out: Pick<OrderAttribution, "initiateCheckoutEventId" | "eventSourceUrl"> = {};
  const eventId = tracking.initiateCheckoutEventId;
  if (typeof eventId === "string" && EVENT_ID_RE.test(eventId)) out.initiateCheckoutEventId = eventId;
  const url = tracking.eventSourceUrl;
  if (typeof url === "string" && url.length <= 1000 && /^(\/|https?:\/\/)/.test(url)) out.eventSourceUrl = url;
  return out;
}

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

    const customer = await getCustomer();
    const attribution: OrderAttribution = { ...readOrderAttribution(request.cookies, request.headers), ...trackingFromBody(body) };
    const data = {
      ...validated.data,
      ...(customer && { userId: customer.userId }),
      attribution,
    };
    if (customer?.email) {
      await saveSubscriberEmail(customer.email, "checkout");
    }
    const result = await createOrder(data);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    // The server copy of the browser's InitiateCheckout; after the response, never in its way
    after(() => sendInitiateCheckoutEvent(result.orderId).catch(() => {}));

    return NextResponse.json({
      orderId: result.orderId,
      orderReference: result.orderReference,
      totals: result.totals,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}
