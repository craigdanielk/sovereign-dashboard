"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Artifact } from "@/lib/types";

const TYPE_COLOURS: Record<string, string> = {
  demo: "#00ff41",
  deploy: "#00b0ff",
  report: "#b388ff",
  url: "#00e5ff",
  document: "#ffb800",
  code: "#39ff14",
  outreach: "#ff6d00",
};

export default function ArtifactsTab() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetchArtifacts = useCallback(async () => {
    let query = supabase
      .from("artifacts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (typeFilter) {
      query = query.eq("type", typeFilter);
    }

    const { data } = await query;
    if (data) setArtifacts(data as Artifact[]);
  }, [typeFilter]);

  useEffect(() => {
    fetchArtifacts();

    const channel = supabase
      .channel("artifacts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "artifacts" }, () =>
        fetchArtifacts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchArtifacts]);

  const typeCounts: Record<string, number> = {};
  artifacts.forEach((a) => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });
  const types = Object.keys(typeCounts).sort();

  const outreachArtifacts = artifacts.filter((a) => a.type === "outreach");
  const outreachApproved = outreachArtifacts.filter((a) => a.status === "APPROVED").length;

  function timeAgo(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-3">
        <span className="text-[10px] font-bold text-accent-orange tracking-wider">
          ARTIFACTS
        </span>
        <span className="text-[9px] text-text-muted">{artifacts.length} total</span>

        <span className="text-text-muted text-[10px]">|</span>

        <div className="flex gap-1">
          <button
            onClick={() => setTypeFilter(null)}
            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
              !typeFilter
                ? "border-accent-green text-accent-green"
                : "border-border text-text-muted hover:text-text-secondary"
            }`}
          >
            ALL
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors uppercase ${
                typeFilter === t
                  ? "border-current"
                  : "border-border text-text-muted hover:text-text-secondary"
              }`}
              style={{
                color: typeFilter === t ? TYPE_COLOURS[t] || "#d4d4d4" : undefined,
              }}
            >
              {t} ({typeCounts[t]})
            </button>
          ))}
        </div>

        {outreachArtifacts.length > 0 && (
          <>
            <span className="text-text-muted text-[10px] ml-auto">|</span>
            <span className="text-[9px] text-accent-orange">
              OUTREACH GATE {outreachApproved}/{outreachArtifacts.length}
            </span>
          </>
        )}
      </div>

      {/* Artifact list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="px-3 py-2 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors"
          >
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[9px] uppercase font-bold shrink-0 px-1.5 py-0.5 rounded"
                  style={{
                    color: TYPE_COLOURS[artifact.type] || "#737373",
                    backgroundColor: `${TYPE_COLOURS[artifact.type] || "#737373"}15`,
                  }}
                >
                  {artifact.type}
                </span>
                <span className="text-[10px] text-text-primary truncate">
                  {artifact.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {artifact.brief_id && (
                  <span className="text-[9px] text-accent-yellow">#{artifact.brief_id}</span>
                )}
                {artifact.status && (
                  <span
                    className={`text-[9px] font-bold ${
                      artifact.status === "APPROVED"
                        ? "text-accent-green"
                        : artifact.status === "PENDING"
                        ? "text-accent-yellow"
                        : "text-text-muted"
                    }`}
                  >
                    {artifact.status}
                  </span>
                )}
                <span className="text-[9px] text-text-muted">{timeAgo(artifact.created_at)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[9px] text-text-muted">
              {artifact.url && (
                <a
                  href={artifact.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-cyan hover:text-accent-green transition-colors truncate max-w-[300px]"
                >
                  {artifact.url}
                </a>
              )}
              {artifact.workspace_slug && (
                <span className="text-accent-purple ml-auto shrink-0">
                  {artifact.workspace_slug}
                </span>
              )}
            </div>
          </div>
        ))}
        {artifacts.length === 0 && (
          <div className="text-[10px] text-text-muted text-center py-8">
            No artifacts registered
          </div>
        )}
      </div>
    </div>
  );
}
