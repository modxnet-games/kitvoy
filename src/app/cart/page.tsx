"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CartContents } from "@/components/storefront/cart-contents";
export default function CartPage() {
  return <div className="store-container cart-page"><Link href="/products" className="text-link"><ArrowLeft size={16} />Continue shopping</Link><h1>Your cart.</h1><p className="cart-page-intro">Review your items before checkout.</p><CartContents /></div>;
}
