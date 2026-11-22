"use client";

import { siteConfig } from "@/config/site";
import { useLanguage } from "@/contexts/language-context";

/**
 * The Chrilik logo from /public/brand. In the header it is the bag beside the
 * name, written in the page's script; `stacked` is the full logo (bag, name
 * and Arabic name) for the footer. `light` is the cream version for dark
 * backgrounds. The link around it carries the name, so the image itself is
 * decorative. `lazy` is for a logo far down the page.
 */
export function BrandLogo({ light = false, lazy = false, stacked = false }: { light?: boolean; lazy?: boolean; stacked?: boolean }) {
  const { locale } = useLanguage();
  const src = stacked ? (light ? siteConfig.logoLight : siteConfig.logo) : (light ? siteConfig.logoHeaderLight : siteConfig.logoHeader)[locale];
  const [width, height] = stacked ? [462, 690] : [330, 100];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={width} height={height} decoding="async" loading={lazy ? "lazy" : undefined} />;
}
