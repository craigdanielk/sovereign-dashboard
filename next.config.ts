import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip prerendering for global-error (Next.js 16 prerender bug with client hooks in layout)
  experimental: {
    staticGenerationRetryCount: 0,
  },
};

export default nextConfig;
