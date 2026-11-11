/**
 * How the checkout offers PayPal.
 *
 * - "buttons": PayPal's own buttons, which open PayPal in a pop-up and call
 *   back into the page.
 * - "redirect": Meta's in-app browsers reload or discard the page behind a
 *   pop-up, so its callback is lost and an approved payment would never be
 *   captured. There the whole page goes to PayPal and comes back, and the
 *   server captures the payment.
 */
export type PayPalMode = "buttons" | "redirect";

export function paypalMode(options: { paypalConfigured: boolean; inAppBrowser: boolean }): PayPalMode | null {
  if (!options.paypalConfigured) return null;
  return options.inAppBrowser ? "redirect" : "buttons";
}
