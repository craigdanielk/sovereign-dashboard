"use client";

import LiveLogs from "@/components/LiveLogs";
import BriefQueue from "@/components/BriefQueue";
import AgentDispatch from "@/components/AgentDispatch";
import SystemHealth from "@/components/SystemHealth";
import Retrospectives from "@/components/Retrospectives";
import PlanningWindow from "@/components/PlanningWindow";
import { useState } from "react";
import { Brief } from "@/lib/supabase";

export default function OpsTab() {
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
        
        {/* Left side: Operations controls (8 cols) */}
        <div className="col-span-8 flex flex-col border-r border-border min-h-0">
          
          {/* Top: Brief Queue + Agent Dispatch */}
          <div className="flex-[2] border-b border-border overflow-hidden grid grid-cols-2 gap-0 min-h-0">
            <div className="border-r border-border overflow-hidden">
              <BriefQueue 
                selectedBrief={selectedBrief} 
                onSelect={setSelectedBrief} 
              />
            </div>
            <div className="overflow-hidden">
              <AgentDispatch 
                selectedBrief={selectedBrief} 
                onSelect={setSelectedBrief} 
              />
            </div>
          </div>

          {/* Bottom: Planning Window */}
          <div className="flex-[1] overflow-hidden min-h-0">
            <PlanningWindow selectedBrief={selectedBrief} />
          </div>
        </div>

        {/* Right side: Execution Log + System Health (4 cols) */}
        <div className="col-span-4 flex flex-col min-h-0 overflow-hidden bg-bg-card/30 shadow-inner">
          <div className="flex-[3] border-b border-border overflow-hidden">
            <LiveLogs />
          </div>
          <div className="flex-[1] overflow-hidden">
            <SystemHealth />
            <div className="p-2 border-t border-border bg-bg-primary/20">
               <Retrospectives />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
