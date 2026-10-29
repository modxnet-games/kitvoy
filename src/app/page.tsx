import { landingConfig } from "@/config/landing";
import { getFeaturedProducts, getProductBySlug } from "@/lib/data/products";
import { getHomepageContent } from "@/lib/data/site-content";
import type { ProductDisplay } from "@/types/product";

import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { ProductStory } from "@/components/landing/product-story";
import { BundleOffer } from "@/components/landing/bundle-offer";
import { UgcVideoGrid } from "@/components/landing/ugc-video-grid";
import { Benefits, Faq, FinalCta, TrustMarquee } from "@/components/landing/landing-sections";
import { StickyBuyBar } from "@/components/landing/sticky-buy-bar";
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
    <SmoothScroll>
      <ProductStory product={product} />
      <TrustMarquee />
      <Benefits />
      <BundleOffer product={product} />
      <UgcVideoGrid />
      <Faq />
      <FinalCta product={product} />

      {content.newsletterSectionVisible && (
        <NewsletterSection
          title={content.newsletterTitle}
          subtitle={content.newsletterSubtitle}
        />
      )}
      <StickyBuyBar product={product} />
    </SmoothScroll>
  );
}
