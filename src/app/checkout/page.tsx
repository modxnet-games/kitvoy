import { headers } from "next/headers";

import { CheckoutClient } from "./checkout-client";

// The visitor's country is read per request
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Cloudflare says which country the visitor is in; the form pre-selects it when the cart ships there
  const visitorCountry = (await headers()).get("cf-ipcountry")?.trim().toUpperCase() || null;
  return <CheckoutClient visitorCountry={visitorCountry} />;
}
