import type { Metadata } from "next";

// The admin is private. Its sign-in page is public, so every admin page says
// noindex (robots.txt doesn't block /admin, so crawlers can read this).
export const metadata: Metadata = {
  title: { absolute: "Kitvoy admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
