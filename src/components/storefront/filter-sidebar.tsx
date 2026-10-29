"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { ShopFilters } from "@/lib/data/products";
import { useLanguage } from "@/contexts/language-context";
import { mergeShopFilters } from "@/lib/shop-filters";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b py-4 first:pt-0 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm font-medium"
      >
        {title}
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

export interface FilterCategory {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
}

interface FilterSidebarProps {
  categories?: FilterCategory[];
  filters: ShopFilters;
  onFiltersChange: (filters: ShopFilters) => void;
  onClearAll: () => void;
  className?: string;
}

export function FilterSidebar({
  categories = [],
  filters,
  onFiltersChange,
  onClearAll,
  className,
}: FilterSidebarProps) {
  const { t } = useLanguage();

  const setFilter = (update: Partial<ShopFilters>) => {
    onFiltersChange(mergeShopFilters(filters, update));
  };

  const hasAnyFilter =
    filters.category ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.availability ||
    filters.rating != null;

  return (
    <aside className={cn("space-y-1", className)}>
      <h3 className="mb-4 text-sm font-semibold">{t("shop.filters")}</h3>

      <FilterSection title={t("shop.category")}>
        {categories.map((cat) => (
          <label
            key={cat.id}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={filters.category === cat.slug}
              onCheckedChange={(checked) =>
                setFilter({ category: checked ? cat.slug : undefined })
              }
            />
            <span>{cat.name}</span>
            {cat._count?.products != null && (
              <span className="text-muted-foreground">({cat._count.products})</span>
            )}
          </label>
        ))}
      </FilterSection>

      <Separator />

      <FilterSection title={t("shop.priceRange")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step={10}
            placeholder={t("shop.minPrice")}
            className="h-8 text-sm"
            value={filters.minPrice ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setFilter({ minPrice: v === "" ? undefined : Number(v) });
            }}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            min={0}
            step={10}
            placeholder={t("shop.maxPrice")}
            className="h-8 text-sm"
            value={filters.maxPrice ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setFilter({ maxPrice: v === "" ? undefined : Number(v) });
            }}
          />
        </div>
      </FilterSection>

      <Separator />

      <FilterSection title={t("shop.availability")}>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={filters.availability === "in-stock"}
            onCheckedChange={(checked) =>
              setFilter({
                availability:
                  checked ? "in-stock" : filters.availability === "in-stock" ? undefined : filters.availability,
              })
            }
          />
          <span>{t("shop.inStock")}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={filters.availability === "out-of-stock"}
            onCheckedChange={(checked) =>
              setFilter({
                availability:
                  checked ? "out-of-stock" : filters.availability === "out-of-stock" ? undefined : filters.availability,
              })
            }
          />
          <span>{t("shop.outOfStock")}</span>
        </label>
      </FilterSection>

      <Separator />

      <FilterSection title={t("shop.rating")}>
        {[4, 3, 2].map((stars) => (
          <label
            key={stars}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={filters.rating === stars}
              onCheckedChange={(checked) =>
                setFilter({ rating: checked ? stars : undefined })
              }
            />
            <span>{t("shop.starsAndUp", { stars })}</span>
          </label>
        ))}
      </FilterSection>

      {hasAnyFilter && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={onClearAll}
        >
          {t("shop.clearFilters")}
        </Button>
      )}
    </aside>
  );
}
