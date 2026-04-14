"use client";

import { type Brief } from "@/lib/supabase";

interface BriefDetailPanelProps {
  brief: Brief | null;
  onClose: () => void;
}

export default function BriefDetailPanel({ brief, onClose }: BriefDetailPanelProps) {
  // Try parsing the node_6 payload for the DAG steps
  let planSteps: any[] = [];
  let routing = null;

  if (brief?.payload) {
    const payload = brief.payload as any;
    const n6 = payload.node_6_execution_plan;
    if (n6 && Array.isArray(n6.steps)) {
      planSteps = n6.steps;
    } else if (n6 && Array.isArray(n6.tasks)) {
      planSteps = n6.tasks;
    }
    routing = payload.routing_result;
  }

  // Basic styling
  const panelStyle = {
    width: brief ? "600px" : "0px",
    borderLeft: brief ? "1px solid var(--border-default)" : "none",
    background: "var(--bg-sidebar)",
    pointerEvents: brief ? ("auto" as const) : ("none" as const),
  };

  return (
    <div
      className="fixed top-0 right-0 h-full z-40 flex flex-col overflow-hidden transition-[width] duration-200"
      style={panelStyle}
    >
      {brief && (
        <>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-bg-card">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-wider text-accent-blue uppercase">
                DAG Inspector // B-{brief.id}
              </span>
              <span className="text-xs text-text-primary font-medium truncate mt-1">
                {brief.name}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary text-xs transition-colors p-2"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Status overview */}
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 border border-border bg-bg-card rounded shadow-sm text-text-primary">
                <span className="text-text-muted uppercase text-[9px] mr-1">Status:</span>
                <span className="font-bold">{brief.status}</span>
              </span>
              {brief.wsjf_score && (
                <span className="px-2 py-1 border border-border bg-bg-card rounded shadow-sm text-text-primary">
                  <span className="text-text-muted uppercase text-[9px] mr-1">WSJF:</span>
                  <span className="font-bold text-accent-yellow">{Number(brief.wsjf_score).toFixed(2)}</span>
                </span>
              )}
              {brief.claimed_by && (
                <span className="px-2 py-1 border border-border bg-bg-card rounded shadow-sm text-text-primary">
                  <span className="text-text-muted uppercase text-[9px] mr-1">Claimed By:</span>
                  <span className="font-bold text-accent-purple">{brief.claimed_by}</span>
                </span>
              )}
            </div>

            {/* Routing Data (if exists) */}
            {routing && (
              <div className="p-3 bg-bg-card border border-border rounded">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Routing Result</p>
                <pre className="text-[10px] text-text-secondary font-mono overflow-auto">
                  {JSON.stringify(routing, null, 2)}
                </pre>
              </div>
            )}

            {/* DAG Steps */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                Directed Acyclic Graph (DAG) Execution
                <span className="px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue text-[9px]">
                  {planSteps.length} nodes
                </span>
              </p>

              {planSteps.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs border border-dashed border-border rounded">
                  No execution steps found in payload.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {planSteps.map((step, idx) => {
                    const stepNum = step.step || step.id || idx + 1;
                    return (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Dot */}
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-bg-sidebar bg-accent-blue shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow absolute left-0 md:left-1/2 transform -translate-x-1/2 z-10">
                          <span className="text-[9px] text-black font-bold">{stepNum}</span>
                        </div>
                        {/* Card */}
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] ml-[1.5rem] md:ml-0 p-3 rounded border border-border bg-bg-card hover:bg-bg-card-hover transition-colors shadow-sm">
                          <p className="text-xs font-bold text-text-primary mb-1">
                            {step.action || step.description || "Node Action"}
                          </p>
                          {(step.agent || step.assigned_to) && (
                            <p className="text-[10px] text-accent-purple mb-1 font-mono">
                              Sub-node Agent: {step.agent || step.assigned_to}
                            </p>
                          )}
                          {(step.dependencies || step.depends_on) && (
                            <p className="text-[10px] text-accent-yellow">
                              Blocks on: {JSON.stringify(step.dependencies || step.depends_on)}
                            </p>
                          )}
                          <p className="text-[10px] text-text-muted line-clamp-2 mt-2">
                            {step.expected_outcome || step.rationale || "No expected outcome defined."}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Raw JSON payload block */}
            <div className="mt-8 pt-4 border-t border-border">
               <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Raw JSON Payload Schema</p>
               <details>
                 <summary className="text-xs text-accent-green cursor-pointer select-none">View System Payload</summary>
                 <pre className="text-[9px] bg-black p-3 rounded mt-2 border border-border text-text-muted overflow-auto max-h-64 font-mono">
                   {JSON.stringify(brief.payload, null, 2)}
                 </pre>
               </details>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
