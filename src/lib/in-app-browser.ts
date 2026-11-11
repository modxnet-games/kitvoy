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
