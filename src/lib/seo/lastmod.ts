/**
 * Sitemap lastmod values as plain W3C dates (YYYY-MM-DD). A date without a
 * time can't drift a day when the server's time zone isn't UTC, which is how
 * "November 9, 2026" used to come out as 2026-11-08T23:00:00Z.
 */

type DayInput = string | Date | null | undefined;

/** "November 9, 2026", "2026-11-09" or a Date → "2026-11-09"; undefined when it isn't a date. */
export function toIsoDay(value: DayInput): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // A written date has no time zone: read it as that calendar day, in UTC
  const parsed = new Date(`${text} UTC`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

/** The most recent of the given days; undefined when none is a date. */
export function latestDay(...values: DayInput[]): string | undefined {
  const days = values.map(toIsoDay).filter((d): d is string => !!d);
  return days.length ? days.sort()[days.length - 1] : undefined;
}
