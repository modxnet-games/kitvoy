"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { ChevronRight, Menu, Search, ShoppingBag, User } from "lucide-react";

import { siteConfig } from "@/config/site";
import { useLanguage } from "@/contexts/language-context";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SearchDialog } from "@/components/layout/search-dialog";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { SignInModal } from "@/components/layout/sign-in-modal";
import { normalizeMediaSrc } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Landing-page sections (ids on the homepage) plus the full catalog. */
const NAV_LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "Bundles", href: "/#bundles" },
  { label: "FAQ", href: "/#faq" },
  { label: "Shop all", href: "/shop" },
];

interface NavbarProps {
  announcementText?: string;
  announcementVisible?: boolean;
  categories?: { name: string; slug: string }[];
  isLoggedIn?: boolean;
  customerImageUrl?: string | null;
}

const iconButton =
  "relative inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Navbar({
  announcementText,
  announcementVisible = true,
  categories = [],
  isLoggedIn = false,
  customerImageUrl = null,
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();
  const mounted = useMounted();
  const itemCount = useCartStore((s) => s.getItemCount());
  const avatar = normalizeMediaSrc(customerImageUrl);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const unsubscribe = useCartStore.subscribe((state, prevState) => {
      if (state.items.length > prevState.items.length) {
        setCartOpen(true);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-[background-color,box-shadow,border-color] duration-300",
          isScrolled
            ? "border-b border-border/70 bg-background/80 shadow-[0_6px_24px_-18px_rgba(28,23,18,0.6)] backdrop-blur-xl"
            : "border-b border-transparent bg-background",
        )}
      >
        {/* Announcement bar */}
        {announcementVisible && (
          <div className="bg-ink text-[#F2E8DA]">
            <p className="container mx-auto flex h-8 items-center justify-center gap-2 px-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] sm:h-9 sm:text-xs">
              <span className="hidden size-1.5 shrink-0 rounded-full bg-brand sm:inline-block" />
              <span className="truncate">{announcementText || t("nav.announcement")}</span>
            </p>
          </div>
        )}

        <nav className="container mx-auto grid h-14 grid-cols-[1fr_auto_1fr] items-center px-3 sm:h-16 sm:px-4 lg:flex lg:gap-8">
          {/* Mobile: menu */}
          <div className="flex items-center lg:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                render={
                  <button type="button" className={iconButton} aria-label="Open menu">
                    <Menu className="size-5" />
                  </button>
                }
              />
              <SheetContent side="left" className="w-[86vw] max-w-sm">
                <SheetHeader>
                  <SheetTitle className="sr-only">{siteConfig.name}</SheetTitle>
                  <Link href="/" onClick={() => setMenuOpen(false)}>
                    <BrandLogo />
                  </Link>
                </SheetHeader>
                <nav className="flex flex-col px-2">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between rounded-xl px-3 py-3.5 text-lg font-semibold tracking-tight transition-colors hover:bg-foreground/[0.06]"
                    >
                      {link.label}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  ))}
                  {categories.length > 0 && (
                    <>
                      <p className="mt-6 px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {t("nav.categories")}
                      </p>
                      {categories.map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/shop?category=${cat.slug}`}
                          onClick={() => setMenuOpen(false)}
                          className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </>
                  )}
                </nav>
                <div className="mt-auto space-y-2 p-4">
                  {isLoggedIn ? (
                    <Link
                      href="/account"
                      onClick={() => setMenuOpen(false)}
                      className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold"
                    >
                      <User className="size-4" />
                      {t("nav.account")}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setSignInOpen(true);
                      }}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold"
                    >
                      <User className="size-4" />
                      Sign in
                    </button>
                  )}
                  <Link
                    href="/#bundles"
                    onClick={() => setMenuOpen(false)}
                    className="flex h-12 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white shadow-lg"
                  >
                    Buy now · Free US shipping
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Logo */}
          <Link href="/" className="justify-self-center lg:justify-self-auto" aria-label={`${siteConfig.name} home`}>
            <BrandLogo className="text-[1.35rem] sm:text-2xl" />
          </Link>

          {/* Desktop links */}
          <ul className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group relative rounded-full px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:text-foreground"
                >
                  {link.label}
                  <span className="absolute inset-x-4 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-brand transition-transform duration-300 group-hover:scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <button type="button" onClick={openSearch} className={iconButton} aria-label={t("nav.search")}>
              <Search className="size-[19px]" />
            </button>

            {isLoggedIn ? (
              <Link href="/account" className={cn(iconButton, "hidden sm:inline-flex")} aria-label={t("nav.account")}>
                {avatar ? (
                  <img src={avatar} alt="" className="size-[22px] rounded-full object-cover" />
                ) : (
                  <User className="size-[19px]" />
                )}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setSignInOpen(true)}
                className={cn(iconButton, "hidden sm:inline-flex")}
                aria-label="Sign in"
              >
                <User className="size-[19px]" />
              </button>
            )}

            <button type="button" onClick={openCart} className={iconButton} aria-label={t("nav.cart")}>
              <ShoppingBag className="size-[19px]" />
              {mounted && itemCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-[18px] text-white">
                  {itemCount}
                </span>
              )}
            </button>

            <Link
              href="/#bundles"
              className="ml-2 hidden h-10 items-center rounded-full bg-ink px-5 text-sm font-bold text-[#F2E8DA] transition-colors hover:bg-ink-soft lg:inline-flex"
            >
              Buy now
            </Link>
          </div>
        </nav>
      </header>

      <SearchDialog open={searchOpen} onClose={closeSearch} />
      <CartDrawer open={cartOpen} onClose={closeCart} />
      {!isLoggedIn && (
        <SignInModal
          open={signInOpen}
          onClose={() => setSignInOpen(false)}
          redirectUrl="/shop"
        />
      )}
    </>
  );
}
