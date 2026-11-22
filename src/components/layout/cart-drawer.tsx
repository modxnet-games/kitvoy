"use client";
import { Sheet, SheetContent, SheetTitle, SheetClose, SheetDescription } from "@/components/ui/sheet";
import { CartContents } from "@/components/storefront/cart-contents";
import { useLanguage } from "@/contexts/language-context";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";

/** The cart, sliding in from the end of the line (right in French, left in Arabic): a count in the title, the lines, then the total and the way to checkout. */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, m, dir } = useLanguage();
  const count = useCartStore(s => s.getItemCount());
  const mounted = useMounted();
  const shown = mounted ? count : 0;
  return <Sheet open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <SheetContent className="cart-panel" side={dir === "rtl" ? "left" : "right"} showCloseButton={false}>
      <div className="kv-cart-head">
        <SheetTitle>{m.cart.title} <span aria-hidden="true">&bull;</span> {t("cart.items", { count: shown })}</SheetTitle>
        <SheetClose render={<button className="kv-cart-close" aria-label={m.common.close} />}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </SheetClose>
      </div>
      <SheetDescription className="sr-only">{m.cart.intro}</SheetDescription>
      {open && <CartContents onNavigate={onClose} />}
    </SheetContent>
  </Sheet>;
}
