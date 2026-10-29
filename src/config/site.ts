export const siteConfig = {
  name: "Kitvoy",
  description:
    "Kitvoy — The cordless tire inflator that lives in your glovebox. Free US shipping, secure checkout and a 30-day money-back guarantee.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ogImage: "/og.png",
  // Favicon / app icon in /public
  icon: "/kitvoy-icon.svg",
  links: {
    twitter: "https://twitter.com/kitvoy",
    instagram: "https://instagram.com/kitvoy",
  },
  creator: "Kitvoy",
  currency: "USD",
} as const;

export type SiteConfig = typeof siteConfig;
