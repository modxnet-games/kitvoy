/** Product shape for storefront display. Maps from DB or mock. */
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
  /** In a cart line with a colour, the colour's own SKU (config/catalog.ts) */
  sku: string;
  isFeatured: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  images: string[];
  /** The colour this cart line is for; absent on the product itself and on products with no colour choice */
  variant?: ProductVariantChoice;
}

export interface ProductVariantChoice {
  key: string;
  label: string;
}

/** A product as one cart line in the chosen colour: its name, SKU and first photo follow the colour. */
export function withVariant(
  product: ProductDisplay,
  variant: { key: string; label: string; sku: string; image?: string },
): ProductDisplay {
  const images = variant.image ? [variant.image, ...product.images.filter((src) => src !== variant.image)] : product.images;
  return { ...product, sku: variant.sku, images, variant: { key: variant.key, label: variant.label } };
}
