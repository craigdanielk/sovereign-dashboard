"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TenantSwitcher from "./TenantSwitcher";

// ── Nav Items categorised for Optimal System Use ──────────────────
interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

interface NavCategory {
  label: string;
  items: NavItem[];
}

const CATEGORIES: NavCategory[] = [
  {
    label: "Intelligence",
    items: [
      { key: "root", label: "Overview", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
      { key: "genesis", label: "Genesis Portal", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> },
      { key: "recon", label: "Deep Recon", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> },
    ]
  },
  {
    label: "Operations",
    items: [
      { key: "north-star", label: "North Star", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
      { key: "battlefield", label: "Battlefield", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
      { key: "workspace", label: "Workspace", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
      { key: "ops", label: "Operational", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12h-4l-3 9L9 3l-3 9H2"/></svg> },
    ]
  },
  {
    label: "Logistics",
    items: [
      { key: "comms", label: "Comms Inbox", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
      { key: "artifacts", label: "Artifact Vault", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
    ]
  },
  {
    label: "Sovereign",
    items: [
      { key: "r17", label: "R17 Master", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
    ]
  }
];

// ── Health indicator ──────────────────────────────────────────────
type HealthStatus = "ok" | "warn" | "error";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeTab, setActiveTabLocal] = useState("root");
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthStatus>("ok");
  const [queueDepth, setQueueDepth] = useState(0);
  const [activeTenant, setActiveTenant] = useState("NORTH-STAR");

  // Sync with global tab state
  useEffect(() => {
    function onTabChange(e: Event) {
      setActiveTabLocal((e as CustomEvent).detail);
    }
    const savedTenant = (typeof window !== "undefined" ? localStorage.getItem("ns_active_tenant") : null) || "NORTH-STAR";
    setActiveTenant(savedTenant);

    function onTenantChange(e: Event) {
      setActiveTenant((e as CustomEvent).detail);
    }

    window.addEventListener("tab-change", onTabChange);
    window.addEventListener("tenant-change", onTenantChange);
    return () => {
      window.removeEventListener("tab-change", onTabChange);
      window.removeEventListener("tenant-change", onTenantChange);
    };
  }, []);

  // Health + queue data
  const fetchStats = useCallback(async () => {
    const { data: queued } = await supabase
      .from("briefs")
      .select("id")
      .in("status", ["QUEUED", "CLAIMED"]);
    setQueueDepth(queued?.length || 0);

    const { data: failedRecent } = await supabase
      .from("briefs")
      .select("id")
      .eq("status", "FAILED")
      .gte("completed_at", new Date(Date.now() - 3600000).toISOString());
    const failCount = failedRecent?.length || 0;
    setHealth(failCount > 2 ? "error" : failCount > 0 ? "warn" : "ok");
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const isLogin = pathname === "/login";
  if (isLogin) return <>{children}</>;

  // Ensure 'ops' tab highlights correctly when on /ops
  useEffect(() => {
    if (pathname === "/ops") {
      setActiveTabLocal("ops");
    }
  }, [pathname]);

  const switchTab = (key: string) => {
    const setter = (window as unknown as Record<string, unknown>).__setActiveTab as
      | ((tab: string) => void)
      | undefined;
    if (setter) setter(key);
  };

  const currentNav = CATEGORIES.flatMap(c => c.items).find((n) => n.key === activeTab);
  const breadcrumb = currentNav ? currentNav.label : "Overview";

  const healthColour = health === "ok" ? "#10B981" : health === "warn" ? "#F59E0B" : "#EF4444";
  const sidebarWidth = collapsed ? 52 : 240;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "#111111" }}>
      {/* ── Left Sidebar ─────────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 h-screen border-r overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          width: sidebarWidth,
          background: "#121212",
          borderColor: "#222222",
        }}
      >
        {/* Logo / brand */}
        <div
          className="flex items-center h-14 border-b px-4 flex-shrink-0"
          style={{ borderColor: "#222222" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] shadow-lg shadow-[#7C3AED22]"
          >
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, lineHeight: 1 }}>S</span>
          </div>
          {!collapsed && (
            <div className="ml-3 flex flex-col overflow-hidden">
               <span className="font-bold text-[13px] text-[#E5E5E5] tracking-tight truncate">SOVEREIGN OS</span>
               <span className="text-[10px] text-[#444444] font-bold tracking-widest uppercase truncate">Mission Control</span>
            </div>
          )}
        </div>

        {/* Categories + Nav items */}
        <nav className="flex-1 overflow-y-auto pt-6 pb-4 custom-scrollbar" style={{ overflowX: "hidden" }}>
          {CATEGORIES.map((cat, idx) => (
            <div key={cat.label} className={idx > 0 ? "mt-6" : ""}>
               {!collapsed && (
                 <div className="px-5 mb-2 text-[10px] font-bold text-[#333333] tracking-[0.2em] uppercase">
                   {cat.label}
                 </div>
               )}
               {cat.items.map((item) => {
                 const active = activeTab === item.key;
                 // Hide R17 if not in master context
                 if (item.key === "r17" && activeTenant !== "NORTH-STAR") return null;
                 
                 return (
                   <button
                     key={item.key}
                     onClick={() => switchTab(item.key)}
                     className={`w-full flex items-center gap-3 transition-all duration-200 group relative ${
                       active ? "bg-[#7C3AED10]" : "hover:bg-[#1A1A1A]"
                     }`}
                     style={{
                       height: 40,
                       paddingLeft: collapsed ? 18 : 20,
                       paddingRight: 12,
                       fontSize: 13,
                       fontWeight: active ? 600 : 500,
                       color: active ? "#7C3AED" : "#777777",
                       textAlign: "left",
                     }}
                   >
                     {active && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#7C3AED]" />
                     )}
                     <span className={`flex-shrink-0 transition-colors ${active ? "text-[#7C3AED]" : "text-[#333333] group-hover:text-[#666666]"}`}>
                       {item.icon}
                     </span>
                     {!collapsed && <span className="truncate">{item.label}</span>}
                   </button>
                 );
               })}
            </div>
          ))}
        </nav>

        {/* Sidebar footer: Command Palette Proxy */}
        <div className="flex-shrink-0 border-t py-4 px-4 bg-[#0E0E0E]" style={{ borderColor: "#222222" }}>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="w-full flex items-center gap-3 px-3 py-2 bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] rounded-lg transition-all"
            style={{ fontSize: 11, color: "#555555" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            {!collapsed && <span className="font-bold tracking-widest uppercase">Command K</span>}
          </button>
          
          <div className="mt-4 flex items-center justify-between px-1">
             <button onClick={() => setCollapsed(!collapsed)} className="p-1 hover:bg-[#1A1A1A] rounded transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="2.5"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
             </button>
             {!collapsed && (
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                   <span className="text-[10px] text-[#333333] font-bold tracking-widest">LIVE</span>
                </div>
             )}
          </div>
        </div>
      </aside>

      {/* ── Right Content ────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-[#111111]">
        {/* Header Bar */}
        <header
          className="flex-shrink-0 flex items-center justify-between border-b px-6"
          style={{ height: 56, background: "#111111", borderColor: "#222222" }}
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase">
              <span className="text-[#444444]">Mission</span>
              <span className="text-[#222222]">/</span>
              <span className="text-[#7C3AED]">{activeTenant}</span>
              <span className="text-[#222222]">/</span>
              <span className="text-[#E5E5E5]">{breadcrumb}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <TenantSwitcher />
             <div className="h-4 w-[1px] bg-[#222222]" />
             <div className="flex items-center gap-2 text-[10px] font-bold text-[#444444] tracking-widest uppercase">
                {queueDepth > 0 && <span className="text-[#7C3AED]">{queueDepth} PENDING</span>}
                <div className={`w-1.5 h-1.5 rounded-full`} style={{ background: healthColour, boxShadow: `0 0 8px ${healthColour}44` }} />
                <span>VER v0.3</span>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden min-h-0">
          {children}
        </main>
      </div>

      <style jsx global>{`
        .nav-item-active { background: #7C3AED10; color: #7C3AED; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1A1A1A; border-radius: 10px; }
      `}</style>
    </div>
  );
}
