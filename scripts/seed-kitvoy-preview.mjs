import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
const url = new URL(process.env.DATABASE_URL || "file:///missing");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || process.env.NODE_ENV === "production") {
  throw new Error("Preview seed is restricted to a local development database.");
}
const prisma = new PrismaClient();
try {
  const existing = await prisma.product.findUnique({ where: { slug: "cordless-tire-inflator" } });
  if (existing) {
    console.log("Inflator already exists; no changes made.");
  } else {
    const category = await prisma.category.upsert({ where: { slug: "car-accessories" }, create: { slug: "car-accessories", name: "Car Accessories" }, update: {} });
    await prisma.product.create({ data: {
      id: "kitvoy-local-preview", slug: "cordless-tire-inflator", name: "Cordless Tire Inflator",
      // Same verified copy as src/config/seo.ts (verifiedProductCopy)
      shortDescription: "A compact cordless tire inflator with a digital pressure gauge, an integrated LED light and USB charging.",
      description: "Keep a compact tire inflator in the car for low-pressure mornings. The digital pressure gauge shows the reading while you inflate, the integrated LED light helps at night, and it recharges with the included USB charging cable. 80 W of power in an ABS housing that weighs just 610 g.",
      details: "• 80 W power\n• ABS housing\n• Digital pressure gauge\n• Integrated LED light\n• USB charging cable\n• Compact 610 g weight",
      price: 59.99, shippingTax: 0, compareAtPrice: null, rating: 0, reviewCount: 0,
      stock: 9, sku: "INF-PREVIEW", isFeatured: true, categoryId: category.id,
      images: { create: [{ url: "/kitvoy/inflator.jpg", order: 0, alt: "Cordless tire inflator" }] },
    } });
    console.log("Created kitvoy-local-preview in the local database. Existing products unchanged; no orders created.");
  }
} finally { await prisma.$disconnect(); }
