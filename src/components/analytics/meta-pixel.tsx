"use client";

import { useEffect, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

import { META_PIXEL_ID } from "@/config/analytics";
import { hasPrivacyOptOut, isUntrackedPath } from "@/lib/analytics/meta-pixel";

const subscribe = () => () => {};
/** The path the pixel last counted; the base code counts the first page itself. */
let lastTracked: string | null = null;

/**
 * Meta Pixel base code plus a PageView on every page. Next.js swaps pages
 * without a full reload, so later views are sent when the path changes.
 */
export function MetaPixel() {
  const pathname = usePathname();
  // false while rendering on the server and during hydration, so nothing loads before the browser can check GPC
  const allowed = useSyncExternalStore(subscribe, () => !hasPrivacyOptOut(), () => false);
  const tracked = allowed && !isUntrackedPath(pathname);

  useEffect(() => {
    if (!tracked) return;
    if (lastTracked === null) {
      lastTracked = pathname;
      return;
    }
    if (lastTracked === pathname) return;
    lastTracked = pathname;
    window.fbq?.("track", "PageView");
  }, [tracked, pathname]);

  if (!tracked) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
    </Script>
  );
}
