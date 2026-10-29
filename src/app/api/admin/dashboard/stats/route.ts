import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { getOrderStats } from "@/lib/data/admin-orders";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getOrderStats();

    // Calculate revenue (sum of total for delivered orders)
    let revenue = 0;
    try {
      const agg = await prisma.order.aggregate({
        where: { status: "DELIVERED" },
        _sum: { total: true },
      });
      revenue = agg._sum.total ?? 0;
    } catch {
      // Order table may not exist yet
    }

    return NextResponse.json({ ...stats, revenue });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
