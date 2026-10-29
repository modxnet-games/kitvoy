"use client";

import { createContext, useCallback, useContext } from "react";
import { en } from "@/messages/en";
import { DEFAULT_LOCALE, interpolate, type Locale } from "@/lib/i18n";

/**
 * English-only copy provider. Components keep calling `t("section.key")` so all
 * storefront copy lives in `src/messages/en.ts`.
 */
interface LanguageContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getValue(obj: unknown, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = getValue(en, key);
      if (!value) return key;
      return params ? interpolate(value, params) : value;
    },
    [],
  );

  return (
    <LanguageContext.Provider value={{ locale: DEFAULT_LOCALE, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
