export const siteConfig = {
  name: "Kitvoy",
  description:
    "A little preparation for the road ahead. Explore the Kitvoy cordless tire inflator and choose your bundle.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ogImage: "/og.png",
  // Logo mark used in the header/footer (browser favicons live in src/app: icon.svg, favicon.ico, apple-icon.png)
  icon: "/kitvoy-icon.svg",
  links: {
    twitter: "https://twitter.com/kitvoy",
    instagram: "https://instagram.com/kitvoy",
  },
  creator: "Kitvoy",
  currency: "USD",
} as const;

export type SiteConfig = typeof siteConfig;
