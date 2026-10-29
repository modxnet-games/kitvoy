import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeMediaSrc } from "@/lib/media-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      images: { select: { url: true }, orderBy: { order: "asc" }, take: 1 },
    },
    take: 8,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      image: normalizeMediaSrc(p.images[0]?.url) || null,
    }))
  );
}
