import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { getPayableOrder, orderHasStock, toCents } from "@/lib/payments/order-payment";
import { canUseStripeCheckout, getStripe } from "@/lib/payments/stripe";

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;
const absolute = (path: string) => new URL(path, siteConfig.url).toString();

/** Checkout pages stay open this long; Stripe's minimum is 30 minutes. */
const SESSION_LIFETIME_SECONDS = 60 * 60;

type StoredAddress = { address1?: string; address2?: string; city?: string; state?: string; zip?: string };

/**
 * POST /api/checkout/stripe  { orderId }
 *
 * Opens a Stripe Checkout Session for a pending order and returns its URL;
 * the browser then goes to Stripe's hosted payment page. Every amount comes
 * from the order in the database, never from the browser.
 *
 * Payment methods come from the Dashboard (dynamic payment methods: cards,
 * Apple Pay, Google Pay, Link and whatever else is turned on there). The order
 * is marked paid only by the webhook (/api/webhooks/stripe), never here.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  // Same gate as the checkout page: test keys in production are admin-only
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

    const reference = orderReference(order.id);
    const total = toCents(order.total);

    // One Checkout per order: reuse it while the customer can still pay there,
    // so a retry or page reload never opens a second chargeable session
    if (order.stripeCheckoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
      if (existing.status === "complete") {
        // Paid or settling; the webhook completes the order
        return NextResponse.json({ error: "checkout.paymentInProgress" }, { status: 409 });
      }
      if (existing.status === "open" && existing.amount_total === total && existing.url) {
        return NextResponse.json({ url: existing.url });
      }
      // Expired, or the total changed: fall through and open a fresh one
    }

    const address = (order.shippingAddress ?? {}) as StoredAddress;
    const shipping: Stripe.Checkout.SessionCreateParams.PaymentIntentData.Shipping = {
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

    // Bundle prices don't divide evenly per unit ($99.99 for two), so each
    // order line is one Checkout line at its own total
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: toCents(item.lineTotal),
        product_data: { name: item.quantity === 1 ? item.productName : `${item.quantity} × ${item.productName}` },
      },
    }));
    if (order.shippingCost > 0) {
      lineItems.push({
        quantity: 1,
        price_data: { currency: "usd", unit_amount: toCents(order.shippingCost), product_data: { name: "Shipping" } },
      });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        customer_email: order.email ?? undefined,
        client_reference_id: order.id,
        metadata: { orderId: order.id, orderReference: reference },
        // The same metadata on the PaymentIntent, so payment_intent.* webhooks find the order too
        payment_intent_data: {
          description: `Kitvoy order ${reference}`,
          metadata: { orderId: order.id, orderReference: reference },
          shipping,
        },
        billing_address_collection: "auto",
        // Always charge in USD: the webhook checks the paid amount against the
        // order in USD, and local-currency conversion would fail that check
        adaptive_pricing: { enabled: false },
        // {CHECKOUT_SESSION_ID} is filled in by Stripe
        success_url: `${absolute("/checkout/success")}?ref=${encodeURIComponent(reference)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: absolute("/checkout"),
        expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
      },
      // Keyed on the session it replaces, so an expired session never comes back
      // from the idempotency cache and concurrent first requests share one session
      { idempotencyKey: `cs-${order.id}-${total}-${order.stripeCheckoutSessionId ?? "first"}` },
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    if (!session.url) throw new Error("Stripe returned a session without a URL");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout/stripe] Checkout Session error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "PAYMENT_INIT_FAILED" }, { status: 500 });
  }
}

/**
 * GET /api/checkout/stripe?session_id=cs_…
 *
 * For the page Stripe sends the customer back to: says whether that Checkout
 * finished, with the paid total and items for the thank-you page and ad
 * tracking. Read-only; the order itself is marked paid by the webhook.
 */
export async function GET(request: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });

  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.orderId;
    // Only a session this store opened for that order counts
    const order = orderId
      ? await prisma.order.findFirst({ where: { id: orderId, stripeCheckoutSessionId: session.id }, include: { items: true } })
      : null;
    if (!order) return NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 });

    const paid = session.status === "complete" && session.payment_status === "paid";
    const processing = session.status === "complete" && session.payment_status === "unpaid";
    return NextResponse.json({
      status: paid ? "paid" : processing ? "processing" : "open",
      orderReference: orderReference(order.id),
      total: order.total,
      skus: order.items.map((i) => i.productSlug),
      quantity: order.items.reduce((n, i) => n + i.quantity, 0),
    });
  } catch (err) {
    console.error("[checkout/stripe] session lookup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "LOOKUP_FAILED" }, { status: 500 });
  }
}
