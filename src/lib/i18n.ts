/**
 * The storefront speaks Arabic (the default, right to left) and French. The
 * language is a cookie, set by the switch in the header or by `?lang=ar|fr` on
 * any link (src/proxy.ts), so one address serves both.
 */
export const LOCALES = ["ar", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "lang";
/** One year */
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "fr";
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** The other language, for the switch. */
export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "fr" : "ar";
}

/**
 * The language for a first visit, from the browser's Accept-Language: French
 * when French comes before Arabic in it, Arabic otherwise.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.toLowerCase().split(",")) {
    const tag = part.trim().split(";")[0];
    if (tag.startsWith("ar")) return "ar";
    if (tag.startsWith("fr")) return "fr";
  }
  return DEFAULT_LOCALE;
}

export function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}
