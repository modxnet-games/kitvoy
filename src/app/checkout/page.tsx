import { getCustomer } from "@/lib/auth/customer-session";
import { getStripePublishableKey } from "@/lib/payments/stripe";
import { CheckoutClient } from "./checkout-client";

// Read payment config per request so a key change only needs a restart, not a rebuild
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Public identifiers for the browser SDKs; the secrets stay server-side
  const paypalClientId = process.env.PAYPAL_CLIENT_ID?.trim() || null;
  const stripePublishableKey = getStripePublishableKey();
  const customer = await getCustomer().catch(() => null);
  return (
    <CheckoutClient
      paypalClientId={paypalClientId}
      stripePublishableKey={stripePublishableKey}
      customer={customer && { email: customer.email, fullName: customer.fullName }}
    />
  );
}
