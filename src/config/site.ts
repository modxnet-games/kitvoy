/**
 * The store's identity. Chrilik (شري ليك) is a Moroccan cash-on-delivery shop.
 * It answers on whatever address NEXT_PUBLIC_APP_URL names, so moving to its
 * own domain is one setting on the server and nothing here.
 */
export const siteConfig = {
  name: "Chrilik",
  nameAr: "شري ليك",
  description: {
    ar: "شري ليك: منتجات مختارة بعناية، الدفع عند الاستلام والتوصيل مجاني لجميع مدن المغرب.",
    fr: "Chrilik : des produits choisis avec soin, paiement à la livraison et livraison gratuite partout au Maroc.",
  },
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  // Share card: the logo on its cream
  ogImage: "/og.png",
  // The stacked logo (bag, name, Arabic name), and its cream version for dark backgrounds
  logo: "/brand/chrilik-logo.svg",
  logoLight: "/brand/chrilik-logo-light.svg",
  // The header lockups: the bag beside the name, in each script
  logoHeader: { fr: "/brand/chrilik-logo-h.svg", ar: "/brand/chrilik-logo-h-ar.svg" },
  logoHeaderLight: { fr: "/brand/chrilik-logo-h-light.svg", ar: "/brand/chrilik-logo-h-ar-light.svg" },
  // The name alone, for small marks on photos
  wordmark: "/brand/chrilik-wordmark.svg",
  wordmarkLight: "/brand/chrilik-wordmark-light.svg",
  // The bag on a terracotta tile (browser favicons live in src/app: icon.svg, favicon.ico, apple-icon.png)
  icon: "/chrilik-icon.svg",
  creator: "Chrilik",
  currency: "MAD",
  country: "MA",
  /** Letters in front of every order reference: CHR-1A2B3C4D */
  orderPrefix: "CHR",
} as const;

export type SiteConfig = typeof siteConfig;
