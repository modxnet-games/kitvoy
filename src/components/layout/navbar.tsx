"use client";

import Link from "next/link";
import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { cartDrawerControl, useCartStore } from "@/store/cart-store";
import { useStorefrontUI } from "@/store/storefront-ui";
import { useMounted } from "@/hooks/use-mounted";
import { useLanguage } from "@/contexts/language-context";
import { LOCALE_COOKIE, LOCALE_MAX_AGE, otherLocale } from "@/lib/i18n";
import { BrandLogo } from "./brand-logo";
import { CartDrawer } from "./cart-drawer";

/**
 * The storefront header: the promise bar, the logo, the language switch and
 * the bag. The store is one product page, so nothing in the header leads away
 * from it.
 */
export function Navbar({ announcementVisible = true }: { announcementVisible?: boolean }) {
  const { t, m, locale } = useLanguage();
  const mounted = useMounted();
  const pathname = usePathname();
  const itemCount = useCartStore(s => s.getItemCount());
  const overlay = useStorefrontUI(s => s.overlay);
  const setOverlay = useStorefrontUI(s => s.setOverlay);
  const close = useCallback(() => setOverlay(null), [setOverlay]);
  const count = mounted ? itemCount : 0;
  const other = otherLocale(locale);

  useEffect(() => useCartStore.subscribe((state, prev) => {
    if (state.items.length > prev.items.length) {
      if (cartDrawerControl.skipNextOpen) { cartDrawerControl.skipNextOpen = false; return; }
      setOverlay("cart");
    }
  }), [setOverlay]);

  useEffect(() => { close(); }, [pathname, close]);

  // The switch is a plain link (it works without JavaScript: the proxy reads ?lang=); with JavaScript the choice
  // is saved first and the page reloads where the customer was, cart and form untouched
  function switchLanguage(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=${LOCALE_MAX_AGE}; samesite=lax`;
    const url = new URL(window.location.href);
    url.searchParams.delete("lang");
    window.location.replace(url.toString());
  }

  return <>
    <a className="skip-link" href="#main-content">{m.common.skip}</a>
    {announcementVisible && <div className="kv-topbar"><strong>{m.topbar.strong}</strong> {m.topbar.rest}</div>}
    <header className="kv-header">
      <div className="kv-wrap">
        <Link href="/" className="kv-logo" aria-label={m.common.home}><BrandLogo /></Link>
        <div className="kv-header-actions">
          <a className="kv-lang" href={`${pathname ?? "/"}?lang=${other}`} lang={other} hrefLang={other} aria-label={m.nav.switchLabel} onClick={switchLanguage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M3 12h18M12 3c2.600 2.400 4 5.600 4 9s-1.400 6.600-4 9c-2.600-2.400-4-5.600-4-9s1.400-6.600 4-9z" stroke="currentColor" strokeWidth="1.6" /></svg>
            <span>{m.nav.switchTo}</span>
          </a>
          <button className="kv-bag-btn cart-trigger" onClick={() => setOverlay("cart")} aria-label={count ? t("nav.openCartCount", { count }) : m.nav.openCart}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 8h14l-1.2 12H6.2L5 8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 8V6.5a3 3 0 016 0V8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {count > 0 && <span className="kv-bag-count">{count}</span>}
          </button>
        </div>
      </div>
    </header>
    <CartDrawer open={overlay === "cart"} onClose={close} />
  </>;
}
