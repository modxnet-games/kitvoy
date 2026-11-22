import { NextResponse } from "next/server";

/**
 * POST /api/webhooks/paypal
 *
 * This store no longer takes PayPal payments. The PayPal account is shared
 * with another store, so its events still arrive here until the owner deletes
 * this endpoint at PayPal. Answering 200 stops the retries; nothing else happens.
 */
export async function POST() {
  return NextResponse.json({ received: true });
}
