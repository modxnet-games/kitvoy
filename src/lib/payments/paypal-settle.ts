import { prisma } from "@/lib/db";
import { sendOwnerAlert } from "@/lib/email";
import { afterOrderPaid, completePaidOrder } from "@/lib/payments/order-payment";
import { getPayPal, paypal } from "@/lib/payments/paypal";
import { cancelOpenPaymentIntent, getStripe } from "@/lib/payments/stripe";

type PayPalMoney = { value?: string; currency_code?: string };
type PayPalCapture = {
  id?: string;
  status?: string;
  amount?: PayPalMoney;
  seller_receivable_breakdown?: { paypal_fee?: PayPalMoney };
};
/** The parts of a PayPal order this store reads. */
export type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: { custom_id?: string; amount?: PayPalMoney; payments?: { captures?: PayPalCapture[] } }[];
};

/** The parts of a store order settling needs. */
export interface SettleOrder {
  id: string;
  total: number;
  paymentStatus: string;
  paymentRef: string | null;
  stripePaymentIntentId: string | null;
}

export type SettleResult =
  | { status: "paid" }
  | {
      status: "open";
      reason:
        /** No PayPal order was ever opened for this order */
        | "no_paypal_order"
        /** The buyer hasn't approved it (yet) */
        | "not_approved"
        /** PayPal no longer has it (it expired unapproved) */
        | "gone"
        /** It was opened for another order or another amount, so it must not be captured */
        | "mismatch"
        /** A card payment for the same order is already settling */
        | "card_in_progress"
        /** PayPal didn't complete the capture */
        | "not_completed";
    };

/** Everything settling does to the outside world, replaceable in tests. */
export interface SettleDeps {
  /** The PayPal order as PayPal has it now; null when it no longer exists */
  getOrder(paypalOrderId: string): Promise<PayPalOrder | null>;
  /** Captures an approved order; safe to repeat (PayPal answers a repeat with the first result) */
  capture(paypalOrderId: string): Promise<PayPalOrder>;
  cardPaymentInProgress(paymentIntentId: string | null): Promise<boolean>;
  /** Marks the store order paid, atomically; false when it already was */
  complete(orderId: string, captureRef: string, fee: number | undefined): Promise<boolean>;
  /** What the order is recorded as paid by */
  paidRef(orderId: string): Promise<string | null>;
  /** Email, push, Meta Purchase, fulfillment: runs once, for whoever completed the order */
  afterPaid(orderId: string, stripePaymentIntentId: string | null): void;
  refundDuplicate(captureId: string, orderId: string, paidBy: string): Promise<void>;
  /** Drops a PayPal order id that must never be captured for this order */
  forget(orderId: string, paypalOrderId: string): Promise<void>;
}

const reference = (orderId: string) => `KTV-${orderId.slice(-8).toUpperCase()}`;
const open = (reason: Extract<SettleResult, { status: "open" }>["reason"]): SettleResult => ({ status: "open", reason });

/**
 * Brings a store order in line with its PayPal order: captures it when the
 * buyer has approved, and marks the store order paid when PayPal has the
 * money. It is the single path to "paid" for PayPal, shared by the buttons'
 * callback, the return from PayPal's redirect, a restored checkout and the
 * webhook, and it is safe to run from all of them at once:
 *
 * - PayPal captures an order once; a repeated capture returns the first result.
 * - The store order flips to paid in one atomic update, and only the caller
 *   that flipped it sends the confirmation, the Meta Purchase and the
 *   fulfillment request.
 *
 * Nothing from a browser or a webhook is trusted: the PayPal order is read
 * from PayPal with the store's own credentials, and it is captured only if it
 * was opened for this order and for exactly its total.
 */
export async function settlePayPalOrder(
  order: SettleOrder,
  paypalOrderId: string | null = order.paymentRef,
  deps: SettleDeps = defaultSettleDeps(),
): Promise<SettleResult> {
  if (order.paymentStatus === "paid") return { status: "paid" };
  if (!paypalOrderId) return open("no_paypal_order");

  const expected = order.total.toFixed(2);
  const matches = (money: PayPalMoney | undefined) => money?.value === expected && money?.currency_code === "USD";

  let paypalOrder = await deps.getOrder(paypalOrderId);
  if (!paypalOrder) return open("gone");

  const unit = paypalOrder.purchase_units?.[0];
  if (unit?.custom_id !== order.id || !matches(unit?.amount)) {
    console.warn(`[paypal] ${reference(order.id)}: PayPal order ${paypalOrderId} is for another order or amount; not capturing`);
    await deps.forget(order.id, paypalOrderId);
    return open("mismatch");
  }

  if (paypalOrder.status === "APPROVED") {
    // A card payment for this order is already settling: don't take the money twice
    if (await deps.cardPaymentInProgress(order.stripePaymentIntentId)) return open("card_in_progress");
    paypalOrder = await deps.capture(paypalOrderId);
  }
  if (paypalOrder.status !== "COMPLETED") {
    return open(paypalOrder.status === "CREATED" || paypalOrder.status === "PAYER_ACTION_REQUIRED" || paypalOrder.status === "SAVED" ? "not_approved" : "not_completed");
  }

  const capture = paypalOrder.purchase_units?.[0]?.payments?.captures?.[0];
  if (capture?.status !== "COMPLETED" || !matches(capture.amount)) {
    console.error(`[paypal] ${reference(order.id)}: capture not completed:`, paypalOrder.status, capture?.status, capture?.amount);
    return open("not_completed");
  }

  // Store the capture id: it's what a refund in PayPal needs. The fee feeds the profit figures.
  const fee = Number(capture.seller_receivable_breakdown?.paypal_fee?.value);
  const captureRef = capture.id ?? paypalOrderId;
  if (await deps.complete(order.id, captureRef, Number.isFinite(fee) ? fee : undefined)) {
    deps.afterPaid(order.id, order.stripePaymentIntentId);
    return { status: "paid" };
  }

  // Already paid: by this capture (the webhook and the browser arriving together) or by a card payment that won the race
  const paidBy = await deps.paidRef(order.id);
  if (paidBy !== captureRef && capture.id) await deps.refundDuplicate(capture.id, order.id, paidBy ?? "unknown");
  return { status: "paid" };
}

/** True when the order's card PaymentIntent is paid or settling. */
async function cardPaymentInProgress(paymentIntentId: string | null): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe || !paymentIntentId) return false;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return intent.status === "succeeded" || intent.status === "processing" || intent.status === "requires_capture";
  } catch (err) {
    // Stripe being unreachable must not block PayPal; a real double payment is refunded anyway
    console.warn("[paypal] couldn't check the card payment:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Refunds a PayPal capture in full when the order was already paid another way, and tells the owner. */
async function refundDuplicateCapture(captureId: string, orderId: string, paidBy: string): Promise<void> {
  const client = getPayPal();
  try {
    if (!client) throw new Error("PayPal isn't configured");
    const req = new paypal.payments.CapturesRefundRequest(captureId);
    req.payPalRequestId(`refund-duplicate-${captureId}`);
    req.requestBody({} as never);
    await client.execute(req);
    await sendOwnerAlert(`Duplicate PayPal payment refunded for ${reference(orderId)}`, [
      `PayPal capture ${captureId} was refunded automatically because the order was already paid (${paidBy}).`,
    ]);
  } catch (err) {
    await sendOwnerAlert(`Duplicate PayPal payment NOT refunded for ${reference(orderId)}`, [
      `PayPal capture ${captureId} paid an order that was already paid (${paidBy}), and the automatic refund failed:`,
      err instanceof Error ? err.message : String(err),
      "Refund it from the PayPal dashboard.",
    ]);
  }
}

const isNotFound = (err: unknown) => (err as { statusCode?: number })?.statusCode === 404 || String((err as Error)?.message ?? "").includes("RESOURCE_NOT_FOUND");

export function defaultSettleDeps(): SettleDeps {
  const client = () => {
    const c = getPayPal();
    if (!c) throw new Error("PayPal isn't configured");
    return c;
  };
  const getOrder = async (paypalOrderId: string): Promise<PayPalOrder | null> => {
    try {
      return (await client().execute(new paypal.orders.OrdersGetRequest(paypalOrderId))).result as PayPalOrder;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  };
  return {
    getOrder,
    capture: async (paypalOrderId) => {
      try {
        const req = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
        // The same id on every attempt: PayPal answers a repeat with the first capture instead of an error
        req.payPalRequestId(`capture-${paypalOrderId}`);
        req.prefer("return=representation");
        req.requestBody({} as never);
        return (await client().execute(req)).result as PayPalOrder;
      } catch (err) {
        // Captured by an earlier attempt that didn't reach us: read the order instead
        if (!String((err as Error)?.message ?? "").includes("ORDER_ALREADY_CAPTURED")) throw err;
        const captured = await getOrder(paypalOrderId);
        if (!captured) throw err;
        return captured;
      }
    },
    cardPaymentInProgress,
    complete: (orderId, captureRef, fee) => completePaidOrder(orderId, captureRef, fee, "paypal"),
    paidRef: async (orderId) => (await prisma.order.findUnique({ where: { id: orderId }, select: { paymentRef: true } }))?.paymentRef ?? null,
    afterPaid: (orderId, stripePaymentIntentId) => {
      // Don't make the customer (or PayPal's webhook) wait on email and push; the server keeps running
      void afterOrderPaid(orderId);
      void cancelOpenPaymentIntent(stripePaymentIntentId);
    },
    refundDuplicate: refundDuplicateCapture,
    forget: async (orderId, paypalOrderId) => {
      await prisma.order.updateMany({ where: { id: orderId, paymentStatus: "unpaid", paymentRef: paypalOrderId }, data: { paymentRef: null } });
    },
  };
}

type PayPalWebhookEvent = {
  event_type?: unknown;
  resource?: {
    id?: unknown;
    custom_id?: unknown;
    purchase_units?: { custom_id?: unknown }[];
    supplementary_data?: { related_ids?: { order_id?: unknown } };
  };
};

const PAYPAL_ID_RE = /^[A-Z0-9]{8,40}$/;
const STORE_ID_RE = /^[a-z0-9]{20,36}$/;

/**
 * Which PayPal order (and which store order) a webhook notification is about.
 * Only used to know what to look up: the notification itself is never trusted.
 */
export function paypalEventTarget(event: unknown): { type: string; paypalOrderId: string | null; orderId: string | null } | null {
  const e = event as PayPalWebhookEvent | null;
  const type = typeof e?.event_type === "string" ? e.event_type : "";
  const resource = e?.resource;
  if (!type || !resource) return null;

  let paypalOrderId: unknown = null;
  let orderId: unknown = null;
  if (type.startsWith("CHECKOUT.ORDER.")) {
    paypalOrderId = resource.id;
    orderId = resource.purchase_units?.[0]?.custom_id;
  } else if (type.startsWith("PAYMENT.CAPTURE.")) {
    paypalOrderId = resource.supplementary_data?.related_ids?.order_id;
    orderId = resource.custom_id;
  } else {
    return null;
  }
  const target = {
    type,
    paypalOrderId: typeof paypalOrderId === "string" && PAYPAL_ID_RE.test(paypalOrderId) ? paypalOrderId : null,
    orderId: typeof orderId === "string" && STORE_ID_RE.test(orderId) ? orderId : null,
  };
  return target.paypalOrderId || target.orderId ? target : null;
}
