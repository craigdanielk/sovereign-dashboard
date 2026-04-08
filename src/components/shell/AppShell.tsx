"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Nav items (8 sections) ────────────────────────────────────────
interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "root",
    label: "Overview",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.8"/>
        <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.8"/>
        <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.8"/>
        <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.8"/>
      </svg>
    ),
  },
  {
    key: "north-star",
    label: "North Star",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L9.2 6.5H14L10.4 9.1L11.6 13.6L8 11L4.4 13.6L5.6 9.1L2 6.5H6.8L8 2Z" fill="currentColor" opacity="0.8"/>
      </svg>
    ),
  },
  {
    key: "battlefield",
    label: "Battlefield",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" fill="currentColor" opacity="0.8"/>
        <circle cx="3" cy="4" r="1.5" fill="currentColor" opacity="0.5"/>
        <circle cx="13" cy="4" r="1.5" fill="currentColor" opacity="0.5"/>
        <circle cx="3" cy="12" r="1.5" fill="currentColor" opacity="0.5"/>
        <circle cx="13" cy="12" r="1.5" fill="currentColor" opacity="0.5"/>
        <line x1="3" y1="4" x2="8" y2="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.75"/>
        <line x1="13" y1="4" x2="8" y2="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.75"/>
        <line x1="3" y1="12" x2="8" y2="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.75"/>
        <line x1="13" y1="12" x2="8" y2="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.75"/>
      </svg>
    ),
  },
  {
    key: "recon",
    label: "Recon",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.5" fill="none"/>
        <line x1="10" y1="10" x2="13.5" y2="13.5" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: "r17",
    label: "R17",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.5" fill="none"/>
        <line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1"/>
        <line x1="5" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    key: "command",
    label: "Workspace",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.5" fill="none"/>
        <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1"/>
        <rect x="5" y="8.5" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.4"/>
      </svg>
    ),
  },
  {
    key: "comms",
    label: "Comms",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3C2 2.45 2.45 2 3 2H13C13.55 2 14 2.45 14 3V10C14 10.55 13.55 11 13 11H5L2 14V3Z" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.5" fill="none"/>
      </svg>
    ),
  },
  {
    key: "artifacts",
    label: "Artifacts",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 2H10L14 6V14C14 14.55 13.55 15 13 15H3C2.45 15 2 14.55 2 14V3C2 2.45 2.45 2 3 2H4Z" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.5" fill="none"/>
        <path d="M10 2V6H14" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1"/>
        <line x1="5" y1="9" x2="11" y2="9" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1"/>
        <line x1="5" y1="11.5" x2="9" y2="11.5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    key: "workspace",
    label: "Workspace",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.5" fill="none"/>
        <path d="M5 4V3C5 2.45 5.45 2 6 2H10C10.55 2 11 2.45 11 3V4" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.2"/>
        <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1"/>
        <circle cx="8" cy="8" r="1" fill="currentColor" opacity="0.6"/>
      </svg>
    ),
  },
];

// ── Health indicator ──────────────────────────────────────────────
type HealthStatus = "ok" | "warn" | "error";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeTab, setActiveTabLocal] = useState("root");
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthStatus>("ok");
  const [queueDepth, setQueueDepth] = useState(0);

  // Sync with global tab state
  useEffect(() => {
    function onTabChange(e: Event) {
      setActiveTabLocal((e as CustomEvent).detail);
    }
    window.addEventListener("tab-change", onTabChange);
    return () => window.removeEventListener("tab-change", onTabChange);
  }, []);

  // Responsive: collapse sidebar on narrow viewport
  useEffect(() => {
    function onResize() {
      setCollapsed(window.innerWidth < 768);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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

  function switchTab(key: string) {
    const setter = (window as unknown as Record<string, unknown>).__setActiveTab as
      | ((tab: string) => void)
      | undefined;
    if (setter) setter(key);
  }

  // Hide shell on /ops and /login
  const isChromeless = pathname === "/ops" || pathname === "/login";
  if (isChromeless) return <>{children}</>;

  const currentNav = NAV_ITEMS.find((n) => n.key === activeTab);
  const breadcrumb = currentNav ? currentNav.label : "Overview";

  const healthColour = health === "ok" ? "#10B981" : health === "warn" ? "#F59E0B" : "#EF4444";
  const sidebarWidth = collapsed ? 48 : 220;

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "#111111" }}>
      {/* ── Left Sidebar ─────────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 h-screen border-r overflow-hidden transition-all duration-200"
        style={{
          width: sidebarWidth,
          background: "#161616",
          borderColor: "#2A2A2A",
        }}
      >
        {/* Logo / brand */}
        <div
          className="flex items-center h-12 border-b px-3 flex-shrink-0"
          style={{ borderColor: "#2A2A2A" }}
        >
          <div
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: "#7C3AED" }}
          >
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>S</span>
          </div>
          {!collapsed && (
            <span
              className="ml-2.5 font-semibold truncate"
              style={{ fontSize: 13, color: "#E5E5E5", letterSpacing: "-0.01em" }}
            >
              Sovereign
            </span>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="ml-auto"
              style={{ color: "#6B6B6B", padding: "2px" }}
              title="Collapse sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              style={{ color: "#6B6B6B", padding: "2px", marginLeft: "auto" }}
              title="Expand sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-1.5" style={{ overflowX: "hidden" }}>
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => switchTab(item.key)}
                className={`w-full flex items-center gap-2.5 transition-colors ${
                  active ? "nav-item-active" : "nav-item-inactive"
                }`}
                style={{
                  height: 36,
                  paddingLeft: collapsed ? 14 : 12,
                  paddingRight: 12,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? "#E5E5E5" : "#A0A0A0",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0" style={{ color: active ? "#E5E5E5" : "#6B6B6B" }}>
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.key === "north-star" && queueDepth > 0 && (
                  <span
                    className="ml-auto flex-shrink-0"
                    style={{
                      fontSize: 10,
                      background: "#7C3AED22",
                      color: "#7C3AED",
                      borderRadius: 4,
                      padding: "1px 5px",
                      fontWeight: 500,
                    }}
                  >
                    {queueDepth}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div
          className="flex-shrink-0 border-t py-2 px-3"
          style={{ borderColor: "#2A2A2A" }}
        >
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
            className="w-full flex items-center gap-2 transition-colors"
            style={{
              height: 30,
              fontSize: 11,
              color: "#6B6B6B",
              borderRadius: 4,
              padding: "0 4px",
            }}
            title="Open command palette (Cmd+K)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="4" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="8" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="8" y="9" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="6" y1="6" x2="8" y2="3" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="6" y1="6" x2="8" y2="11" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            {!collapsed && (
              <span>
                Cmd+K
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ── Right: Top bar + Content ──────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="flex-shrink-0 flex items-center justify-between border-b"
          style={{
            height: 48,
            padding: "0 16px",
            background: "#111111",
            borderColor: "#2A2A2A",
          }}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-2" style={{ fontSize: 13 }}>
            <span style={{ color: "#6B6B6B" }}>Sovereign</span>
            <span style={{ color: "#2A2A2A" }}>/</span>
            <span style={{ color: "#E5E5E5", fontWeight: 500 }}>{breadcrumb}</span>
          </div>

          {/* Right: health dot + queue */}
          <div className="flex items-center gap-3" style={{ fontSize: 12, color: "#6B6B6B" }}>
            {queueDepth > 0 && (
              <span>
                <span style={{ color: "#A0A0A0" }}>{queueDepth}</span>
                <span className="ml-1">queued</span>
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: healthColour,
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 11 }}>
                {health === "ok" ? "Healthy" : health === "warn" ? "Warning" : "Error"}
              </span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main
          className="flex-1 overflow-hidden min-h-0"
          style={{ background: "#111111" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
