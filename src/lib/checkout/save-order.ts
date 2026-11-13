import { after } from "next/server";
import type { NextRequest } from "next/server";

import { readOrderAttribution, type OrderAttribution } from "@/lib/analytics/attribution";
import { sendInitiateCheckoutEvent } from "@/lib/analytics/meta-capi";
import { getCustomer } from "@/lib/auth/customer-session";
import { presentedSessionToken } from "@/lib/checkout/resume-cookies";
import { SESSION_TTL_MS, isOpenOrder } from "@/lib/checkout/resume-token";
import { extendSessionToken, findCheckoutToken, issueCheckoutToken, pruneExpiredCheckoutTokens } from "@/lib/checkout/tokens";
import { prisma } from "@/lib/db";
import { createOrder, updatePendingOrder, type CreateOrderInput } from "@/lib/orders";
import type { OrderTotals } from "@/lib/payments/money";
import { ensureOrderPaymentIntent } from "@/lib/payments/stripe-intent";
import { getStripe } from "@/lib/payments/stripe";
import { saveSubscriberEmail } from "@/lib/subscribers";

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

export interface SavedCheckoutOrder {
  orderId: string;
  orderReference: string;
  totals: OrderTotals;
  /** The checkout's session token: the one presented, or a new one for a new order */
  sessionToken: string | null;
  /** True when the checkout's open order was updated instead of a new one being created */
  reused: boolean;
}

export type SaveCheckoutOrderResult = { ok: true; saved: SavedCheckoutOrder } | { ok: false; error: string };

const orderReferenceOf = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

/**
 * Saves validated checkout details as a pending (unpaid) order, for whichever
 * route collected them: the details form or an express payment.
 *
 * One order per checkout: when the browser presents the session token of an
 * order that is still open, that order is updated in place (reload, Edit, a
 * changed cart) instead of a second one being created. The signed-in customer
 * and the ad attribution are read from the request. A new order gets a
 * session token and Meta's InitiateCheckout, once.
 *
 * `options` is for express checkout, where the order's id was chosen before
 * the buyer approved and `paymentRef` is the PayPal order that pays it. The
 * checkout's open order is then updated only when it is that very order;
 * otherwise the order is created with that id, already naming the PayPal
 * order. If the id is taken, the existing order stands only when it is the
 * same payment saved by another request (it names the same PayPal order, or
 * is paid): an order holding other details is never passed off as this one.
 */
export async function saveCheckoutOrder(
  request: NextRequest,
  body: unknown,
  input: CreateOrderInput,
  options: { orderId?: string; paymentRef?: string } = {},
): Promise<SaveCheckoutOrderResult> {
  const customer = await getCustomer();
  const attribution: OrderAttribution = { ...readOrderAttribution(request.cookies, request.headers), ...trackingFromBody(body) };
  const data = {
    ...input,
    ...(customer && { userId: customer.userId }),
    attribution,
  };
  if (customer?.email) {
    await saveSubscriberEmail(customer.email, "checkout");
  }

  let sessionToken = presentedSessionToken(request, (body as { resumeToken?: unknown })?.resumeToken);
  const session = sessionToken ? await findCheckoutToken(sessionToken, "session") : null;

  let saved: { orderId: string; orderReference: string; totals: OrderTotals } | null = null;
  let reused = false;

  if (session && sessionToken && isOpenOrder(session.order) && (!options.orderId || session.orderId === options.orderId)) {
    const updated = await updatePendingOrder(session.order, data);
    if (updated.success) {
      saved = updated;
      reused = true;
      await extendSessionToken(sessionToken);
      if (updated.totalChanged || updated.detailsChanged) await syncCardIntent(updated.orderId);
    } else if (!updated.notReusable) {
      return { ok: false, error: updated.error };
    }
    // Paid or canceled in the meantime: fall through to a new order
  }

  if (!saved) {
    const created = await createOrder(data, options.orderId ? { id: options.orderId, paymentRef: options.paymentRef } : {});
    if (!created.success) {
      if (!created.exists || !options.orderId) return { ok: false, error: created.error };
      // Another request for the same express payment got here first: its order stands
      const existing = await prisma.order.findUnique({
        where: { id: options.orderId },
        select: { id: true, subtotal: true, shippingCost: true, total: true, paymentStatus: true, paymentRef: true },
      });
      const samePayment = !!existing && (existing.paymentStatus === "paid" || (!!options.paymentRef && existing.paymentRef === options.paymentRef));
      if (!existing || !samePayment) return { ok: false, error: created.error };
      return {
        ok: true,
        saved: {
          orderId: existing.id,
          orderReference: orderReferenceOf(existing.id),
          totals: { subtotal: existing.subtotal, shippingCost: existing.shippingCost, total: existing.total },
          sessionToken: null,
          reused: true,
        },
      };
    }
    const newOrderId = created.orderId;
    saved = created;
    sessionToken = await issueCheckoutToken(newOrderId, "session", SESSION_TTL_MS);

    // Meta's InitiateCheckout, once per order and with the order reference as
    // its event_id (the browser sends the same id); after the response, never in its way
    after(() => sendInitiateCheckoutEvent(newOrderId).catch(() => {}));
    after(() => pruneExpiredCheckoutTokens());
  }

  return { ok: true, saved: { orderId: saved.orderId, orderReference: saved.orderReference, totals: saved.totals, sessionToken, reused } };
}
