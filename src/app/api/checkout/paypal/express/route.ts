import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { siteConfig } from "@/config/site";
import { orderContents } from "@/lib/analytics/meta-capi";
import { presentedSessionToken } from "@/lib/checkout/resume-cookies";
import { isOpenOrder } from "@/lib/checkout/resume-token";
import { saveCheckoutOrder } from "@/lib/checkout/save-order";
import { findCheckoutToken } from "@/lib/checkout/tokens";
import { prisma } from "@/lib/db";
import { orderInputFromDetails, parseCartItems, priceCart } from "@/lib/orders";
import { getPayPal, paypal } from "@/lib/payments/paypal";
import {
  completeExpressOrder,
  createExpressOrder,
  expressOrderBody,
  expressReturnUrls,
  newOrderId,
  paypalExpressEnabled,
  type ExpressStoreOrder,
} from "@/lib/payments/paypal-express";
import { defaultSettleDeps, settlePayPalOrder } from "@/lib/payments/paypal-settle";

/** Why the route can't be used right now, or null when it can. */
function unavailable(): NextResponse | null {
  if (!getPayPal()) return NextResponse.json({ error: "PAYPAL_NOT_CONFIGURED" }, { status: 503 });
  // PAYPAL_EXPRESS=off also stops approvals already under way: they lapse uncaptured and nobody is charged
  if (!paypalExpressEnabled()) return NextResponse.json({ error: "PAYPAL_EXPRESS_OFF" }, { status: 503 });
  return null;
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** The body PayPal's SDK takes for a new order. */
type PayPalCreateBody = Parameters<InstanceType<typeof paypal.orders.OrdersCreateRequest>["requestBody"]>[0];

/**
 * POST /api/checkout/paypal/express  { items, resumeToken?, mode? }
 *
 * Opens a PayPal order for the cart, for the express button at the top of the
 * details step. The amount is the cart priced from the database, never the
 * browser's figures, and the buyer chooses the shipping address in PayPal.
 * The priced cart is listed in the PayPal order, which is where completing
 * (PUT) reads it back from. Nothing is saved here: the store order is created
 * when the approved payment is completed.
 *
 * Returns { paypalOrderId, allowedCountries }: the countries the cart ships
 * to, so the button can turn away other addresses while the buyer is still in
 * PayPal. The same check runs again on the server after approval.
 *
 * `mode: "redirect"` (Meta's in-app browsers, where a pop-up loses its page):
 * also returns { approveUrl }. The browser goes to PayPal as a full page and
 * PayPal sends it back to /checkout?ppx=return (or ppx=cancel) with its order
 * id, where the page asks for the payment to be completed. No token is put in
 * those addresses: the browser that left keeps a marker of the PayPal order
 * it opened, and only completes that one.
 */
export async function POST(request: NextRequest) {
  const blocked = unavailable();
  if (blocked) return blocked;

  try {
    const body = await readBody(request);
    const redirect = body.mode === "redirect";
    const result = await createExpressOrder(
      parseCartItems(body.items),
      {
        priceCart,
        sessionOrder: async () => {
          const session = await findCheckoutToken(presentedSessionToken(request, body.resumeToken), "session");
          return session && isOpenOrder(session.order) ? { id: session.order.id, stripePaymentIntentId: session.order.stripePaymentIntentId } : null;
        },
        cardPaymentInProgress: defaultSettleDeps().cardPaymentInProgress,
        newOrderId,
        openPayPalOrder: async ({ orderId, priced, redirect: comesBack }) => {
          const client = getPayPal();
          if (!client) throw new Error("PayPal isn't configured");
          const req = new paypal.orders.OrdersCreateRequest();
          req.prefer("return=representation");
          const order = expressOrderBody({ orderId, priced, brandName: siteConfig.name, redirect: comesBack ? expressReturnUrls(siteConfig.url) : null });
          // The SDK's typings ask for every part of a breakdown; PayPal takes the parts that apply
          req.requestBody(order as PayPalCreateBody);
          const res = await client.execute(req);
          const id: unknown = res.result?.id;
          return { id: typeof id === "string" ? id : "", links: res.result?.links };
        },
      },
      { redirect },
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({
      paypalOrderId: result.paypalOrderId,
      allowedCountries: result.allowedCountries,
      ...(result.approveUrl && { approveUrl: result.approveUrl }),
    });
  } catch (err) {
    console.error("[checkout/paypal-express] create error:", err);
    return NextResponse.json({ error: "PAYMENT_INIT_FAILED" }, { status: 500 });
  }
}

const findOrder = (orderId: string): Promise<ExpressStoreOrder | null> =>
  prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, total: true, status: true, paymentStatus: true, paymentRef: true, stripePaymentIntentId: true },
  });

/**
 * PUT /api/checkout/paypal/express  { paypalOrderId, items, phone?, resumeToken? }
 *
 * Completes an express payment the buyer approved in PayPal: reads the PayPal
 * order with the store's credentials, checks the address PayPal holds against
 * the checkout's own rules, prices the cart again, saves the store order and
 * settles it through the same path as every other PayPal payment.
 *
 * The cart is the one listed in the PayPal order, so a browser that lost its
 * cart on the way to PayPal and back (or sends another one) changes nothing.
 * `items` is only priced for a PayPal order that lists none.
 *
 * Answers { status }: "paid" (with the order reference, total and contents,
 * as a restored paid checkout gets), "address_unusable" (with a reason),
 * "needs_phone" (repeat the call with a `phone`), "price_changed",
 * "not_completed" or "unconfirmed". Only "paid" means the order is paid.
 * "address_unusable", "price_changed" and "not_completed" mean nothing was
 * taken and nothing can be later; "unconfirmed" (like an error answer) means
 * that isn't known, and the page must not say the buyer wasn't charged. The
 * buyer's details and the checkout's session token are never part of the
 * answer.
 */
export async function PUT(request: NextRequest) {
  const blocked = unavailable();
  if (blocked) return blocked;

  try {
    const body = await readBody(request);
    const settleDeps = defaultSettleDeps();
    const result = await completeExpressOrder(
      {
        paypalOrderId: body.paypalOrderId,
        items: parseCartItems(body.items),
        phone: typeof body.phone === "string" ? body.phone.slice(0, 40) : undefined,
      },
      {
        getPayPalOrder: settleDeps.getOrder,
        findOrder,
        priceCart,
        saveOrder: async ({ orderId, paypalOrderId, details, items }) => {
          // The same saving as the details form: the signed-in customer, the ad attribution, one order per checkout
          const saved = await saveCheckoutOrder(request, body, orderInputFromDetails(details, items), { orderId, paymentRef: paypalOrderId });
          if (!saved.ok) return saved;
          // The order now holds PayPal's address, so it may name this PayPal order: settling requires that before it
          // captures an express payment (a new order was created naming it; the checkout's open order is marked here)
          await prisma.order.updateMany({
            where: { id: orderId, status: "PENDING", paymentStatus: "unpaid" },
            data: { paymentMethod: "paypal", paymentRef: paypalOrderId },
          });
          const order = await findOrder(orderId);
          return order ? { ok: true, order } : { ok: false, error: "ORDER_NOT_FOUND" };
        },
        cardPaymentInProgress: settleDeps.cardPaymentInProgress,
        settle: (order, paypalOrderId) => settlePayPalOrder(order, paypalOrderId, settleDeps),
        forget: settleDeps.forget,
        contents: async (orderId) => orderContents(await prisma.orderItem.findMany({ where: { orderId } })),
      },
    );
    if (result.status === "not_completed" || result.status === "unconfirmed") console.warn(`[checkout/paypal-express] ${result.status}: ${result.code}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[checkout/paypal-express] complete error:", err);
    return NextResponse.json({ error: "PAYMENT_CAPTURE_FAILED" }, { status: 500 });
  }
}
