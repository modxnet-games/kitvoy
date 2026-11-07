import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Server-side Stripe client, or null when STRIPE_SECRET_KEY is not configured.
 * Use a restricted key (rk_…) limited to what the store calls: PaymentIntents,
 * Charges, Balance (fees) and Refunds. The SDK pins its own
 * API version, so a Stripe-side default change can't alter behavior silently.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  client ??= new Stripe(key, { appInfo: { name: "Kitvoy store", url: "https://kitvoy.com" } });
  return client;
}

/** The browser key, or null when card payments aren't set up (both keys are needed). */
export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key && process.env.STRIPE_SECRET_KEY?.trim() ? key : null;
}

/** PaymentIntent states where the customer can still pay (or retry) on the same intent. */
const OPEN_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

export function isOpenIntent(intent: Stripe.PaymentIntent): boolean {
  return OPEN_STATUSES.has(intent.status);
}

/**
 * Cancels an order's card PaymentIntent once the order is paid another way
 * (PayPal), so a card form left open in another tab can't charge it again.
 * Best-effort: the webhook refunds a duplicate payment anyway.
 */
export async function cancelOpenPaymentIntent(paymentIntentId: string | null | undefined): Promise<void> {
  const stripe = getStripe();
  if (!stripe || !paymentIntentId) return;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (isOpenIntent(intent)) {
      await stripe.paymentIntents.cancel(paymentIntentId, { cancellation_reason: "duplicate" });
    }
  } catch (err) {
    console.warn(`[stripe] couldn't cancel ${paymentIntentId}:`, err instanceof Error ? err.message : err);
  }
}
