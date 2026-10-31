export const siteConfig = {
  name: "Kitvoy",
  description:
    "Kitvoy sells one thing: a cordless tire inflator with a digital pressure gauge and LED light, shipped free across the United States.",
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
