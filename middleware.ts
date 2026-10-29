import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Matches `/admin/orders/:orderId/print` (optional trailing slash). */
const ADMIN_ORDER_PRINT_PATH = /^\/admin\/orders\/[^/]+\/print\/?$/;

export function middleware(request: NextRequest) {
  if (ADMIN_ORDER_PRINT_PATH.test(request.nextUrl.pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-kitvoy-order-print", "1");
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/orders/:path*"],
};
