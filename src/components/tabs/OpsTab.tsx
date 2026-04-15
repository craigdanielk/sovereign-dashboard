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
    <div className="h-full flex flex-col overflow-hidden bg-bg-primary">
      {/* ── Three-lane body ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LANE 1: Brief Queue (QUEUED + CLAIMED only, 280px) ── */}
        <div
          className="flex flex-col flex-shrink-0 border-r border-border overflow-hidden bg-bg-sidebar"
          style={{ width: 280 }}
        >
          <div
            className="flex-shrink-0 flex items-center px-4 border-b border-border"
            style={{ height: 48 }}
          >
            <span className="text-xs font-semibold tracking-wide uppercase text-text-secondary">
              Queue
            </span>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <BriefQueue
              selectedBrief={selectedBrief}
              onSelect={handleBriefSelect}
              statusFilter={["QUEUED", "CLAIMED"]}
            />
          </div>
        </div>

        {/* ── LANE 2: Agent / DAG (flex) ──────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden min-h-0 border-r border-border">
          <div
            className="flex-shrink-0 flex items-center justify-between px-4 border-b border-border"
            style={{ height: 48 }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold tracking-wide uppercase text-text-secondary">
                Execution
              </span>
              {selectedBrief && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-bg-hover text-accent">
                  #{selectedBrief.id} — {selectedBrief.name?.split("::")[1] ?? selectedBrief.name}
                </span>
              )}
            </div>
            <button
              onClick={() => setKpiOpen(true)}
              className="text-[11px] font-semibold tracking-wide uppercase px-3 py-1 rounded border border-border text-text-muted hover:text-accent hover:border-accent/40 transition-all"
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

        {/* ── LANE 3: System Health + Live Logs (320px) ───────────── */}
        <div
          className="flex flex-col flex-shrink-0 overflow-hidden bg-bg-sidebar"
          style={{ width: 320 }}
        >
          <div
            className="flex-shrink-0 flex items-center px-4 border-b border-border"
            style={{ height: 48 }}
          >
            <span className="text-xs font-semibold tracking-wide uppercase text-text-secondary">
              System
            </span>
          </div>
          <div className="flex-shrink-0 border-b border-border">
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
