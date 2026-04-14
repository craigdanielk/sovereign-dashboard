"use client";

import LiveLogs from "@/components/LiveLogs";
import BriefQueue from "@/components/BriefQueue";
import AgentDispatch from "@/components/AgentDispatch";
import SystemHealth from "@/components/SystemHealth";
import Retrospectives from "@/components/Retrospectives";
import PlanningWindow from "@/components/PlanningWindow";
import MissionObserver from "@/components/MissionObserver";
import { useState } from "react";
import { Brief } from "@/lib/supabase";

export default function OpsTab() {
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg-primary">
      {/* Three Column Master Layout */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
        
        {/* COLUMN 1: MISSION & AGENT STREAMS (3/12) */}
        <div className="col-span-3 flex flex-col border-r border-border min-h-0">
          <div className="flex-[3] border-b border-border overflow-hidden">
            <BriefQueue 
              selectedBrief={selectedBrief} 
              onSelect={setSelectedBrief} 
            />
          </div>
          <div className="flex-[2] overflow-hidden">
            <AgentDispatch 
              selectedBrief={selectedBrief} 
              onSelect={setSelectedBrief} 
            />
          </div>
        </div>

        {/* COLUMN 2: COMMAND & PLANNING (6/12) */}
        <div className="col-span-6 flex flex-col border-r border-border min-h-0">
          <div className="flex-[3] border-b border-border overflow-hidden bg-bg-card/5">
            <MissionObserver brief={selectedBrief} />
          </div>
          <div className="flex-[2] overflow-hidden">
            <PlanningWindow selectedBrief={selectedBrief} />
          </div>
        </div>

        {/* COLUMN 3: TELEMETRY & HEALTH (3/12) */}
        <div className="col-span-3 flex flex-col min-h-0 overflow-hidden bg-bg-card/10">
          <div className="flex-[4] border-b border-border overflow-hidden">
            <LiveLogs />
          </div>
          <div className="flex-[1] overflow-hidden">
            <SystemHealth />
          </div>
          <div className="shrink-0 p-2 border-t border-border bg-bg-primary/20">
             <Retrospectives />
          </div>
        </div>

      </div>
    </div>
  );
}
