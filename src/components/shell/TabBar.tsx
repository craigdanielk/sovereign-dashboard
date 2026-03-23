"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS } from "@/lib/types";

export default function TabBar() {
  const pathname = usePathname();

  function isActive(tab: { key: string; path: string }): boolean {
    if (tab.key === "root") return pathname === "/";
    return pathname.startsWith(tab.path);
  }

  return (
    <nav className="shrink-0 flex items-center gap-0 px-2 border-b border-border bg-bg-primary overflow-x-auto">
      {TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.key}
            href={tab.path}
            className={`px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
              active ? "tab-active" : "tab-inactive"
            }`}
          >
            {tab.shortLabel}
          </Link>
        );
      })}

      {/* Cmd+K shortcut hint at far right */}
      <div className="ml-auto flex items-center gap-2 pr-2">
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true })
            );
          }}
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
        >
          <kbd className="border border-border rounded px-1 py-0.5 text-[9px]">
            Cmd+K
          </kbd>
        </button>
      </div>
    </nav>
  );
}
