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
import { LOCALE_COOKIE, LOCALE_MAX_AGE, isLocale } from "@/lib/i18n";

/** Matches `/admin/orders/:orderId/print` (optional trailing slash). */
const ADMIN_ORDER_PRINT_PATH = /^\/admin\/orders\/[^/]+\/print\/?$/;

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (ADMIN_ORDER_PRINT_PATH.test(pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-store-order-print", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  if (pathname.startsWith("/admin")) {
    // The dashboard renders without the shop around it (app/layout.tsx)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-store-area", "admin");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // A link that names a language (an ad, the header switch without JavaScript): the page renders in it now, and the choice is kept
  const lang = searchParams.get("lang");
  const requestHeaders = new Headers(request.headers);
  // Never trust these headers from outside
  requestHeaders.delete("x-store-lang");
  requestHeaders.delete("x-store-area");
  requestHeaders.delete("x-store-order-print");
  if (isLocale(lang)) requestHeaders.set("x-store-lang", lang);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const secure = request.nextUrl.protocol === "https:";
  if (isLocale(lang)) {
    response.cookies.set(LOCALE_COOKIE, lang, { maxAge: LOCALE_MAX_AGE, path: "/", sameSite: "lax", secure });
  }

  // A visit from an ad: remember which one for 30 days (last click wins), so
  // the order can say which campaign and creative drove it
  const attribution = attributionFromUrl(request.nextUrl);
  if (!attribution) return response;

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
