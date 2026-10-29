"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/language-context";

const SORT_OPTIONS = [
  { value: "featured", labelKey: "shop.sortFeatured" },
  { value: "price-asc", labelKey: "shop.sortPriceAsc" },
  { value: "price-desc", labelKey: "shop.sortPriceDesc" },
  { value: "newest", labelKey: "shop.sortNewest" },
  { value: "rating", labelKey: "shop.sortRating" },
] as const;

interface SortDropdownProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}

export function SortDropdown({
  value = "featured",
  onValueChange,
  placeholder = "Sort by",
}: SortDropdownProps) {
  const { t } = useLanguage();
  const handleChange = (v: string | null, _eventDetails: unknown) => {
    if (v) onValueChange?.(v);
  };

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      defaultValue="featured"
    >
      <SelectTrigger className="w-[160px] text-sm sm:w-[180px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
