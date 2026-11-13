import { prisma } from "@/lib/db";
import { sendOwnerAlert } from "@/lib/email";
import { afterOrderPaid, completePaidOrder } from "@/lib/payments/order-payment";
import { getPayPal, paypal } from "@/lib/payments/paypal";
import { PAYPAL_EXPRESS_REFERENCE, PAYPAL_ID_RE, STORE_ID_RE } from "@/lib/payments/paypal-ids";
import { cancelOpenPaymentIntent, getStripe } from "@/lib/payments/stripe";

type PayPalMoney = { value?: string; currency_code?: string };
type PayPalCapture = {
  id?: string;
  status?: string;
  amount?: PayPalMoney;
  seller_receivable_breakdown?: { paypal_fee?: PayPalMoney };
};
type PayPalName = { given_name?: string; surname?: string };
type PayPalPhone = { national_number?: string };
type PayPalAddress = {
  address_line_1?: string;
  address_line_2?: string;
  /** State, province or region */
  admin_area_1?: string;
  /** City */
  admin_area_2?: string;
  postal_code?: string;
  country_code?: string;
};
/** One line of the cart as express checkout records it in the PayPal order (the `sku` says which product, colour and quantity). */
export type PayPalItem = { name?: string; sku?: string; quantity?: string; unit_amount?: PayPalMoney };
/** The parts of a PayPal order this store reads. The buyer, the shipping address and the items are only read by express checkout. */
export type PayPalOrder = {
  id?: string;
  status?: string;
  payer?: { name?: PayPalName; email_address?: string; phone?: { phone_number?: PayPalPhone } };
  payment_source?: { paypal?: { name?: PayPalName; email_address?: string; phone_number?: PayPalPhone } };
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    amount?: PayPalMoney;
    items?: PayPalItem[];
    shipping?: { name?: { full_name?: string }; phone_number?: PayPalPhone; address?: PayPalAddress };
    payments?: { captures?: PayPalCapture[] };
  }[];
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
        /** An express PayPal order whose address the store order doesn't hold yet */
        | "awaiting_details"
        /** PayPal accepted the payment but is holding it (a review, an eCheck): its notification settles the order when the money arrives */
        | "capture_pending"
        /** PayPal refused the capture: nothing was taken */
        | "capture_declined"
        /** PayPal took the money, but the order was changed meanwhile and no longer costs that amount: the capture is given back */
        | "order_changed"
        /** PayPal didn't complete the capture, and what became of it isn't known */
        | "not_completed";
    };

/** Everything settling does to the outside world, replaceable in tests. */
export interface SettleDeps {
  /** The PayPal order as PayPal has it now; null when it no longer exists */
  getOrder(paypalOrderId: string): Promise<PayPalOrder | null>;
  /** Captures an approved order; safe to repeat (PayPal answers a repeat with the first result) */
  capture(paypalOrderId: string): Promise<PayPalOrder>;
  cardPaymentInProgress(paymentIntentId: string | null): Promise<boolean>;
  /** Marks the store order paid, atomically, if it still costs the `paidTotal` PayPal took; false when it was already paid or costs something else now */
  complete(orderId: string, captureRef: string, fee: number | undefined, paidTotal: number): Promise<boolean>;
  /** What the order is recorded as paid by; null when it isn't paid */
  paidRef(orderId: string): Promise<string | null>;
  /** Email, push, Meta Purchase, fulfillment: runs once, for whoever completed the order */
  afterPaid(orderId: string, stripePaymentIntentId: string | null): void;
  refundDuplicate(captureId: string, orderId: string, paidBy: string): Promise<void>;
  /**
   * A capture that pays for nothing: the order was changed while PayPal was
   * taking the money and no longer costs `paid`. Gives it back and tells the
   * owner either way, so the money never sits unseen.
   */
  refundUnmatched(input: { captureId: string | null; paypalOrderId: string; orderId: string; paid: string }): Promise<void>;
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
 * - That update only goes through while the order still costs what PayPal
 *   took. An order edited during the capture stays unpaid, and the capture
 *   is refunded with a note to the owner.
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
  /**
   * PayPal holds a completed capture for this order, but the order doesn't
   * cost that amount (any more): it was edited while the money was being
   * taken. The order must not be paid by it, for the old cart or the new one,
   * so the capture goes back to the buyer and the owner is told. The order
   * stops naming the PayPal order: nothing is left to settle.
   */
  const unmatched = async (capture: PayPalCapture): Promise<SettleResult> => {
    console.error(`[paypal] ${reference(order.id)}: capture ${capture.id ?? "?"} of PayPal order ${paypalOrderId} no longer matches the order's total; giving it back`);
    await deps.refundUnmatched({ captureId: capture.id ?? null, paypalOrderId, orderId: order.id, paid: capture.amount?.value ?? "?" });
    await deps.forget(order.id, paypalOrderId);
    return open("order_changed");
  };

  let paypalOrder = await deps.getOrder(paypalOrderId);
  if (!paypalOrder) return open("gone");

  const unit = paypalOrder.purchase_units?.[0];
  if (unit?.custom_id !== order.id || !matches(unit?.amount)) {
    // Already captured for this order, for an amount the order no longer costs: the order was changed after
    // the money was taken and whoever captured it didn't get to deal with it (see `unmatched` above)
    const taken = unit?.custom_id === order.id ? unit.payments?.captures?.find((c) => c.status === "COMPLETED") : undefined;
    if (taken) return unmatched(taken);
    console.warn(`[paypal] ${reference(order.id)}: PayPal order ${paypalOrderId} is for another order or amount; not capturing`);
    await deps.forget(order.id, paypalOrderId);
    return open("mismatch");
  }
  // An express order ships to the address the buyer chose in PayPal. That address is saved on the store
  // order together with this PayPal order's id, so until the order names it, it is not captured: a
  // notification that arrives first must not pay an order that still holds an address typed earlier
  if (unit.reference_id === PAYPAL_EXPRESS_REFERENCE && order.paymentRef !== paypalOrderId) return open("awaiting_details");

  if (paypalOrder.status === "APPROVED") {
    // A card payment for this order is already settling: don't take the money twice
    if (await deps.cardPaymentInProgress(order.stripePaymentIntentId)) return open("card_in_progress");
    paypalOrder = await deps.capture(paypalOrderId);
  }
  const capture = paypalOrder.purchase_units?.[0]?.payments?.captures?.[0];
  // PayPal accepted the payment and is holding it. The order keeps naming this PayPal order, so the
  // notification PayPal sends when the money arrives finds it and marks it paid then
  if (capture?.status === "PENDING") {
    console.warn(`[paypal] ${reference(order.id)}: capture ${capture.id ?? "?"} is pending at PayPal`);
    return open("capture_pending");
  }
  if (capture?.status === "DECLINED" || capture?.status === "FAILED") {
    console.warn(`[paypal] ${reference(order.id)}: PayPal refused the capture (${capture.status})`);
    return open("capture_declined");
  }
  if (paypalOrder.status !== "COMPLETED") {
    return open(paypalOrder.status === "CREATED" || paypalOrder.status === "PAYER_ACTION_REQUIRED" || paypalOrder.status === "SAVED" ? "not_approved" : "not_completed");
  }
  if (capture?.status !== "COMPLETED" || !matches(capture.amount)) {
    console.error(`[paypal] ${reference(order.id)}: capture not completed:`, paypalOrder.status, capture?.status, capture?.amount);
    return open("not_completed");
  }

  // Store the capture id: it's what a refund in PayPal needs. The fee feeds the profit figures.
  const fee = Number(capture.seller_receivable_breakdown?.paypal_fee?.value);
  const captureRef = capture.id ?? paypalOrderId;
  // The amount PayPal took goes with it: the order is only marked paid while it still costs exactly that
  if (await deps.complete(order.id, captureRef, Number.isFinite(fee) ? fee : undefined, Number(capture.amount?.value))) {
    deps.afterPaid(order.id, order.stripePaymentIntentId);
    return { status: "paid" };
  }

  const paidBy = await deps.paidRef(order.id);
  // Not paid: the order was changed while PayPal was capturing, so this money matches nothing
  if (paidBy === null) return unmatched(capture);
  // Already paid: by this capture (the webhook and the browser arriving together) or by a card payment that won the race
  if (paidBy !== captureRef && capture.id) await deps.refundDuplicate(capture.id, order.id, paidBy);
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

/** Refunds a PayPal capture in full. The request carries the same id every time, so a repeat is answered with the first refund. */
async function refundCapture(captureId: string): Promise<void> {
  const client = getPayPal();
  if (!client) throw new Error("PayPal isn't configured");
  const req = new paypal.payments.CapturesRefundRequest(captureId);
  req.payPalRequestId(`refund-duplicate-${captureId}`);
  req.requestBody({} as never);
  await client.execute(req);
}

/**
 * Refunds a capture that pays for nothing because the order was changed while
 * PayPal was taking the money, and tells the owner: what happened when the
 * refund went through, what to do by hand when it didn't.
 */
async function refundUnmatchedCapture(input: { captureId: string | null; paypalOrderId: string; orderId: string; paid: string }): Promise<void> {
  const what = `PayPal ${input.captureId ? `capture ${input.captureId}` : `order ${input.paypalOrderId}`} took $${input.paid} for ${reference(input.orderId)}, but the order was changed while the payment was being taken and no longer costs that amount.`;
  try {
    if (!input.captureId) throw new Error("PayPal reported no capture id");
    await refundCapture(input.captureId);
    await sendOwnerAlert(`PayPal payment refunded for ${reference(input.orderId)}: the order changed during payment`, [
      what,
      "The order was NOT marked paid and the payment was refunded automatically.",
      "Nothing else to do unless the customer asks about it.",
    ]);
  } catch (err) {
    await sendOwnerAlert(`PayPal payment NOT refunded for ${reference(input.orderId)}: the order changed during payment`, [
      what,
      "The order was NOT marked paid, and the automatic refund failed:",
      err instanceof Error ? err.message : String(err),
      "Refund it from the PayPal dashboard.",
    ]);
  }
}

/** Refunds a PayPal capture in full when the order was already paid another way, and tells the owner. */
async function refundDuplicateCapture(captureId: string, orderId: string, paidBy: string): Promise<void> {
  try {
    await refundCapture(captureId);
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
    complete: (orderId, captureRef, fee, paidTotal) => completePaidOrder({ orderId, paymentRef: captureRef, paidTotal, paymentFee: fee, paymentMethod: "paypal" }),
    paidRef: async (orderId) => {
      const paid = await prisma.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true, paymentRef: true } });
      return paid?.paymentStatus === "paid" ? paid.paymentRef ?? "unknown" : null;
    },
    afterPaid: (orderId, stripePaymentIntentId) => {
      // Don't make the customer (or PayPal's webhook) wait on email and push; the server keeps running
      void afterOrderPaid(orderId);
      void cancelOpenPaymentIntent(stripePaymentIntentId);
    },
    refundDuplicate: refundDuplicateCapture,
    refundUnmatched: refundUnmatchedCapture,
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
