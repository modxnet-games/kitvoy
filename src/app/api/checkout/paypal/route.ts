import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { sendOrderToZendrop, recordFulfillment } from "@/lib/fulfillment/zendrop";
import { getPayableOrder, markOrderPaid } from "@/lib/payments/order-payment";
import { getPayPal, paypal } from "@/lib/payments/paypal";

/**
 * POST /api/checkout/paypal  { orderId }
 * Creates a PayPal order for a pending store order. Returns { id } for the
 * PayPal Buttons `createOrder` callback.
 */
export async function POST(request: Request) {
  const client = getPayPal();
  if (!client) {
    return NextResponse.json({ error: "PAYPAL_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await getPayableOrder(body?.orderId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { order } = result;

    const req = new paypal.orders.OrdersCreateRequest();
    req.prefer("return=representation");
    req.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.id,
          custom_id: order.id,
          amount: { currency_code: "USD", value: order.total.toFixed(2) },
        },
      ],
    });
    const res = await client.execute(req);
    const paypalOrderId: string = res.result.id;

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: "paypal", paymentRef: paypalOrderId },
    });

    return NextResponse.json({ id: paypalOrderId });
  } catch (err) {
    console.error("[checkout/paypal] create error:", err);
    return NextResponse.json({ error: "PAYMENT_INIT_FAILED" }, { status: 500 });
  }
}

/**
 * PUT /api/checkout/paypal  { orderId }
 * Captures the approved PayPal order (PayPal Buttons `onApprove`), marks the
 * store order paid and hands it to fulfillment.
 */
export async function PUT(request: Request) {
  const client = getPayPal();
  if (!client) {
    return NextResponse.json({ error: "PAYPAL_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await getPayableOrder(body?.orderId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { order } = result;
    if (order.paymentMethod !== "paypal" || !order.paymentRef) {
      return NextResponse.json({ error: "PAYPAL_ORDER_MISSING" }, { status: 409 });
    }

    const req = new paypal.orders.OrdersCaptureRequest(order.paymentRef);
    req.requestBody({} as never);
    const res = await client.execute(req);

    const capture = res.result?.purchase_units?.[0]?.payments?.captures?.[0];
    const paidValue = capture?.amount?.value;
    if (res.result?.status !== "COMPLETED" || paidValue !== order.total.toFixed(2)) {
      console.error("[checkout/paypal] capture mismatch:", res.result?.status, paidValue);
      return NextResponse.json({ error: "PAYMENT_NOT_COMPLETED" }, { status: 402 });
    }

    if (await markOrderPaid(order.id, order.paymentRef)) {
      const fulfillment = await sendOrderToZendrop(order.id);
      if (fulfillment.ok && !fulfillment.alreadyFulfilled) {
        await recordFulfillment(order.id, fulfillment.fulfillmentRef);
      } else if (!fulfillment.ok) {
        console.warn("[checkout/paypal] fulfillment pending:", fulfillment.error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[checkout/paypal] capture error:", err);
    return NextResponse.json({ error: "PAYMENT_CAPTURE_FAILED" }, { status: 500 });
  }
}
