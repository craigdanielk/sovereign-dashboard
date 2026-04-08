"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Brief } from "@/lib/supabase";
import LinearListRow from "@/components/LinearListRow";
import LinearGroupHeader from "@/components/LinearGroupHeader";
import EmptyState from "@/components/EmptyState";

// ── Detail panel ──────────────────────────────────────────────────
function DetailPanel({ brief, onClose }: { brief: Brief; onClose: () => void }) {
  function timeStr(ts: string | null): string {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div
      className="detail-panel h-full flex flex-col border-l overflow-hidden"
      style={{
        width: 480,
        minWidth: 480,
        background: "#161616",
        borderColor: "#2A2A2A",
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between border-b flex-shrink-0"
        style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: "#E5E5E5" }}>BRIEF</span>
        <button
          onClick={onClose}
          style={{ color: "#6B6B6B", padding: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "16px" }}>
        {/* Title */}
        <h2
          className="font-mono"
          style={{ fontSize: 13, color: "#E5E5E5", marginBottom: 16, lineHeight: 1.5, wordBreak: "break-word" }}
        >
          {brief.name}
        </h2>

        {/* Metadata grid */}
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "8px 12px", fontSize: 12 }}>
          <span style={{ color: "#6B6B6B" }}>Status</span>
          <span style={{ color: "#E5E5E5" }}>{brief.status}</span>

          <span style={{ color: "#6B6B6B" }}>Priority</span>
          <span style={{ color: "#E5E5E5" }}>{brief.priority || "—"}</span>

          {brief.claimed_by && (
            <>
              <span style={{ color: "#6B6B6B" }}>Claimed by</span>
              <span style={{ color: "#E5E5E5" }}>{brief.claimed_by}</span>
            </>
          )}

          {brief.wsjf_score != null && (
            <>
              <span style={{ color: "#6B6B6B" }}>WSJF</span>
              <span style={{ color: "#E5E5E5" }}>{Number(brief.wsjf_score).toFixed(1)}</span>
            </>
          )}

          {brief.quality_grade && (
            <>
              <span style={{ color: "#6B6B6B" }}>Quality</span>
              <span style={{
                color: brief.quality_grade === "GREEN" ? "#10B981"
                  : brief.quality_grade === "YELLOW" ? "#F59E0B"
                  : "#EF4444",
              }}>
                {brief.quality_grade}
              </span>
            </>
          )}

          <span style={{ color: "#6B6B6B" }}>Created</span>
          <span style={{ color: "#E5E5E5" }}>{timeStr(brief.created_at)}</span>

          {brief.completed_at && (
            <>
              <span style={{ color: "#6B6B6B" }}>Completed</span>
              <span style={{ color: "#E5E5E5" }}>{timeStr(brief.completed_at)}</span>
            </>
          )}
        </div>

        {/* Payload */}
        {brief.payload && (
          <div style={{ marginTop: 20 }}>
            <span style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Payload
            </span>
            <pre
              className="font-mono"
              style={{
                marginTop: 8,
                padding: 12,
                background: "#111111",
                borderRadius: 6,
                fontSize: 11,
                color: "#A0A0A0",
                overflow: "auto",
                maxHeight: 400,
                border: "1px solid #2A2A2A",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(brief.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Group header ──────────────────────────────────────────────────
const STATUS_ORDER = ["QUEUED", "CLAIMED", "IN_PROGRESS", "FAILED", "COMPLETED", "SUPERSEDED", "DRAFT", "PENDING"];

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  CLAIMED: "Claimed",
  IN_PROGRESS: "In Progress",
  FAILED: "Failed",
  COMPLETED: "Completed",
  SUPERSEDED: "Superseded",
  DRAFT: "Draft",
  PENDING: "Pending",
};

const DEFAULT_EXPANDED = new Set(["QUEUED", "CLAIMED", "IN_PROGRESS", "FAILED"]);

// ── Main component ────────────────────────────────────────────────
export default function NorthStarTab() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(DEFAULT_EXPANDED);
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);

  const fetchBriefs = useCallback(async () => {
    const { data } = await supabase
      .from("briefs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data) setBriefs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBriefs();

    const channel = supabase
      .channel("northstar-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, fetchBriefs)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBriefs]);

  // Group briefs by status
  const grouped = briefs.reduce<Record<string, Brief[]>>((acc, brief) => {
    const s = brief.status;
    if (!acc[s]) acc[s] = [];
    acc[s].push(brief);
    return acc;
  }, {});

  const orderedStatuses = [
    ...STATUS_ORDER.filter((s) => grouped[s]?.length),
    ...Object.keys(grouped).filter((s) => !STATUS_ORDER.includes(s)),
  ];

  function toggleGroup(status: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const totalActive = (grouped["QUEUED"]?.length || 0) + (grouped["CLAIMED"]?.length || 0) + (grouped["IN_PROGRESS"]?.length || 0);

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── List panel ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Section header */}
        <div
          className="flex items-center justify-between flex-shrink-0 border-b"
          style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 15, fontWeight: 600, color: "#E5E5E5" }}>North Star</span>
            {totalActive > 0 && (
              <span
                style={{
                  fontSize: 11,
                  background: "#7C3AED22",
                  color: "#7C3AED",
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontWeight: 500,
                }}
              >
                {totalActive} active
              </span>
            )}
          </div>
          <button
            style={{
              fontSize: 12,
              color: "#E5E5E5",
              background: "#7C3AED",
              borderRadius: 6,
              padding: "5px 12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            New BRIEF
          </button>
        </div>

        {/* Brief list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <EmptyState message="Loading briefs…" />
          ) : orderedStatuses.length === 0 ? (
            <EmptyState message="No briefs yet" />
          ) : (
            orderedStatuses.map((status) => {
              const items = grouped[status] || [];
              const expanded = expandedGroups.has(status);
              return (
                <div key={status}>
                  <LinearGroupHeader
                    label={STATUS_LABELS[status] ?? status}
                    count={items.length}
                    expanded={expanded}
                    onToggle={() => toggleGroup(status)}
                  />
                  {expanded && items.map((brief) => {
                    const labels = brief.payload?.labels as Record<string, unknown> | undefined;
                    const tenantBadge = typeof labels?.client_slug === "string" ? labels.client_slug : undefined;
                    return (
                      <LinearListRow
                        key={brief.id}
                        id={brief.id}
                        title={brief.name}
                        status={brief.status}
                        priority={brief.priority ?? undefined}
                        badge={tenantBadge}
                        timestamp={brief.created_at}
                        onClick={() => setSelectedBrief(brief)}
                      />
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────── */}
      {selectedBrief && (
        <DetailPanel
          brief={selectedBrief}
          onClose={() => setSelectedBrief(null)}
        />
      )}
    </div>
  );
}
