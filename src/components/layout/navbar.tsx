"use client";

import Link from "next/link";
import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, ShoppingBag, X } from "lucide-react";
import { cartDrawerControl, useCartStore } from "@/store/cart-store";
import { useStorefrontUI } from "@/store/storefront-ui";
import { useMounted } from "@/hooks/use-mounted";
import { BrandLogo } from "./brand-logo";
import { CartDrawer } from "./cart-drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";

const LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "Bundles", href: "/#bundles" },
  { label: "FAQ", href: "/#faq" },
];

export function Navbar({ announcementText, announcementVisible = true }: { announcementText?: string; announcementVisible?: boolean }) {
  const mounted = useMounted();
  const pathname = usePathname();
  const itemCount = useCartStore(s => s.getItemCount());
  const overlay = useStorefrontUI(s => s.overlay);
  const setOverlay = useStorefrontUI(s => s.setOverlay);
  const close = useCallback(() => setOverlay(null), [setOverlay]);

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
      {announcementVisible && <div className="announcement">{announcementText || "A little preparation for the road ahead."}</div>}
      <nav className="store-container header-nav" aria-label="Main navigation">
        <Link href="/" aria-label="Kitvoy home"><BrandLogo /></Link>
        <ul className="desktop-nav">{LINKS.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
        <div className="nav-actions">
          <button className="icon-button cart-trigger" aria-label={"Open cart" + (mounted && itemCount ? ", " + itemCount + " items" : "")} onClick={() => setOverlay("cart")}><ShoppingBag size={23} />{mounted && itemCount > 0 && <span className="cart-count">{itemCount}</span>}</button>
          <Link href="/#bundles" className="primary-button nav-purchase">Shop inflator <ArrowRight size={16} /></Link>
          <button className="icon-button mobile-menu-trigger" aria-label="Open menu" onClick={() => setOverlay("menu")}><Menu size={25} /></button>
        </div>
      </nav>
    </header>
    <Sheet open={overlay === "menu"} onOpenChange={open => setOverlay(open ? "menu" : null)}>
      <SheetContent side="right" className="store-menu" showCloseButton={false}>
        <SheetHeader className="menu-header"><SheetTitle><BrandLogo /></SheetTitle><SheetClose render={<button className="icon-button" aria-label="Close menu" />}><X /></SheetClose></SheetHeader>
        <nav aria-label="Mobile navigation">{LINKS.map(link => <Link key={link.href} href={link.href} onClick={close}>{link.label}<ArrowRight size={19} /></Link>)}<Link href="/support" onClick={close}>Help & information<ArrowRight size={19} /></Link><Link href="/account" onClick={close}>My account<ArrowRight size={19} /></Link></nav>
        <Link href="/#bundles" className="primary-button" onClick={close}>Shop inflator</Link>
      </SheetContent>
    </Sheet>
    <CartDrawer open={overlay === "cart"} onClose={close} />
  </>;
}
