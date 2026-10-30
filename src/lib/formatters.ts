const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format price in US Dollars ($) */
export function formatPrice(price: number): string {
  return usdFormatter.format(price);
}

/**
 * Dates use one fixed timezone (US Eastern) so the server-rendered HTML and
 * the browser agree; formatting in the viewer's local zone causes hydration
 * mismatches and shifts dates across midnight.
 */
const STORE_TIME_ZONE = "America/New_York";

/** Format a date for US display (e.g. "Oct 29, 2026") */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: STORE_TIME_ZONE,
  });
}

/** Date and time, labeled with the zone (e.g. "Oct 29, 2026, 9:38 PM EDT") */
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: STORE_TIME_ZONE,
    timeZoneName: "short",
  });
}
