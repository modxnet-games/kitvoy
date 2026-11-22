import type { Metadata } from "next";

import { getLocale } from "@/lib/locale-server";
import { getMessages } from "@/messages";

// The cart page is a client component, so its metadata lives here
export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).cart.title, robots: { index: false, follow: true } };
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
