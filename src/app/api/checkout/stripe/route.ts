import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/db";
import { getPayableOrder, orderHasStock, toCents } from "@/lib/payments/order-payment";
import { getStripe, isOpenIntent } from "@/lib/payments/stripe";

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

type StoredAddress = { address1?: string; address2?: string; city?: string; state?: string; zip?: string };

/**
 * POST /api/checkout/stripe  { orderId }
 *
 * Returns the client secret of the order's PaymentIntent for the Payment
 * Element, creating it on first use. The amount always comes from the order in
 * the database, never from the browser.
 *
 * Payment methods come from the Dashboard (dynamic payment methods). The order
 * is marked paid only by the webhook (/api/webhooks/stripe), never here.
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

    if (!(await orderHasStock(order.id))) {
      return NextResponse.json({ error: "stock.notEnoughStock" }, { status: 409 });
    }

    const amount = toCents(order.total);

    // One intent per order: reuse it while it can still be paid, so retries and
    // page reloads never create a second chargeable intent
    if (order.stripePaymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      if (existing.status === "succeeded" || existing.status === "processing" || existing.status === "requires_capture") {
        // Already paid or settling; the webhook completes the order
        return NextResponse.json({ error: "checkout.paymentInProgress" }, { status: 409 });
      }
      if (isOpenIntent(existing)) {
        if (existing.amount === amount) {
          return NextResponse.json({ clientSecret: existing.client_secret });
        }
        const updated = await stripe.paymentIntents.update(existing.id, { amount });
        return NextResponse.json({ clientSecret: updated.client_secret });
      }
      // Canceled: fall through and create a fresh one
    }

    const address = (order.shippingAddress ?? {}) as StoredAddress;
    const shipping: Stripe.PaymentIntentCreateParams.Shipping = {
      name: order.customerName,
      phone: order.phone,
      address: {
        line1: address.address1 ?? order.location,
        line2: address.address2 || undefined,
        city: address.city,
        state: address.state,
        postal_code: address.zip,
        country: "US",
      },
    };

    const intent = await stripe.paymentIntents.create(
      {
        amount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `Kitvoy order ${orderReference(order.id)}`,
        metadata: { orderId: order.id, orderReference: orderReference(order.id) },
        shipping,
      },
      // Keyed on the intent it replaces, so a canceled intent never comes back
      // from the idempotency cache and concurrent first requests share one intent
      { idempotencyKey: `pi-${order.id}-${amount}-${order.stripePaymentIntentId ?? "first"}` },
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id },
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error("[checkout/stripe] PaymentIntent error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "PAYMENT_INIT_FAILED" }, { status: 500 });
  }
}
