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

export async function getAllProducts(sortBy?: string): Promise<ProductDisplay[]> {
  const orderBy =
    sortBy === "price-asc"
      ? { price: "asc" as const }
      : sortBy === "price-desc"
        ? { price: "desc" as const }
        : sortBy === "newest"
          ? { createdAt: "desc" as const }
          : sortBy === "rating"
            ? { rating: "desc" as const }
            : { isFeatured: "desc" as const };

  const products = await prisma.product.findMany({
    include: productInclude,
    orderBy,
  });

  return products.map((p) =>
    toProductDisplay({
      ...p,
      images: p.images,
    }),
  );
}

export async function getFeaturedProducts(): Promise<ProductDisplay[]> {
  const products = await prisma.product.findMany({
    where: { isFeatured: true },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });

  return products.map((p) =>
    toProductDisplay({
      ...p,
      images: p.images,
    }),
  );
}

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

export async function getAllProductSlugs(): Promise<{ slug: string }[]> {
  try {
    const products = await prisma.product.findMany({
      select: { slug: true },
    });
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export interface ShopFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: "in-stock" | "out-of-stock";
  rating?: number;
  sort?: string;
}

export async function getShopProducts(
  filters: ShopFilters = {},
): Promise<ProductDisplay[]> {
  const {
    category: categorySlug,
    minPrice,
    maxPrice,
    availability,
    rating,
    sort: sortBy = "featured",
  } = filters;

  const where: NonNullable<Parameters<typeof prisma.product.findMany>[0]>["where"] = {};

  if (categorySlug?.trim()) {
    where.category = { slug: categorySlug.trim() };
  }

  const priceConditions: { gte?: number; lte?: number } = {};
  if (minPrice != null && !Number.isNaN(minPrice) && minPrice > 0) {
    priceConditions.gte = minPrice;
  }
  if (maxPrice != null && !Number.isNaN(maxPrice) && maxPrice > 0) {
    priceConditions.lte = maxPrice;
  }
  if (Object.keys(priceConditions).length > 0) {
    where.price = priceConditions;
  }

  if (availability === "in-stock") {
    where.stock = { gt: 0 };
  } else if (availability === "out-of-stock") {
    where.stock = 0;
  }

  if (rating != null && !Number.isNaN(rating) && rating >= 1 && rating <= 5) {
    where.rating = { gte: rating };
  }

  const orderBy =
    sortBy === "price-asc"
      ? { price: "asc" as const }
      : sortBy === "price-desc"
        ? { price: "desc" as const }
        : sortBy === "newest"
          ? { createdAt: "desc" as const }
          : sortBy === "rating"
            ? { rating: "desc" as const }
            : { isFeatured: "desc" as const };

  const products = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy,
  });

  return products.map((p) =>
    toProductDisplay({
      ...p,
      images: p.images,
    }),
  );
}

export async function getRelatedProducts(
  product: ProductDisplay,
  limit = 4,
): Promise<ProductDisplay[]> {
  const sameCategory = await prisma.product.findMany({
    where: {
      categoryId: product.category.id,
      id: { not: product.id },
      stock: { gt: 0 },
    },
    include: productInclude,
    take: limit,
  });

  const needed = limit - sameCategory.length;
  if (needed <= 0) {
    return sameCategory.map((p) =>
      toProductDisplay({ ...p, images: p.images }),
    );
  }

  const others = await prisma.product.findMany({
    where: {
      id: { notIn: [product.id, ...sameCategory.map((p) => p.id)] },
      stock: { gt: 0 },
    },
    include: productInclude,
    take: needed,
  });

  return [...sameCategory, ...others].map((p) =>
    toProductDisplay({ ...p, images: p.images }),
  );
}
