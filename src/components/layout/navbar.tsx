"use client";

import Link from "next/link";
import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, ShoppingBag, X } from "lucide-react";
import { cartDrawerControl, useCartStore } from "@/store/cart-store";
import { useStorefrontUI } from "@/store/storefront-ui";
import { useMounted } from "@/hooks/use-mounted";
import { INFLATOR_SLUG, catalog } from "@/config/catalog";
import { BrandLogo } from "./brand-logo";
import { CartDrawer } from "./cart-drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";

/** On a product page the links jump to its sections; elsewhere they lead to the catalog. */
function navLinks(pathname: string | null) {
  const product = catalog.find((p) => p.path === pathname);
  if (product) {
    return {
      links: [
        { label: "How it works", href: `${product.path}#how` },
        { label: "Bundles", href: `${product.path}#bundles` },
        { label: "FAQ", href: `${product.path}#faq` },
      ],
      cta: { label: product.slug === INFLATOR_SLUG ? "Shop inflator" : "Choose a pack", href: `${product.path}#bundles` },
    };
  }
  return {
    links: [
      { label: "All products", href: "/products" },
      { label: "Shipping", href: "/shipping" },
      { label: "Help", href: "/support" },
    ],
    cta: { label: "Shop products", href: "/products" },
  };
}

export function Navbar({ announcementText, announcementVisible = true }: { announcementText?: string; announcementVisible?: boolean }) {
  const mounted = useMounted();
  const pathname = usePathname();
  const itemCount = useCartStore(s => s.getItemCount());
  const overlay = useStorefrontUI(s => s.overlay);
  const setOverlay = useStorefrontUI(s => s.setOverlay);
  const close = useCallback(() => setOverlay(null), [setOverlay]);
  const { links: LINKS, cta } = navLinks(pathname);
  // The inflator ships to the US only, so its page keeps the US wording (or the admin's own text)
  const announcement = pathname === "/inflator" ? announcementText || "Free U.S. Shipping on Every Order" : "Free Tracked Shipping on Every Order";

  useEffect(() => useCartStore.subscribe((state, prev) => {
    if (state.items.length > prev.items.length) {
      if (cartDrawerControl.skipNextOpen) { cartDrawerControl.skipNextOpen = false; return; }
      setOverlay("cart");
    }
  }), [setOverlay]);

  useEffect(() => { close(); }, [pathname, close]);

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="store-header">
      {announcementVisible && <div className="announcement">{announcement}</div>}
      <nav className="store-container header-nav" aria-label="Main navigation">
        <Link href="/" aria-label="Kitvoy home"><BrandLogo /></Link>
        <ul className="desktop-nav">{LINKS.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
        <div className="nav-actions">
          <button className="icon-button cart-trigger" aria-label={"Open cart" + (mounted && itemCount ? ", " + itemCount + " items" : "")} onClick={() => setOverlay("cart")}><ShoppingBag size={23} />{mounted && itemCount > 0 && <span className="cart-count">{itemCount}</span>}</button>
          <Link href={cta.href} className="primary-button nav-purchase">{cta.label} <ArrowRight size={16} /></Link>
          <button className="icon-button mobile-menu-trigger" aria-label="Open menu" onClick={() => setOverlay("menu")}><Menu size={25} /></button>
        </div>
      </nav>
    </header>
    <Sheet open={overlay === "menu"} onOpenChange={open => setOverlay(open ? "menu" : null)}>
      <SheetContent side="right" className="store-menu" showCloseButton={false}>
        <SheetHeader className="menu-header"><SheetTitle><BrandLogo /></SheetTitle><SheetClose render={<button className="icon-button" aria-label="Close menu" />}><X /></SheetClose></SheetHeader>
        <nav aria-label="Mobile navigation">{LINKS.map(link => <Link key={link.href} href={link.href} onClick={close}>{link.label}<ArrowRight size={19} /></Link>)}<Link href="/support" onClick={close}>Help & information<ArrowRight size={19} /></Link><Link href="/account" onClick={close}>My account<ArrowRight size={19} /></Link></nav>
        <Link href={cta.href} className="primary-button" onClick={close}>{cta.label}</Link>
      </SheetContent>
    </Sheet>
    <CartDrawer open={overlay === "cart"} onClose={close} />
  </>;
}
