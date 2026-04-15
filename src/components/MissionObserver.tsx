"use client";

import { type Brief } from "@/lib/supabase";

interface MissionObserverProps {
  brief: Brief | null;
}

export default function MissionObserver({ brief }: MissionObserverProps) {
  if (!brief) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30 select-none">
        <div className="w-16 h-16 mb-4 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-blue">
             <circle cx="12" cy="12" r="10" />
             <path d="M12 16v-4" />
             <path d="M12 8h.01" />
           </svg>
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-text-muted">Observation Deck Standby</p>
        <p className="text-xs text-text-muted max-w-[240px] mt-2 italic">Select a brief from the mission queue or agent dispatch to view the neural execution plan.</p>
      </div>
    );
  }

  // Try parsing the node_6 payload for the DAG steps
  let planSteps: any[] = [];
  let routing = null;

  if (brief.payload) {
    const payload = brief.payload as any;
    const n6 = payload.node_6_execution_plan;
    if (n6 && Array.isArray(n6.steps)) {
      planSteps = n6.steps;
    } else if (n6 && Array.isArray(n6.tasks)) {
      planSteps = n6.tasks;
    }
    routing = payload.routing_result;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg-primary/30">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 border-b border-border bg-bg-card" style={{ height: 48 }}>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-wide text-accent-blue uppercase">
            Mission Observer // B-{brief.id}
          </span>
          <span className="text-xs text-text-primary font-medium truncate mt-0.5">
            {brief.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5">
             <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
             <span className="text-xs text-accent-green font-bold tracking-tighter uppercase">Observing</span>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Status overview */}
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1 px-2 py-1 border border-border bg-bg-primary rounded">
            <span className="text-text-muted uppercase text-[11px] font-bold">Status</span>
            <span className="font-mono font-bold text-text-primary px-1.5 rounded bg-bg-card">{brief.status}</span>
          </div>
          {brief.wsjf_score && (
            <div className="flex items-center gap-1 px-2 py-1 border border-border bg-bg-primary rounded">
              <span className="text-text-muted uppercase text-[11px] font-bold">WSJF</span>
              <span className="font-mono font-bold text-accent-yellow px-1.5 rounded bg-bg-card">{Number(brief.wsjf_score).toFixed(2)}</span>
            </div>
          )}
          {brief.claimed_by && (
            <div className="flex items-center gap-1 px-2 py-1 border border-border bg-bg-primary rounded">
              <span className="text-text-muted uppercase text-[11px] font-bold">Agent</span>
              <span className="font-mono font-bold text-accent-purple px-1.5 rounded bg-bg-card">{brief.claimed_by}</span>
            </div>
          )}
        </div>

        {/* DAG Steps */}
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
            Directed Acyclic Graph (DAG) Execution Matrix
            <span className="px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue text-[11px]">
              {planSteps.length} nodes
            </span>
          </p>

          {planSteps.length === 0 ? (
            <div className="text-center py-6 text-text-muted text-xs border border-dashed border-border rounded bg-bg-card/50">
              No execution steps found in neural payload.
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
              {planSteps.map((step, idx) => {
                const stepNum = step.step || step.id || idx + 1;
                return (
                  <div key={idx} className="relative flex items-start gap-4">
                    {/* Dot */}
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-bg-primary bg-bg-card shrink-0 z-10">
                      <span className="text-xs text-accent-blue font-bold">{stepNum}</span>
                    </div>
                    {/* Card */}
                    <div className="flex-1 p-3 rounded-xl border border-border bg-bg-card/80 hover:bg-bg-card transition-all shadow-sm group">
                      <p className="text-[11px] font-bold text-text-primary mb-1 group-hover:text-accent-blue transition-colors">
                        {step.action || step.description || step.task || "Node Action"}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 border-t border-border/50 pt-2">
                        {(step.agent || step.assigned_to) && (
                          <div className="text-[11px] flex items-center gap-1">
                             <span className="text-text-muted">AGENT:</span>
                             <span className="text-accent-purple font-bold">{step.agent || step.assigned_to}</span>
                          </div>
                        )}
                        {(step.dependencies || step.depends_on) && (
                          <div className="text-[11px] flex items-center gap-1">
                             <span className="text-text-muted">BLOCKS:</span>
                             <span className="text-accent-yellow font-bold">NODE {JSON.stringify(step.dependencies || step.depends_on)}</span>
                          </div>
                        )}
                        <div className="text-[11px] flex items-center gap-1">
                           <span className="text-text-muted">STATUS:</span>
                           <span className="text-accent-green font-bold uppercase">Ready</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Meta / Routing */}
        <div className="grid grid-cols-2 gap-4">
           {routing && (
              <div className="p-3 bg-bg-card border border-border rounded-xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 font-mono">Routing Manifest</p>
                <pre className="text-[11px] text-text-secondary font-mono overflow-auto max-h-32">
                  {JSON.stringify(routing, null, 2)}
                </pre>
              </div>
           )}
           <div className="p-3 bg-bg-card border border-border rounded-xl">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 font-mono">Raw Node Payload</p>
              <pre className="text-[11px] text-text-muted/50 font-mono overflow-auto max-h-32">
                {JSON.stringify(brief.payload, null, 2)}
              </pre>
           </div>
        </div>
      </div>
    </div>
  );
}
