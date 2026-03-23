"use client";

import { useEffect, useState } from "react";
import { TABS } from "@/lib/types";

export default function TabBar() {
  const [activeTab, setActiveTabLocal] = useState("root");

  // Sync with global tab state
  useEffect(() => {
    function onTabChange(e: Event) {
      setActiveTabLocal((e as CustomEvent).detail);
    }
    window.addEventListener("tab-change", onTabChange);
    return () => window.removeEventListener("tab-change", onTabChange);
  }, []);

  function switchTab(key: string) {
    const setter = (window as unknown as Record<string, unknown>).__setActiveTab as
      | ((tab: string) => void)
      | undefined;
    if (setter) setter(key);
  }

  return (
    <nav className="shrink-0 flex items-center gap-0 px-2 border-b border-border bg-bg-primary overflow-x-auto">
      {TABS.map((tab, idx) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap ${
              active ? "tab-active" : "tab-inactive"
            }`}
            title={`${tab.label} (Ctrl+${idx + 1})`}
          >
            {tab.shortLabel}
          </button>
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
