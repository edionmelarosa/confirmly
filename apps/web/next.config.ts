import type { NextConfig } from "next";

// Real API origin for the rewrite destination (server-side only).
const apiUpstream = (process.env.API_UPSTREAM_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    // Browser calls same-origin /backend/*; Next proxies to the API service.
    return [
      {
        source: "/backend/:path*",
        destination: `${apiUpstream}/:path*`,
      },
    ];
  },
};

export default nextConfig;
