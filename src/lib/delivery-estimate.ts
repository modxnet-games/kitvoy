import { storePolicies } from "@/config/policies";
import { STORE_TIME_ZONE } from "@/lib/formatters";

/** Today's date in the store's time zone, as YYYY-MM-DD. */
export function storeToday(now: Date = new Date()): string {
  // en-CA writes dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** `days` business days after `from` (Saturdays and Sundays don't count). Works on UTC midnights, so no clock or zone enters into it. */
function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left -= 1;
  }
  return date;
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * When an order placed on `today` (YYYY-MM-DD) should arrive, e.g.
 * "Nov 21 – Dec 2": the store's processing time, then the country's transit
 * time, both in business days (the figures the shipping answer gives). It is
 * an estimate and is worded as one wherever it is shown. The server works out
 * `today` once and hands it to the page, so the server render and the browser
 * always agree on the dates.
 */
export function arrivalRange(today: string, transit: { min: number; max: number }): string | null {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(today)) return null;
  const start = new Date(today + "T00:00:00Z");
  if (Number.isNaN(start.getTime())) return null;
  const { processingDays } = storePolicies.shipping;
  const earliest = shortDate.format(addBusinessDays(addBusinessDays(start, processingDays.min), transit.min));
  const latest = shortDate.format(addBusinessDays(addBusinessDays(start, processingDays.max), transit.max));
  return earliest === latest ? earliest : `${earliest} – ${latest}`;
}
