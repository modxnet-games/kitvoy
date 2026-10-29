import { prisma } from "@/lib/db";

export async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });
}

export interface CategoryNavItem {
  name: string;
  slug: string;
}

export async function getCategoriesForNav(): Promise<CategoryNavItem[]> {
  try {
    return prisma.category.findMany({
      where: { showInMenu: true },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}
