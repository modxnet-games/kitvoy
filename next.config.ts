import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Single-product store: the homepage is the shop. Temporary (307) so the
  // catalog pages can come back if more products are added.
  async redirects() {
    return [
      { source: "/shop", destination: "/", permanent: false },
      { source: "/shop/:slug*", destination: "/", permanent: false },
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
