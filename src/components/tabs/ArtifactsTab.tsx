"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import LinearListRow from "@/components/LinearListRow";
import EmptyState from "@/components/EmptyState";

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
  file:     "#6366F1",
  report:   "#7C3AED",
  repo:     "#6366F1",
  url:      "#6366F1",
  demo:     "#F59E0B",
  deploy:   "#10B981",
  code:     "#6366F1",
  document: "#F59E0B",
  outreach: "#F59E0B",
};

const STATUS_COLOURS: Record<string, string> = {
  verified: "#10B981",
  built:    "#F59E0B",
  deployed: "#6366F1",
  failed:   "#EF4444",
  live:     "#10B981",
  DELIVERED:"#10B981",
};

const FILTER_TYPES = ["ALL", "file", "report", "repo", "url", "deploy"] as const;

export default function ArtifactsTab() {
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchArtifacts = useCallback(async () => {
    let query = supabase
      .from("artifacts")
      .select("id, brief_name, agent, artifact_type, title, location, commit, test_url, status, verified_by_human, verified_at, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (typeFilter) {
      query = query.eq("artifact_type", typeFilter);
    }

    const { data } = await query;
    if (data) setArtifacts(data as ArtifactRow[]);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    fetchArtifacts();

    const channel = supabase
      .channel("artifacts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "artifacts" }, fetchArtifacts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchArtifacts]);

  const typeCounts: Record<string, number> = {};
  artifacts.forEach((a) => {
    const t = a.artifact_type || "unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  return (
    <div className="h-full flex overflow-hidden">
      {/* List panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Section header */}
        <div
          className="flex items-center justify-between flex-shrink-0 border-b"
          style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: "#E5E5E5" }}>Artifacts</span>
          <span style={{ fontSize: 12, color: "#6B6B6B" }}>{artifacts.length} total</span>
        </div>

        {/* Filter strip */}
        <div
          className="flex items-center gap-2 flex-shrink-0 border-b overflow-x-auto"
          style={{ padding: "8px 16px", borderColor: "#2A2A2A" }}
        >
          {FILTER_TYPES.map((t) => {
            const isAll = t === "ALL";
            const active = isAll ? !typeFilter : typeFilter === t;
            const count = isAll ? artifacts.length : typeCounts[t] || 0;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(isAll ? null : typeFilter === t ? null : t)}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: `1px solid ${active ? "#7C3AED" : "#2A2A2A"}`,
                  color: active ? "#7C3AED" : "#6B6B6B",
                  background: active ? "#7C3AED15" : "transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t}{!isAll && ` (${count})`}
              </button>
            );
          })}
        </div>

        {/* Artifact list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <EmptyState message="Loading artifacts…" />
          ) : artifacts.length === 0 ? (
            <EmptyState message="No artifacts registered" />
          ) : (
            artifacts.map((artifact) => {
              const typeCol = TYPE_COLOURS[artifact.artifact_type || ""] || "#6B6B6B";
              const statusStr = artifact.status?.toUpperCase() ?? "";
              const statusCol = STATUS_COLOURS[artifact.status || ""] || STATUS_COLOURS[statusStr] || "#6B6B6B";
              const link = artifact.test_url || artifact.location;
              return (
                <LinearListRow
                  key={artifact.id}
                  title={artifact.title || "(untitled)"}
                  status={artifact.status?.toUpperCase() ?? undefined}
                  badge={artifact.artifact_type || undefined}
                  badgeColor={typeCol}
                  secondaryText={link || undefined}
                  timestamp={artifact.created_at}
                  onClick={() => setSelectedArtifact(artifact)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedArtifact && (
        <div
          className="detail-panel h-full flex flex-col border-l"
          style={{ width: 420, minWidth: 420, background: "#161616", borderColor: "#2A2A2A" }}
        >
          <div
            className="flex items-center justify-between border-b flex-shrink-0"
            style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: "#E5E5E5" }}>Artifact</span>
            <button onClick={() => setSelectedArtifact(null)} style={{ color: "#6B6B6B", padding: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, color: "#E5E5E5", marginBottom: 16 }}>
              {selectedArtifact.title || "(untitled)"}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "8px 12px", fontSize: 12 }}>
              <span style={{ color: "#6B6B6B" }}>Type</span>
              <span style={{ color: "#E5E5E5" }}>{selectedArtifact.artifact_type || "—"}</span>
              <span style={{ color: "#6B6B6B" }}>Status</span>
              <span style={{ color: "#E5E5E5" }}>{selectedArtifact.status || "—"}</span>
              <span style={{ color: "#6B6B6B" }}>Agent</span>
              <span style={{ color: "#E5E5E5" }}>{selectedArtifact.agent || "—"}</span>
              <span style={{ color: "#6B6B6B" }}>Brief</span>
              <span className="font-mono" style={{ color: "#E5E5E5", fontSize: 11, wordBreak: "break-all" }}>
                {selectedArtifact.brief_name || "—"}
              </span>
              {selectedArtifact.location && (
                <>
                  <span style={{ color: "#6B6B6B" }}>URL</span>
                  <a
                    href={selectedArtifact.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#7C3AED", fontSize: 11, wordBreak: "break-all" }}
                  >
                    {selectedArtifact.location}
                  </a>
                </>
              )}
              {selectedArtifact.commit && (
                <>
                  <span style={{ color: "#6B6B6B" }}>Commit</span>
                  <span className="font-mono" style={{ color: "#E5E5E5", fontSize: 11 }}>
                    {selectedArtifact.commit.slice(0, 8)}
                  </span>
                </>
              )}
              {selectedArtifact.verified_by_human && (
                <>
                  <span style={{ color: "#6B6B6B" }}>Verified</span>
                  <span style={{ color: "#10B981" }}>Human verified</span>
                </>
              )}
              {selectedArtifact.notes && (
                <>
                  <span style={{ color: "#6B6B6B" }}>Notes</span>
                  <span style={{ color: "#A0A0A0", fontSize: 12 }}>{selectedArtifact.notes}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
