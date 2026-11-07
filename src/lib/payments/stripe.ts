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
