/**
 * Meta's in-app browsers (the web views inside Facebook, Messenger, Instagram
 * and Threads). They reload or discard pages when the app goes to the
 * background and can't keep a pop-up connected to the page that opened it, so
 * checkout treats them differently.
 */
export type InAppBrowser = "facebook" | "instagram" | "threads";

export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  const ua = userAgent ?? "";
  // Threads identifies itself as Barcelona (and often as Instagram too), so it goes first
  if (/Barcelona/i.test(ua)) return "threads";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  return null;
}

export const inAppBrowserName: Record<InAppBrowser, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
};

/**
 * A URL that asks the phone to open an https page in its real browser instead
 * of the in-app one. Android understands an intent: link (with the page itself
 * as the fallback); iOS opens x-safari-https: links in Safari. Anything else
 * gets the plain URL back.
 */
export function externalBrowserUrl(httpsUrl: string, userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  let url: URL;
  try {
    url = new URL(httpsUrl);
  } catch {
    return httpsUrl;
  }
  if (url.protocol !== "https:") return httpsUrl;
  if (/Android/i.test(ua)) {
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
  }
  if (/iPhone|iPad|iPod/i.test(ua)) return `x-safari-${httpsUrl}`;
  return httpsUrl;
}
