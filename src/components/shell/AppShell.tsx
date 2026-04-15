"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/tenant-context";
import TenantSwitcher from "./TenantSwitcher";

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const PRIMARY_NAV: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    key: "ops",
    label: "Operations",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    key: "briefs",
    label: "Briefs",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    key: "capabilitymap",
    label: "Cap Map",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
      </svg>
    ),
  },
  {
    key: "verifications",
    label: "Verify",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
  {
    key: "recon",
    label: "Recon",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
    ),
  },
  {
    key: "comms",
    label: "Comms",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    key: "battlefield",
    label: "Battlefield",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
];

type HealthStatus = "ok" | "warn" | "error";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tenantName } = useTenant();
  const [activeTab, setActiveTabLocal] = useState("ops");
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthStatus>("ok");
  const [queueDepth, setQueueDepth] = useState(0);

  useEffect(() => {
    function onTabChange(e: Event) {
      setActiveTabLocal((e as CustomEvent).detail);
    }
    window.addEventListener("tab-change", onTabChange);
    return () => window.removeEventListener("tab-change", onTabChange);
  }, []);

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

  useEffect(() => {
    if (pathname === "/ops") setActiveTabLocal("ops");
  }, [pathname]);

  const switchTab = (key: string) => {
    const setter = (window as unknown as Record<string, unknown>).__setActiveTab as
      | ((tab: string) => void)
      | undefined;
    if (setter) setter(key);
  };

  const currentNav = PRIMARY_NAV.find((n) => n.key === activeTab);
  const breadcrumb = currentNav?.label ?? "Operations";

  const healthColor =
    health === "ok" ? "#22C55E" : health === "warn" ? "#EAB308" : "#EF4444";

  const sidebarWidth = collapsed ? 52 : 220;

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: "#080808", position: "relative", zIndex: 1 }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 h-screen overflow-hidden transition-all duration-250 ease-in-out"
        style={{
          width: sidebarWidth,
          background: "#0D0D0D",
          borderRight: "1px solid #1C1C1C",
        }}
      >
        {/* Brand row */}
        <div
          className="flex items-center flex-shrink-0 gap-3"
          style={{
            height: 52,
            padding: "0 14px",
            borderBottom: "1px solid #1C1C1C",
          }}
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="icon-btn"
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s ease-in-out",
              }}
            >
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </button>

          {/* Logo mark — always visible */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "#7C3AED",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: "-0.02em" }}>S</span>
          </div>

          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#D4D4D4",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}>
                Sovereign
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 500,
                color: "#454545",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}>
                Command Center
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto custom-scrollbar"
          style={{ padding: "8px 8px", overflowX: "hidden" }}
        >
          {PRIMARY_NAV.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => switchTab(item.key)}
                className={`nav-item${active ? " active" : ""}`}
                style={{
                  height: 36,
                  padding: collapsed ? "0 14px" : "0 10px",
                  marginBottom: 1,
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: 10,
                }}
                title={collapsed ? item.label : undefined}
              >
                {/* Active indicator */}
                {active && (
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: "25%",
                    bottom: "25%",
                    width: 2,
                    borderRadius: "0 2px 2px 0",
                    background: "#7C3AED",
                  }} />
                )}
                <span style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: active ? "#9D6FEB" : "currentColor",
                  opacity: active ? 1 : 0.7,
                }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid #1C1C1C",
            background: "#0A0A0A",
            padding: "10px 8px",
          }}
        >
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="cmd-btn"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 8,
              padding: collapsed ? "7px 0" : "7px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            {!collapsed && <span>Search</span>}
            {!collapsed && (
              <span style={{
                marginLeft: "auto",
                fontSize: 10,
                color: "#3A3A3A",
                background: "#181818",
                border: "1px solid #2A2A2A",
                borderRadius: 4,
                padding: "1px 5px",
                fontFamily: "var(--font-mono)",
              }}>
                ⌘K
              </span>
            )}
          </button>

          {!collapsed && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 10px 2px",
            }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22C55E",
                  flexShrink: 0,
                  animation: "pulse-dot 2s ease-in-out infinite",
                  boxShadow: "0 0 6px #22C55E44",
                }}
              />
              <span style={{ fontSize: 10, color: "#525252", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                Live
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Content area ────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden"
        style={{ background: "#111111" }}
      >
        {/* Header bar */}
        <header
          style={{
            flexShrink: 0,
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: "#111111",
            borderBottom: "1px solid #1C1C1C",
          }}
        >
          {/* Breadcrumb */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
          }}>
            <span style={{ color: "#3A3A3A" }}>Mission</span>
            <span style={{ color: "#242424" }}>/</span>
            <span style={{ color: "#5B21B6" }}>{tenantName}</span>
            <span style={{ color: "#242424" }}>/</span>
            <span style={{ color: "#A3A3A3" }}>{breadcrumb}</span>
          </div>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <TenantSwitcher />

            <div style={{
              width: 1,
              height: 16,
              background: "#1E1E1E",
              flexShrink: 0,
            }} />

            {/* Queue depth + health */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}>
              {queueDepth > 0 && (
                <span style={{
                  color: "#7C3AED",
                  background: "rgba(124,58,237,0.1)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  borderRadius: 5,
                  padding: "2px 8px",
                  fontSize: 11,
                }}>
                  {queueDepth} queued
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: healthColor,
                    boxShadow: `0 0 8px ${healthColor}55`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "#454545", textTransform: "uppercase" }}>
                  v0.4
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
