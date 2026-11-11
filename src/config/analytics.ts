/**
 * Meta (Facebook) Pixel for ad measurement. The id is public;
 * NEXT_PUBLIC_META_PIXEL_ID overrides it at build time.
 *
 * The store's own pixel is the default only in a production build. On a
 * developer's machine (next dev, tests) there is no default, so local browsing
 * and test checkouts never report to the live pixel; set the variable to a
 * test pixel's id to exercise tracking locally.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || (process.env.NODE_ENV === "production" ? "1602344064422523" : "");
