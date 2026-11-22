import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

// The admin is private. Its sign-in page is public, so every admin page says
// noindex (robots.txt doesn't block /admin, so crawlers can read this).
export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} admin`, template: `%s · ${siteConfig.name} admin` },
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
