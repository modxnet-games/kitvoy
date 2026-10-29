import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { slug: "accessories", name: "Accessories" },
  { slug: "clothing", name: "Clothing" },
  { slug: "footwear", name: "Footwear" },
  { slug: "watches", name: "Watches" },
  { slug: "bags", name: "Bags" },
];

const products = [
  {
    slug: "premium-leather-bag",
    name: "Premium Leather Crossbody Bag",
    shortDescription:
      "Handcrafted full-grain leather crossbody with gold-tone hardware.",
    description:
      "Crafted from supple full-grain leather, this crossbody bag combines timeless elegance with everyday functionality. Features multiple interior pockets and adjustable strap for versatile wear.",
    details:
      "• Full-grain leather\n• Gold-tone hardware\n• Adjustable strap (drop 20-24\")\n• Interior zip pocket\n• Main compartment with magnetic closure",
    price: 189,
    compareAtPrice: 249,
    badge: "Sale",
    rating: 4.8,
    reviewCount: 124,
    stock: 15,
    sku: "BAG-001",
    isFeatured: true,
    categorySlug: "accessories",
    images: ["/placeholder-bag.jpg"],
  },
  {
    slug: "minimalist-leather-watch",
    name: "Minimalist Leather Watch",
    shortDescription: "Slim silhouette with genuine leather strap and Swiss movement.",
    description:
      "Understated design meets precision engineering. Features a slim 40mm case, Swiss quartz movement, and interchangeable genuine leather strap.",
    details:
      "• 40mm stainless steel case\n• Swiss quartz movement\n• Genuine leather strap\n• Water resistant 30m\n• 2-year warranty",
    price: 299,
    compareAtPrice: null,
    badge: "Bestseller",
    rating: 4.9,
    reviewCount: 256,
    stock: 8,
    sku: "WCH-001",
    isFeatured: true,
    categorySlug: "watches",
    images: ["/placeholder-watch.jpg"],
  },
  {
    slug: "cotton-essential-tee",
    name: "Organic Cotton Essential Tee",
    shortDescription: "Ultra-soft 100% organic cotton in a relaxed fit.",
    description:
      "The perfect everyday tee. Made from GOTS-certified organic cotton for exceptional softness and durability. Relaxed fit for all-day comfort.",
    details:
      "• 100% GOTS organic cotton\n• 220gsm weight\n• Relaxed fit\n• Reinforced shoulder seams\n• Pre-shrunk",
    price: 49,
    compareAtPrice: 65,
    badge: "Sale",
    rating: 4.6,
    reviewCount: 89,
    stock: 45,
    sku: "TEE-001",
    isFeatured: true,
    categorySlug: "clothing",
    images: ["/placeholder-tee.jpg"],
  },
  {
    slug: "classic-leather-sneakers",
    name: "Classic Leather Sneakers",
    shortDescription: "Handcrafted white leather sneakers with vulcanized sole.",
    description:
      "Timeless white leather sneakers built for comfort and longevity. Features a vulcanized rubber sole and cushioned insole for all-day wear.",
    details:
      "• Full-grain leather upper\n• Vulcanized rubber sole\n• Cushioned EVA insole\n• Lace-up closure\n• Perforated lining",
    price: 129,
    compareAtPrice: null,
    badge: "New",
    rating: 4.7,
    reviewCount: 167,
    stock: 22,
    sku: "SHO-001",
    isFeatured: true,
    categorySlug: "footwear",
    images: ["/placeholder-sneakers.jpg"],
  },
  {
    slug: "structured-tote-bag",
    name: "Structured Leather Tote",
    shortDescription: "Spacious tote with clean lines and top-zip closure.",
    description:
      "A roomy everyday tote with structured silhouette. Perfect for work or weekend. Features top zip, interior pockets, and durable leather construction.",
    details:
      "• Smooth leather\n• Top zip closure\n• 2 interior pockets\n• Removable shoulder strap\n• 15\" x 12\" x 4\"",
    price: 245,
    compareAtPrice: null,
    badge: null,
    rating: 4.5,
    reviewCount: 43,
    stock: 12,
    sku: "BAG-002",
    isFeatured: false,
    categorySlug: "bags",
    images: ["/placeholder-tote.jpg"],
  },
  {
    slug: "wool-blend-coat",
    name: "Wool Blend Overcoat",
    shortDescription: "Tailored overcoat in premium Italian wool blend.",
    description:
      "Classic overcoat crafted from a luxurious wool blend. Tailored fit with notch lapels, single-breasted closure, and fully lined interior.",
    details:
      "• 70% wool, 30% polyester\n• Full lining\n• Notch lapel\n• Single-breasted\n• Hidden pockets",
    price: 425,
    compareAtPrice: 499,
    badge: "Sale",
    rating: 4.9,
    reviewCount: 78,
    stock: 6,
    sku: "COA-001",
    isFeatured: true,
    categorySlug: "clothing",
    images: ["/placeholder-coat.jpg"],
  },
  {
    slug: "silk-scarf",
    name: "Printed Silk Scarf",
    shortDescription: "Lightweight 100% mulberry silk with hand-rolled edges.",
    description:
      "An artful accessory that elevates any outfit. Featuring a bold floral print on pure mulberry silk with hand-rolled hem.",
    details: "• 100% mulberry silk\n• Hand-rolled edges\n• 34\" x 34\"\n• Dry clean only",
    price: 98,
    compareAtPrice: null,
    badge: "New",
    rating: 4.7,
    reviewCount: 34,
    stock: 28,
    sku: "ACC-001",
    isFeatured: false,
    categorySlug: "accessories",
    images: ["/placeholder-scarf.jpg"],
  },
  {
    slug: "leather-ankle-boots",
    name: "Leather Ankle Boots",
    shortDescription: "Chelsea-style boots in soft suede with elastic gussets.",
    description:
      "Versatile Chelsea boots in buttery soft suede. Easy slip-on design with side elastic gussets and durable rubber sole.",
    details:
      "• Suede upper\n• Elastic side gussets\n• Rubber sole\n• Cushioned footbed\n• Pull tab",
    price: 185,
    compareAtPrice: null,
    badge: null,
    rating: 4.6,
    reviewCount: 92,
    stock: 11,
    sku: "SHO-002",
    isFeatured: false,
    categorySlug: "footwear",
    images: ["/placeholder-boots.jpg"],
  },
  {
    slug: "champagne-dial-watch",
    name: "Champagne Dial Dress Watch",
    shortDescription: "Elegant dress watch with champagne dial and mesh bracelet.",
    description:
      "Refined dress watch with a warm champagne dial and matching stainless steel mesh bracelet. Ideal for formal occasions.",
    details:
      "• 38mm case\n• Mineral crystal\n• Japanese automatic movement\n• Mesh bracelet\n• 50m water resistance",
    price: 349,
    compareAtPrice: null,
    badge: null,
    rating: 4.8,
    reviewCount: 56,
    stock: 4,
    sku: "WCH-002",
    isFeatured: false,
    categorySlug: "watches",
    images: ["/placeholder-dresswatch.jpg"],
  },
];

async function main() {
  const categoryIds: Record<string, string> = {};

  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: {},
    });
    categoryIds[c.slug] = cat.id;
  }

  for (const p of products) {
    const { categorySlug, images, ...productData } = p;
    const categoryId = categoryIds[categorySlug];
    if (!categoryId) throw new Error(`Category not found: ${categorySlug}`);

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        ...productData,
        categoryId,
        images: {
          create: images.map((url, i) => ({ url, order: i })),
        },
      },
      update: {},
    });

    const existingImages = await prisma.productImage.count({
      where: { productId: product.id },
    });
    if (existingImages === 0) {
      await prisma.productImage.createMany({
        data: images.map((url, i) => ({
          productId: product.id,
          url,
          order: i,
        })),
      });
    }
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
