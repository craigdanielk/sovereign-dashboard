"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Lazy-import TenantProvider to prevent createContext from being evaluated
// during Vercel's static prerender of /_global-error (React dispatcher null).
const TenantProviderLazy = dynamic(
  () => import("@/lib/tenant-context").then((m) => ({ default: m.TenantProvider })),
  { ssr: false }
);

const AppShell = dynamic(() => import("./AppShell"), {
  ssr: false,
  loading: () => <div style={{ height: "100vh", background: "#111111" }} />,
});
const GlobalSearch = dynamic(() => import("./GlobalSearch"), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), { ssr: false });

export default function Shell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div style={{ height: "100vh", background: "#111111" }} />;
  }

  return (
    <TenantProviderLazy>
      <AppShell>{children}</AppShell>
      <GlobalSearch />
      <CommandPalette />
    </TenantProviderLazy>
  );
}
