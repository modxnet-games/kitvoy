import Stripe from "stripe";

import { isAdminAuthenticated } from "@/lib/auth/admin-session";

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

/** True when the configured secret key is a test-mode key (sandbox). */
export function isStripeTestMode(): boolean {
  return /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "");
}

/**
 * Whether this visitor may pay by card. With test keys on the production
 * server, only a signed-in admin sees the card form: customers would
 * otherwise get a form that declines every real card. Local development
 * (`next dev`) and live keys show it to everyone.
 */
export async function canUseStripeCheckout(): Promise<boolean> {
  if (!getStripe() || !getStripePublishableKey()) return false;
  if (!isStripeTestMode() || process.env.NODE_ENV !== "production") return true;
  try {
    return await isAdminAuthenticated();
  } catch {
    return false;
  }
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
