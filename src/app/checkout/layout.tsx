import type { Metadata } from "next";

import { getLocale } from "@/lib/locale-server";
import { getMessages } from "@/messages";

// Covers /checkout and the client-rendered /checkout/success
export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).checkout.title, robots: { index: false, follow: false } };
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
