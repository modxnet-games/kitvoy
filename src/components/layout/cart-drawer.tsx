"use client";
import { Sheet, SheetContent, SheetTitle, SheetClose, SheetDescription } from "@/components/ui/sheet";
import { CartContents } from "@/components/storefront/cart-contents";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";

/** The cart, sliding in from the right: a count in the title, the lines, then the total and the way to checkout. */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const count = useCartStore(s => s.getItemCount());
  const mounted = useMounted();
  const shown = mounted ? count : 0;
  return <Sheet open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <SheetContent className="cart-panel" showCloseButton={false}>
      <div className="kv-cart-head">
        <SheetTitle>Cart <span aria-hidden="true">&bull;</span> {shown} {shown === 1 ? "item" : "items"}</SheetTitle>
        <SheetClose render={<button className="kv-cart-close" aria-label="Close cart" />}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </SheetClose>
      </div>
      <SheetDescription className="sr-only">Review quantities, shipping and total before checkout.</SheetDescription>
      {open && <CartContents onNavigate={onClose} />}
    </SheetContent>
  </Sheet>;
}
