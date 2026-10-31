import type { Metadata } from "next";

// The cart page is a client component, so its metadata lives here
export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: true } };

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
