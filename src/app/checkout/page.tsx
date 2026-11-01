import { getCustomer } from "@/lib/auth/customer-session";
import { CheckoutClient } from "./checkout-client";

// Read PayPal config per request so a key change only needs a restart, not a rebuild
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // The client id is PayPal's public identifier for the browser SDK; the secret stays server-side
  const paypalClientId = process.env.PAYPAL_CLIENT_ID?.trim() || null;
  const customer = await getCustomer().catch(() => null);
  return (
    <CheckoutClient
      paypalClientId={paypalClientId}
      customer={customer && { email: customer.email, fullName: customer.fullName }}
    />
  );
}
