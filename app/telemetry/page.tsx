"use client";

import { useEffect, useState, useCallback } from "react";
import { NavBar } from "../components/NavBar";
import { StaleBanner } from "../components/StaleBanner";
import { staleFetch } from "../hooks/useStaleFetch";

interface TelemetryData {
  totalSessions: number;
  completedBriefs: number;
  failedBriefs: number;
  deferredBriefs: number;
  avgHealthScore: number | null;
  errorRate: number;
  topErrors: { error: string; count: number }[];
  topFailedTools: { tool: string; count: number }[];
  topMissingSkills: { skill: string; count: number }[];
  dailyCosts: { date: string; cost: number; calls: number }[];
  perAgentCost: { agent: string; cost: number; calls: number; tokens: number }[];
  perClientCost: { client: string; cost: number; calls: number }[];
  totalCost: number;
  todayCost: number;
  completionRate: number;
  recentSessions: {
    session_id: string;
    created_at: string;
    summary: string | null;
    health_score: number | null;
    completed: number;
    failed: number;
    errors: number;
    missing_skills: number;
  }[];
  fetchedAt: string;
}

const AGENT_COLOURS: Record<string, string> = {
  recon: "#ff9f0a",
  sage: "#30d158",
  aragon: "#0a84ff",
  prism: "#bf5af2",
  executor: "#ff375f",
  planner: "#64d2ff",
  lore: "#ffd60a",
  kira: "#ac8e68",
  forge: "#ff6961",
  deliver: "#77dd77",
};

function agentColour(agent: string): string {
  return AGENT_COLOURS[agent.toLowerCase()] ?? "var(--text-3)";
}

function fmt$(n: number): string {
  if (n < 0.001) return "<$0.001";
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function KPI({
  label,
  value,
  alert,
  sub,
}: {
  label: string;
  value: string;
  alert?: boolean;
  sub?: string;
}) {
  return (
    <div className="glass-inner p-4 space-y-1">
      <div
        className="text-[10px] uppercase tracking-widest"
        style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold tabular-nums"
        style={{
          color: alert ? "var(--red, #ff375f)" : "var(--text-1)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[9px]" style={{ color: "var(--text-4)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SparkBar({ dailyCosts }: { dailyCosts: TelemetryData["dailyCosts"] }) {
  if (dailyCosts.length === 0) return null;
  const max = Math.max(...dailyCosts.map((d) => d.cost), 0.001);
  return (
    <div className="flex items-end gap-[2px] h-10">
      {dailyCosts.slice(-30).map((d) => {
        const pct = (d.cost / max) * 100;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${fmt$(d.cost)} (${d.calls} calls)`}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${Math.max(pct, 4)}%`,
              background: "var(--green, #30d158)",
              opacity: 0.75,
            }}
          />
        );
      })}
    </div>
  );
}

export default function TelemetryPage() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [stale, setStale] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await staleFetch<TelemetryData>("/api/telemetry");
      setData(result.data);
      setStale(result.stale);
      setCachedAt(result.cachedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{
        background: "var(--bg-0, #0a0a0a)",
        color: "var(--text-1, #f2f2f2)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <NavBar />
        </div>
        <span
          className="text-[10px]"
          style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
        >
          {data ? `fetched ${timeAgo(data.fetchedAt)}` : "—"}
        </span>
      </div>

      {stale && cachedAt && <StaleBanner cachedAt={cachedAt} />}

      {/* KPI row */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <KPI label="Sessions (30d)" value={String(data.totalSessions)} />
          <KPI
            label="Completion rate"
            value={fmtPct(data.completionRate)}
            alert={data.completionRate < 0.7}
            sub={`${data.completedBriefs} done / ${data.failedBriefs} failed`}
          />
          <KPI
            label="Error rate"
            value={fmtPct(data.errorRate)}
            alert={data.errorRate > 0.3}
          />
          <KPI
            label="Health score"
            value={data.avgHealthScore != null ? String(data.avgHealthScore) : "—"}
          />
          <KPI label="Today cost" value={fmt$(data.todayCost)} alert={data.todayCost >= 10} />
          <KPI label="30-day cost" value={fmt$(data.totalCost)} />
        </div>
      )}

      {loading && (
        <div className="glass-inner p-8 text-center" style={{ color: "var(--text-4)" }}>
          Loading telemetry...
        </div>
      )}

      {/* Daily cost burn */}
      {data && data.dailyCosts.length > 0 && (
        <div className="glass-inner p-4 space-y-2">
          <div
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Daily cost burn — last 30 days
          </div>
          <SparkBar dailyCosts={data.dailyCosts} />
          <div
            className="flex justify-between text-[9px]"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            <span>{data.dailyCosts[0]?.date ?? ""}</span>
            <span>today</span>
          </div>
        </div>
      )}

      {/* Two-column layout: Agent costs + Missing skills */}
      {data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Per-agent cost */}
          {data.perAgentCost.length > 0 && (
            <div className="glass-inner p-4 space-y-3">
              <div
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
              >
                Cost by agent (30d)
              </div>
              <div className="space-y-2">
                {data.perAgentCost.map((a) => {
                  const maxCost = Math.max(
                    ...data.perAgentCost.map((x) => x.cost),
                    0.001
                  );
                  const pct = (a.cost / maxCost) * 100;
                  return (
                    <div key={a.agent} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background: agentColour(a.agent),
                              boxShadow: `0 0 6px ${agentColour(a.agent)}66`,
                            }}
                          />
                          <span
                            className="text-[12px] font-medium"
                            style={{
                              color: "var(--text-2)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {a.agent}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-3 text-[11px] tabular-nums"
                          style={{
                            color: "var(--text-3)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          <span>{fmtTokens(a.tokens)} tok</span>
                          <span>{a.calls} calls</span>
                          <span
                            className="font-semibold"
                            style={{ color: agentColour(a.agent) }}
                          >
                            {fmt$(a.cost)}
                          </span>
                        </div>
                      </div>
                      <div
                        className="h-1 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: agentColour(a.agent),
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Most missing skills */}
          <div className="space-y-6">
            {data.topMissingSkills.length > 0 && (
              <div className="glass-inner p-4 space-y-3">
                <div
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  Most missing skills
                </div>
                <div className="space-y-1.5">
                  {data.topMissingSkills.map((s) => (
                    <div
                      key={s.skill}
                      className="flex items-center justify-between text-[12px]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <span style={{ color: "var(--text-2)" }}>{s.skill}</span>
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: "#ffd60a" }}
                      >
                        {s.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Most failed tools */}
            {data.topFailedTools.length > 0 && (
              <div className="glass-inner p-4 space-y-3">
                <div
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  Most failed tools
                </div>
                <div className="space-y-1.5">
                  {data.topFailedTools.map((t) => (
                    <div
                      key={t.tool}
                      className="flex items-center justify-between text-[12px]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <span style={{ color: "var(--text-2)" }}>{t.tool}</span>
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: "var(--red, #ff375f)" }}
                      >
                        {t.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-client cost breakdown */}
      {data && data.perClientCost.length > 1 && (
        <div className="glass-inner p-4 space-y-3">
          <div
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Cost by client (30d)
          </div>
          <div className="space-y-1.5">
            {data.perClientCost.map((c) => (
              <div
                key={c.client}
                className="flex items-center justify-between text-[12px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span style={{ color: "var(--text-2)" }}>{c.client}</span>
                <div
                  className="flex items-center gap-3 text-[11px] tabular-nums"
                  style={{ color: "var(--text-3)" }}
                >
                  <span>{c.calls} calls</span>
                  <span className="font-semibold" style={{ color: "var(--text-1)" }}>
                    {fmt$(c.cost)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top errors */}
      {data && data.topErrors.length > 0 && (
        <div className="glass-inner p-4 space-y-3">
          <div
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Top errors (30d)
          </div>
          <div className="space-y-1.5">
            {data.topErrors.slice(0, 8).map((e, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[11px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span
                  className="max-w-[80%] truncate"
                  style={{ color: "var(--text-3)" }}
                >
                  {e.error}
                </span>
                <span
                  className="tabular-nums font-semibold"
                  style={{ color: "var(--red, #ff375f)" }}
                >
                  {e.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions table */}
      {data && data.recentSessions.length > 0 && (
        <div className="glass-inner p-4 space-y-3">
          <div
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Recent sessions
          </div>
          <div className="overflow-x-auto">
            <table
              className="w-full text-[11px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <thead>
                <tr
                  style={{
                    color: "var(--text-4)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {["Time", "Session", "Summary", "Done", "Failed", "Errors", "Gaps"].map(
                    (h) => (
                      <th
                        key={h}
                        className="pb-2 text-left font-medium pr-4 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.recentSessions.map((s) => (
                  <tr
                    key={s.session_id}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      color: "var(--text-2)",
                    }}
                  >
                    <td
                      className="py-1.5 pr-4 whitespace-nowrap"
                      style={{ color: "var(--text-4)" }}
                    >
                      {timeAgo(s.created_at)}
                    </td>
                    <td className="pr-4 whitespace-nowrap" style={{ color: "var(--text-3)" }}>
                      {s.session_id.slice(0, 8)}
                    </td>
                    <td
                      className="pr-4 max-w-[300px] truncate"
                      style={{ color: "var(--text-3)" }}
                    >
                      {s.summary ?? "—"}
                    </td>
                    <td className="pr-4 tabular-nums" style={{ color: "#30d158" }}>
                      {s.completed}
                    </td>
                    <td
                      className="pr-4 tabular-nums"
                      style={{
                        color: s.failed > 0 ? "var(--red, #ff375f)" : "var(--text-4)",
                      }}
                    >
                      {s.failed}
                    </td>
                    <td
                      className="pr-4 tabular-nums"
                      style={{
                        color: s.errors > 0 ? "var(--red, #ff375f)" : "var(--text-4)",
                      }}
                    >
                      {s.errors}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        color: s.missing_skills > 0 ? "#ffd60a" : "var(--text-4)",
                      }}
                    >
                      {s.missing_skills}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.totalSessions === 0 && data.dailyCosts.length === 0 && (
        <div
          className="glass-inner p-8 text-center"
          style={{ color: "var(--text-4)" }}
        >
          <div className="text-[13px]">No telemetry data yet.</div>
          <div className="text-[11px] mt-1">
            Session retrospectives will appear after executor sessions complete.
          </div>
        </div>
      )}

      {error && (
        <div
          className="glass-inner p-4 text-[12px]"
          style={{ color: "var(--red, #ff375f)", fontFamily: "var(--font-mono)" }}
        >
          Error: {error}
        </div>
      )}
    </div>
  );
}
