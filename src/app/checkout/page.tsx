import { cookies, headers } from "next/headers";

import { getCustomer } from "@/lib/auth/customer-session";
import { RESUME_FLAG_COOKIE } from "@/lib/checkout/resume-constants";
import { paypalExpressEnabled } from "@/lib/payments/paypal-express";
import { canUseStripeCheckout, getStripePublishableKey } from "@/lib/payments/stripe";
import { CheckoutClient } from "./checkout-client";

// Read payment config per request so a key change only needs a restart, not a rebuild
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Public identifiers for the browser SDKs; the secrets stay server-side
  const paypalClientId = process.env.PAYPAL_CLIENT_ID?.trim() || null;
  const stripePublishableKey = (await canUseStripeCheckout()) ? getStripePublishableKey() : null;
  // PAYPAL_EXPRESS=off takes the PayPal express button away with a restart; PayPal on the payment step stays
  const paypalExpress = !!paypalClientId && paypalExpressEnabled();
  const customer = await getCustomer().catch(() => null);
  // A started checkout is about to be restored: show the payment step's outline rather than the empty form's
  const resumeHint = (await cookies()).has(RESUME_FLAG_COOKIE);
  // Cloudflare says which country the visitor is in; the form pre-selects it when the cart ships there
  const visitorCountry = (await headers()).get("cf-ipcountry")?.trim().toUpperCase() || null;
  return (
    <CheckoutClient
      paypalClientId={paypalClientId}
      stripePublishableKey={stripePublishableKey}
      customer={customer && { email: customer.email, fullName: customer.fullName }}
      resumeHint={resumeHint}
      visitorCountry={visitorCountry}
      paypalExpress={paypalExpress}
    />
  );
}
