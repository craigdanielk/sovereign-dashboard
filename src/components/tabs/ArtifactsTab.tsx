"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// Matches the actual artifacts table schema
interface ArtifactRow {
  id: string;
  brief_name: string | null;
  agent: string | null;
  artifact_type: string | null;
  title: string | null;
  location: string | null;
  commit: string | null;
  test_url: string | null;
  status: string | null;
  verified_by_human: boolean | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
}

const TYPE_COLOURS: Record<string, string> = {
  file: "#39ff14",
  report: "#b388ff",
  repo: "#00b0ff",
  url: "#00e5ff",
  demo: "#ffb800",
  deploy: "#00ff41",
  code: "#39ff14",
  document: "#ffb800",
  outreach: "#ff6d00",
};

const STATUS_COLOURS: Record<string, string> = {
  verified: "#00ff41",
  built: "#ffb800",
  deployed: "#00b0ff",
  failed: "#ff1744",
  live: "#00ff41",
};

const FILTER_TYPES = ["ALL", "file", "report", "repo", "url"] as const;

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ArtifactsTab() {
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetchArtifacts = useCallback(async () => {
    let query = supabase
      .from("artifacts")
      .select(
        "id, brief_name, agent, artifact_type, title, location, commit, test_url, status, verified_by_human, verified_at, notes, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (typeFilter) {
      query = query.eq("artifact_type", typeFilter);
    }

    const { data } = await query;
    if (data) setArtifacts(data as ArtifactRow[]);
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

  // Dynamic type counts from all data (unfiltered)
  const typeCounts: Record<string, number> = {};
  artifacts.forEach((a) => {
    const t = a.artifact_type || "unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  // Status counts
  const statusCounts: Record<string, number> = {};
  artifacts.forEach((a) => {
    const s = a.status || "unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-3">
        <span className="text-[10px] font-bold text-accent-orange tracking-wider">
          ARTIFACTS
        </span>
        <span className="text-[9px] text-text-muted">{artifacts.length} total</span>

        <span className="text-text-muted text-[10px]">|</span>

        {/* Filter pills */}
        <div className="flex gap-1">
          {FILTER_TYPES.map((t) => {
            const isAll = t === "ALL";
            const active = isAll ? !typeFilter : typeFilter === t;
            const count = isAll
              ? artifacts.length
              : typeCounts[t] || 0;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(isAll ? null : typeFilter === t ? null : t)}
                className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors uppercase ${
                  active
                    ? "border-current"
                    : "border-border text-text-muted hover:text-text-secondary"
                }`}
                style={{
                  color: active
                    ? isAll
                      ? "#00ff41"
                      : TYPE_COLOURS[t] || "#d4d4d4"
                    : undefined,
                }}
              >
                {t} {!isAll && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* Status summary chips */}
        <div className="ml-auto flex items-center gap-2">
          {Object.entries(statusCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([status, count]) => (
              <span
                key={status}
                className="text-[9px] font-bold"
                style={{ color: STATUS_COLOURS[status] || "#737373" }}
              >
                {status.toUpperCase()}: {count}
              </span>
            ))}
        </div>
      </div>

      {/* Artifact list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {artifacts.map((artifact) => {
          const typeCol = TYPE_COLOURS[artifact.artifact_type || ""] || "#737373";
          const statusCol = STATUS_COLOURS[artifact.status || ""] || "#737373";
          const link = artifact.test_url || artifact.location;

          return (
            <div
              key={artifact.id}
              className="px-3 py-2 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors"
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Type badge */}
                  <span
                    className="text-[9px] uppercase font-bold shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      color: typeCol,
                      backgroundColor: `${typeCol}15`,
                    }}
                  >
                    {artifact.artifact_type || "?"}
                  </span>
                  {/* Title */}
                  <span className="text-[10px] text-text-primary truncate">
                    {artifact.title || "(untitled)"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Brief name */}
                  {artifact.brief_name && (
                    <span className="text-[9px] text-accent-yellow truncate max-w-[140px]">
                      {artifact.brief_name}
                    </span>
                  )}
                  {/* Agent */}
                  {artifact.agent && (
                    <span className="text-[9px] text-accent-purple font-bold uppercase">
                      {artifact.agent}
                    </span>
                  )}
                  {/* Status badge */}
                  {artifact.status && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: statusCol,
                        backgroundColor: `${statusCol}15`,
                      }}
                    >
                      {artifact.status.toUpperCase()}
                    </span>
                  )}
                  {/* Verified badge */}
                  {artifact.verified_by_human && (
                    <span className="text-[9px] text-accent-green font-bold">HUMAN OK</span>
                  )}
                  <span className="text-[9px] text-text-muted">{timeAgo(artifact.created_at)}</span>
                </div>
              </div>

              {/* Links row */}
              <div className="flex items-center gap-2 text-[9px] text-text-muted">
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-cyan hover:text-accent-green transition-colors truncate max-w-[400px]"
                  >
                    {link}
                  </a>
                )}
                {artifact.commit && (
                  <span className="text-text-secondary shrink-0">
                    commit: {artifact.commit.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {artifacts.length === 0 && (
          <div className="text-[10px] text-text-muted text-center py-8">
            No artifacts registered
          </div>
        )}
      </div>
    </div>
  );
}
