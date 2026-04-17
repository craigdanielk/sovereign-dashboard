import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output mode — all pages server-rendered, no static HTML expected.
  // Fixes Vercel ENOENT on /_global-error.html when prerender silently fails.
  output: "standalone",
  experimental: {
    staticGenerationRetryCount: 0,
  },
};

export default nextConfig;
