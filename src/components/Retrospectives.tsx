"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type SessionRetrospective } from "@/lib/supabase";

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "--";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const DATA_QUALITY_COLOURS: Record<string, string> = {
  COMPLETE: "#00ff41",
  PARTIAL: "#ffb800",
  HOLLOW: "#ff1744",
};

export default function Retrospectives() {
  const [retros, setRetros] = useState<SessionRetrospective[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleInsert = useCallback((payload: { new: SessionRetrospective }) => {
    setRetros((prev) => [payload.new as SessionRetrospective, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    supabase
      .from("session_retrospectives")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setRetros(data);
      });

    const channel = supabase
      .channel("retros-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_retrospectives" },
        handleInsert
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleInsert]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border">
        <h2 className="text-sm font-bold tracking-wider uppercase text-accent-yellow">
          Session Retrospectives
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {retros.map((retro) => {
          const dqColour = retro.data_quality
            ? DATA_QUALITY_COLOURS[retro.data_quality.toUpperCase()] || "#404040"
            : "#404040";

          return (
            <div key={retro.id}>
              <button
                onClick={() => setExpanded(expanded === retro.id ? null : retro.id)}
                className="w-full text-left px-3 py-2 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted w-14">
                      {new Date(retro.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="text-xs text-text-primary truncate max-w-[160px]">
                      {retro.session_id.slice(0, 12)}...
                    </span>
                    {/* Data quality badge */}
                    {retro.data_quality && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: dqColour,
                          backgroundColor: `${dqColour}15`,
                        }}
                      >
                        {retro.data_quality.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-accent-cyan">{retro.tool_calls_count || 0} calls</span>
                    <span className="text-text-muted">
                      {formatDuration(retro.total_duration_minutes)}
                    </span>
                    {retro.api_cost_estimate != null && (
                      <span className="text-accent-orange">
                        ${Number(retro.api_cost_estimate).toFixed(2)}
                      </span>
                    )}
                    {retro.health_score != null && (
                      <span
                        className={
                          Number(retro.health_score) >= 0.8
                            ? "text-accent-green"
                            : Number(retro.health_score) >= 0.5
                            ? "text-accent-yellow"
                            : "text-accent-red"
                        }
                      >
                        {(Number(retro.health_score) * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="text-text-muted">
                      {expanded === retro.id ? "[-]" : "[+]"}
                    </span>
                  </div>
                </div>
                {retro.summary && (
                  <p className="text-[10px] text-text-secondary mt-1 truncate">{retro.summary}</p>
                )}
              </button>

              {expanded === retro.id && (
                <div className="px-3 py-2 mx-1 bg-bg-primary border border-border border-t-0 rounded-b text-[10px] space-y-1">
                  {retro.model_used && (
                    <div>
                      <span className="text-text-muted">model: </span>
                      <span className="text-text-secondary">{retro.model_used}</span>
                    </div>
                  )}
                  {retro.working_directory && (
                    <div>
                      <span className="text-text-muted">dir: </span>
                      <span className="text-text-secondary">{retro.working_directory}</span>
                    </div>
                  )}
                  {retro.brief_ids_claimed && retro.brief_ids_claimed.length > 0 && (
                    <div>
                      <span className="text-text-muted">claimed: </span>
                      <span className="text-accent-yellow">
                        {retro.brief_ids_claimed.map((id) => `#${id}`).join(", ")}
                      </span>
                    </div>
                  )}
                  {retro.brief_ids_completed && retro.brief_ids_completed.length > 0 && (
                    <div>
                      <span className="text-text-muted">completed: </span>
                      <span className="text-accent-green">
                        {retro.brief_ids_completed.map((id) => `#${id}`).join(", ")}
                      </span>
                    </div>
                  )}
                  {retro.brief_ids_failed && retro.brief_ids_failed.length > 0 && (
                    <div>
                      <span className="text-text-muted">failed: </span>
                      <span className="text-accent-red">
                        {retro.brief_ids_failed.map((id) => `#${id}`).join(", ")}
                      </span>
                    </div>
                  )}
                  {retro.tool_calls_by_type && Object.keys(retro.tool_calls_by_type).length > 0 && (
                    <div>
                      <span className="text-text-muted">tools: </span>
                      <span className="text-text-secondary">
                        {Object.entries(retro.tool_calls_by_type)
                          .sort(([, a], [, b]) => b - a)
                          .map(([tool, count]) => `${tool}(${count})`)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {retro.files_modified && retro.files_modified.length > 0 && (
                    <div>
                      <span className="text-text-muted">modified: </span>
                      <span className="text-accent-blue">{retro.files_modified.length} files</span>
                    </div>
                  )}
                  {retro.files_created && retro.files_created.length > 0 && (
                    <div>
                      <span className="text-text-muted">created: </span>
                      <span className="text-accent-green">{retro.files_created.length} files</span>
                    </div>
                  )}

                  {/* Errors encountered */}
                  {retro.errors_encountered &&
                    (Array.isArray(retro.errors_encountered)
                      ? retro.errors_encountered.length > 0
                      : Object.keys(retro.errors_encountered).length > 0) && (
                      <div className="mt-1 pt-1 border-t border-border">
                        <span className="text-accent-red font-bold">ERRORS: </span>
                        <div className="ml-2 mt-0.5 space-y-0.5">
                          {(Array.isArray(retro.errors_encountered)
                            ? retro.errors_encountered
                            : Object.entries(retro.errors_encountered).map(
                                ([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`
                              )
                          ).map((err, i) => (
                            <div key={i} className="text-accent-red/80">
                              {typeof err === "string" ? err : JSON.stringify(err)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* False assumptions */}
                  {retro.false_assumptions &&
                    (Array.isArray(retro.false_assumptions)
                      ? retro.false_assumptions.length > 0
                      : Object.keys(retro.false_assumptions).length > 0) && (
                      <div className="mt-1 pt-1 border-t border-border">
                        <span className="text-accent-yellow font-bold">FALSE ASSUMPTIONS: </span>
                        <div className="ml-2 mt-0.5 space-y-0.5">
                          {(Array.isArray(retro.false_assumptions)
                            ? retro.false_assumptions
                            : Object.entries(retro.false_assumptions).map(
                                ([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`
                              )
                          ).map((fa, i) => (
                            <div key={i} className="text-accent-yellow/80">
                              {typeof fa === "string" ? fa : JSON.stringify(fa)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Retrospective tag */}
                  {retro.retrospective_tag && Object.keys(retro.retrospective_tag).length > 0 && (
                    <div className="mt-1 pt-1 border-t border-border">
                      <span className="text-accent-purple font-bold">TAGS: </span>
                      <span className="text-text-secondary">
                        {Object.entries(retro.retrospective_tag)
                          .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {retros.length === 0 && (
          <div className="text-center text-text-muted py-4 text-xs">No retrospectives yet</div>
        )}
      </div>
    </div>
  );
}
