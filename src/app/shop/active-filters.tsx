"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import type { ShopFilters } from "@/lib/data/products";
import type { FilterCategory } from "@/components/storefront/filter-sidebar";
import { useLanguage } from "@/contexts/language-context";
import { buildShopQueryString, mergeShopFilters } from "@/lib/shop-filters";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ActiveFiltersProps {
  filters: ShopFilters;
  categories: FilterCategory[];
  className?: string;
}

export function ActiveFilters({ filters, categories, className }: ActiveFiltersProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const apply = (newFilters: ShopFilters) => {
    const q = buildShopQueryString(newFilters);
    router.push(`/shop${q}`);
  };

  const remove = (update: Partial<ShopFilters>) => {
    apply(mergeShopFilters(filters, update));
  };

  const clearAll = () => apply({});

  const chips: { key: string; label: string; remove: () => void }[] = [];

  if (filters.category) {
    const cat = categories.find((c) => c.slug === filters.category);
    chips.push({
      key: "category",
      label: cat ? cat.name : filters.category,
      remove: () => remove({ category: undefined }),
    });
  }
  if (filters.minPrice != null) {
    chips.push({
      key: "minPrice",
      label: `${t("shop.minPrice")}: ${filters.minPrice}`,
      remove: () => remove({ minPrice: undefined }),
    });
  }
  if (filters.maxPrice != null) {
    chips.push({
      key: "maxPrice",
      label: `${t("shop.maxPrice")}: ${filters.maxPrice}`,
      remove: () => remove({ maxPrice: undefined }),
    });
  }
  if (filters.availability) {
    chips.push({
      key: "availability",
      label:
        filters.availability === "in-stock"
          ? t("shop.inStock")
          : t("shop.outOfStock"),
      remove: () => remove({ availability: undefined }),
    });
  }
  if (filters.rating != null) {
    chips.push({
      key: "rating",
      label: t("shop.starsAndUp", { stars: filters.rating }),
      remove: () => remove({ rating: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        {t("shop.activeFilters")}:
      </span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.remove}
            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
            aria-label={`Remove ${chip.label}`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
      >
        {t("shop.clearAll")}
      </button>
    </div>
  );
}
