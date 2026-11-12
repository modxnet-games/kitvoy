import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // The catalog lives at /products (the link in the social bios) and each
  // product has its own page. Temporary (307) redirects, so a path can be
  // given a page of its own later.
  async redirects() {
    return [
      // The old template catalog
      { source: "/shop", destination: "/products", permanent: false },
      { source: "/shop/cordless-tire-inflator", destination: "/inflator", permanent: false },
      { source: "/shop/:slug*", destination: "/products", permanent: false },
      // The bio-link page was first planned as /links
      { source: "/links", destination: "/products", permanent: false },
      // Short paths for captions and ads
      { source: "/pet", destination: "/products#hub-niche-pet-care", permanent: false },
      { source: "/ball", destination: "/products/pouncepop", permanent: false },
      { source: "/pouncepop", destination: "/products/pouncepop", permanent: false },
    ];
  },
  // Private areas say noindex on the response itself, so it also covers their
  // redirects to the sign-in pages and anything that isn't HTML
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/account", headers: noindex },
      { source: "/account/:path*", headers: noindex },
      { source: "/checkout/:path*", headers: noindex },
      { source: "/review/:path*", headers: noindex },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
