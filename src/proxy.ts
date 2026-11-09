import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  FBC_MAX_AGE,
  attributionFromUrl,
  buildFbc,
  serializeAttribution,
  validFbc,
} from "@/lib/analytics/attribution";

/** Matches `/admin/orders/:orderId/print` (optional trailing slash). */
const ADMIN_ORDER_PRINT_PATH = /^\/admin\/orders\/[^/]+\/print\/?$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ADMIN_ORDER_PRINT_PATH.test(pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-kitvoy-order-print", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // A visit from an ad: remember which one for 30 days (last click wins), so
  // the order can say which campaign and creative drove it
  const attribution = pathname.startsWith("/admin") ? null : attributionFromUrl(request.nextUrl);
  if (!attribution) return NextResponse.next();

  const response = NextResponse.next();
  const secure = request.nextUrl.protocol === "https:";
  response.cookies.set(ATTRIBUTION_COOKIE, serializeAttribution(attribution), {
    maxAge: ATTRIBUTION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure,
  });
  // Meta's click cookie, set here in case the pixel is blocked or opted out of;
  // the pixel writes the same value when it runs
  if (attribution.fbclid && !validFbc(request.cookies.get("_fbc")?.value)) {
    response.cookies.set("_fbc", buildFbc(attribution.fbclid, attribution.fbclidAt ?? Date.now()), {
      maxAge: FBC_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure,
    });
  }
  return response;
}

export const config = {
  // Pages only: not the API, Next's assets, uploads or files with an extension
  matcher: ["/((?!api|_next/static|_next/image|uploads|.*\\..*).*)"],
};
