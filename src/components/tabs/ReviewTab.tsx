"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────
interface OvernightBrief {
  id: number;
  name: string;
  priority: string;
  status: string;
  claimed_at: string | null;
  title: string | null;
  artifact_type: string | null;
  location: string | null;
  test_url: string | null;
  artifact_status: string | null;
  verified_by_human: boolean | null;
}

interface UnverifiedArtifact {
  id: number;
  brief_name: string | null;
  title: string;
  artifact_type: string;
  location: string | null;
  test_url: string | null;
  status: string | null;
  created_at: string;
  verified_by_human: boolean;
}

interface LiveDeployment {
  id: number;
  title: string;
  artifact_type: string;
  location: string | null;
  test_url: string | null;
  status: string | null;
  created_at: string;
  brief_name: string | null;
}

interface ReportArtifact {
  id: number;
  title: string;
  location: string | null;
  status: string | null;
  created_at: string;
  brief_name: string | null;
  content: string | null;
}

interface CostEntry {
  agent: string;
  sessions: number;
  events: number;
}

// ── Helpers ──────────────────────────────────────────────────────
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusBadge(status: string | null, verified: boolean | null) {
  if (verified) return { colour: "#00ff41", label: "VERIFIED" };
  if (status === "failed") return { colour: "#ff1744", label: "FAILED" };
  return { colour: "#ffb800", label: "NEEDS REVIEW" };
}

// ── Section: Overnight Summary ───────────────────────────────────
function OvernightSummary({ items }: { items: OvernightBrief[] }) {
  // Deduplicate by brief id, collect artifacts per brief
  const briefMap = new Map<
    number,
    { brief: OvernightBrief; artifacts: OvernightBrief[] }
  >();
  for (const row of items) {
    if (!briefMap.has(row.id)) {
      briefMap.set(row.id, { brief: row, artifacts: [] });
    }
    if (row.title) {
      briefMap.get(row.id)!.artifacts.push(row);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-bold text-accent-green tracking-wider glow-green">
          OVERNIGHT SUMMARY
        </span>
        <span className="text-[9px] text-text-muted">
          {briefMap.size} completed (24h)
        </span>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto max-h-[260px]">
        {briefMap.size === 0 && (
          <div className="text-[10px] text-text-muted text-center py-4">
            No completed BRIEFs in the last 24 hours
          </div>
        )}
        {Array.from(briefMap.values()).map(({ brief, artifacts }) => {
          const badge = statusBadge(
            brief.artifact_status,
            brief.verified_by_human
          );
          return (
            <div
              key={brief.id}
              className="px-3 py-2 rounded bg-bg-card border border-border"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-accent-yellow">
                    #{brief.id}
                  </span>
                  <span className="text-[10px] text-text-primary">
                    {brief.name}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color: badge.colour,
                      backgroundColor: `${badge.colour}15`,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                <span className="text-[9px] text-text-muted">
                  {brief.priority}
                </span>
              </div>
              {artifacts.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {artifacts.map((a, i) => (
                    <span
                      key={i}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary border border-border"
                    >
                      {a.artifact_type}: {a.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section: Needs Verification ──────────────────────────────────
function NeedsVerification({
  items,
  onApprove,
  onReject,
  loadingId,
}: {
  items: UnverifiedArtifact[];
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  loadingId: number | null;
}) {
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function handleReject(id: number) {
    if (!rejectReason.trim()) return;
    onReject(id, rejectReason.trim());
    setRejectId(null);
    setRejectReason("");
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-bold text-accent-yellow tracking-wider">
          NEEDS VERIFICATION
        </span>
        <span className="text-[9px] text-text-muted">
          {items.length} pending
        </span>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto max-h-[300px]">
        {items.length === 0 && (
          <div className="text-[10px] text-text-muted text-center py-4">
            All artifacts verified
          </div>
        )}
        {items.map((artifact) => (
          <div
            key={artifact.id}
            className="px-3 py-2 rounded bg-bg-card border border-border"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[9px] uppercase font-bold shrink-0 px-1.5 py-0.5 rounded"
                  style={{
                    color: "#00e5ff",
                    backgroundColor: "#00e5ff15",
                  }}
                >
                  {artifact.artifact_type}
                </span>
                <span className="text-[10px] text-text-primary truncate">
                  {artifact.title}
                </span>
              </div>
              <span className="text-[9px] text-text-muted shrink-0">
                {timeAgo(artifact.created_at)}
              </span>
            </div>

            {artifact.location && (
              <div className="text-[9px] text-accent-cyan truncate mb-1">
                {artifact.location}
              </div>
            )}
            {artifact.test_url && (
              <a
                href={artifact.test_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-accent-blue hover:text-accent-green transition-colors block truncate mb-1"
              >
                {artifact.test_url}
              </a>
            )}

            {rejectId === artifact.id ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason..."
                  className="flex-1 text-[10px] px-2 py-1 rounded bg-bg-secondary border border-border text-text-primary placeholder-text-muted outline-none focus:border-accent-red"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReject(artifact.id);
                    if (e.key === "Escape") {
                      setRejectId(null);
                      setRejectReason("");
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleReject(artifact.id)}
                  disabled={!rejectReason.trim()}
                  className="text-[9px] px-2 py-1 rounded bg-accent-red/20 text-accent-red border border-accent-red/30 hover:bg-accent-red/30 transition-colors disabled:opacity-30"
                >
                  CONFIRM
                </button>
                <button
                  onClick={() => {
                    setRejectId(null);
                    setRejectReason("");
                  }}
                  className="text-[9px] px-2 py-1 rounded text-text-muted hover:text-text-secondary transition-colors"
                >
                  ESC
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => onApprove(artifact.id)}
                  disabled={loadingId === artifact.id}
                  className="text-[9px] px-2 py-1 rounded bg-accent-green/20 text-accent-green border border-accent-green/30 hover:bg-accent-green/30 transition-colors disabled:opacity-50"
                >
                  {loadingId === artifact.id ? "..." : "APPROVE"}
                </button>
                <button
                  onClick={() => setRejectId(artifact.id)}
                  disabled={loadingId === artifact.id}
                  className="text-[9px] px-2 py-1 rounded bg-accent-red/20 text-accent-red border border-accent-red/30 hover:bg-accent-red/30 transition-colors disabled:opacity-50"
                >
                  REJECT
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Live Deployments ────────────────────────────────────
function LiveDeployments({ items }: { items: LiveDeployment[] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-bold text-accent-cyan tracking-wider">
          LIVE DEPLOYMENTS
        </span>
        <span className="text-[9px] text-text-muted">
          {items.length} active
        </span>
      </div>
      <div className="p-2 grid grid-cols-2 gap-1 overflow-y-auto max-h-[260px]">
        {items.length === 0 && (
          <div className="col-span-2 text-[10px] text-text-muted text-center py-4">
            No live deployments found
          </div>
        )}
        {items.map((d) => (
          <a
            key={d.id}
            href={d.test_url || d.location || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded bg-bg-card border border-border hover:bg-bg-card-hover hover:border-accent-cyan/30 transition-colors block"
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-text-primary truncate">
                {d.title}
              </span>
              {d.status && (
                <span
                  className={`text-[9px] font-bold shrink-0 ml-1 ${
                    d.status === "live" || d.status === "deployed"
                      ? "text-accent-green"
                      : d.status === "failed"
                      ? "text-accent-red"
                      : "text-accent-yellow"
                  }`}
                >
                  {d.status.toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-[9px] text-accent-cyan truncate">
              {d.test_url || d.location || "No URL"}
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px] text-text-muted uppercase">
                {d.artifact_type}
              </span>
              <span className="text-[9px] text-text-muted">
                {timeAgo(d.created_at)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Section: Reports ─────────────────────────────────────────────
function Reports({ items }: { items: ReportArtifact[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-bold text-accent-purple tracking-wider">
          REPORTS
        </span>
        <span className="text-[9px] text-text-muted">{items.length} total</span>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto max-h-[260px]">
        {items.length === 0 && (
          <div className="text-[10px] text-text-muted text-center py-4">
            No reports found
          </div>
        )}
        {items.map((r) => (
          <div
            key={r.id}
            className="rounded bg-bg-card border border-border overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedId(expandedId === r.id ? null : r.id)
              }
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-bg-card-hover transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-text-primary truncate">
                  {r.title}
                </span>
                {r.brief_name && (
                  <span className="text-[9px] text-accent-yellow shrink-0">
                    {r.brief_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-text-muted">
                  {timeAgo(r.created_at)}
                </span>
                <span className="text-[9px] text-text-muted">
                  {expandedId === r.id ? "[-]" : "[+]"}
                </span>
              </div>
            </button>
            {expandedId === r.id && (
              <div className="px-3 py-2 border-t border-border bg-bg-secondary">
                <pre className="text-[10px] text-text-secondary whitespace-pre-wrap font-[inherit] max-h-[200px] overflow-y-auto">
                  {r.content || r.location || "No content available"}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Cost Summary ────────────────────────────────────────
function CostSummary({ items }: { items: CostEntry[] }) {
  const totalSessions = items.reduce((s, e) => s + e.sessions, 0);
  const totalEvents = items.reduce((s, e) => s + e.events, 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-bold text-accent-orange tracking-wider">
          COST SUMMARY (24H)
        </span>
        <span className="text-[9px] text-text-muted">
          {totalSessions} sessions / {totalEvents} events
        </span>
      </div>
      <div className="p-2 space-y-0.5 overflow-y-auto max-h-[200px]">
        {items.length === 0 && (
          <div className="text-[10px] text-text-muted text-center py-4">
            No execution data in the last 24 hours
          </div>
        )}
        {items.map((entry) => {
          const pct =
            totalEvents > 0
              ? Math.round((entry.events / totalEvents) * 100)
              : 0;
          return (
            <div
              key={entry.agent}
              className="px-3 py-1.5 rounded bg-bg-card border border-border flex items-center gap-2"
            >
              <span className="text-[10px] text-accent-green font-bold w-24 shrink-0 uppercase">
                {entry.agent}
              </span>
              <div className="flex-1 h-1.5 bg-bg-secondary rounded overflow-hidden">
                <div
                  className="h-full bg-accent-orange rounded"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[9px] text-text-secondary w-20 text-right shrink-0">
                {entry.sessions}s / {entry.events}e
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ReviewTab ───────────────────────────────────────────────
export default function ReviewTab() {
  const [overnight, setOvernight] = useState<OvernightBrief[]>([]);
  const [unverified, setUnverified] = useState<UnverifiedArtifact[]>([]);
  const [deployments, setDeployments] = useState<LiveDeployment[]>([]);
  const [reports, setReports] = useState<ReportArtifact[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const fetchAll = useCallback(async () => {
    // 1. Overnight summary — completed BRIEFs with their artifacts (last 24h)
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: briefData } = await supabase
      .from("briefs")
      .select("id, name, priority, status, claimed_at")
      .eq("status", "COMPLETED")
      .gte("claimed_at", twentyFourHoursAgo)
      .order("claimed_at", { ascending: false });

    if (briefData && briefData.length > 0) {
      // Fetch artifacts for these briefs
      const briefNames = briefData.map(
        (b: { name: string }) => b.name
      );
      const { data: artData } = await supabase
        .from("artifacts")
        .select(
          "title, artifact_type, location, test_url, status, verified_by_human, brief_name"
        )
        .in("brief_name", briefNames);

      const artMap = new Map<string, typeof artData>();
      if (artData) {
        for (const a of artData) {
          const key = a.brief_name as string;
          if (!artMap.has(key)) artMap.set(key, []);
          artMap.get(key)!.push(a);
        }
      }

      const merged: OvernightBrief[] = [];
      for (const b of briefData) {
        const arts = artMap.get(b.name) || [];
        if (arts.length === 0) {
          merged.push({
            ...b,
            title: null,
            artifact_type: null,
            location: null,
            test_url: null,
            artifact_status: null,
            verified_by_human: null,
          });
        } else {
          for (const a of arts) {
            merged.push({
              ...b,
              title: a.title,
              artifact_type: a.artifact_type,
              location: a.location,
              test_url: a.test_url,
              artifact_status: a.status,
              verified_by_human: a.verified_by_human,
            });
          }
        }
      }
      setOvernight(merged);
    } else {
      setOvernight([]);
    }

    // 2. Needs verification
    const { data: unvData } = await supabase
      .from("artifacts")
      .select("*")
      .eq("verified_by_human", false)
      .order("created_at", { ascending: false });
    if (unvData) setUnverified(unvData as UnverifiedArtifact[]);

    // 3. Live deployments
    const { data: deployData } = await supabase
      .from("artifacts")
      .select("*")
      .or(
        "artifact_type.in.(url,demo),location.ilike.https://%"
      )
      .order("created_at", { ascending: false });
    if (deployData) setDeployments(deployData as LiveDeployment[]);

    // 4. Reports
    const { data: reportData } = await supabase
      .from("artifacts")
      .select("*")
      .eq("artifact_type", "report")
      .order("created_at", { ascending: false });
    if (reportData) setReports(reportData as ReportArtifact[]);

    // 5. Cost summary
    const { data: costData } = await supabase.rpc("review_cost_summary");
    if (costData) {
      setCosts(costData as CostEntry[]);
    } else {
      // Fallback: query execution_log directly
      const { data: logData } = await supabase
        .from("execution_log")
        .select("agent, session_id")
        .gte("created_at", twentyFourHoursAgo);
      if (logData) {
        const agentMap = new Map<
          string,
          { sessions: Set<string>; events: number }
        >();
        for (const row of logData) {
          const a = row.agent || "unknown";
          if (!agentMap.has(a))
            agentMap.set(a, { sessions: new Set(), events: 0 });
          const entry = agentMap.get(a)!;
          if (row.session_id) entry.sessions.add(row.session_id);
          entry.events++;
        }
        const costEntries: CostEntry[] = Array.from(agentMap.entries())
          .map(([agent, data]) => ({
            agent,
            sessions: data.sessions.size,
            events: data.events,
          }))
          .sort((a, b) => b.sessions - a.sessions);
        setCosts(costEntries);
      }
    }

    setLastRefresh(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    fetchAll();

    // Realtime subscription for artifacts changes
    const channel = supabase
      .channel("review-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artifacts" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefs" },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  async function handleApprove(id: number) {
    setLoadingId(id);
    try {
      const res = await fetch("/api/review/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifact_id: id }),
      });
      if (res.ok) {
        await fetchAll();
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: number, reason: string) {
    setLoadingId(id);
    try {
      const res = await fetch("/api/review/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifact_id: id, reason }),
      });
      if (res.ok) {
        await fetchAll();
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-3">
        <span className="text-[10px] font-bold text-accent-green tracking-wider glow-green">
          MORNING REVIEW
        </span>
        <span className="text-[9px] text-text-muted">
          Last refresh: {lastRefresh || "loading..."}
        </span>
        <button
          onClick={fetchAll}
          className="ml-auto text-[9px] px-2 py-0.5 rounded border border-border text-text-muted hover:text-accent-green hover:border-accent-green/30 transition-colors"
        >
          REFRESH
        </button>
      </div>

      {/* Content grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-2 gap-0">
          {/* Left column */}
          <div className="border-r border-border">
            <OvernightSummary items={overnight} />
            <div className="border-t border-border">
              <NeedsVerification
                items={unverified}
                onApprove={handleApprove}
                onReject={handleReject}
                loadingId={loadingId}
              />
            </div>
          </div>

          {/* Right column */}
          <div>
            <LiveDeployments items={deployments} />
            <div className="border-t border-border">
              <Reports items={reports} />
            </div>
            <div className="border-t border-border">
              <CostSummary items={costs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
