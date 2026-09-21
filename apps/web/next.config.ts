import type { NextConfig } from "next";

const apiUpstream =
  process.env.API_UPSTREAM_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    // Same-origin /backend/* → API so session cookies stay on the web host
    // (required when web + api are on different Railway domains).
    const base = apiUpstream.replace(/\/$/, "");
    if (base.endsWith("/backend")) {
      return [];
    }
    return [
      {
        source: "/backend/:path*",
        destination: `${base}/:path*`,
      },
    ];
  },
};

export default nextConfig;
