"use client";

import { useEffect, useState } from "react";
import TopBar from "./TopBar";
import GlobalSearch from "./GlobalSearch";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="h-screen flex flex-col overflow-hidden">
        {mounted && <TopBar />}
        <main className="flex-1 overflow-hidden min-h-0">{children}</main>
      </div>
      {mounted && <GlobalSearch />}
    </>
  );
}
