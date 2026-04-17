"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Brief } from "@/lib/supabase";
import BriefDetailPanel from "./BriefDetailPanel";

const STATUS_COLOR: Record<string, string> = {
  QUEUED:     "#6366F1",
  CLAIMED:    "#EAB308",
  COMPLETED:  "#22C55E",
  FAILED:     "#EF4444",
  PENDING:    "#737373",
  SUPERSEDED: "#7C3AED",
};

function timeAgo(ts: string | null): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function displayName(name: string): string {
  let n = name.replace(/^BRIEF::/, "");
  // Strip trailing ::YYYYMMDD-HHMMSS or ::YYYY-MM-DD timestamp
  n = n.replace(/::[\d]{8}-[\d]{6}$/, "").replace(/::[\d]{4}-[\d]{2}-[\d]{2}$/, "");
  return n;
}

const ALL_TABS = ["QUEUED", "CLAIMED", "COMPLETED", "FAILED"];

export default function BriefQueue({
  selectedBrief,
  onSelect,
  statusFilter,
}: {
  selectedBrief: Brief | null,
  onSelect: (b: Brief | null) => void,
  statusFilter?: string[],
}) {
  const tabs = statusFilter ?? ALL_TABS;
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState(tabs[0] ?? "QUEUED");
  const [activeTenant, setActiveTenant] = useState<string>("NORTH-STAR");

  const fetchBriefs = useCallback(async () => {
    const { data } = await supabase
      .from("briefs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) {
      setBriefs(data);
    }
  }, []);

  useEffect(() => {
    const c: Record<string, number> = {};
    const currentTenant = activeTenant.toUpperCase();
    const NORTH_STAR_ID = "00000000-0000-0000-0000-000000000001";
    
    briefs.forEach((b: Brief) => {
      const bTenant = (b.tenant_id || "").toUpperCase();
      let tenantMatch = false;

      if (currentTenant === "NORTH-STAR") {
        tenantMatch = bTenant === NORTH_STAR_ID || bTenant === "NORTH-STAR";
      } else {
        tenantMatch = bTenant === currentTenant;
      }

      if (tenantMatch) {
        c[b.status] = (c[b.status] || 0) + 1;
      }
    });
    setCounts(c);
  }, [briefs, activeTenant]);

  useEffect(() => {
    const saved = localStorage.getItem("ns_active_tenant") || "NORTH-STAR";
    setActiveTenant(saved);

    const onTenantChange = (e: Event) => {
      setActiveTenant((e as CustomEvent).detail);
    };

    window.addEventListener("tenant-change", onTenantChange);
    fetchBriefs();

    const channel = supabase
      .channel("briefs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefs" },
        () => fetchBriefs()
      )
      .subscribe();

    return () => {
      window.removeEventListener("tenant-change", onTenantChange);
      supabase.removeChannel(channel);
    };
  }, [fetchBriefs]);

  const filtered = briefs.filter((b) => {
    const statusMatch = b.status === activeTab;
    
    const currentTenant = activeTenant.toUpperCase();
    const NORTH_STAR_ID = "00000000-0000-0000-0000-000000000001";
    
    // Normalize tenant ID
    const bTenant = (b.tenant_id || "").toUpperCase();
    
    let tenantMatch = false;
    if (currentTenant === "NORTH-STAR") {
      tenantMatch = bTenant === NORTH_STAR_ID || bTenant === "NORTH-STAR";
    } else {
      tenantMatch = bTenant === currentTenant;
    }
    
    return statusMatch && tenantMatch;
  });
  // tabs is derived from statusFilter prop (defined above)

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0 12px",
          height: 44,
          borderBottom: "1px solid #1C1C1C",
        }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab;
          const count = counts[tab] || 0;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 6,
                border: active ? "1px solid #2A2A2A" : "1px solid transparent",
                background: active ? "#1A1A1A" : "transparent",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: active ? "#C4C4C4" : "#525252",
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = "#737373";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = "#525252";
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: STATUS_COLOR[tab] ?? "#525252",
                }}
              />
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
              {count > 0 && (
                <span style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: active ? "#737373" : "#3A3A3A",
                  minWidth: 14,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.map((brief) => {
          const isSelected = selectedBrief?.id === brief.id;
          const gradeColor =
            brief.quality_grade === "GREEN" ? "#22C55E" :
            brief.quality_grade === "YELLOW" ? "#EAB308" :
            brief.quality_grade === "RED" ? "#EF4444" : "#2A2A2A";
          return (
            <div
              key={brief.id}
              onClick={() => onSelect(brief)}
              style={{
                padding: "11px 14px",
                borderBottom: "1px solid #161616",
                cursor: "pointer",
                background: isSelected ? "rgba(124,58,237,0.07)" : "transparent",
                borderLeft: isSelected ? "2px solid #7C3AED" : "2px solid transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.022)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Primary row — name is the hero */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "#5B21B6",
                    fontWeight: 600,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  #{brief.id}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#D4D4D4",
                    lineHeight: 1.35,
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {displayName(brief.name ?? "")}
                </span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: gradeColor,
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                  title={brief.quality_grade ? `Grade: ${brief.quality_grade}` : "Ungraded"}
                />
              </div>

              {/* Meta row */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                color: "#525252",
              }}>
                {/* Status pip */}
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: `${STATUS_COLOR[brief.status] ?? "#525252"}14`,
                  border: `1px solid ${STATUS_COLOR[brief.status] ?? "#525252"}30`,
                  fontSize: 10,
                  fontWeight: 600,
                  color: STATUS_COLOR[brief.status] ?? "#737373",
                  letterSpacing: "0.03em",
                }}>
                  {brief.status}
                </span>

                {/* Priority */}
                <span style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "#181818",
                  border: "1px solid #242424",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "#525252",
                }}>
                  {brief.priority || "P2"}
                </span>

                {/* Agent */}
                {brief.claimed_by && (
                  <span style={{ color: "#7C3AED", fontSize: 11 }}>
                    {brief.claimed_by}
                  </span>
                )}

                {/* WSJF */}
                {brief.wsjf_score != null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#454545" }}>
                    {Number(brief.wsjf_score).toFixed(1)}
                  </span>
                )}

                {/* Time — pushed right */}
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "#3A3A3A" }}>
                  {timeAgo(brief.created_at)}
                </span>
              </div>

              {/* Failure reason if present */}
              {brief.failure_reason && (
                <p style={{ fontSize: 11, color: "#EF4444", marginTop: 5, lineHeight: 1.35 }} className="truncate">
                  {brief.failure_reason}
                </p>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{
            padding: "40px 16px",
            textAlign: "center",
            fontSize: 12,
            color: "#3A3A3A",
          }}>
            No {activeTab.toLowerCase()} briefs
          </div>
        )}
      </div>
    </div>
  );
}
