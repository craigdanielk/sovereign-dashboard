"use client";

import { useEffect, useState, useCallback } from "react";
import { NavBar } from "../components/NavBar";
import { StaleBanner } from "../components/StaleBanner";
import { staleFetch } from "../hooks/useStaleFetch";

interface AgentSummary {
  agent: string;
  total_cost: number;
  total_calls: number;
  total_tokens: number;
}

interface DailyTotal {
  date: string;
  total_cost: number;
  total_calls: number;
}

interface CostRow {
  id: number;
  created_at: string;
  agent: string;
  operation: string;
  model: string;
  provider: string;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
}

interface CostsData {
  rows: CostRow[];
  agentSummary: AgentSummary[];
  dailyTotals: DailyTotal[];
  monthTotal: number;
  todayTotal: number;
  fetchedAt: string;
}

const DAILY_ALERT_THRESHOLD = 10;

const AGENT_COLOURS: Record<string, string> = {
  recon: "#ff9f0a",
  sage: "#30d158",
  aragon: "#0a84ff",
  prism: "#bf5af2",
  executor: "#ff375f",
  planner: "#64d2ff",
};

function agentColour(agent: string): string {
  return AGENT_COLOURS[agent.toLowerCase()] ?? "var(--text-3)";
}

function fmt$(n: number): string {
  if (n < 0.001) return "<$0.001";
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`;
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

function SparkBar({
  dailyTotals,
}: {
  dailyTotals: DailyTotal[];
}) {
  if (dailyTotals.length === 0) return null;
  const max = Math.max(...dailyTotals.map((d) => d.total_cost), 0.001);
  return (
    <div className="flex items-end gap-[2px] h-10">
      {dailyTotals.slice(-30).map((d) => {
        const pct = (d.total_cost / max) * 100;
        const over = d.total_cost >= DAILY_ALERT_THRESHOLD;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${fmt$(d.total_cost)} (${d.total_calls} calls)`}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${Math.max(pct, 4)}%`,
              background: over ? "var(--red, #ff375f)" : "var(--green, #30d158)",
              opacity: 0.75,
            }}
          />
        );
      })}
    </div>
  );
}

export default function CostsPage() {
  const [data, setData] = useState<CostsData | null>(null);
  const [stale, setStale] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await staleFetch<CostsData>("/api/costs");
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

  const overBudget = (data?.todayTotal ?? 0) >= DAILY_ALERT_THRESHOLD;
  const maxAgentCost = Math.max(
    ...(data?.agentSummary.map((a) => a.total_cost) ?? [0.001])
  );

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: "var(--bg-0, #0a0a0a)", color: "var(--text-1, #f2f2f2)" }}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Today",
            value: data ? fmt$(data.todayTotal) : "—",
            alert: overBudget,
          },
          {
            label: "30-day total",
            value: data ? fmt$(data.monthTotal) : "—",
            alert: false,
          },
          {
            label: "Calls (30d)",
            value: data ? data.rows.length.toLocaleString() : "—",
            alert: false,
          },
          {
            label: "Agents active",
            value: data ? String(data.agentSummary.length) : "—",
            alert: false,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-inner p-4 space-y-1">
            <div
              className="text-[10px] uppercase tracking-widest"
              style={{
                color: "var(--text-4)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {kpi.label}
            </div>
            <div
              className="text-2xl font-bold tabular-nums"
              style={{
                color: kpi.alert ? "var(--red, #ff375f)" : "var(--text-1)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {loading ? (
                <span className="opacity-30">…</span>
              ) : (
                kpi.value
              )}
            </div>
            {kpi.alert && (
              <div
                className="text-[9px] font-semibold"
                style={{ color: "var(--red, #ff375f)" }}
              >
                ⚠ daily threshold exceeded
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Trend sparkbar */}
      {data && data.dailyTotals.length > 0 && (
        <div className="glass-inner p-4 space-y-2">
          <div
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Daily spend — last 30 days
          </div>
          <SparkBar dailyTotals={data.dailyTotals} />
          <div
            className="flex justify-between text-[9px]"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            <span>{data.dailyTotals[0]?.date ?? ""}</span>
            <span>today</span>
          </div>
        </div>
      )}

      {/* Agent breakdown */}
      {data && data.agentSummary.length > 0 && (
        <div className="glass-inner p-4 space-y-3">
          <div
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Cost by agent (30d)
          </div>
          <div className="space-y-2">
            {data.agentSummary.map((a) => {
              const pct =
                maxAgentCost > 0 ? (a.total_cost / maxAgentCost) * 100 : 0;
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
                      <span>{fmtTokens(a.total_tokens)} tok</span>
                      <span>{a.total_calls} calls</span>
                      <span
                        className="font-semibold"
                        style={{ color: agentColour(a.agent) }}
                      >
                        {fmt$(a.total_cost)}
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

      {/* Recent calls table */}
      {data && data.rows.length > 0 && (
        <div className="glass-inner p-4 space-y-3">
          <div
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Recent calls
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ fontFamily: "var(--font-mono)" }}>
              <thead>
                <tr
                  style={{
                    color: "var(--text-4)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {["Time", "Agent", "Operation", "Model", "Tokens", "Cost"].map(
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
                {data.rows.slice(0, 50).map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      color: "var(--text-2)",
                    }}
                  >
                    <td className="py-1.5 pr-4 whitespace-nowrap" style={{ color: "var(--text-4)" }}>
                      {timeAgo(row.created_at)}
                    </td>
                    <td className="pr-4 whitespace-nowrap">
                      <span
                        className="font-semibold"
                        style={{ color: agentColour(row.agent) }}
                      >
                        {row.agent}
                      </span>
                    </td>
                    <td
                      className="pr-4 max-w-[180px] truncate"
                      style={{ color: "var(--text-3)" }}
                    >
                      {row.operation}
                    </td>
                    <td className="pr-4 whitespace-nowrap" style={{ color: "var(--text-4)" }}>
                      {row.model.replace("claude-", "").replace("-20251001", "")}
                    </td>
                    <td className="pr-4 tabular-nums" style={{ color: "var(--text-3)" }}>
                      {row.total_tokens != null ? fmtTokens(row.total_tokens) : "—"}
                    </td>
                    <td className="tabular-nums font-medium" style={{ color: "var(--text-1)" }}>
                      {row.estimated_cost_usd != null ? fmt$(row.estimated_cost_usd) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.rows.length === 0 && (
        <div
          className="glass-inner p-8 text-center"
          style={{ color: "var(--text-4)" }}
        >
          <div className="text-[13px]">No cost data yet.</div>
          <div className="text-[11px] mt-1">
            Import{" "}
            <code
              className="px-1 rounded"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              utils/cost_tracker.py
            </code>{" "}
            and apply migration{" "}
            <code
              className="px-1 rounded"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              migrations/002_cost_log.sql
            </code>{" "}
            to start tracking.
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
