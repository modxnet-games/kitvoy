import type { Locale } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import { ar } from "./ar";
import { fr, type Messages } from "./fr";

export type { Messages };

const MESSAGES: Record<Locale, Messages> = { ar, fr };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

/** A dotted key ("cart.title") in the given language; the key itself when it is unknown. */
export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let current: unknown = MESSAGES[locale];
  for (const part of key.split(".")) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "string") return key;
  return params ? interpolate(current, params) : current;
}
