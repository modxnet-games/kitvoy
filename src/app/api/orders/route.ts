import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateOrderInput } from "@/lib/orders";
import { isSecureRequest, setResumeCookies } from "@/lib/checkout/resume-cookies";
import { saveCheckoutOrder } from "@/lib/checkout/save-order";

/**
 * POST /api/orders
 *
 * Saves the checkout details as a pending (unpaid) order. One order per
 * checkout: when the browser presents the session token of an order that is
 * still open, that order is updated in place (reload, Edit, a changed cart)
 * instead of a second one being created.
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

    const result = await saveCheckoutOrder(request, body, validated.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }
    const { saved } = result;

    const response = NextResponse.json({
      orderId: saved.orderId,
      orderReference: saved.orderReference,
      totals: saved.totals,
      resumeToken: saved.sessionToken,
      reused: saved.reused,
    });
    if (saved.sessionToken) setResumeCookies(response, saved.sessionToken, isSecureRequest(request));
    return response;
  } catch (err) {
    console.error("Order creation error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}
