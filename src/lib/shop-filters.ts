import type { ShopFilters } from "@/lib/data/products";

const SORT_VALUES = ["featured", "price-asc", "price-desc", "newest", "rating"] as const;
const AVAILABILITY_VALUES = ["in-stock", "out-of-stock"] as const;

export type SortValue = (typeof SORT_VALUES)[number];

export function parseShopSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): ShopFilters & { sort?: string } {
  const category = getSingle(searchParams.category);
  const minPrice = parseNum(getSingle(searchParams.minPrice));
  const maxPrice = parseNum(getSingle(searchParams.maxPrice));
  const availability = getSingle(searchParams.availability);
  const rating = parseNum(getSingle(searchParams.rating));
  const sort = getSingle(searchParams.sort);

  return {
    ...(category ? { category } : {}),
    ...(minPrice != null ? { minPrice } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(availability && AVAILABILITY_VALUES.includes(availability as "in-stock" | "out-of-stock")
      ? { availability: availability as "in-stock" | "out-of-stock" }
      : {}),
    ...(rating != null && rating >= 1 && rating <= 5 ? { rating } : {}),
    ...(sort && SORT_VALUES.includes(sort as SortValue) ? { sort } : {}),
  };
}

function getSingle(
  value: string | string[] | undefined,
): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseNum(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function buildShopSearchParams(filters: ShopFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.rating != null) params.set("rating", String(filters.rating));
  if (filters.sort) params.set("sort", filters.sort);
  return params;
}

export function buildShopQueryString(filters: ShopFilters): string {
  const params = buildShopSearchParams(filters);
  const q = params.toString();
  return q ? `?${q}` : "";
}

/** Merge current filters with a partial update; remove keys set to undefined. */
export function mergeShopFilters(
  current: ShopFilters,
  update: Partial<ShopFilters>,
): ShopFilters {
  const next = { ...current };
  for (const key of Object.keys(update) as (keyof ShopFilters)[]) {
    const v = update[key];
    if (v === undefined || v === "") {
      delete next[key];
    } else {
      (next as Record<string, unknown>)[key] = v;
    }
  }
  return next;
}
