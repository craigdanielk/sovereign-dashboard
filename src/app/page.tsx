"use client";

import LiveLogs from "@/components/LiveLogs";
import BriefQueue from "@/components/BriefQueue";
import AgentDispatch from "@/components/AgentDispatch";
import SystemHealth from "@/components/SystemHealth";
import Retrospectives from "@/components/Retrospectives";

export default function Dashboard() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-widest text-accent-cyan">SOVEREIGN</span>
          <span className="text-xs text-text-muted border-l border-border pl-3">
            Operations Dashboard
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span>
            {new Date().toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span className="text-accent-green">APQC 1.0</span>
        </div>
      </header>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 grid-rows-2 gap-0 overflow-hidden min-h-0">
        {/* Execution Log — full left side */}
        <div className="col-span-7 row-span-2 border-r border-border min-h-0">
          <LiveLogs />
        </div>

        {/* Top right: Brief Queue + Agent Dispatch */}
        <div className="col-span-5 row-span-1 border-b border-border overflow-hidden grid grid-cols-2 gap-0 min-h-0">
          <div className="border-r border-border overflow-hidden">
            <BriefQueue />
          </div>
          <div className="overflow-hidden">
            <AgentDispatch />
          </div>
        </div>

        {/* Bottom right: System Health + Retrospectives */}
        <div className="col-span-5 row-span-1 overflow-hidden grid grid-cols-2 gap-0 min-h-0">
          <div className="border-r border-border overflow-hidden">
            <SystemHealth />
          </div>
          <div className="overflow-hidden">
            <Retrospectives />
          </div>
        </div>
      </div>
    </div>
  );
}
