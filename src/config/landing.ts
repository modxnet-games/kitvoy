/**
 * Single-product landing page content (homepage).
 *
 * Price, stock and images come from the database product whose slug matches
 * `productSlug` (falls back to the first featured product). Everything else on
 * the landing page is edited here.
 */
export const landingConfig = {
  productSlug: "cordless-tire-inflator",

  /** Shown only when no matching product exists in the database yet. */
  fallback: {
    name: "Kitvoy Cordless Tire Inflator",
    price: 59.99,
    compareAtPrice: 99.99,
  },

  hero: {
    eyebrow: "Never get stranded by a flat again",
    title: "Inflate any tire in minutes. No cords. No gas station.",
    subtitle:
      "A pocket-sized, rechargeable air compressor with a digital pressure gauge and auto shut-off. Set your PSI, press start, and it stops on its own.",
    bullets: [
      "Auto shut-off at your preset PSI",
      "Cars, SUVs, bikes, motorcycles & balls",
      "USB-C rechargeable · built-in LED light",
    ],
    cta: "Get Yours Now",
    /** MP4 path or URL. Leave empty to show the video placeholder. */
    videoSrc: "",
    videoPoster: "",
  },

  countdown: {
    label: "Launch sale ends in",
    /**
     * ISO date the promotion actually ends (e.g. "2026-11-30T23:59:59-05:00").
     * Leave empty to count down to local midnight. Only advertise a deadline
     * your pricing really honors — fake urgency can violate FTC rules.
     */
    endsAt: "",
  },

  benefits: [
    {
      title: "Set it & forget it",
      text: "Dial in your target PSI. The inflator stops automatically when it gets there.",
    },
    {
      title: "Fits in your glovebox",
      text: "Smaller than a water bottle, so it rides along on every trip.",
    },
    {
      title: "Charges with USB-C",
      text: "Top it up from your car, laptop or a wall charger.",
    },
    {
      title: "Built-in flashlight",
      text: "Bright LED with SOS mode for roadside stops at night.",
    },
  ],

  bundle: {
    title: "Bundle & save",
    subtitle: "One for every car in the driveway, plus one for the bike rack.",
    cta: "Claim This Offer",
  },

  ugc: {
    title: "See it in action",
    subtitle: "Tag @kitvoy in your video to get featured here.",
    /**
     * Replace with real customer videos (with their permission). Tiles with an
     * empty `videoSrc` render as placeholders.
     */
    videos: [
      { caption: "Topping off before a road trip", videoSrc: "", poster: "" },
      { caption: "Flat on the highway shoulder", videoSrc: "", poster: "" },
      { caption: "Mountain bike tires in 40 seconds", videoSrc: "", poster: "" },
      { caption: "Unboxing & first use", videoSrc: "", poster: "" },
      { caption: "Cold-morning PSI check", videoSrc: "", poster: "" },
      { caption: "Pumping up the kids' soccer ball", videoSrc: "", poster: "" },
    ],
  },

  faq: [
    {
      q: "How long does shipping take?",
      a: "Orders ship free with tracking to all 50 states. Most arrive in 5–9 business days.",
    },
    {
      q: "What if it doesn't work for me?",
      a: "You're covered by our 30-day money-back guarantee. Contact support and we'll make it right.",
    },
    {
      q: "Which valves does it support?",
      a: "Schrader (car) valves out of the box, with Presta and ball-needle adapters included.",
    },
    {
      q: "Is checkout secure?",
      a: "Yes. Payments are processed by Stripe and PayPal over an encrypted connection. We never see or store your card details.",
    },
  ],
} as const;

export type LandingConfig = typeof landingConfig;
