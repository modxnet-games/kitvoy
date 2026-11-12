import { catalog, type CatalogProduct } from "@/config/catalog";
import { prisma } from "@/lib/db";
import { isVideoMediaUrl, normalizeMediaSrc } from "@/lib/media-url";
import type { ProductDisplay } from "@/types/product";

export interface CatalogCard {
  entry: CatalogProduct;
  /** The live database product, or null while the product hasn't been created there */
  product: ProductDisplay | null;
  /** Card photo: the product's first image, else the catalog's fallback */
  image: string;
}

/**
 * Every catalog product with its live price and stock, for the catalog pages
 * (/ and /products). A product missing from the database still gets a card,
 * without a price, so a new catalog entry is visible before it is seeded.
 */
export async function getCatalogCards(): Promise<CatalogCard[]> {
  const rows = await prisma.product
    .findMany({
      where: { slug: { in: catalog.map((p) => p.slug) } },
      include: { category: { select: { id: true, name: true, slug: true } }, images: { orderBy: { order: "asc" } } },
    })
    .catch(() => []);
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  return [...catalog]
    .sort((a, b) => a.hubNumber - b.hubNumber)
    .map((entry) => {
      const row = bySlug.get(entry.slug);
      const images = (row?.images ?? []).flatMap((i) => {
        const src = normalizeMediaSrc(i.url);
        return src && !isVideoMediaUrl(src) ? [src] : [];
      });
      const product: ProductDisplay | null = row
        ? {
            id: row.id,
            slug: row.slug,
            name: row.name,
            shortDescription: row.shortDescription,
            description: row.description,
            details: row.details,
            price: row.price,
            shippingTax: row.shippingTax,
            compareAtPrice: null,
            badge: null,
            rating: 0,
            reviewCount: 0,
            stock: row.stock,
            sku: row.sku,
            isFeatured: row.isFeatured,
            category: row.category,
            images,
          }
        : null;
      return { entry, product, image: images[0] ?? entry.fallbackImage };
    });
}
