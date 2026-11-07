import { after, NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/db";
import { sendOwnerAlert } from "@/lib/email";
import { formatPrice } from "@/lib/formatters";
import { afterOrderPaid, completePaidOrder, toCents } from "@/lib/payments/order-payment";
import { getStripe } from "@/lib/payments/stripe";

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;
const idOf = (ref: string | { id: string } | null | undefined) => (typeof ref === "string" ? ref : ref?.id ?? null);

/**
 * POST /api/webhooks/stripe
 *
 * The only place a Stripe payment completes an order. Verifies the signature
 * on the raw body (request.text(), never a parsed body) first, then:
 *  - checkout.session.completed / checkout.session.async_payment_succeeded →
 *    the session's PaymentIntent → the same completion as below
 *  - payment_intent.succeeded → completePaidOrder() → afterOrderPaid(); refunds a
 *    second payment for an order that's already paid or canceled
 *  - payment_intent.payment_failed → logged (the customer can retry)
 *  - charge.updated → records the Stripe fee when it wasn't ready at success
 *  - charge.refunded → refundedAmount / paymentStatus "refunded"
 *  - charge.dispute.created → owner alert
 * Every handler is idempotent, so Stripe's retries are safe.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleSessionCompleted(stripe, event.data.object);
        break;
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        console.info(`[stripe] delayed payment failed for order ${session.metadata?.orderId ?? "?"} (session ${session.id})`);
        break;
      }
      case "payment_intent.succeeded":
        await handleSucceeded(stripe, event.data.object);
        break;
      case "payment_intent.payment_failed": {
        const intent = event.data.object;
        console.info(`[stripe] payment failed for order ${intent.metadata?.orderId ?? "?"}: ${intent.last_payment_error?.code ?? "unknown"}`);
        break;
      }
      case "charge.updated":
        await handleChargeUpdated(stripe, event.data.object);
        break;
      case "charge.refunded":
        await handleRefunded(event.data.object);
        break;
      case "charge.dispute.created":
        await handleDispute(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    // 500 makes Stripe retry; the handlers are safe to run again
    console.error(`[webhooks/stripe] ${event.type} ${event.id} failed:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "HANDLER_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** The processing fee in dollars from the charge's balance transaction, when it exists yet. */
async function chargeFee(stripe: Stripe, chargeId: string | null): Promise<number | undefined> {
  if (!chargeId) return undefined;
  try {
    const charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
    const bt = charge.balance_transaction;
    return bt && typeof bt === "object" ? bt.fee / 100 : undefined;
  } catch (err) {
    console.warn(`[stripe] fee lookup for ${chargeId} failed:`, err instanceof Error ? err.message : err);
    return undefined;
  }
}

/**
 * Stripe Checkout finished. Only a paid session counts (a delayed method such
 * as a bank debit arrives later as async_payment_succeeded); the order is then
 * completed through its PaymentIntent, so amount checks and the duplicate
 * refund apply the same way. Idempotent: a second event finds the order paid.
 */
async function handleSessionCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid") return;
  const orderId = session.metadata?.orderId;
  const intentId = idOf(session.payment_intent);
  if (!orderId || !intentId) return; // Not a store checkout
  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (!intent.metadata?.orderId) intent.metadata = { ...intent.metadata, orderId };
  await handleSucceeded(stripe, intent);
}

async function handleSucceeded(stripe: Stripe, intent: Stripe.PaymentIntent) {
  const orderId = intent.metadata?.orderId;
  if (!orderId) return; // Not a store checkout (e.g. a Dashboard payment)

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    await sendOwnerAlert("Card payment for an unknown order", [
      `PaymentIntent ${intent.id} succeeded for ${formatPrice(intent.amount_received / 100)}, but order ${orderId} doesn't exist.`,
      "Check it in the Stripe Dashboard and refund it if needed.",
    ]);
    return;
  }
  const reference = orderReference(order.id);

  // Trust the intent's own amount, never what the browser said
  if (intent.currency !== "usd" || intent.amount_received !== toCents(order.total)) {
    await sendOwnerAlert(`Card payment amount doesn't match ${reference}`, [
      `PaymentIntent ${intent.id} received ${formatPrice(intent.amount_received / 100)} ${intent.currency.toUpperCase()}; the order total is ${formatPrice(order.total)}.`,
      "The order was NOT marked paid. Check it in the Stripe Dashboard.",
    ]);
    return;
  }

  if (order.status === "CANCELED" && order.paymentStatus !== "paid") {
    await refundDuplicate(stripe, intent, reference, "the order was already canceled");
    return;
  }

  const fee = await chargeFee(stripe, idOf(intent.latest_charge));
  if (await completePaidOrder(order.id, intent.id, fee, "card", !intent.livemode)) {
    // Respond to Stripe now; email, push and CJ run after the response.
    // Test-mode payments never reach the supplier.
    after(() => afterOrderPaid(order.id, { testPayment: !intent.livemode }));
    return;
  }

  // Already paid: by this intent (a retried event) or by something else (paid twice)
  const current = await prisma.order.findUnique({ where: { id: order.id }, select: { paymentRef: true } });
  if (current?.paymentRef === intent.id) return;
  await refundDuplicate(stripe, intent, reference, `the order was already paid (${current?.paymentRef ?? "unknown"})`);
}

/** Refunds a second payment in full and tells the owner. Idempotent per intent. */
async function refundDuplicate(stripe: Stripe, intent: Stripe.PaymentIntent, reference: string, why: string) {
  await stripe.refunds.create(
    { payment_intent: intent.id, reason: "duplicate", metadata: { orderId: intent.metadata?.orderId ?? "" } },
    { idempotencyKey: `refund-duplicate-${intent.id}` },
  );
  await sendOwnerAlert(`Duplicate card payment refunded for ${reference}`, [
    `PaymentIntent ${intent.id} (${formatPrice(intent.amount_received / 100)}) was refunded automatically because ${why}.`,
    "Nothing else to do unless the customer asks about it.",
  ]);
}

/** Some payment methods only get their balance transaction (and fee) after success. */
async function handleChargeUpdated(stripe: Stripe, charge: Stripe.Charge) {
  const intentId = idOf(charge.payment_intent);
  if (!intentId || !charge.balance_transaction) return;
  const order = await prisma.order.findFirst({
    where: { paymentRef: intentId, paymentFee: null },
    select: { id: true },
  });
  if (!order) return;
  const fee = await chargeFee(stripe, charge.id);
  if (fee !== undefined) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentFee: fee } });
  }
}

/** Refunds are made in the Stripe Dashboard; this records them on the order. */
async function handleRefunded(charge: Stripe.Charge) {
  const intentId = idOf(charge.payment_intent);
  if (!intentId) return;
  // Only the payment that paid the order; refunds of a duplicate payment don't touch it
  const order = await prisma.order.findFirst({ where: { paymentRef: intentId } });
  if (!order) return;

  const refundedAmount = charge.amount_refunded / 100;
  await prisma.order.update({
    where: { id: order.id },
    data: { refundedAmount, ...(charge.refunded ? { paymentStatus: "refunded" } : {}) },
  });
  if (order.refundedAmount !== refundedAmount) {
    await sendOwnerAlert(`Refund recorded for ${orderReference(order.id)}`, [
      `${charge.refunded ? "Full" : "Partial"} refund: ${formatPrice(refundedAmount)} of ${formatPrice(order.total)}.`,
      order.fulfillmentRef
        ? `The order was already sent to the supplier (${order.fulfillmentRef}). Cancel it there if it hasn't shipped.`
        : "The order hasn't been sent to the supplier.",
    ]);
  }
}

/** Disputes need evidence by a deadline. */
async function handleDispute(dispute: Stripe.Dispute) {
  const intentId = idOf(dispute.payment_intent);
  const order = intentId ? await prisma.order.findFirst({ where: { paymentRef: intentId } }) : null;
  const due = dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toUTCString() : "see Dashboard";
  await sendOwnerAlert(`Card payment disputed${order ? ` for ${orderReference(order.id)}` : ""}`, [
    `Dispute ${dispute.id}: ${formatPrice(dispute.amount / 100)}, reason "${dispute.reason}".`,
    `Respond with evidence (tracking, delivery confirmation) in the Stripe Dashboard by ${due}.`,
  ]);
}
