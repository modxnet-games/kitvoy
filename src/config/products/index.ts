import { pouncepop } from "./pouncepop";
import type { ProductContent } from "./types";

export type { DemoLoop, DiagramId, GalleryBadge, GalleryImage, IconName, ProductContent } from "./types";

/** Page copy for the products that use the shared product page template (/products/<slug>). */
const contents: Record<string, ProductContent> = {
  [pouncepop.slug]: pouncepop,
};

export function getProductContent(slug: string): ProductContent | undefined {
  return contents[slug];
}

export const productContents: ProductContent[] = Object.values(contents);
