"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import TopBar from "./TopBar";
import TabBar from "./TabBar";
import GlobalSearch from "./GlobalSearch";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Hide shell chrome on /ops (legacy dashboard)
  const isLegacy = pathname === "/ops";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isLegacy) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="h-screen flex flex-col overflow-hidden bg-bg-primary">
        {mounted && <TopBar />}
        {mounted && <TabBar />}
        <main className="flex-1 overflow-hidden min-h-0">{children}</main>
      </div>
      {mounted && <GlobalSearch />}
    </>
  );
}
