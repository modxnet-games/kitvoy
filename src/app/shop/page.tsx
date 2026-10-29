import { getAllCategories } from "@/lib/data/categories";
import { getShopProducts } from "@/lib/data/products";
import { parseShopSearchParams } from "@/lib/shop-filters";

import { ShopClient } from "./shop-client";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseShopSearchParams(params ?? {});

  const [products, categories] = await Promise.all([
    getShopProducts(filters),
    getAllCategories(),
  ]);

  const categoryForFilter = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    _count: c._count,
  }));

  return (
    <ShopClient
      products={products}
      categories={categoryForFilter}
      initialFilters={filters}
    />
  );
}
