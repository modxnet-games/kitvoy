import { siteConfig } from "@/config/site";

/** The reference a customer and the owner quote for an order: CHR-1A2B3C4D (the end of its id). */
export function orderReferenceOf(id: string): string {
  return `${siteConfig.orderPrefix}-${id.slice(-8).toUpperCase()}`;
}
