import paypal from "@paypal/checkout-server-sdk";

let client: paypal.core.PayPalHttpClient | null = null;

/**
 * Server-side PayPal client, or null when credentials are not configured.
 * Uses the sandbox unless PAYPAL_ENV=live.
 */
export function getPayPal(): paypal.core.PayPalHttpClient | null {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  if (!client) {
    const environment =
      process.env.PAYPAL_ENV === "live"
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    client = new paypal.core.PayPalHttpClient(environment);
  }
  return client;
}

export { paypal };
