/**
 * Public tracking page for a shipment. 17TRACK is a universal tracker that
 * detects the carrier from the number (USPS, UPS, YunExpress, …), so the
 * store doesn't need to record which carrier Zendrop used.
 */
export function trackingUrl(trackingNumber: string): string {
  return `https://t.17track.net/en#nums=${encodeURIComponent(trackingNumber.replace(/\s+/g, ""))}`;
}
