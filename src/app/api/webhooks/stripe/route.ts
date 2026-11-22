import { NextResponse } from "next/server";

/**
 * POST /api/webhooks/stripe
 *
 * This store no longer takes card payments. The Stripe account is shared with
 * another store, so its events still arrive here until the owner deletes this
 * endpoint at Stripe. Answering 200 stops the retries; nothing else happens.
 */
export async function POST() {
  return NextResponse.json({ received: true });
}
