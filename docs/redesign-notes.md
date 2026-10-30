# Kitvoy local redesign

## Design plan

Use the supplied references as one system: warm white `#FAF9F6`, white surfaces, ink `#171918`, gray `#666A67`, borders `#E7E5DF`, decorative orange `#E56624`, and accessible CTA orange `#C94B16`. Retain the existing Inter family. Large, closely spaced headline; quiet body typography; restrained line icons. Desktop pairs left-aligned copy/purchase controls with a dominant product gallery. Mobile orders copy, image, price and purchase action together. Native scroll brings three usage steps, observable product features, bundle choices and FAQs into view immediately.

The brief intentionally supplies the warm palette, orange accents, and large headline. Follow those choices rather than introducing a different aesthetic. The actual inflator is the visual focus. Avoid stock reviews, countdowns, decorative animation, and unrelated lifestyle imagery.

## Product and asset sources

Public product record read from https://kitvoy.com on October 30, 2026: cordless-tire-inflator, SKU INF-001, price $59.99, shippingTax $0, current stock 9. This is a dated reference, not a live inventory feed. Production rendering continues to read the database by slug. A missing product is unavailable; it no longer substitutes an unrelated featured clothing product.

Authentic source images copied locally:

- `/kitvoy/inflator-front.png`: https://kitvoy.com/uploads/products/product-1793327823741-nqw5v8nj.png
- `/kitvoy/inflator-detail.png`: https://kitvoy.com/uploads/products/product-1793327827741-advdzp7z.png
- `/kitvoy/inflator-kit.png`: https://kitvoy.com/uploads/products/product-1793327831990-kd7g539e.png

Only the first is displayed. The other supplier graphics have unsupported universal-compatibility and popularity claims embedded in them. Gallery detail views are CSS crops of the real first image, labeled as details; they are not new angles. No image generation was needed. Higher-resolution authentic photography and a clean real usage shot would improve the gallery.

## Content decisions and outstanding business details

The prior landing config explicitly says its product/shipping facts need supplier verification. No specification sheet or approved policies were found. Copy uses observable display/buttons/hose and the user-supplied cordless product identity. Automatic shutoff, charging type, inflation performance, dimensions, battery capacity, adapter contents and compatibility claims require a supplier manual before being promoted.

No shipping, returns, privacy or contact pages existed. `/support` now gives factual available information and explicitly identifies unpublished details. It is not an invented legal policy. Footer destinations link to these help sections and the existing account/order pages. Contact options come only from admin store settings.

Before publication the merchant must supply delivery estimates and exclusions, return window/eligibility/process/address, approved privacy policy and business identity, and a working support email/phone. The mockups' 30-day promise has not been approved and is omitted. Legacy CMS announcement text making that promise is suppressed, without modifying the CMS record. No countdown, sales counts, reviews or popularity badges are displayed.

## Commerce and local review

Existing shared bundle calculation is unchanged: 15% at two, 25% at three or more, cent-rounded line totals. At $59.99 this is $59.99 / $101.98 / $134.98, saving $0 / $18 / $44.99. UI derives these values and refreshes its catalog quote. Server order creation remains authoritative. Bundle selection changes nothing until the explicit add action; the action replaces this product's cart quantity as disclosed. Insufficient stock is shown for correction rather than silently changing an offer.

Cart uses the established Base UI dialog for focus trapping, Escape, background inertness and scroll lock. Payment labels match the existing PayPal checkout; guest-card eligibility is not guaranteed. Stripe routes remain in place. Authentication, admin, order creation, fulfillment and payment APIs were not replaced.

`node scripts/seed-kitvoy-preview.mjs` adds a clearly labeled product only to a localhost development database when the inflator slug is missing. It never updates existing products, never seeds orders, and refuses remote or production databases. The original local database had clothing test products; they are preserved.

No production deployment is requested or performed. Browser tests must use loopback URLs and stop before real payment/order submission.

## Verification results

- Production build: passed.
- TypeScript (`npx tsc --noEmit`): passed.
- Focused ESLint across the changed storefront, checkout, cart, supporting hooks and tests: passed with no errors or warnings.
- Commerce tests (`npm run test:commerce`): 6 passed. Covers cent-rounded bundles and changed prices, explicit replacement, stock refresh without quantity changes, removal, US delivery validation, and AA contrast for primary text/button colors.
- Local HTTP smoke checks: `/`, `/cart`, `/checkout`, and `/support` returned 200 with the expected main document and no server error.
- Full-repository ESLint: unrelated pre-existing errors remain in the two account-order clients (`react-hooks/purity`), admin notifications route (`no-explicit-any`) and admin product-image manager (`set-state-in-effect`). The existing mount and product-thumbnail hook issues were resolved where reused by this redesign.

### Pending browser verification and screenshots

The browser tool denied `http://127.0.0.1:3000`, initially reporting a declined origin permission. After the user authorized a retry and confirmed enabling access, the tool still reported: “A saved permission or managed policy denies access.” This was not bypassed with another browser or automation channel.

Visual checks at 360, 390, 768 and 1440px, actual keyboard/focus behavior, image loading, sticky-bar intersections, rendered overflow/contrast and screenshots remain **unverified**. Do not treat a successful build or code tests as visual sign-off.

`tests/browser/storefront.spec.ts` prepares seven browser cases including all four widths, gallery and navigation, bundle/cart arithmetic, checkout errors, keyboard containment, reduced motion, accessibility and quote retry. It intercepts order/payment requests and is limited to loopback hosts. It has not been executed. Once browser permission is resolved, run it against the local dev server with `npm run test:browser`. Screenshots are configured for `artifacts/screenshots/`; no screenshots have been fabricated or supplied yet. Chrome must be installed; tests use the existing Chrome channel. The development test dependencies require Node 22.12 or later.
