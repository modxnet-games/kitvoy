/**
 * Sets the inflator's description, short description and details to the
 * supplier-verified copy in src/config/seo.ts.
 *
 *   node --import tsx scripts/apply-verified-product-copy.ts
 */
import "dotenv/config";

import { landingConfig } from "../src/config/landing";
import { verifiedProductCopy } from "../src/config/seo";
import { prisma } from "../src/lib/db";

const UNVERIFIED = /usb-c|\bsos\b|shut(s)? (itself )?off|stops by itself|auto(matic)?[ -]?(shut|stop)|presta|ball-needle|adapters? (are )?included/i;

async function main() {
  const where = { slug: landingConfig.productSlug };
  const before = await prisma.product.findUnique({ where, select: { shortDescription: true, description: true, details: true } });
  if (!before) throw new Error(`No product with slug ${landingConfig.productSlug}`);
  const flagged = (Object.entries(before) as [string, string][]).filter(([, v]) => UNVERIFIED.test(v)).map(([k]) => k);
  console.log("unverified claims before:", flagged.length ? flagged.join(", ") : "none");

  const after = await prisma.product.update({ where, data: verifiedProductCopy, select: { shortDescription: true, description: true, details: true } });
  const left = (Object.values(after) as string[]).some((v) => UNVERIFIED.test(v));
  console.log("updated; unverified claims after:", left ? "STILL PRESENT" : "none");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
