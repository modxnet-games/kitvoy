import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { toggleReviewVisibility } from "@/lib/data/admin-reviews";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await toggleReviewVisibility(id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Failed to toggle visibility" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to toggle review visibility" },
      { status: 500 },
    );
  }
}
