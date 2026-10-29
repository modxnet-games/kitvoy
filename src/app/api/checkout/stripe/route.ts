import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getPayableOrder, toCents } from "@/lib/payments/order-payment";
import { getStripe } from "@/lib/payments/stripe";

/**
 * POST /api/checkout/stripe  { orderId }
 *
 * Creates (or reuses) a Stripe PaymentIntent for a pending order and returns
 * its client secret for Stripe Elements. The amount always comes from the
 * order in the database, never from the client.
 *
 * TODO(payments): confirm the payment from a Stripe webhook
 * (payment_intent.succeeded) → markOrderPaid() → sendOrderToZendrop().
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await getPayableOrder(body?.orderId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { order } = result;
    const amount = toCents(order.total);

    // Reuse an existing intent so retries don't create duplicate charges
    if (order.paymentRef?.startsWith("pi_")) {
      const existing = await stripe.paymentIntents.retrieve(order.paymentRef);
      if (existing.status !== "canceled" && existing.amount === amount) {
        return NextResponse.json({ clientSecret: existing.client_secret });
      }
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        receipt_email: order.email ?? undefined,
        metadata: { orderId: order.id },
      },
      { idempotencyKey: `order-${order.id}-${amount}` },
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: "card", paymentRef: intent.id },
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error("[checkout/stripe] PaymentIntent error:", err);
    return NextResponse.json({ error: "PAYMENT_INIT_FAILED" }, { status: 500 });
  }
}
