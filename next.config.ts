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
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
