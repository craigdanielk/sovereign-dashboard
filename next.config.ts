import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dashboard is fully dynamic (Supabase queries, tenant context).
  // Prevents /_global-error prerender crash (useContext null in static build).
  output: undefined,
  experimental: {
    // Skip static prerendering for error pages that can't access layout providers
    staticGenerationRetryCount: 0,
  },
};

export default nextConfig;
