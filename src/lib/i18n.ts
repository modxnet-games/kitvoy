/** The storefront is English-only (US market). Kept as a type for existing order records. */
export type Locale = "en";

export const DEFAULT_LOCALE: Locale = "en";

export function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    String(params[key] ?? ""),
  );
}
