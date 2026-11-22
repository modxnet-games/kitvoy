import { CheckoutClient } from "./checkout-client";

/** The cash-on-delivery order form. The cart lives in the browser, so the page itself has nothing to load. */
export default function CheckoutPage() {
  return <CheckoutClient />;
}
