import { NextResponse } from "next/server";

import { orderContents } from "@/lib/analytics/meta-capi";
import { prisma } from "@/lib/db";
import { getPayableOrder, orderHasStock } from "@/lib/payments/order-payment";
import { canUseStripeCheckout, getStripe } from "@/lib/payments/stripe";
import { ensureOrderPaymentIntent } from "@/lib/payments/stripe-intent";

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

/**
 * POST /api/checkout/stripe  { orderId }
 *
 * Returns the client secret of the order's PaymentIntent for the Payment
 * Element, creating it on first use and reusing it afterwards (reloads,
 * retries, edits). The amount always comes from the order in the database,
 * never from the browser.
 *
 * Payment methods come from the Dashboard (dynamic payment methods). The order
 * is marked paid only by the webhook (/api/webhooks/stripe), never here.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !(await canUseStripeCheckout())) {
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

    const intent = await ensureOrderPaymentIntent(stripe, order);
    if (!intent.ok) {
      // Already paid or settling; the webhook completes the order
      return NextResponse.json({ error: "checkout.paymentInProgress" }, { status: 409 });
    }
    return NextResponse.json({ clientSecret: intent.clientSecret });
  } catch (err) {
    console.error("[checkout/stripe] PaymentIntent error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "PAYMENT_INIT_FAILED" }, { status: 500 });
  }
}

/**
 * GET /api/checkout/stripe?payment_intent=pi_…
 *
 * For the success page after a payment method that left the site (Klarna,
 * Affirm, Cash App, bank): says whether that PaymentIntent went through, with
 * the paid total and SKUs for the thank-you page and ad tracking. Read-only;
 * the order itself is marked paid by the webhook.
 */
export async function GET(request: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });

  const intentId = new URL(request.url).searchParams.get("payment_intent") ?? "";
  if (!/^pi_[A-Za-z0-9]+$/.test(intentId)) {
    return NextResponse.json({ error: "INVALID_PAYMENT" }, { status: 400 });
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(intentId);
    const orderId = intent.metadata?.orderId;
    // Only an intent this store created for that order counts
    const order = orderId
      ? await prisma.order.findFirst({ where: { id: orderId, stripePaymentIntentId: intent.id }, include: { items: true } })
      : null;
    if (!order) return NextResponse.json({ error: "INVALID_PAYMENT" }, { status: 404 });

    const status = intent.status === "succeeded" ? "paid" : intent.status === "processing" ? "processing" : "open";
    return NextResponse.json({
      status,
      orderReference: orderReference(order.id),
      total: order.total,
      // What the Purchase event reports, line by line, exactly as the server event does
      contents: await orderContents(order.items),
    });
  } catch (err) {
    // A made-up or foreign id is a bad request, not an outage
    if ((err as { code?: string })?.code === "resource_missing") {
      return NextResponse.json({ error: "INVALID_PAYMENT" }, { status: 404 });
    }
    console.error("[checkout/stripe] payment lookup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "LOOKUP_FAILED" }, { status: 500 });
  }
}
