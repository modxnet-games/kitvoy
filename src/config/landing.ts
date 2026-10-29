/**
 * Single-product landing page content (homepage).
 *
 * Price, stock and images come from the database product whose slug matches
 * `productSlug` (falls back to the first featured product). Everything else on
 * the landing page is edited here.
 *
 * Product facts below (auto shut-off, USB-C, LED, included adapters, delivery
 * window) must match the supplier's spec sheet before you run traffic.
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
    eyebrow: "The cordless tire inflator",
    title: "Low tire? Fix it from your glovebox.",
    subtitle:
      "Kitvoy is a rechargeable air pump that lives in your car. Set the PSI on the screen, press start, and it stops by itself when the tire hits your number.",
    cta: "Get My Kitvoy",
    scrollHint: "Scroll to see it work",
  },

  /** The pinned 3D story under the hero. Each step is one scroll "beat". */
  story: [
    {
      kicker: "Step 1",
      title: "Twist the hose onto the valve",
      text: "The chuck threads onto any car, bike or motorcycle valve. Presta and ball-needle adapters ride in the case.",
    },
    {
      kicker: "Step 2",
      title: "Set the PSI from your door sticker",
      text: "The screen shows the tire's current pressure the moment it's connected. Tap + or − to pick your target.",
    },
    {
      kicker: "Step 3",
      title: "Press start, then watch it stop",
      text: "It fills to your number and shuts itself off, so you can't overinflate the tire.",
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
    "30-day money-back guarantee",
    "Secure checkout with card or PayPal",
    "Tracked delivery to all 50 states",
  ],

  benefits: {
    title: "Why it earns a spot in the car",
    items: [
      {
        title: "Stops at your number",
        text: "Dial in the PSI from your door sticker. The pump shuts off when the tire reaches it.",
      },
      {
        title: "Rides in the glovebox",
        text: "It's small enough to stay in the car, so it's there the morning your tire light comes on.",
      },
      {
        title: "Charges like your phone",
        text: "Top it up from the car, a laptop or a wall adapter with the USB-C cable in the box.",
      },
      {
        title: "Lights up roadside stops",
        text: "The built-in LED has an SOS flash mode for a low tire after dark.",
      },
    ],
  },

  bundle: {
    title: "One for every car in the driveway",
    subtitle: "Buy 2 and save 15%. Buy 3 and save 25%. Every bundle ships free.",
    cta: "Claim My Bundle",
  },

  ugc: {
    title: "Kitvoy on the road",
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

  faq: [
    {
      q: "How long does shipping take?",
      a: "Every order ships free with tracking to all 50 states. Most arrive in 5–9 business days.",
    },
    {
      q: "What if it doesn't work for my car?",
      a: "You have 30 days to try it. If it doesn't fit your needs, contact support and we'll refund you.",
    },
    {
      q: "Which valves does it fit?",
      a: "Car and motorcycle (Schrader) valves out of the box. Presta and ball-needle adapters are included for bikes and sports balls.",
    },
    {
      q: "Is checkout secure?",
      a: "Payments go through Stripe and PayPal over an encrypted connection. Your card details never touch our servers.",
    },
  ],

  finalCta: {
    title: "Keep one in the car before the tire light comes on.",
    subtitle: "Try it for 30 days. If it doesn't earn its glovebox spot, we'll refund you.",
    cta: "Get My Kitvoy",
  },
} as const;

export type LandingConfig = typeof landingConfig;
