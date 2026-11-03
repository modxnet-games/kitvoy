type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
  interface Navigator {
    /** Global Privacy Control: the visitor asked sites not to sell or share their data */
    globalPrivacyControl?: boolean;
  }
}

/** True when the visitor's browser sends Global Privacy Control; the pixel then never loads. */
export function hasPrivacyOptOut(): boolean {
  return typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
}

/** Pages the pixel ignores (the store's own admin). */
export function isUntrackedPath(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

/**
 * Standard Purchase event, sent once the payment has been captured. eventID is
 * the order reference, so Meta can de-duplicate it against a server-side event later.
 */
export function trackPurchase(p: { orderReference: string; value: number; skus: string[]; quantity: number }) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq(
    "track",
    "Purchase",
    {
      currency: "USD",
      value: Math.round(p.value * 100) / 100,
      content_ids: p.skus,
      content_type: "product",
      num_items: p.quantity,
    },
    { eventID: p.orderReference },
  );
}
