const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format price in US Dollars ($) */
export function formatPrice(price: number): string {
  return usdFormatter.format(price);
}

/** Format a date for US display (e.g. "Oct 29, 2026") */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
