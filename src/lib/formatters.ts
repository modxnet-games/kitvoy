import type { Locale } from "@/lib/i18n";

/**
 * Prices are Moroccan dirhams. A whole amount is written without decimals
 * ("199 DH", "199 درهم"); anything else keeps two. Digits are Western in both
 * languages, as Moroccan shops write them.
 */
export function formatPrice(price: number, locale: Locale | "en" = "fr"): string {
  const amount = Math.round(price * 100) / 100;
  const [int, dec] = amount.toFixed(Number.isInteger(amount) ? 0 : 2).split(".");
  // Thousands: a thin gap, never a comma that reads as decimals
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const number = dec ? grouped + (locale === "en" ? "." : ",") + dec : grouped;
  if (locale === "ar") return `${number} درهم`;
  if (locale === "en") return `${number} MAD`;
  return `${number} DH`;
}

/**
 * Dates use one fixed time zone (Morocco) so the server-rendered HTML and the
 * browser agree; formatting in the viewer's own zone causes hydration
 * mismatches and shifts dates across midnight.
 */
export const STORE_TIME_ZONE = "Africa/Casablanca";

const DATE_LOCALE: Record<Locale | "en", string> = { ar: "ar-MA-u-nu-latn", fr: "fr-MA", en: "en-GB" };

/** A date, e.g. "22 Nov 2026" in the admin, "22 nov. 2026" in French */
export function formatDate(date: Date | string, locale: Locale | "en" = "en"): string {
  return new Date(date).toLocaleDateString(DATE_LOCALE[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: STORE_TIME_ZONE,
  });
}

/** Date and time in Morocco, e.g. "22 Nov 2026, 18:42" */
export function formatDateTime(date: Date | string, locale: Locale | "en" = "en"): string {
  return new Date(date).toLocaleString(DATE_LOCALE[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: STORE_TIME_ZONE,
  });
}
