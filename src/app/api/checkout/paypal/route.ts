import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { siteConfig } from "@/config/site";
import {
  afterOrderPaid,
  completePaidOrder,
  getPayableOrder,
  orderHasStock,
} from "@/lib/payments/order-payment";
import { getPayPal, paypal } from "@/lib/payments/paypal";

type PayPalCapture = { id?: string; status?: string; amount?: { value?: string; currency_code?: string } };
type PayPalOrderResult = {
  id?: string;
  status?: string;
  purchase_units?: { payments?: { captures?: PayPalCapture[] } }[];
};

const firstCapture = (r: PayPalOrderResult | undefined) => r?.purchase_units?.[0]?.payments?.captures?.[0];

/**
 * POST /api/checkout/paypal  { orderId }
 * Creates a PayPal order for a pending store order. Returns { id } for the
 * PayPal Buttons `createOrder` callback. The amount always comes from the
 * order in the database, never from the browser.
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

    if (!(await orderHasStock(order.id))) {
      return NextResponse.json({ error: "stock.notEnoughStock" }, { status: 409 });
    }

    const req = new paypal.orders.OrdersCreateRequest();
    req.prefer("return=representation");
    req.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.id,
          custom_id: order.id,
          description: `${siteConfig.name} order KTV-${order.id.slice(-8).toUpperCase()}`,
          amount: { currency_code: "USD", value: order.total.toFixed(2) },
        },
      ],
      application_context: {
        brand_name: siteConfig.name,
        // The store already collected the US shipping address at checkout
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
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
 * Captures the approved PayPal order (PayPal Buttons `onApprove`), verifies the
 * amount, marks the store order paid (reserving stock) and runs the paid-order
 * steps: owner email, admin push and fulfillment.
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
      // A retried capture of an order we already marked paid is a success
      if (result.error === "ORDER_ALREADY_PAID") return NextResponse.json({ ok: true });
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { order } = result;
    if (order.paymentMethod !== "paypal" || !order.paymentRef) {
      return NextResponse.json({ error: "PAYPAL_ORDER_MISSING" }, { status: 409 });
    }
    const paypalOrderId = order.paymentRef;

    let paypalOrder: PayPalOrderResult | undefined;
    try {
      const req = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
      req.requestBody({} as never);
      paypalOrder = (await client.execute(req)).result as PayPalOrderResult;
    } catch (err) {
      // Captured by an earlier attempt that didn't reach us: read the order instead
      if (!String((err as Error)?.message ?? "").includes("ORDER_ALREADY_CAPTURED")) throw err;
      paypalOrder = (await client.execute(new paypal.orders.OrdersGetRequest(paypalOrderId))).result as PayPalOrderResult;
    }

    const capture = firstCapture(paypalOrder);
    const expected = order.total.toFixed(2);
    if (
      paypalOrder?.status !== "COMPLETED" ||
      capture?.status !== "COMPLETED" ||
      capture.amount?.value !== expected ||
      capture.amount?.currency_code !== "USD"
    ) {
      console.error("[checkout/paypal] capture not completed:", paypalOrder?.status, capture?.status, capture?.amount);
      return NextResponse.json({ error: "PAYMENT_NOT_COMPLETED" }, { status: 402 });
    }

    // Store the capture id: it's what a refund in PayPal needs
    if (await completePaidOrder(order.id, capture.id ?? paypalOrderId)) {
      // Don't make the customer wait on email/push; the server keeps running
      void afterOrderPaid(order.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[checkout/paypal] capture error:", err);
    return NextResponse.json({ error: "PAYMENT_CAPTURE_FAILED" }, { status: 500 });
  }
}
