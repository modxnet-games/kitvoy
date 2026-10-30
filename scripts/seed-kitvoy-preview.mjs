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
      shortDescription: "A cordless inflator with a digital display and air hose.",
      description: "Local review fixture based on the public Kitvoy product listing retrieved October 30, 2026. Not a production stock record.",
      details: "Digital pressure display\nFront-facing controls\nAir hose",
      price: 59.99, shippingTax: 0, compareAtPrice: null, rating: 0, reviewCount: 0,
      stock: 9, sku: "INF-PREVIEW", isFeatured: true, categoryId: category.id,
      images: { create: [{ url: "/kitvoy/inflator-front.png", order: 0, alt: "Cordless tire inflator" }] },
    } });
    console.log("Created kitvoy-local-preview in the local database. Existing products unchanged; no orders created.");
  }
} finally { await prisma.$disconnect(); }
