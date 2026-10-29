import { landingConfig } from "@/config/landing";
import { getFeaturedProducts, getProductBySlug } from "@/lib/data/products";
import { getHomepageContent } from "@/lib/data/site-content";
import type { ProductDisplay } from "@/types/product";

import { LandingHero } from "@/components/landing/landing-hero";
import { BundleOffer } from "@/components/landing/bundle-offer";
import { UgcVideoGrid } from "@/components/landing/ugc-video-grid";
import { Benefits, Faq, TrustBar } from "@/components/landing/landing-sections";
import { NewsletterSection } from "@/components/newsletter-section";

export const dynamic = "force-dynamic";

/** The landing product: configured slug first, else the first featured product. */
async function getLandingProduct(): Promise<ProductDisplay | null> {
  try {
    const bySlug = await getProductBySlug(landingConfig.productSlug);
    if (bySlug) return bySlug;
    const [featured] = await getFeaturedProducts();
    return featured ?? null;
  } catch {
    // DB unavailable — render with fallback copy/price, CTAs link to /shop
    return null;
  }
}

export default async function HomePage() {
  const [product, content] = await Promise.all([
    getLandingProduct(),
    getHomepageContent(),
  ]);

  return (
    <>
      <LandingHero product={product} />
      <TrustBar />
      <Benefits />
      <BundleOffer product={product} />
      <UgcVideoGrid />
      <Faq />

      {content.newsletterSectionVisible && (
        <NewsletterSection
          title={content.newsletterTitle}
          subtitle={content.newsletterSubtitle}
        />
      )}
    </>
  );
}
