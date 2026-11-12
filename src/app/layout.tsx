import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { siteConfig } from "@/config/site";
import { LanguageProvider } from "@/contexts/language-context";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { FooterWrapper } from "@/components/layout/footer-wrapper";
import { WhatsappFloatingWrapper } from "@/components/layout/whatsapp-floating-wrapper";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { META_PIXEL_ID } from "@/config/analytics";

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
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
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
        {!isAdminOrderPrint && META_PIXEL_ID && (
          <>
            <MetaPixel />
            {/* Meta Pixel fallback for browsers without JavaScript */}
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`} />
            </noscript>
          </>
        )}
        <LanguageProvider>
          {isAdminOrderPrint ? (
            <div className="min-h-screen bg-[#f5f5f5]">{children}</div>
          ) : (
            <div className="relative flex min-h-screen flex-col">
              <NavbarWrapper />
              <main id="main-content" className="flex-1">{children}</main>
              <FooterWrapper />
              <WhatsappFloatingWrapper />
            </div>
          )}
        </LanguageProvider>
      </body>
    </html>
  );
}
