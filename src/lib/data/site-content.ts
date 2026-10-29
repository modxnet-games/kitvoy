import { prisma } from "@/lib/db";
import { normalizeMediaSrc } from "@/lib/media-url";

// ─── Homepage content shape ─────────────────────────────────────────────────

export interface HomepageContent {
  announcementBar: string;
  announcementBarVisible: boolean;

  bannerImage: string;
  bannerVisible: boolean;

  featuredTitle: string;
  featuredSubtitle: string;
  featuredProductsVisible: boolean;

  newsletterTitle: string;
  newsletterSubtitle: string;
  newsletterSectionVisible: boolean;
}

export const HOMEPAGE_DEFAULTS: HomepageContent = {
  announcementBar: "Free US shipping on every order · 30-day money-back guarantee",
  announcementBarVisible: true,

  bannerImage: "",
  bannerVisible: true,

  featuredTitle: "Featured Products",
  featuredSubtitle: "Handpicked favorites from our latest collection",
  featuredProductsVisible: true,

  newsletterTitle: "Stay in the Loop",
  newsletterSubtitle:
    "Subscribe to our newsletter for exclusive offers, new arrivals, and style inspiration delivered to your inbox.",
  newsletterSectionVisible: true,
};

const HOMEPAGE_KEY = "homepage";

// ─── Read ───────────────────────────────────────────────────────────────────

export async function getHomepageContent(): Promise<HomepageContent> {
  try {
    const row = await prisma.siteContent.findUnique({
      where: { key: HOMEPAGE_KEY },
    });
    if (!row) return { ...HOMEPAGE_DEFAULTS };
    const merged = { ...HOMEPAGE_DEFAULTS, ...(row.value as Partial<HomepageContent>) };
    merged.bannerImage = normalizeMediaSrc(merged.bannerImage);
    // Legacy DB may still contain bannerLink — strip so type matches and admin no longer uses it
    delete (merged as Record<string, unknown>).bannerLink;
    return merged;
  } catch {
    return { ...HOMEPAGE_DEFAULTS };
  }
}

// ─── Write ──────────────────────────────────────────────────────────────────

export async function upsertHomepageContent(
  data: Partial<HomepageContent>,
): Promise<HomepageContent> {
  const current = await getHomepageContent();
  const merged = { ...current };

  for (const key of Object.keys(data) as (keyof HomepageContent)[]) {
    const v = data[key];
    if (typeof v === "boolean") {
      (merged as Record<string, unknown>)[key] = v;
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      (merged as Record<string, unknown>)[key] =
        key === "bannerImage" ? normalizeMediaSrc(trimmed) : trimmed;
    }
  }

  delete (merged as Record<string, unknown>).bannerLink;
  const json = JSON.parse(JSON.stringify(merged));
  await prisma.siteContent.upsert({
    where: { key: HOMEPAGE_KEY },
    update: { value: json },
    create: { key: HOMEPAGE_KEY, value: json },
  });

  return merged;
}
