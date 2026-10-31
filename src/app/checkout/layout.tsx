import type { Metadata } from "next";

// Covers /checkout and the client-rendered /checkout/success
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
