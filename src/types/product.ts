import type { CatalogVariant } from "@/config/catalog";

/** Product shape for storefront display, mapped from the database. */
export interface ProductDisplay {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  details: string;
  price: number;
  shippingTax?: number;
  compareAtPrice?: number | null;
  badge?: "New" | "Sale" | "Bestseller" | null;
  rating: number;
  reviewCount: number;
  stock: number;
  /** In a cart line with a colour and size, that variant's own SKU (config/catalog.ts) */
  sku: string;
  isFeatured: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  images: string[];
  /** The colour and size this cart line is for; absent on the product itself */
  variant?: ProductVariantChoice;
}

/** Only the key is kept: the colour's name is read from the catalog in the page's language. */
export interface ProductVariantChoice {
  key: string;
}

/** A product as one cart line in the chosen colour and size: its SKU and first photo follow the colour. */
export function withVariant(product: ProductDisplay, variant: CatalogVariant): ProductDisplay {
  const images = [variant.image, ...product.images.filter((src) => src !== variant.image)];
  return { ...product, sku: variant.sku, images, variant: { key: variant.key } };
}
