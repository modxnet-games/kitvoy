"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Menu, Search, ShoppingBag, User, LayoutGrid, ChevronRight } from "lucide-react";

import { siteConfig } from "@/config/site";
import { useLanguage } from "@/contexts/language-context";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";
import { BrandLogo } from "@/components/layout/brand-logo";
import { SearchDialog } from "@/components/layout/search-dialog";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { SignInModal } from "@/components/layout/sign-in-modal";
import { Button } from "@/components/ui/button";
import { normalizeMediaSrc } from "@/lib/media-url";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavbarProps {
  announcementText?: string;
  announcementVisible?: boolean;
  categories?: { name: string; slug: string }[];
  isLoggedIn?: boolean;
  customerImageUrl?: string | null;
}

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
  const { t } = useLanguage();
  const mounted = useMounted();
  const itemCount = useCartStore((s) => s.getItemCount());

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
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
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          isScrolled
            ? "border-b bg-background/80 backdrop-blur-lg"
            : "bg-background"
        }`}
      >
        {/* Announcement bar */}
        {announcementVisible && (
          <div className="bg-primary text-primary-foreground">
            <div className="container mx-auto flex h-8 items-center justify-center px-4 text-xs font-medium tracking-wide sm:text-sm">
              {announcementText || t("nav.announcement")}
            </div>
          </div>
        )}

        {/* Main header row */}
        <nav className="relative container mx-auto flex h-16 items-center px-4 sm:h-20">

          {/* ===== MOBILE LAYOUT (< lg) ===== */}
          {/* Left: hamburger */}
          <div className="flex shrink-0 items-center lg:hidden">
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-9 text-foreground">
                    <Menu className="size-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                }
              />
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle className="sr-only">{siteConfig.name}</SheetTitle>
                  <Link href="/" className="flex items-center">
                    <BrandLogo />
                  </Link>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-0.5 px-1">
                  <Link
                    href="/shop"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <LayoutGrid className="size-4 text-muted-foreground" />
                    {t("nav.allProducts")}
                  </Link>
                  {categories.length > 0 && (
                    <>
                      <div className="my-2 border-t" />
                      <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("nav.categories")}
                      </p>
                      {categories.map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/shop?category=${cat.slug}`}
                          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {cat.name}
                          <ChevronRight className="size-3.5 opacity-40" />
                        </Link>
                      ))}
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Center: Logo — flex-1 on mobile to center, flex-initial on desktop */}
          <Link
            href="/"
            className="flex flex-1 items-center justify-center lg:flex-initial lg:justify-start lg:ml-6 lg:mr-8 transition-transform hover:scale-[1.02]"
          >
            <BrandLogo />
          </Link>

          {/* ===== DESKTOP LAYOUT (lg+) ===== */}
          {/* Desktop: centered search */}
          <div className="hidden lg:flex lg:flex-1 lg:justify-center">
            <button
              type="button"
              onClick={openSearch}
              className="flex h-11 w-full max-w-md items-center gap-3 rounded-full border border-border/50 bg-muted/40 px-5 text-sm text-muted-foreground shadow-sm transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-[360px] xl:w-[420px]"
            >
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{t("nav.searchPlaceholder")}</span>
            </button>
          </div>

          {/* Right icons */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-4 lg:gap-5">
            {/* Desktop categories dropdown */}
            {categories.length > 0 && (
              <div className="group relative hidden lg:block">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={t("nav.categories")}
                >
                  <LayoutGrid className="size-[18px]" />
                </button>
                <div className="invisible absolute right-0 top-full z-50 min-w-[200px] rounded-xl border bg-background p-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                  <Link
                    href="/shop"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {t("nav.allProducts")}
                  </Link>
                  <div className="my-1 border-t" />
                  {categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/shop?category=${cat.slug}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      {cat.name}
                      <ChevronRight className="size-3 opacity-40" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {isLoggedIn ? (
              <Link href="/account">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 text-foreground hover:bg-muted"
                  aria-label={t("nav.account")}
                >
                  <div className="flex size-full items-center justify-center">
                    {normalizeMediaSrc(customerImageUrl) ? (
                      <img
                        src={normalizeMediaSrc(customerImageUrl)}
                        alt={t("nav.account")}
                        className="size-[22px] rounded-full object-cover"
                      />
                    ) : (
                      <User className="size-[22px]" />
                    )}
                  </div>
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-10 text-foreground hover:bg-muted"
                aria-label="Sign In"
                onClick={() => setSignInOpen(true)}
              >
                <User className="size-[22px]" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="relative size-10 text-foreground hover:bg-muted"
              aria-label={t("nav.cart")}
              onClick={openCart}
            >
              <ShoppingBag className="size-[22px]" />
              {mounted && itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </nav>

        {/* Mobile only: full-width pill search bar below header */}
        <div className="px-4 pb-4 md:hidden">
          <button
            type="button"
            onClick={openSearch}
            className="flex w-full items-center gap-3 rounded-full border border-border/50 bg-muted/30 py-3.5 pl-5 pr-5 text-left text-sm text-muted-foreground shadow-md transition-all hover:bg-muted/50 hover:shadow-lg"
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span>{t("nav.searchPlaceholder")}</span>
          </button>
        </div>
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
