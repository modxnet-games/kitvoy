import type { Metadata, Viewport } from "next";
import { Cairo, Cormorant_Garamond, El_Messiri, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import { siteConfig } from "@/config/site";
import { LanguageProvider } from "@/contexts/language-context";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { FooterWrapper } from "@/components/layout/footer-wrapper";
import { WhatsappFloatingWrapper } from "@/components/layout/whatsapp-floating-wrapper";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { META_PIXEL_ID } from "@/config/analytics";
import { dirOf } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

// Arabic, the default language: Cairo for text, El Messiri for display headings. These are preloaded.
const arabic = Cairo({ subsets: ["arabic", "latin"], variable: "--font-ar", display: "swap" });
const arabicDisplay = El_Messiri({ subsets: ["arabic"], variable: "--font-ar-display", display: "swap" });
// French: Manrope for text, Cormorant Garamond for display headings; fetched only when a page uses them
const sans = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap", preload: false });
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  // Lets fixed bars pad for the iPhone home indicator via env(safe-area-inset-bottom)
  viewportFit: "cover",
  // The logo terracotta of the top bar, so the browser's own frame continues it
  themeColor: "#A8443A",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const description = siteConfig.description[locale];
  return {
    title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
    description,
    metadataBase: new URL(siteConfig.url),
    openGraph: {
      type: "website",
      locale: locale === "ar" ? "ar_MA" : "fr_MA",
      url: siteConfig.url,
      title: siteConfig.name,
      description,
      siteName: siteConfig.name,
      images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
    },
    twitter: { card: "summary_large_image", title: siteConfig.name, description, images: [siteConfig.ogImage] },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const isAdminOrderPrint = headerList.get("x-store-order-print") === "1";
  // The owner's dashboard is English and left to right, without the shop's header, footer or tracking
  const isAdmin = isAdminOrderPrint || headerList.get("x-store-area") === "admin";
  const locale = await getLocale();
  const fonts = `${arabic.variable} ${arabicDisplay.variable} ${sans.variable} ${serif.variable}`;

  if (isAdmin) {
    return (
      <html lang="en" dir="ltr" suppressHydrationWarning className={fonts}>
        <body className="font-sans antialiased">
          <LanguageProvider locale="fr">{isAdminOrderPrint ? <div className="min-h-screen bg-[#f5f5f5]">{children}</div> : children}</LanguageProvider>
        </body>
      </html>
    );
  }

  // The font variables sit on <html>, where the --kv-* type tokens in globals.css read them
  return (
    <html lang={locale} dir={dirOf(locale)} suppressHydrationWarning className={fonts}>
      <body className="font-sans antialiased">
        {META_PIXEL_ID && (
          <>
            <MetaPixel />
            {/* Meta Pixel fallback for browsers without JavaScript */}
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`} />
            </noscript>
          </>
        )}
        <LanguageProvider locale={locale}>
          <div className="relative flex min-h-screen flex-col">
            <NavbarWrapper />
            <main id="main-content" className="flex-1">{children}</main>
            <FooterWrapper />
            <WhatsappFloatingWrapper />
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
