"use client";

import dynamic from "next/dynamic";
import { TenantProvider } from "@/lib/tenant-context";

// ssr:false prevents usePathname/useRouter/useContext from running during
// /_global-error and /_not-found static prerendering in Next.js 16.
const AppShell = dynamic(() => import("./AppShell"), {
  ssr: false,
  loading: () => <div style={{ height: "100vh", background: "#111111" }} />,
});
const GlobalSearch = dynamic(() => import("./GlobalSearch"), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), { ssr: false });

// TenantProvider lives here so both AppShell (TenantSwitcher) and
// page children (tab components) share the same context instance.
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <AppShell>{children}</AppShell>
      <GlobalSearch />
      <CommandPalette />
    </TenantProvider>
  );
}
