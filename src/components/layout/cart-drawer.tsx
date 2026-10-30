"use client";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetClose, SheetDescription } from "@/components/ui/sheet";
import { CartContents } from "@/components/storefront/cart-contents";
import { BrandLogo } from "./brand-logo";
import { useCartStore } from "@/store/cart-store";
import { useMounted } from "@/hooks/use-mounted";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const count = useCartStore(s => s.getItemCount());
  const mounted = useMounted();
  return <Sheet open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <SheetContent className="cart-panel" showCloseButton={false}>
      <div className="cart-panel-brand"><BrandLogo /><SheetClose render={<button className="icon-button" aria-label="Close cart" />}><X size={24} /></SheetClose></div>
      <SheetTitle className="cart-panel-title">Your cart{mounted && count > 0 ? " (" + count + ")" : ""}</SheetTitle>
      <SheetDescription className="sr-only">Review quantities, shipping and total before checkout.</SheetDescription>
      {open && <CartContents onNavigate={onClose} />}
    </SheetContent>
  </Sheet>;
}
