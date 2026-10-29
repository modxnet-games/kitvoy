import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order – Print",
};

/**
 * Print segment only — no nested <html>/<body> (invalid under App Router root).
 */
export default function OrderPrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
