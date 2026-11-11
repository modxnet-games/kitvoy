import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { siteConfig } from "@/config/site";
import { presentedSessionToken } from "@/lib/checkout/resume-cookies";
import { PAYPAL_LINK_TTL_MS, RESUME_LINK_PARAM } from "@/lib/checkout/resume-token";
import { findCheckoutToken, issueCheckoutToken } from "@/lib/checkout/tokens";
import { getPayableOrder, orderHasStock } from "@/lib/payments/order-payment";
import { getPayPal, paypal } from "@/lib/payments/paypal";
import { settlePayPalOrder } from "@/lib/payments/paypal-settle";
import { getStripe } from "@/lib/payments/stripe";

/** True when the order's card PaymentIntent is paid or settling. */
async function cardPaymentInProgress(paymentIntentId: string | null): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe || !paymentIntentId) return false;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return intent.status === "succeeded" || intent.status === "processing" || intent.status === "requires_capture";
  } catch (err) {
    // Stripe being unreachable must not block PayPal; a real double payment is refunded anyway
    console.warn("[checkout/paypal] couldn't check the card payment:", err instanceof Error ? err.message : err);
    return false;
  }
}

type PayPalLink = { rel?: string; href?: string };

/**
 * POST /api/checkout/paypal  { orderId, redirect?, resumeToken? }
 *
 * Creates a PayPal order for a pending store order. The amount always comes
 * from the order in the database, never from the browser.
 *
 * - Default: returns { id } for the PayPal Buttons `createOrder` callback
 *   (PayPal opens in a pop-up and calls back into the page).
 * - `redirect: true` (Meta's in-app browsers, where a pop-up loses its page):
 *   also returns { approveUrl }. The browser goes to PayPal as a full page and
 *   PayPal sends it back to /checkout with a short-lived link token, where the
 *   payment is captured on the server. Only the browser holding the
 *   checkout's session token can start this.
 */
export async function POST(request: NextRequest) {
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

    // A card payment for this order is already settling: don't open a second way to pay
    if (await cardPaymentInProgress(order.stripePaymentIntentId)) {
      return NextResponse.json({ error: "checkout.paymentInProgress" }, { status: 409 });
    }

    let returnUrls: { return_url: string; cancel_url: string } | null = null;
    if (body?.redirect === true) {
      const session = await findCheckoutToken(presentedSessionToken(request, body?.resumeToken), "session");
      if (!session || session.orderId !== order.id) {
        return NextResponse.json({ error: "checkout.sessionExpired" }, { status: 403 });
      }
      // A token made for this trip only: the session token itself never goes into a URL
      const link = await issueCheckoutToken(order.id, "link", PAYPAL_LINK_TTL_MS);
      const back = `${siteConfig.url.replace(/\/$/, "")}/checkout?${RESUME_LINK_PARAM}=${link}`;
      returnUrls = { return_url: `${back}&pp=return`, cancel_url: `${back}&pp=cancel` };
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
        ...(returnUrls ?? {}),
      },
    });
    const res = await client.execute(req);
    const paypalOrderId: string = res.result.id;

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: "paypal", paymentRef: paypalOrderId },
    });

    if (!returnUrls) return NextResponse.json({ id: paypalOrderId });

    const links = (res.result.links ?? []) as PayPalLink[];
    const approveUrl = links.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
    if (!approveUrl || !/^https:\/\/([a-z0-9-]+\.)*paypal\.com\//.test(approveUrl)) {
      console.error("[checkout/paypal] PayPal returned no approval link for", paypalOrderId);
      return NextResponse.json({ error: "PAYMENT_INIT_FAILED" }, { status: 502 });
    }
    return NextResponse.json({ id: paypalOrderId, approveUrl });
  } catch (err) {
    console.error("[checkout/paypal] create error:", err);
    return NextResponse.json({ error: "PAYMENT_INIT_FAILED" }, { status: 500 });
  }
}

/**
 * PUT /api/checkout/paypal  { orderId }
 * Captures the approved PayPal order (PayPal Buttons `onApprove`), verifies the
 * amount, marks the store order paid (reserving stock) and runs the paid-order
 * steps: owner email, admin push and fulfillment. The same settling runs when
 * a checkout comes back from PayPal's redirect and from PayPal's webhook, so a
 * capture can never happen twice.
 */
export async function PUT(request: Request) {
  if (!getPayPal()) {
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

    const settled = await settlePayPalOrder(order);
    if (settled.status === "paid") return NextResponse.json({ ok: true });
    console.error(`[checkout/paypal] capture not completed for ${order.id}: ${settled.reason}`);
    return NextResponse.json({ error: "PAYMENT_NOT_COMPLETED" }, { status: 402 });
  } catch (err) {
    console.error("[checkout/paypal] capture error:", err);
    return NextResponse.json({ error: "PAYMENT_CAPTURE_FAILED" }, { status: 500 });
  }
}
