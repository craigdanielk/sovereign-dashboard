"use client";

import { useState, useCallback, useEffect } from "react";
import { TABS } from "@/lib/types";
import RootTab from "@/components/tabs/RootTab";
import NorthStarTab from "@/components/tabs/NorthStarTab";
import BattlefieldTab from "@/components/tabs/BattlefieldTab";
import ReconTab from "@/components/tabs/ReconTab";
import R17Tab from "@/components/tabs/R17Tab";
import CommsTab from "@/components/tabs/CommsTab";
import ArtifactsTab from "@/components/tabs/ArtifactsTab";
import CommandTab from "@/components/tabs/CommandTab";
import ReviewTab from "@/components/tabs/ReviewTab";

// Map tab keys to components — all rendered in one page, zero routing latency
const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  root: RootTab,
  "north-star": NorthStarTab,
  battlefield: BattlefieldTab,
  recon: ReconTab,
  r17: R17Tab,
  comms: CommsTab,
  artifacts: ArtifactsTab,
  command: CommandTab,
  review: ReviewTab,
};

export default function WarRoom() {
  const [activeTab, setActiveTab] = useState("root");

  // Expose tab setter globally so TopBar/TabBar can use it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setActiveTab = setActiveTab;
    (window as unknown as Record<string, unknown>).__activeTab = activeTab;
    window.dispatchEvent(new CustomEvent("tab-change", { detail: activeTab }));
    return () => {
      delete (window as unknown as Record<string, unknown>).__setActiveTab;
      delete (window as unknown as Record<string, unknown>).__activeTab;
    };
  }, [activeTab]);

  // Keyboard shortcuts: Ctrl+1-8 for tabs
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key >= "1" && e.key <= "8") {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (TABS[idx]) setActiveTab(TABS[idx].key);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const ActiveComponent = TAB_COMPONENTS[activeTab] || TAB_COMPONENTS.root;

  return (
    <div className="h-full overflow-hidden">
      <ActiveComponent />
    </div>
  );
}
