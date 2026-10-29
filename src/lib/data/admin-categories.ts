import { prisma } from "@/lib/db";

export type AdminCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  showInMenu: boolean;
  createdAt: Date;
  _count: { products: number };
};

export async function getAllAdminCategories(): Promise<AdminCategoryListItem[]> {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export type AdminCategoryDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  showInMenu: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAdminCategoryById(
  id: string
): Promise<AdminCategoryDetail | null> {
  return prisma.category.findUnique({
    where: { id },
  });
}

export async function createCategory(data: {
  name: string;
  slug: string;
  description: string | null;
  showInMenu?: boolean;
}) {
  return prisma.category.create({
    data: {
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      description: data.description?.trim() || null,
      showInMenu: data.showInMenu ?? true,
    },
  });
}

export async function updateCategory(
  id: string,
  data: { name: string; slug: string; description: string | null; showInMenu?: boolean }
) {
  return prisma.category.update({
    where: { id },
    data: {
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      description: data.description?.trim() || null,
      ...(typeof data.showInMenu === "boolean" ? { showInMenu: data.showInMenu } : {}),
    },
  });
}

/** Returns product count for the category. */
export async function getCategoryProductCount(categoryId: string): Promise<number> {
  return prisma.product.count({ where: { categoryId } });
}

/**
 * Deletes a category only if it has no products. Returns an error key if deletion is blocked.
 */
export async function deleteCategory(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const count = await getCategoryProductCount(id);
  if (count > 0) {
    return {
      ok: false,
      error: "CATEGORY_IN_USE",
    };
  }
  await prisma.category.delete({ where: { id } });
  return { ok: true };
}

/** Check if a slug is taken by another category (optionally excluding an id for updates). */
export async function isSlugTaken(
  slug: string,
  excludeCategoryId?: string
): Promise<boolean> {
  const normalized = slug.trim().toLowerCase();
  const existing = await prisma.category.findFirst({
    where: {
      slug: normalized,
      ...(excludeCategoryId ? { id: { not: excludeCategoryId } } : {}),
    },
  });
  return !!existing;
}

/** Slugify a category name for URL-safe slug. */
function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Find a category by name (slug) or create it if it doesn't exist.
 * Returns the category id. Use from product form to allow "type new category".
 */
export async function findOrCreateCategoryByName(name: string): Promise<{ id: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Category name is required");
  }
  const slug = slugifyName(trimmed);
  if (!slug) {
    throw new Error("Category name must contain at least one letter or number");
  }
  const existing = await prisma.category.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (existing) return { id: existing.id };
  const created = await prisma.category.create({
    data: { name: trimmed, slug, description: null },
    select: { id: true },
  });
  return { id: created.id };
}
