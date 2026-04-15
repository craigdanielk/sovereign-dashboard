"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamic imports prevent hook evaluation during /_global-error prerender
const DashboardTab     = dynamic(() => import("@/components/tabs/DashboardTab"),     { ssr: false });
const OpsTab           = dynamic(() => import("@/components/tabs/OpsTab"),           { ssr: false });
const WorkspaceTab     = dynamic(() => import("@/components/tabs/WorkspaceTab"),     { ssr: false });
const BriefsTab        = dynamic(() => import("@/components/tabs/BriefsTab"),        { ssr: false });
const CapabilityMapTab = dynamic(() => import("@/components/tabs/CapabilityMapTab"), { ssr: false });
const VerificationsTab = dynamic(() => import("@/components/tabs/VerificationsTab"), { ssr: false });
const ReconTab         = dynamic(() => import("@/components/tabs/ReconTab"),         { ssr: false });
const CommsTab         = dynamic(() => import("@/components/tabs/CommsTab"),         { ssr: false });
const BattlefieldTab   = dynamic(() => import("@/components/tabs/BattlefieldTab"),   { ssr: false });

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard:     DashboardTab,
  ops:           OpsTab,
  tasks:         WorkspaceTab,
  briefs:        BriefsTab,
  capabilitymap: CapabilityMapTab,
  verifications: VerificationsTab,
  recon:         ReconTab,
  comms:         CommsTab,
  battlefield:   BattlefieldTab,
};

export default function WarRoom() {
  const [activeTab, setActiveTab] = useState("ops");

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setActiveTab = setActiveTab;
    (window as unknown as Record<string, unknown>).__activeTab = activeTab;
    window.dispatchEvent(new CustomEvent("tab-change", { detail: activeTab }));
    return () => {
      delete (window as unknown as Record<string, unknown>).__setActiveTab;
      delete (window as unknown as Record<string, unknown>).__activeTab;
    };
  }, [activeTab]);

  // Keyboard shortcuts: Ctrl+1-5
  useEffect(() => {
    const keys = ["dashboard", "ops", "tasks", "briefs", "recon"];
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        setActiveTab(keys[parseInt(e.key) - 1]);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const ActiveComponent = TAB_COMPONENTS[activeTab] || TAB_COMPONENTS.ops;

  return (
    <div className="h-full overflow-hidden">
      <ActiveComponent />
    </div>
  );
}
