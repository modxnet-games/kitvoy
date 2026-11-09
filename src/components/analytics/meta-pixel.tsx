"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { ensurePixel, hasPrivacyOptOut, isUntrackedPath, trackPageView } from "@/lib/analytics/meta-pixel";

const subscribe = () => () => {};

/**
 * Meta Pixel: loads the base code once per page load and sends one PageView
 * per path. Next.js swaps pages without a full reload, so later views are
 * sent when the path changes; the same path never counts twice.
 */
export function MetaPixel() {
  const pathname = usePathname();
  // false while rendering on the server and during hydration, so nothing loads before the browser can check GPC
  const allowed = useSyncExternalStore(subscribe, () => !hasPrivacyOptOut(), () => false);
  const tracked = allowed && !isUntrackedPath(pathname);

  useEffect(() => {
    if (!tracked) return;
    ensurePixel();
    trackPageView(pathname);
  }, [tracked, pathname]);

  return null;
}
