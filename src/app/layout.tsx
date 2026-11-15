import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { siteConfig } from "@/config/site";
import { LanguageProvider } from "@/contexts/language-context";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { FooterWrapper } from "@/components/layout/footer-wrapper";
import { WhatsappFloatingWrapper } from "@/components/layout/whatsapp-floating-wrapper";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { META_PIXEL_ID } from "@/config/analytics";

// The storefront's type pair: Manrope for text, Cormorant Garamond for display headings
const sans = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const viewport: Viewport = {
  // Lets fixed bars pad for the iPhone home indicator via env(safe-area-inset-bottom)
  viewportFit: "cover",
  // The logo green of the top bar, so the browser's own frame continues it
  themeColor: "#1C5244",
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

  // The font variables sit on <html>, where the --kv-* type tokens in globals.css read them
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans antialiased">
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
