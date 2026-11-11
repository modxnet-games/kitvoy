import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createOrder, updatePendingOrder, validateOrderInput } from "@/lib/orders";
import { getCustomer } from "@/lib/auth/customer-session";
import { saveSubscriberEmail } from "@/lib/subscribers";
import { readOrderAttribution, type OrderAttribution } from "@/lib/analytics/attribution";
import { sendInitiateCheckoutEvent } from "@/lib/analytics/meta-capi";
import { isSecureRequest, presentedSessionToken, setResumeCookies } from "@/lib/checkout/resume-cookies";
import { SESSION_TTL_MS, isOpenOrder } from "@/lib/checkout/resume-token";
import { extendSessionToken, findCheckoutToken, issueCheckoutToken, pruneExpiredCheckoutTokens } from "@/lib/checkout/tokens";
import { prisma } from "@/lib/db";
import { ensureOrderPaymentIntent } from "@/lib/payments/stripe-intent";
import { getStripe } from "@/lib/payments/stripe";

/** The page the customer is on, taken only in the shapes the checkout produces. */
function trackingFromBody(body: unknown): Pick<OrderAttribution, "eventSourceUrl"> {
  const tracking = (body as { tracking?: Record<string, unknown> } | null)?.tracking;
  if (!tracking || typeof tracking !== "object") return {};
  const url = tracking.eventSourceUrl;
  // The resume link's token must never reach a third party through the event URL
  if (typeof url === "string" && url.length <= 1000 && /^(\/|https?:\/\/)/.test(url)) return { eventSourceUrl: url.split(/[?#]/)[0] };
  return {};
}

/**
 * After an edit, the open card intent must carry the new amount and address
 * before anyone can pay it. Best-effort here: /api/checkout/stripe runs the
 * same sync again before it hands out a client secret.
 */
async function syncCardIntent(orderId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (order?.stripePaymentIntentId && isOpenOrder(order)) await ensureOrderPaymentIntent(stripe, order);
  } catch (err) {
    console.warn("[orders] couldn't sync the card intent after an edit:", err instanceof Error ? err.message : err);
  }
}

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

    const customer = await getCustomer();
    const attribution: OrderAttribution = { ...readOrderAttribution(request.cookies, request.headers), ...trackingFromBody(body) };
    const data = {
      ...validated.data,
      ...(customer && { userId: customer.userId }),
      attribution,
    };
    if (customer?.email) {
      await saveSubscriberEmail(customer.email, "checkout");
    }

    let sessionToken = presentedSessionToken(request, (body as { resumeToken?: unknown })?.resumeToken);
    const session = sessionToken ? await findCheckoutToken(sessionToken, "session") : null;

    let saved: { orderId: string; orderReference: string; totals: { subtotal: number; shippingCost: number; total: number } } | null = null;
    let reused = false;

    if (session && sessionToken && isOpenOrder(session.order)) {
      const updated = await updatePendingOrder(session.order, data);
      if (updated.success) {
        saved = updated;
        reused = true;
        await extendSessionToken(sessionToken);
        if (updated.totalChanged || updated.detailsChanged) await syncCardIntent(updated.orderId);
      } else if (!updated.notReusable) {
        return NextResponse.json({ error: updated.error }, { status: 400 });
      }
      // Paid or canceled in the meantime: fall through to a new order
    }

    if (!saved) {
      const created = await createOrder(data);
      if (!created.success) {
        return NextResponse.json(
          { error: created.error },
          { status: 400 },
        );
      }
      saved = created;
      sessionToken = await issueCheckoutToken(created.orderId, "session", SESSION_TTL_MS);

      // Meta's InitiateCheckout, once per order and with the order reference as
      // its event_id (the browser sends the same id); after the response, never in its way
      after(() => sendInitiateCheckoutEvent(created.orderId).catch(() => {}));
      after(() => pruneExpiredCheckoutTokens());
    }

    const response = NextResponse.json({
      orderId: saved.orderId,
      orderReference: saved.orderReference,
      totals: saved.totals,
      resumeToken: sessionToken,
      reused,
    });
    if (sessionToken) setResumeCookies(response, sessionToken, isSecureRequest(request));
    return response;
  } catch (err) {
    console.error("Order creation error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}
