"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ProductDisplay } from "@/types/product";
import type { ShopFilters } from "@/lib/data/products";
import { useLanguage } from "@/contexts/language-context";
import type { FilterCategory } from "@/components/storefront/filter-sidebar";
import { parseShopSearchParams, buildShopQueryString } from "@/lib/shop-filters";
import {
  Breadcrumbs,
  FilterDrawer,
  ProductCard,
  ProductGrid,
  SortDropdown,
} from "@/components/storefront";
import { FilterSidebar } from "@/components/storefront/filter-sidebar";
import { ActiveFilters } from "./active-filters";

interface ShopClientProps {
  products: ProductDisplay[];
  categories: FilterCategory[];
  initialFilters?: ShopFilters;
}

export function ShopClient({
  products,
  categories,
}: ShopClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return parseShopSearchParams(params);
  }, [searchParams]);

  const sortValue = filters.sort ?? "featured";

  const applyFilters = (newFilters: ShopFilters) => {
    const q = buildShopQueryString(newFilters);
    router.push(`/shop${q}`);
  };

  const handleFiltersChange = (newFilters: ShopFilters) => {
    applyFilters(newFilters);
  };

  const handleClearAllFilters = () => {
    applyFilters({});
  };

  const handleSortChange = (sort: string) => {
    applyFilters({ ...filters, sort: sort || undefined });
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <Breadcrumbs items={[{ label: t("shop.title") }]} className="mb-6" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          {t("shop.title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          {t("shop.subtitle")}
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {t(
            products.length === 1 ? "shop.productsCount" : "shop.productsCountPlural",
            { count: products.length },
          )}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex lg:hidden">
            <FilterDrawer
              categories={categories}
              productCount={products.length}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearAll={handleClearAllFilters}
            />
          </div>
          <SortDropdown
            value={sortValue}
            onValueChange={handleSortChange}
            placeholder={t("shop.sortBy")}
          />
        </div>
      </div>

      {/* Active filters */}
      <ActiveFilters
        filters={filters}
        categories={categories}
        className="mb-4"
      />

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 rounded-lg border bg-card p-4">
            <FilterSidebar
              categories={categories}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearAll={handleClearAllFilters}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {products.length > 0 ? (
            <ProductGrid>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ProductGrid>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
              <p className="text-muted-foreground">
                {t("empty.noProducts")}
              </p>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="mt-3 text-sm font-medium text-primary underline"
              >
                {t("shop.clearFilters")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
