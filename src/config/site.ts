export const siteConfig = {
  name: "Kitvoy",
  description:
    "Kitvoy picks useful little products for pets, the home and everyday comfort, and ships them free with tracking.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // Share card: the logo on its cream
  ogImage: "/og.png",
  // The logo (dog, cat and leaf over the wordmark), and its cream version for dark backgrounds
  logo: "/brand/kitvoy-logo.svg",
  logoLight: "/brand/kitvoy-logo-light.svg",
  // The wordmark alone, for small marks on photos
  wordmark: "/brand/kitvoy-wordmark.svg",
  wordmarkLight: "/brand/kitvoy-wordmark-light.svg",
  // The mark on a green tile (browser favicons live in src/app: icon.svg, favicon.ico, apple-icon.png)
  icon: "/kitvoy-icon.svg",
  links: {
    twitter: "https://twitter.com/kitvoy",
    instagram: "https://instagram.com/kitvoy",
  },
  creator: "Kitvoy",
  currency: "USD",
} as const;

export type SiteConfig = typeof siteConfig;
