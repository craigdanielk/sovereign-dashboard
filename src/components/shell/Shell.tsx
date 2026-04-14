"use client";

import dynamic from "next/dynamic";

// ssr:false prevents usePathname/useRouter/useContext from running during
// /_global-error and /_not-found static prerendering in Next.js 15.
const AppShell = dynamic(() => import("./AppShell"), {
  ssr: false,
  loading: () => <div style={{ height: "100vh", background: "#111111" }} />,
});
const GlobalSearch = dynamic(() => import("./GlobalSearch"), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), { ssr: false });

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <GlobalSearch />
      <CommandPalette />
    </>
  );
}
