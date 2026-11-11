import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resumeCheckout } from "@/lib/checkout/resume";
import { clearResumeCookies, isSecureRequest, presentedSessionToken, setResumeCookies } from "@/lib/checkout/resume-cookies";
import { isCheckoutToken } from "@/lib/checkout/resume-token";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/checkout/resume  { token?, link?, clear? }
 *
 * Where a started checkout stands, for the browser that holds its token: the
 * session token (sent explicitly or as the HttpOnly cookie) or a short-lived
 * link token from a URL, which is exchanged for a session here. An order's
 * details are only ever returned to a valid token, never to an order reference.
 *
 * `clear` forgets the checkout on this browser once it has been paid.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; link?: unknown; clear?: unknown };

  if (body.clear === true) {
    const response = NextResponse.json({ status: "none" }, { headers: noStore });
    clearResumeCookies(response);
    return response;
  }

  const link = isCheckoutToken(body.link) ? body.link : null;
  const session = presentedSessionToken(request, body.token);
  if (!link && !session) {
    const response = NextResponse.json({ status: "none" }, { headers: noStore });
    clearResumeCookies(response);
    return response;
  }

  try {
    const { result, sessionToken } = await resumeCheckout({ session, link });
    const pending = result.status === "pending" && sessionToken;
    const response = NextResponse.json(pending ? { ...result, resumeToken: sessionToken } : result, { headers: noStore });
    if (pending) setResumeCookies(response, sessionToken, isSecureRequest(request));
    else clearResumeCookies(response);
    return response;
  } catch (err) {
    console.error("[checkout/resume] failed:", err instanceof Error ? err.message : err);
    // The browser keeps its token and tries again on the next load
    return NextResponse.json({ error: "RESUME_FAILED" }, { status: 500, headers: noStore });
  }
}
