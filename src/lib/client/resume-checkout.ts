import type { ResumeResult } from "@/lib/checkout/resume";

/** The server's answer, plus the session token to keep when the checkout is still to pay. */
export type ResumeResponse = ResumeResult & { resumeToken?: string };

/**
 * Asks the server where a started checkout stands. `token` is the session
 * token from local storage (the HttpOnly cookie is sent along either way);
 * `link` is a short-lived token that arrived in the URL.
 * Null when the server couldn't be reached or failed: nothing is known then,
 * and the browser keeps what it has.
 */
export async function resumeCheckout(input: { token?: string | null; link?: string | null }): Promise<ResumeResponse | null> {
  try {
    const res = await fetch("/api/checkout/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ token: input.token ?? undefined, link: input.link ?? undefined }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ResumeResponse | null;
    return json && typeof json.status === "string" ? json : null;
  } catch {
    return null;
  }
}

/** Once paid, the server drops its checkout cookie on this browser. Fire-and-forget; survives the page leaving. */
export function forgetCheckoutOnServer(): void {
  try {
    void fetch("/api/checkout/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}
