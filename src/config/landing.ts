/**
 * Single-product landing page content (homepage).
 *
 * Price, stock and images come from the database product whose slug matches
 * `productSlug` (falls back to the first featured product). Everything else on
 * the landing page is edited here.
 *
 * Product facts must match the supplier-verified specs in config/seo.ts
 * (80 W, ABS, digital pressure gauge, integrated LED, USB charging cable,
 * 610 g) and policy terms must match config/policies.ts.
 */
export const landingConfig = {
  productSlug: "cordless-tire-inflator",

  /** Shown only when no matching product exists in the database yet. */
  fallback: {
    name: "Cordless Tire Inflator",
    price: 59.99,
    compareAtPrice: 99.99,
  },

  hero: {
    eyebrow: "The cordless tire inflator",
    title: "Low tire? Fix it from your glovebox.",
    subtitle:
      "A compact cordless inflator that lives in your car, with a digital pressure gauge, an integrated LED light and USB charging.",
    cta: "Get My Inflator",
    scrollHint: "Scroll to see it work",
  },

  /** The pinned 3D story under the hero. Each step is one scroll "beat". */
  story: [
    {
      kicker: "Step 1",
      title: "Twist the hose onto the valve",
      text: "Attach the hose to a compatible tire valve, following the product instructions.",
    },
    {
      kicker: "Step 2",
      title: "Set the PSI from your door sticker",
      text: "The screen shows the tire's current pressure the moment it's connected. Tap + or − to pick your target.",
    },
    {
      kicker: "Step 3",
      title: "Press start and watch the gauge",
      text: "The digital gauge shows the pressure as it climbs. Stop when it reaches your tire's recommended PSI.",
    },
  ],

  countdown: {
    label: "Launch pricing ends in",
    /**
     * ISO date the promotion actually ends (e.g. "2026-11-30T23:59:59-05:00").
     * Leave empty to count down to local midnight. Only advertise a deadline
     * your pricing really honors — fake urgency can violate FTC rules.
     */
    endsAt: "",
  },

  trust: [
    "Free US shipping on every order",
    "30-day returns on unused items",
    "Secure checkout with PayPal",
    "Tracked delivery to all 50 states and DC",
  ],

  benefits: {
    eyebrow: "Why it works",
    title: "Why it earns a spot in the car",
    items: [
      {
        title: "Pressure at a glance",
        text: "The digital gauge shows the reading while you inflate, so you can match the PSI on your door sticker.",
      },
      {
        title: "Rides in the glovebox",
        text: "It's small enough to stay in the car, so it's there the morning your tire light comes on.",
      },
      {
        title: "Charges like your phone",
        text: "Recharge it with the included USB charging cable.",
      },
      {
        title: "Lights up roadside stops",
        text: "The integrated LED light helps with a low tire after dark.",
      },
    ],
  },

  bundle: {
    eyebrow: "Bundle & save",
    title: "One for every car in the driveway",
    subtitle: "Buy 2 and save 15%. Buy 3 and save 25%. Every bundle ships free.",
    cta: "Claim My Bundle",
  },

  ugc: {
    eyebrow: "On the road",
    title: "See it on the road",
    subtitle: "Post your clip and tag @kitvoy to get featured here.",
    /**
     * Replace with real customer videos (with their permission). Tiles with an
     * empty `videoSrc` render as placeholders.
     */
    videos: [
      { caption: "Topping off before a road trip", videoSrc: "", poster: "" },
      { caption: "Low tire on the highway shoulder", videoSrc: "", poster: "" },
      { caption: "Mountain bike tires, trailside", videoSrc: "", poster: "" },
      { caption: "Unboxing and first fill", videoSrc: "", poster: "" },
      { caption: "Cold-morning PSI check", videoSrc: "", poster: "" },
      { caption: "Pumping up the soccer ball", videoSrc: "", poster: "" },
    ],
  },

  faqHeading: {
    eyebrow: "FAQ",
    title: "Questions before you buy",
  },

  faq: [
    {
      q: "How long does shipping take?",
      a: "Every order ships free with tracking to all 50 states and DC. Orders process in 1–2 business days and arrive 4–9 business days after they ship.",
    },
    {
      q: "What if it doesn't work for my car?",
      a: "Return unused items in their original packaging within 30 days of delivery for a refund. Damaged or defective items are replaced or fully refunded.",
    },
    {
      q: "Which valves does it fit?",
      a: "Check your tire's valve type against the product manual before use. Email support@kitvoy.com if you need a particular adapter.",
    },
    {
      q: "Is checkout secure?",
      a: "Payments go through PayPal over an encrypted connection. Your card details never touch our servers.",
    },
  ],

  finalCta: {
    title: "Keep one in the car before the tire light comes on.",
    subtitle: "Free US shipping, and 30-day returns on unused items.",
    cta: "Get My Inflator",
  },
} as const;

export type LandingConfig = typeof landingConfig;
