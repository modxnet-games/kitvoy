/**
 * Store policy terms. The policy pages, the product page (trust row, FAQ) and
 * the structured data all read these, so change a term here and every place
 * that states it follows. The wording itself is in config/policy-content.ts.
 */
export const storePolicies = {
  /** Shown on every policy page (YYYY-MM-DD); update it whenever a policy's wording changes */
  effectiveDate: "2026-11-22",
  /** Free delivery everywhere in Morocco, counted from the confirmation call */
  delivery: { hours: { min: 24, max: 72 }, free: true },
  /** A size can be swapped within this many days of delivery, unworn */
  exchange: { windowDays: 7 },
} as const;

export const policyLinks = [
  { href: "/shipping", key: "shipping" },
  { href: "/returns", key: "returns" },
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
] as const;

export type PolicyKey = (typeof policyLinks)[number]["key"];
