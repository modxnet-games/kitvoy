"use client";

import Link from "next/link";
import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { cartDrawerControl, useCartStore } from "@/store/cart-store";
import { useStorefrontUI } from "@/store/storefront-ui";
import { useMounted } from "@/hooks/use-mounted";
import { catalog } from "@/config/catalog";
import { BrandLogo } from "./brand-logo";
import { CartDrawer } from "./cart-drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";

/** On a product's page the links jump to its sections; elsewhere they lead to the storefront and the help pages. */
function navLinks(pathname: string | null) {
  const product = catalog.find((p) => p.path === pathname);
  if (product) {
    return {
      links: [
        { label: "How it works", href: `${product.path}#how` },
        { label: "Bundles", href: `${product.path}#bundles` },
        { label: "FAQ", href: `${product.path}#faq` },
      ],
      cta: { label: "Choose a pack", href: `${product.path}#bundles` },
    };
  }
  return {
    links: [
      { label: "Shipping", href: "/shipping" },
      { label: "Help", href: "/support" },
    ],
    cta: { label: "Shop products", href: "/" },
  };
}

export function Navbar({ announcementVisible = true }: { announcementVisible?: boolean }) {
  const mounted = useMounted();
  const pathname = usePathname();
  const itemCount = useCartStore(s => s.getItemCount());
  const overlay = useStorefrontUI(s => s.overlay);
  const setOverlay = useStorefrontUI(s => s.setOverlay);
  const close = useCallback(() => setOverlay(null), [setOverlay]);
  const { links: LINKS, cta } = navLinks(pathname);
  // A product page on the shared template keeps its header to the logo and the bag, so nothing leads away from the buy box
  const minimal = catalog.some((p) => p.path === pathname && p.path.startsWith("/products/"));
  const count = mounted ? itemCount : 0;

  useEffect(() => useCartStore.subscribe((state, prev) => {
    if (state.items.length > prev.items.length) {
      if (cartDrawerControl.skipNextOpen) { cartDrawerControl.skipNextOpen = false; return; }
      setOverlay("cart");
    }
  }), [setOverlay]);

  useEffect(() => { close(); }, [pathname, close]);

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {announcementVisible && <div className="kv-topbar"><strong>Free Tracked Shipping</strong> Included on Every Order</div>}
    <header className="kv-header">
      <div className="kv-wrap">
        <Link href="/" className="kv-logo" aria-label="Kitvoy home"><BrandLogo /></Link>
        {!minimal && <nav aria-label="Main navigation"><ul className="kv-header-nav">{LINKS.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul></nav>}
        <div className="kv-header-actions">
          {!minimal && <Link href={cta.href} className="kv-btn kv-btn-primary kv-header-cta">{cta.label} <ArrowRight size={16} aria-hidden="true" /></Link>}
          <button className="kv-bag-btn cart-trigger" onClick={() => setOverlay("cart")} aria-label={"Open cart" + (count ? ", " + count + (count === 1 ? " item" : " items") : "")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 8h14l-1.2 12H6.2L5 8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 8V6.5a3 3 0 016 0V8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {count > 0 && <span className="kv-bag-count">{count}</span>}
          </button>
          {!minimal && <button className="kv-menu-btn" aria-label="Open menu" onClick={() => setOverlay("menu")}><Menu size={24} aria-hidden="true" /></button>}
        </div>
      </div>
    </header>
    <Sheet open={overlay === "menu"} onOpenChange={open => setOverlay(open ? "menu" : null)}>
      <SheetContent side="right" className="store-menu" showCloseButton={false}>
        <SheetHeader className="menu-header"><SheetTitle className="kv-logo" aria-label="Kitvoy"><BrandLogo /></SheetTitle><SheetClose render={<button className="icon-button" aria-label="Close menu" />}><X /></SheetClose></SheetHeader>
        <nav aria-label="Mobile navigation">{LINKS.map(link => <Link key={link.href} href={link.href} onClick={close}>{link.label}<ArrowRight size={19} /></Link>)}<Link href="/support" onClick={close}>Help & information<ArrowRight size={19} /></Link></nav>
        <Link href={cta.href} className="primary-button" onClick={close}>{cta.label}</Link>
      </SheetContent>
    </Sheet>
    <CartDrawer open={overlay === "cart"} onClose={close} />
  </>;
}
