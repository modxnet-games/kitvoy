/**
 * Whether the checkout shows PayPal's own pop-up buttons. In Meta's in-app
 * browsers the pop-up loses its connection to the page (the page is reloaded
 * or discarded behind it), so an approved payment would never be captured:
 * the buttons stay hidden there, unless PayPal is the only way to pay.
 */
export function offerPayPalButtons(options: { paypalConfigured: boolean; cardConfigured: boolean; inAppBrowser: boolean }): boolean {
  return options.paypalConfigured && (!options.inAppBrowser || !options.cardConfigured);
}
