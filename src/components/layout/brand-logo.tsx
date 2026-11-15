import { siteConfig } from "@/config/site";

/**
 * The Kitvoy logo: the dog, the cat and the leaf over the wordmark, from
 * /public/brand. `light` is the cream version for dark backgrounds. The link or
 * heading around it carries the name, so the image itself is decorative.
 * `lazy` is for a logo far down the page (the footer's).
 */
export function BrandLogo({ light = false, lazy = false }: { light?: boolean; lazy?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={light ? siteConfig.logoLight : siteConfig.logo} alt="" width={955} height={650} decoding="async" loading={lazy ? "lazy" : undefined} />;
}
