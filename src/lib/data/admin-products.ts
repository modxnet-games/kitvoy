import { prisma } from "@/lib/db";
import { normalizeMediaSrc } from "@/lib/media-url";
import type { OrderStatus } from "@prisma/client";

function sanitizeImageUrls(urls: string[]) {
  return urls
    .map((u) => normalizeMediaSrc(u.trim()))
    .filter((u) => u.length > 0);
}

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { select: { id: true, url: true, alt: true, order: true }, orderBy: { order: "asc" } },
} as const;

export type AdminProductWithRelations = Awaited<
  ReturnType<typeof getAdminProductById>
> extends infer T
  ? T extends null
    ? never
    : T
  : never;

const CONFIRMED_STATUS: OrderStatus = "CONFIRMED";

async function getConfirmedOrdersQuantityByProductIds(
  productIds: string[],
): Promise<Map<string, number>> {
  const safeIds = productIds.filter(Boolean);
  if (safeIds.length === 0) return new Map();

  const groups = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: safeIds },
      order: { status: CONFIRMED_STATUS },
    },
    _sum: { quantity: true },
  });

  const map = new Map<string, number>();
  for (const g of groups) {
    const pid = g.productId;
    if (!pid) continue;
    map.set(pid, g._sum.quantity ?? 0);
  }
  return map;
}

export async function getAllAdminProducts() {
  const products = await prisma.product.findMany({
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });

  const productIds = products.map((p) => p.id);
  const confirmedQtyMap = await getConfirmedOrdersQuantityByProductIds(productIds);

  return products.map((p) => ({
    ...p,
    ordersCount: confirmedQtyMap.get(p.id) ?? 0,
  }));
}

export async function getAdminProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });

  if (!product) return null;

  const agg = await prisma.orderItem.aggregate({
    where: {
      productId: id,
      order: { status: CONFIRMED_STATUS },
    },
    _sum: { quantity: true },
  });

  return {
    ...product,
    ordersCount: agg._sum.quantity ?? 0,
  };
}

export async function createProduct(data: {
  name: string;
  slug: string;
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
  categoryId: string;
  imageUrls: string[];
}) {
  const { imageUrls, ...productData } = data;
  const cleanUrls = sanitizeImageUrls(imageUrls);
  return prisma.product.create({
    data: {
      ...productData,
      images: {
        create: cleanUrls.map((url, index) => ({ url, order: index })),
      },
    },
    include: productInclude,
  });
}

export async function updateProduct(
  id: string,
  data: {
    name: string;
    slug: string;
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
    categoryId: string;
    imageUrls: string[];
  }
) {
  const { imageUrls, ...productData } = data;
  const validUrls = sanitizeImageUrls(imageUrls);

  await prisma.$transaction([
    prisma.productImage.deleteMany({ where: { productId: id } }),
    prisma.product.update({
      where: { id },
      data: {
        ...productData,
        images: {
          create: validUrls.map((url, index) => ({
            url,
            order: index,
          })),
        },
      },
    }),
  ]);

  return getAdminProductById(id);
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({
    where: { id },
  });
}
