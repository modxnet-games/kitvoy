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

/**
 * The browser key, or null when card payments aren't set up (both keys are
 * needed). Read with bracket access so Next.js doesn't inline it at build
 * time: switching keys on the server then only needs a restart.
 */
export function getStripePublishableKey(): string | null {
  const key = process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]?.trim();
  return key && process.env.STRIPE_SECRET_KEY?.trim() ? key : null;
}

/** True when the configured secret key is a test-mode key (sandbox). */
export function isStripeTestMode(): boolean {
  return /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "");
}

/**
 * Whether checkout offers Stripe: true for every visitor once both keys are
 * set. With test (sandbox) keys that means everyone gets Stripe's sandbox
 * Checkout, where real cards are declined; the owner chose that while the
 * store has no traffic. Test payments are flagged and never reach CJ.
 * Switch the server to live keys before sending real customers.
 */
export async function canUseStripeCheckout(): Promise<boolean> {
  return Boolean(getStripe() && getStripePublishableKey());
}

/** The Checkout Session's state, or null when Stripe can't be asked right now. */
async function sessionStatus(sessionId: string): Promise<Stripe.Checkout.Session.Status | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    return (await stripe.checkout.sessions.retrieve(sessionId)).status;
  } catch (err) {
    console.warn(`[stripe] couldn't read session ${sessionId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * True once the customer finished the order's Stripe Checkout (paid, or a
 * delayed method still settling), so no second way to pay should open.
 * Stripe being unreachable never blocks PayPal: a real double payment is
 * refunded by the webhook anyway.
 */
export async function checkoutSessionCompleted(sessionId: string | null | undefined): Promise<boolean> {
  if (!sessionId) return false;
  return (await sessionStatus(sessionId)) === "complete";
}

/**
 * Closes an order's Stripe Checkout once the order is paid another way (PayPal)
 * or canceled, so a Checkout page left open in another tab can't charge it.
 * Best-effort: the webhook refunds a duplicate payment anyway.
 */
export async function expireOpenCheckoutSession(sessionId: string | null | undefined): Promise<void> {
  const stripe = getStripe();
  if (!stripe || !sessionId) return;
  try {
    if ((await sessionStatus(sessionId)) === "open") await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    console.warn(`[stripe] couldn't expire session ${sessionId}:`, err instanceof Error ? err.message : err);
  }
}
