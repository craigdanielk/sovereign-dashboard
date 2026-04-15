"use client";

import BriefQueue from "@/components/BriefQueue";
import SystemHealth from "@/components/SystemHealth";
import LiveLogs from "@/components/LiveLogs";
import PlanningWindow from "@/components/PlanningWindow";
import MissionObserver from "@/components/MissionObserver";
import KpiPanel from "@/components/KpiPanel";
import { useState, useEffect } from "react";
import type { Brief } from "@/lib/supabase";

export default function OpsTab() {
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);
  const [planningOpen, setPlanningOpen] = useState(false); // collapsed by default
  const [kpiOpen, setKpiOpen] = useState(false);
  const [centerKey, setCenterKey] = useState(0);

  const handleBriefSelect = (brief: Brief | null) => {
    if (!brief) return;
    setSelectedBrief(brief);
    setCenterKey((k) => k + 1);
  };

  const PLANNING_HEIGHT = 240;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "#111111" }}>
      {/* ── Three-lane body ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LANE 1: Brief Queue (280px) ── */}
        <div
          className="flex flex-col flex-shrink-0 overflow-hidden"
          style={{ width: 280, background: "#0D0D0D", borderRight: "1px solid #1C1C1C" }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-between"
            style={{ height: 48, padding: "0 16px", borderBottom: "1px solid #1C1C1C" }}
          >
            <span className="panel-label">Queue</span>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <BriefQueue
              selectedBrief={selectedBrief}
              onSelect={handleBriefSelect}
              statusFilter={["QUEUED", "CLAIMED"]}
            />
          </div>
        </div>

        {/* ── LANE 2: Execution (flex) ── */}
        <div
          className="flex flex-col flex-1 overflow-hidden min-h-0"
          style={{ background: "#111111", borderRight: "1px solid #1C1C1C" }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-between"
            style={{ height: 48, padding: "0 16px", borderBottom: "1px solid #1C1C1C" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="panel-label">Execution</span>
              {selectedBrief && (
                <span style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "#5B21B6",
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.18)",
                  borderRadius: 5,
                  padding: "2px 8px",
                }}>
                  B-{selectedBrief.id}
                </span>
              )}
              {selectedBrief && (
                <span style={{ fontSize: 12, color: "#737373", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedBrief.name?.split("::").slice(1, 3).join(" · ") ?? selectedBrief.name}
                </span>
              )}
            </div>
            <button
              onClick={() => setKpiOpen(true)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #222222",
                background: "transparent",
                color: "#525252",
                cursor: "pointer",
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(124,58,237,0.35)";
                e.currentTarget.style.color = "#9D6FEB";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#222222";
                e.currentTarget.style.color = "#525252";
              }}
            >
              KPIs
            </button>
          </div>

          <div
            key={centerKey}
            className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar"
            style={{ animation: "fade-in-up 0.25s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <MissionObserver brief={selectedBrief} />
          </div>
        </div>

        {/* ── LANE 3: System (320px) ── */}
        <div
          className="flex flex-col flex-shrink-0 overflow-hidden"
          style={{ width: 320, background: "#0D0D0D" }}
        >
          <div
            className="flex-shrink-0 flex items-center"
            style={{ height: 48, padding: "0 16px", borderBottom: "1px solid #1C1C1C" }}
          >
            <span className="panel-label">System</span>
          </div>
          <div style={{ flexShrink: 0, borderBottom: "1px solid #1C1C1C" }}>
            <SystemHealth />
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <LiveLogs />
          </div>
        </div>
      </div>

      {/* ── Planning Window — collapsed by default ───────────────── */}
      <div
        className="flex-shrink-0 border-t border-border overflow-hidden transition-all duration-200 ease-out"
        style={{ height: planningOpen ? PLANNING_HEIGHT : 44 }}
      >
        <div
          className="flex items-center justify-between px-4 bg-bg-sidebar border-b border-border cursor-pointer select-none"
          style={{ height: 44 }}
          onClick={() => setPlanningOpen((o) => !o)}
        >
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l4-4V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10z" />
            </svg>
            <span className="text-xs font-semibold tracking-wide uppercase text-accent">
              Planning Window
            </span>
            {selectedBrief && (
              <span className="text-[11px] font-mono text-text-muted">— #{selectedBrief.id}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="2"
              style={{ transform: planningOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </div>
        </div>
        {planningOpen && (
          <div style={{ height: PLANNING_HEIGHT - 44 }}>
            <PlanningWindow selectedBrief={selectedBrief} />
          </div>
        )}
      </div>

      {/* ── KPI Overlay ──────────────────────────────────────────── */}
      {kpiOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setKpiOpen(false)}
        >
          <div
            className="rounded-xl border border-border overflow-hidden shadow-2xl bg-bg-sidebar"
            style={{ width: 520, maxHeight: "80vh", animation: "fade-in-up 0.2s cubic-bezier(0.16,1,0.3,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="text-xs font-semibold tracking-wide uppercase text-text-secondary">Agent KPIs</span>
              <button onClick={() => setKpiOpen(false)} className="text-text-muted hover:text-text-secondary transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: "calc(80vh - 48px)" }}>
              <KpiPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
