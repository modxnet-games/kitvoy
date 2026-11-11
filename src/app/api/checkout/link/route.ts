import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { siteConfig } from "@/config/site";
import { presentedSessionToken } from "@/lib/checkout/resume-cookies";
import { HANDOFF_LINK_TTL_MS, RESUME_LINK_PARAM, isOpenOrder } from "@/lib/checkout/resume-token";
import { findCheckoutToken, issueCheckoutToken } from "@/lib/checkout/tokens";

/**
 * POST /api/checkout/link  { token? }
 *
 * A link that opens this checkout's payment step in another browser, for a
 * customer stuck in an in-app browser. Only the browser holding the
 * checkout's session token can ask for one; the link carries its own token,
 * good for 15 minutes, which the other browser exchanges for a session of its
 * own. The session token itself never appears in a URL.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const session = await findCheckoutToken(presentedSessionToken(request, body.token), "session");
  if (!session || !isOpenOrder(session.order)) {
    return NextResponse.json({ error: "checkout.sessionExpired" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const link = await issueCheckoutToken(session.orderId, "link", HANDOFF_LINK_TTL_MS);
  return NextResponse.json(
    { url: `${siteConfig.url.replace(/\/$/, "")}/checkout?${RESUME_LINK_PARAM}=${link}`, expiresInSeconds: HANDOFF_LINK_TTL_MS / 1000 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
