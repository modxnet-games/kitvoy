import type { Locale } from "@/lib/i18n";
import { sanadi } from "./sanadi";
import type { ProductContent, ProductEntry } from "./types";

export type { GalleryBadge, GalleryImage, ProductContent, ProductEntry, SizeGuideRow } from "./types";

/** Page copy for the products the store sells, by database slug. */
const entries: Record<string, ProductEntry> = {
  [sanadi.slug]: sanadi,
};

export function getProductEntry(slug: string): ProductEntry | undefined {
  return entries[slug];
}

export function getProductContent(slug: string, locale: Locale): ProductContent | undefined {
  return entries[slug]?.content[locale];
}

export const productEntries: ProductEntry[] = Object.values(entries);
