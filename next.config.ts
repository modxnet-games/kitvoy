import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Pages the store no longer has: the catalog, the tire inflator, the old template shop, the short
  // links from captions and ads, and customer accounts. They all lead to the storefront. Temporary
  // (307) redirects, so a path can be given a page of its own later.
  async redirects() {
    return [
      { source: "/products", destination: "/", permanent: false },
      { source: "/inflator", destination: "/", permanent: false },
      { source: "/shop", destination: "/", permanent: false },
      { source: "/shop/:slug*", destination: "/", permanent: false },
      { source: "/links", destination: "/", permanent: false },
      { source: "/pet", destination: "/", permanent: false },
      { source: "/ball", destination: "/", permanent: false },
      { source: "/pouncepop", destination: "/", permanent: false },
      { source: "/login", destination: "/", permanent: false },
      { source: "/register", destination: "/", permanent: false },
      { source: "/account/:path*", destination: "/", permanent: false },
    ];
  },
  // Private areas say noindex on the response itself, so it also covers their
  // redirects and anything that isn't HTML
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/checkout/:path*", headers: noindex },
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
