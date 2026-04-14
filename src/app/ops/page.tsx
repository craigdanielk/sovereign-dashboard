"use client";

import LiveLogs from "@/components/LiveLogs";
import BriefQueue from "@/components/BriefQueue";
import AgentDispatch from "@/components/AgentDispatch";
import SystemHealth from "@/components/SystemHealth";
import Retrospectives from "@/components/Retrospectives";

export default function OpsDashboard() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
        
        {/* Left side: Operations controls (8 cols) */}
        <div className="col-span-8 flex flex-col border-r border-border min-h-0">
          
          {/* Top: Brief Queue + Agent Dispatch */}
          <div className="flex-[3] border-b border-border overflow-hidden grid grid-cols-2 gap-0 min-h-0">
            <div className="border-r border-border overflow-hidden">
              <BriefQueue />
            </div>
            <div className="overflow-hidden">
              <AgentDispatch />
            </div>
          </div>

          {/* Bottom: Retrospectives */}
          <div className="flex-[2] overflow-hidden min-h-0">
            <Retrospectives />
          </div>
        </div>

        {/* Right side: Execution Log + System Health (4 cols) */}
        <div className="col-span-4 flex flex-col min-h-0 overflow-hidden bg-bg-card/30">
          <div className="flex-[3] border-b border-border overflow-hidden">
            <LiveLogs />
          </div>
          <div className="flex-[1] overflow-hidden">
            <SystemHealth />
          </div>
        </div>
      </div>
    </div>
  );
}
