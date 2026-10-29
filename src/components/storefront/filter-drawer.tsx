"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

import type { FilterCategory } from "./filter-sidebar";
import type { ShopFilters } from "@/lib/data/products";
import { FilterSidebar } from "./filter-sidebar";

interface FilterDrawerProps {
  categories?: FilterCategory[];
  productCount?: number;
  filters: ShopFilters;
  onFiltersChange: (filters: ShopFilters) => void;
  onClearAll: () => void;
}

export function FilterDrawer({
  categories = [],
  productCount,
  filters,
  onFiltersChange,
  onClearAll,
}: FilterDrawerProps) {
  const { t } = useLanguage();
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2 text-sm">
            <SlidersHorizontal className="size-4" />
            {t("shop.filters")}
            {productCount != null && (
              <span className="text-muted-foreground">({productCount})</span>
            )}
          </Button>
        }
      />
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("shop.filters")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 px-1">
          <FilterSidebar
            categories={categories}
            filters={filters}
            onFiltersChange={onFiltersChange}
            onClearAll={onClearAll}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
