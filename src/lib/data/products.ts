import { prisma } from "@/lib/db";
import { normalizeMediaSrc } from "@/lib/media-url";
import type { ProductDisplay } from "@/types/product";

function toProductDisplay(product: {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  details: string;
  price: number;
  shippingTax: number;
  compareAtPrice: number | null;
  badge: string | null;
  rating: number;
  reviewCount: number;
  stock: number;
  sku: string;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string };
  images: { url: string }[];
}): ProductDisplay {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    details: product.details,
    price: product.price,
    shippingTax: product.shippingTax,
    compareAtPrice: product.compareAtPrice,
    badge: product.badge as ProductDisplay["badge"],
    rating: product.rating,
    reviewCount: product.reviewCount,
    stock: product.stock,
    sku: product.sku,
    isFeatured: product.isFeatured,
    category: product.category,
    images: product.images
      .map((i) => normalizeMediaSrc(i.url))
      .filter((url) => url.length > 0),
  };
}

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { select: { url: true }, orderBy: { order: "asc" } },
} as const;

export async function getProductBySlug(
  slug: string,
): Promise<ProductDisplay | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  });

  if (!product) return null;

  return toProductDisplay({
    ...product,
    images: product.images,
  });
}
