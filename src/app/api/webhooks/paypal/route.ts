import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getPayPal } from "@/lib/payments/paypal";
import { paypalEventTarget, settlePayPalOrder } from "@/lib/payments/paypal-settle";

const reference = (orderId: string) => `KTV-${orderId.slice(-8).toUpperCase()}`;

/**
 * POST /api/webhooks/paypal
 *
 * PayPal's notifications (CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED):
 * the safety net for a payment whose page never got to finish it, for example
 * an in-app browser that was closed between approving in PayPal and coming
 * back to the store.
 *
 * The notification is treated as a hint and nothing more. It only says which
 * PayPal order to look at; that order is then read from PayPal with the
 * store's own credentials, and it is captured and the store order marked paid
 * only if PayPal itself says it was approved for this order and this total
 * (see settlePayPalOrder). A forged notification can therefore do no more than
 * trigger a status check. Settling is idempotent, so PayPal's retries and a
 * capture arriving from the customer's browser at the same moment are safe.
 */
export async function POST(request: Request) {
  if (!getPayPal()) {
    return NextResponse.json({ error: "PAYPAL_NOT_CONFIGURED" }, { status: 503 });
  }

  let event: unknown;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const target = paypalEventTarget(event);
  if (!target) return NextResponse.json({ received: true, ignored: true });

  try {
    const order =
      (target.paypalOrderId
        ? await prisma.order.findFirst({ where: { paymentRef: target.paypalOrderId, paymentMethod: "paypal" } })
        : null) ?? (target.orderId ? await prisma.order.findUnique({ where: { id: target.orderId } }) : null);
    // Not one of ours, or already settled (the browser got there first)
    if (!order || order.paymentStatus === "paid" || order.status === "CANCELED") {
      return NextResponse.json({ received: true });
    }

    const settled = await settlePayPalOrder(order, target.paypalOrderId ?? order.paymentRef);
    console.info(`[webhooks/paypal] ${target.type} ${reference(order.id)}: ${settled.status === "paid" ? "paid" : `open (${settled.reason})`}`);
    return NextResponse.json({ received: true });
  } catch (err) {
    // 500 makes PayPal retry; settling is safe to run again
    console.error(`[webhooks/paypal] ${target.type} failed:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "HANDLER_FAILED" }, { status: 500 });
  }
}
