import { landingConfig } from "@/config/landing";
import { getProductBySlug } from "@/lib/data/products";
import { StorefrontHome } from "@/components/landing/storefront-home";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Never substitute an unrelated featured product for the inflator.
  const product = await getProductBySlug(landingConfig.productSlug).catch(() => null);
  return <StorefrontHome product={product} />;
}
