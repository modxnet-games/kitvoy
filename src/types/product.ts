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
  sku: string;
  isFeatured: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  images: string[];
}
