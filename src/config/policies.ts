/**
 * Store policy terms. The policy pages, homepage FAQ, product structured data,
 * Merchant Center feed and llms.txt all read these, so change a term here and
 * every place that states it follows.
 */
export const storePolicies = {
  /** Shown on every policy page; update it whenever a policy's wording changes */
  effectiveDate: "November 12, 2026",
  supportEmail: "support@kitvoy.com",
  shipping: {
    /** Business days from payment to handing the order to the carrier */
    processingDays: { min: 1, max: 2 },
    /** Business days in transit once shipped, for US orders; other countries are per product in config/catalog.ts */
    deliveryDays: { min: 4, max: 9 },
    carrier: "CJPacket",
    destinations: "all 50 US states and Washington, DC",
  },
  returns: { windowDays: 30 },
  /** Jurisdiction named in the terms of service */
  governingLaw: "the State of New Mexico, United States",
} as const;

export const policyLinks = [
  { href: "/shipping", label: "Shipping policy" },
  { href: "/returns", label: "Returns & refunds" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of service" },
] as const;

const { processingDays: p, deliveryDays: d } = storePolicies.shipping;

/** "1–2 business days" */
export const processingText = `${p.min}–${p.max} business days`;
/** "4–9 business days" */
export const deliveryText = `${d.min}–${d.max} business days`;
