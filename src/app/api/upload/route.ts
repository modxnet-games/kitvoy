import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth/admin-session";
import {
  uploadProductImage,
  uploadHomepageImage,
  uploadCategoryImage,
} from "@/lib/upload";

const ALLOWED_TYPES = new Set(["product", "banner", "category"]);

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = ((formData.get("type") as string) || "product").toLowerCase();

    if (!file || !file.size) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { error: "Invalid type. Use product, banner, or category." },
        { status: 400 },
      );
    }

    let result: Awaited<ReturnType<typeof uploadProductImage>>;
    switch (type) {
      case "banner":
        result = await uploadHomepageImage(file);
        break;
      case "category":
        result = await uploadCategoryImage(file);
        break;
      default:
        result = await uploadProductImage(file);
        break;
    }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
