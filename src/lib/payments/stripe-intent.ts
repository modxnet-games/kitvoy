import { createHash } from "node:crypto";
import type Stripe from "stripe";

import { countryOf } from "@/lib/us-address";

import { prisma } from "@/lib/db";
import { toCents } from "@/lib/payments/money";
import { isOpenIntent } from "@/lib/payments/stripe";

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

type StoredAddress = { address1?: string; address2?: string; city?: string; state?: string; zip?: string; country?: string };

/** The parts of an order its PaymentIntent is built from. */
export interface IntentOrder {
  id: string;
  total: number;
  customerName: string;
  phone: string;
  location: string;
  shippingAddress: unknown;
  stripePaymentIntentId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
}

/** The order's address in Stripe's shape (shown in the Dashboard and used by risk checks). */
export function intentShipping(order: IntentOrder): Stripe.PaymentIntentCreateParams.Shipping {
  const address = (order.shippingAddress ?? {}) as StoredAddress;
  return {
    name: order.customerName,
    phone: order.phone,
    address: {
      line1: address.address1 ?? order.location,
      line2: address.address2 || undefined,
      city: address.city,
      state: address.state,
      postal_code: address.zip,
      country: countryOf(address),
    },
  };
}

/** Order ids plus the ad that drove the order, so the Stripe Dashboard shows it too (no personal data). */
export function intentMetadata(order: IntentOrder): Record<string, string> {
  const entries: [string, string | null][] = [
    ["utm_source", order.utmSource],
    ["utm_medium", order.utmMedium],
    ["utm_campaign", order.utmCampaign],
    ["utm_content", order.utmContent],
    ["utm_term", order.utmTerm],
    ["fbclid", order.fbclid],
  ];
  return {
    orderId: order.id,
    orderReference: orderReference(order.id),
    ...Object.fromEntries(entries.filter((e): e is [string, string] => !!e[1]).map(([k, v]) => [k, v.slice(0, 500)])),
  };
}

const text = (value: string | null | undefined) => value ?? "";

/** True when an open intent already carries the order's amount and delivery details. */
export function intentMatchesOrder(
  intent: Pick<Stripe.PaymentIntent, "amount" | "shipping">,
  order: IntentOrder,
): boolean {
  if (intent.amount !== toCents(order.total)) return false;
  const want = intentShipping(order);
  const have = intent.shipping;
  if (!have) return false;
  return (
    text(have.name) === text(want.name) &&
    text(have.phone) === text(want.phone) &&
    text(have.address?.line1) === text(want.address.line1) &&
    text(have.address?.line2) === text(want.address.line2) &&
    text(have.address?.city) === text(want.address.city) &&
    text(have.address?.state) === text(want.address.state) &&
    text(have.address?.postal_code) === text(want.address.postal_code) &&
    text(have.address?.country) === text(want.address.country)
  );
}

/** The stored intent, or null when Stripe doesn't have it under these keys (deleted, or made in the other mode). */
async function retrieveIntent(stripe: Pick<Stripe, "paymentIntents">, id: string): Promise<Stripe.PaymentIntent | null> {
  try {
    return await stripe.paymentIntents.retrieve(id);
  } catch (err) {
    if ((err as { code?: string })?.code === "resource_missing") return null;
    throw err;
  }
}

export type EnsureIntentResult =
  | { ok: true; clientSecret: string; intentId: string }
  /** Already paid or settling on this order's intent; the webhook completes the order */
  | { ok: false; intentStatus: "succeeded" | "processing" | "requires_capture" };

/**
 * The one PaymentIntent of an order, ready to pay: created on first use, then
 * reused for every reload, retry and edit. When the order's total or address
 * changed since, the open intent is updated in place so nobody can pay a stale
 * amount; if Stripe refuses the update (a redirect method is mid-flight), the
 * intent is canceled and replaced.
 */
export async function ensureOrderPaymentIntent(
  stripe: Pick<Stripe, "paymentIntents">,
  order: IntentOrder,
  saveIntentId: (orderId: string, intentId: string) => Promise<unknown> = (orderId, intentId) =>
    prisma.order.update({ where: { id: orderId }, data: { stripePaymentIntentId: intentId } }),
): Promise<EnsureIntentResult> {
  const amount = toCents(order.total);
  const shipping = intentShipping(order);
  const metadata = intentMetadata(order);
  const description = `Kitvoy order ${orderReference(order.id)}`;
  const previous = order.stripePaymentIntentId;

  const existing = previous ? await retrieveIntent(stripe, previous) : null;
  if (existing) {
    const settled =
      existing.status === "succeeded" ? "succeeded" : existing.status === "processing" ? "processing" : existing.status === "requires_capture" ? "requires_capture" : null;
    if (settled) return { ok: false, intentStatus: settled };
    if (isOpenIntent(existing) && existing.client_secret) {
      if (intentMatchesOrder(existing, order)) {
        return { ok: true, clientSecret: existing.client_secret, intentId: existing.id };
      }
      try {
        const updated = await stripe.paymentIntents.update(existing.id, { amount, shipping, metadata, description });
        if (updated.client_secret) return { ok: true, clientSecret: updated.client_secret, intentId: updated.id };
      } catch (err) {
        console.warn(`[checkout/stripe] couldn't update ${existing.id}; replacing it:`, err instanceof Error ? err.message : err);
      }
      await stripe.paymentIntents.cancel(existing.id).catch(() => {});
    }
  }
  // No intent yet, or the stored one can't be used any more (canceled, gone,
  // or just replaced): create a fresh one rather than reuse it

  // Keyed on the intent it replaces and on what it carries: concurrent first
  // requests share one intent, and a canceled intent never comes back from
  // Stripe's idempotency cache
  const fingerprint = createHash("sha256").update(JSON.stringify([amount, shipping, metadata])).digest("hex").slice(0, 12);
  const intent = await stripe.paymentIntents.create(
    { amount, currency: "usd", automatic_payment_methods: { enabled: true }, description, metadata, shipping },
    { idempotencyKey: `pi-${order.id}-${amount}-${previous ?? "first"}-${fingerprint}` },
  );
  if (!intent.client_secret) throw new Error(`PaymentIntent ${intent.id} has no client secret`);

  await saveIntentId(order.id, intent.id);
  return { ok: true, clientSecret: intent.client_secret, intentId: intent.id };
}
