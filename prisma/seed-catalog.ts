/**
 * Creates the database rows for the catalog products that use the shared page
 * template (config/catalog.ts + config/products/*): the category, the product
 * and its gallery images.
 *
 *   npx tsx prisma/seed-catalog.ts            dry run: prints what it would do
 *   npx tsx prisma/seed-catalog.ts --apply    writes
 *
 * Safe to run more than once and on a live database: it only ever ADDS. A
 * product that already exists is left exactly as it is (price, stock, copy and
 * images are then the admin's), unless --refresh-copy is passed, which
 * rewrites that product's name and descriptions from the config and nothing
 * else. It never deletes, never touches orders, and never touches any product
 * outside the catalog.
 *
 * On a database that isn't on this machine it refuses to write without
 * --allow-remote, so a production run is always a deliberate one. The
 * OrderItem.variantKey column must exist first (`prisma db push`, additive).
 */
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { getCatalogProduct } from "../src/config/catalog";
import { productContents } from "../src/config/products";

loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const refreshCopy = args.has("--refresh-copy");
const allowRemote = args.has("--allow-remote");

async function main() {
  const dbUrl = new URL(process.env.DATABASE_URL || "file:///missing");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(dbUrl.hostname);
  console.log(`Database: ${dbUrl.hostname}${dbUrl.pathname} (${local ? "local" : "REMOTE"}) · ${apply ? "APPLY" : "dry run"}`);
  if (apply && !local && !allowRemote) {
    throw new Error("This database is not on this machine. Re-run with --allow-remote if that is intended.");
  }

  const prisma = new PrismaClient();
  try {
    for (const content of productContents) {
      const entry = getCatalogProduct(content.slug);
      if (!entry) {
        console.log(`- ${content.slug}: not in config/catalog.ts, skipped`);
        continue;
      }
      const db = content.database;
      const copy = { name: db.name, shortDescription: db.shortDescription, description: db.description, details: db.details };

      const existing = await prisma.product.findUnique({ where: { slug: content.slug }, include: { images: true } });
      if (existing) {
        console.log(`- ${content.slug}: exists (price ${existing.price}, stock ${existing.stock}, ${existing.images.length} images)`);
        if (refreshCopy) {
          console.log(`  ${apply ? "refreshing" : "would refresh"} name and descriptions from the config`);
          if (apply) await prisma.product.update({ where: { id: existing.id }, data: { ...copy, contentUpdatedAt: new Date() } });
        }
        if (existing.images.length === 0) {
          console.log(`  ${apply ? "adding" : "would add"} ${content.gallery.length} gallery images`);
          if (apply) {
            await prisma.productImage.createMany({
              data: content.gallery.map((image, order) => ({ productId: existing.id, url: image.src, alt: image.alt, order })),
            });
          }
        }
        continue;
      }

      console.log(`- ${content.slug}: ${apply ? "creating" : "would create"} "${db.name}" at $${db.price}, stock ${db.stock}, SKU ${db.sku}, category "${db.categoryName}", ${content.gallery.length} images`);
      console.log(`  colours → CJ variants: ${entry.variants.map((v) => `${v.label} = ${v.cj.sku} (vid ${v.cj.vid})`).join("; ")}`);
      if (!apply) continue;

      const category = await prisma.category.upsert({
        where: { slug: db.categorySlug },
        create: { slug: db.categorySlug, name: db.categoryName },
        update: {},
      });
      await prisma.product.create({
        data: {
          slug: content.slug,
          ...copy,
          price: db.price,
          shippingTax: 0,
          // No "was" price and no rating: there is no former price and there are no reviews
          compareAtPrice: null,
          rating: 0,
          reviewCount: 0,
          stock: db.stock,
          sku: db.sku,
          isFeatured: false,
          categoryId: category.id,
          contentUpdatedAt: new Date(),
          images: { create: content.gallery.map((image, order) => ({ url: image.src, alt: image.alt, order })) },
        },
      });
    }
    console.log(apply ? "Done." : "Dry run only. Pass --apply to write.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
