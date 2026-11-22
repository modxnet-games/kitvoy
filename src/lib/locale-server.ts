import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, type Locale } from "@/lib/i18n";

/**
 * The language of the request being rendered: the visitor's choice (cookie)
 * when there is one, otherwise their browser's languages, otherwise Arabic.
 * A link with `?lang=fr` sets the cookie before the page renders (src/proxy.ts).
 */
export async function getLocale(): Promise<Locale> {
  const headerList = await headers();
  // The proxy passes on a language it has just set from the URL, before the cookie comes back
  const forced = headerList.get("x-store-lang");
  if (isLocale(forced)) return forced;
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage(headerList.get("accept-language"));
}
