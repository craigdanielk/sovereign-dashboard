"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface MetricCard {
  label: string;
  value: number | string;
  colour: string;
}

interface RecentItem {
  id: number | string;
  title: string;
  status: string;
  source: string;
  created_at: string;
}

function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function navigateTab(key: string) {
  const setter = (window as unknown as Record<string, unknown>).__setActiveTab as
    | ((tab: string) => void)
    | undefined;
  if (setter) setter(key);
}

export default function RootTab() {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      { data: queued },
      { data: completedToday },
      { data: artifacts },
      { data: recentBriefs },
    ] = await Promise.all([
      supabase.from("briefs").select("id").in("status", ["QUEUED", "CLAIMED", "IN_PROGRESS"]),
      supabase.from("briefs").select("id").eq("status", "COMPLETED").gte("completed_at", today.toISOString()),
      supabase.from("artifacts").select("id").eq("status", "DELIVERED"),
      supabase.from("briefs").select("id, name, status, created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    const cutoff = new Date(Date.now() - 30 * 60000).toISOString();
    const { data: recentLogs } = await supabase
      .from("execution_log")
      .select("agent")
      .gte("created_at", cutoff);

    const activeAgents = recentLogs
      ? new Set(recentLogs.map((l: { agent: string }) => l.agent)).size
      : 0;

    setMetrics([
      { label: "Briefs queued", value: queued?.length || 0, colour: "#7C3AED" },
      { label: "Completed today", value: completedToday?.length || 0, colour: "#10B981" },
      { label: "Agents active", value: activeAgents, colour: "#F59E0B" },
      { label: "Artifacts delivered", value: artifacts?.length || 0, colour: "#6366F1" },
    ]);

    if (recentBriefs) {
      setRecent(
        recentBriefs.map((b: { id: number; name: string; status: string; created_at: string }) => ({
          id: b.id,
          title: b.name,
          status: b.status,
          source: "North Star",
          created_at: b.created_at,
        }))
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);

    const channel = supabase
      .channel("root-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, fetchData)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const STATUS_COLOUR: Record<string, string> = {
    QUEUED: "#6366F1",
    CLAIMED: "#F59E0B",
    IN_PROGRESS: "#F59E0B",
    COMPLETED: "#10B981",
    DONE: "#10B981",
    FAILED: "#EF4444",
    BLOCKED: "#EF4444",
    DRAFT: "#6B6B6B",
    PENDING: "#6B6B6B",
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "#111111" }}>
      {/* Section header */}
      <div
        className="flex items-center justify-between flex-shrink-0 border-b"
        style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: "#E5E5E5" }}>Overview</span>
        <button
          onClick={fetchData}
          style={{ fontSize: 12, color: "#6B6B6B", padding: "4px 8px" }}
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: "20px 16px" }}>
        {/* Metric cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {metrics.map((m) => (
            <div
              key={m.label}
              style={{
                background: "#161616",
                border: "1px solid #2A2A2A",
                borderRadius: 6,
                padding: "16px 14px",
              }}
            >
              <div style={{ fontSize: 11, color: "#6B6B6B", marginBottom: 8 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: m.colour, lineHeight: 1 }}>
                {loading ? "—" : m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Quick nav */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Sections
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {[
              { key: "north-star", label: "North Star" },
              { key: "battlefield", label: "Battlefield" },
              { key: "recon", label: "Recon" },
              { key: "r17", label: "R17" },
              { key: "command", label: "Workspace" },
              { key: "ops", label: "Operational" },
              { key: "comms", label: "Comms" },
              { key: "artifacts", label: "Artifacts" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => navigateTab(item.key)}
                style={{
                  background: "#161616",
                  border: "1px solid #2A2A2A",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#A0A0A0",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#7C3AED";
                  (e.currentTarget as HTMLButtonElement).style.color = "#E5E5E5";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2A2A";
                  (e.currentTarget as HTMLButtonElement).style.color = "#A0A0A0";
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div style={{ fontSize: 11, color: "#6B6B6B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Recent activity
          </div>
          <div
            style={{
              background: "#161616",
              border: "1px solid #2A2A2A",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {loading ? (
              <div style={{ padding: "24px", fontSize: 13, color: "#6B6B6B", textAlign: "center" }}>Loading…</div>
            ) : recent.length === 0 ? (
              <div style={{ padding: "24px", fontSize: 13, color: "#6B6B6B", textAlign: "center" }}>No recent activity</div>
            ) : (
              recent.map((item) => (
                <div
                  key={item.id}
                  className="list-row"
                  onClick={() => navigateTab("north-star")}
                  style={{ cursor: "pointer" }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: "1px solid #2A2A2A",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="font-mono"
                    style={{ fontSize: 11, color: "#6B6B6B", flexShrink: 0, minWidth: 28 }}
                  >
                    #{item.id}
                  </span>
                  <span
                    className="truncate flex-1"
                    style={{ fontSize: 13, color: "#E5E5E5" }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: STATUS_COLOUR[item.status] ?? "#6B6B6B",
                      background: `${STATUS_COLOUR[item.status] ?? "#6B6B6B"}15`,
                      borderRadius: 4,
                      padding: "1px 6px",
                      flexShrink: 0,
                    }}
                  >
                    {item.status}
                  </span>
                  <span style={{ fontSize: 11, color: "#6B6B6B", flexShrink: 0, minWidth: 28, textAlign: "right" }}>
                    {timeAgo(item.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
