"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import { dirOf, type Locale } from "@/lib/i18n";
import { getMessages, translate, type Messages } from "@/messages";

/**
 * The page's language, chosen on the server (cookie, then the browser's
 * languages) and handed down here. Client components read `t("cart.title")`
 * or the typed `m.cart.title`.
 */
interface LanguageContextValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  m: Messages;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(locale, key, params), [locale]);
  const value = useMemo(() => ({ locale, dir: dirOf(locale), m: getMessages(locale), t }), [locale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
