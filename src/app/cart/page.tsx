"use client";
import Link from "next/link";
import { CartContents } from "@/components/storefront/cart-contents";
import { useLanguage } from "@/contexts/language-context";

export default function CartPage() {
  const { m } = useLanguage();
  return (
    <div className="store-container cart-page">
      <Link href="/" className="text-link">{m.cart.continue}</Link>
      <h1>{m.cart.title}</h1>
      <p className="cart-page-intro">{m.cart.intro}</p>
      <CartContents />
    </div>
  );
}
