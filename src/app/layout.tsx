import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { siteConfig } from "@/config/site";
import { LanguageProvider } from "@/contexts/language-context";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { FooterWrapper } from "@/components/layout/footer-wrapper";
import { WhatsappFloatingWrapper } from "@/components/layout/whatsapp-floating-wrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  // Lets fixed bars pad for the iPhone home indicator via env(safe-area-inset-bottom)
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    creator: "@kitvoy",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const isAdminOrderPrint =
    headerList.get("x-kitvoy-order-print") === "1";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <LanguageProvider>
          {isAdminOrderPrint ? (
            <div className="min-h-screen bg-[#f5f5f5]">{children}</div>
          ) : (
            <div className="relative flex min-h-screen flex-col">
              <NavbarWrapper />
              <main className="flex-1">{children}</main>
              <FooterWrapper />
              <WhatsappFloatingWrapper />
            </div>
          )}
        </LanguageProvider>
      </body>
    </html>
  );
}
