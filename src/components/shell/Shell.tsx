"use client";

import AppShell from "./AppShell";
import GlobalSearch from "./GlobalSearch";
import CommandPalette from "@/components/CommandPalette";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <GlobalSearch />
      <CommandPalette />
    </>
  );
}
