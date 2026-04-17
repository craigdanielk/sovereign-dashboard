import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dashboard is fully dynamic (Supabase queries, tenant context).
  // Disabling static generation entirely prevents /_global-error prerender
  // crash where auto-generated error page hits useContext through root layout.
  experimental: {
    staticGenerationRetryCount: 0,
  },
};

export default nextConfig;
