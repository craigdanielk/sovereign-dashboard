"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { NavBar } from "./components/NavBar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LogEntry {
  id: number;
  created_at: string;
  session_id: string;
  brief_id: number | null;
  agent: string;
  step_number: number;
  operation: string;
  trigger: string | null;
  tool_or_service: string | null;
  input_summary: string | null;
  output_summary: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  tokens_used: number | null;
  model: string | null;
  error_type: string | null;
  error_message: string | null;
  recovery_action: string | null;
}

interface AgentActivity {
  agent: string;
  ops: number;
  errors: number;
  lastSeen: string;
  lastOp: string;
  activeSessions: number;
  briefIds: number[];
}

interface LogSummary {
  totalLogs: number;
  opsLastHour: number;
  uniqueSessionsLastHour: number;
  totalErrors: number;
  recentErrors: number;
  agentActivity: AgentActivity[];
}

interface BriefRow {
  id: number;
  name: string;
  priority: string;
  status: string;
  triggered_by: string | null;
  blocked_by: string[] | null;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  claimed_by: string | null;
  failure_reason: string | null;
  summary: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(iso: string | null): string {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const AGENT_COLOURS: Record<string, string> = {
  sovereign: "#0a84ff",
  executor: "#ff375f",
  recon: "#ff9f0a",
  sage: "#30d158",
  aragon: "#0a84ff",
  prism: "#bf5af2",
  planner: "#64d2ff",
  lore: "#ffd60a",
  kira: "#ac8e68",
  forge: "#ff6961",
  deliver: "#77dd77",
  monitor: "#5ac8fa",
};

function agentColour(agent: string): string {
  return AGENT_COLOURS[agent.toLowerCase()] ?? "var(--text-3)";
}

function statusColour(status: string): string {
  switch (status.toUpperCase()) {
    case "QUEUED": return "var(--orange)";
    case "CLAIMED": return "var(--blue)";
    case "COMPLETED": return "var(--green)";
    case "FAILED": return "var(--red)";
    case "SUPERSEDED": return "var(--text-4)";
    case "PENDING": return "var(--yellow)";
    default: return "var(--text-3)";
  }
}

function statusBg(status: string): string {
  switch (status.toUpperCase()) {
    case "QUEUED": return "var(--orange-dim)";
    case "CLAIMED": return "var(--blue-dim)";
    case "COMPLETED": return "var(--green-dim)";
    case "FAILED": return "var(--red-dim)";
    case "SUPERSEDED": return "rgba(255,255,255,0.03)";
    case "PENDING": return "var(--yellow-dim)";
    default: return "rgba(255,255,255,0.03)";
  }
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonPanel() {
  return (
    <div className="space-y-4 p-1">
      <div className="skeleton h-5 w-40" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Metric                                                         */
/* ------------------------------------------------------------------ */

function KPI({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="glass-inner p-4 space-y-1 text-center">
      <div
        className="text-[10px] uppercase tracking-widest"
        style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold tabular-nums"
        style={{
          color: color ?? "var(--text-1)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="text-[9px]"
          style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel 1: Live Execution Log Stream                                 */
/* ------------------------------------------------------------------ */

function ExecutionLogPanel({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) return <SkeletonPanel />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-soft-pulse"
            style={{ background: "var(--green)", boxShadow: "0 0 8px rgba(48,209,88,0.5)" }}
          />
          <h2
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--text-1)" }}
          >
            Live Execution Log
          </h2>
        </div>
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
        >
          {logs.length} recent
        </span>
      </div>

      <div
        className="space-y-1 max-h-[600px] overflow-y-auto pr-1"
        style={{ scrollbarGutter: "stable" }}
      >
        {logs.slice(0, 50).map((log, i) => {
          const hasError = !!log.error_type;
          return (
            <div
              key={log.id}
              className={`glass-inner p-2.5 animate-fade-up delay-${Math.min(i + 1, 8)}`}
              style={{
                borderColor: hasError
                  ? "rgba(255,69,58,0.2)"
                  : "rgba(255,255,255,0.04)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: hasError ? "var(--red)" : agentColour(log.agent),
                      boxShadow: `0 0 6px ${hasError ? "rgba(255,69,58,0.5)" : agentColour(log.agent) + "66"}`,
                    }}
                  />
                  <span
                    className="text-[11px] font-semibold"
                    style={{
                      color: agentColour(log.agent),
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {log.agent}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-[1px] rounded"
                    style={{
                      background: hasError
                        ? "var(--red-dim)"
                        : "rgba(255,255,255,0.04)",
                      color: hasError ? "var(--red)" : "var(--text-2)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {log.operation}
                  </span>
                </div>
                <span
                  className="text-[9px]"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  {timeAgo(log.created_at)}
                </span>
              </div>

              {/* Tool + summary */}
              <div className="flex items-center gap-2 ml-3.5">
                {log.tool_or_service && (
                  <span
                    className="text-[9px] px-1.5 py-[1px] rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      color: "var(--text-3)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {log.tool_or_service}
                  </span>
                )}
                {log.duration_ms != null && (
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                  >
                    {log.duration_ms}ms
                  </span>
                )}
                {log.brief_id && (
                  <span
                    className="text-[9px]"
                    style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                  >
                    BRIEF#{log.brief_id}
                  </span>
                )}
              </div>

              {/* Input/output summaries */}
              {log.input_summary && (
                <div
                  className="mt-1 ml-3.5 text-[10px] truncate"
                  style={{ color: "var(--text-3)", maxWidth: "100%" }}
                  title={log.input_summary}
                >
                  {log.input_summary.slice(0, 120)}
                </div>
              )}

              {/* Error details */}
              {hasError && (
                <div
                  className="mt-1 ml-3.5 text-[10px]"
                  style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}
                >
                  {log.error_type}: {log.error_message?.slice(0, 100)}
                  {log.recovery_action && (
                    <span style={{ color: "var(--orange)" }}>
                      {" "}| recovery: {log.recovery_action}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel 2: BRIEF Queue Status                                        */
/* ------------------------------------------------------------------ */

function BriefQueuePanel({ briefs }: { briefs: BriefRow[] }) {
  if (briefs.length === 0) return <SkeletonPanel />;

  // Count by status
  const counts: Record<string, number> = {};
  for (const b of briefs) {
    const s = b.status.toUpperCase();
    counts[s] = (counts[s] ?? 0) + 1;
  }

  const statusOrder = ["QUEUED", "CLAIMED", "PENDING", "COMPLETED", "FAILED", "SUPERSEDED"];
  const activeBriefs = briefs.filter((b) =>
    ["QUEUED", "CLAIMED", "PENDING"].includes(b.status.toUpperCase())
  );
  const recentCompleted = briefs
    .filter((b) => b.status.toUpperCase() === "COMPLETED")
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-[15px] font-semibold tracking-tight"
          style={{ color: "var(--text-1)" }}
        >
          BRIEF Queue
        </h2>
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
        >
          {briefs.length} total
        </span>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-3 gap-2 animate-fade-up delay-1">
        {statusOrder
          .filter((s) => (counts[s] ?? 0) > 0)
          .map((s) => (
            <div
              key={s}
              className="rounded-xl text-center py-2.5 px-2"
              style={{
                background: statusBg(s),
                border: `1px solid rgba(255,255,255,0.05)`,
              }}
            >
              <div
                className="text-lg font-bold tabular-nums"
                style={{
                  color: statusColour(s),
                  fontFamily: "var(--font-mono)",
                }}
              >
                {counts[s]}
              </div>
              <div
                className="text-[9px] font-semibold tracking-wider uppercase mt-0.5"
                style={{
                  color: statusColour(s),
                  fontFamily: "var(--font-mono)",
                  opacity: 0.7,
                }}
              >
                {s}
              </div>
            </div>
          ))}
      </div>

      {/* Active BRIEFs */}
      {activeBriefs.length > 0 && (
        <div className="space-y-2 animate-fade-up delay-2">
          <div
            className="text-[10px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-3)" }}
          >
            Active BRIEFs
          </div>
          {activeBriefs.map((b) => (
            <div
              key={b.id}
              className="glass-inner p-3"
              style={{
                borderColor:
                  b.status.toUpperCase() === "CLAIMED"
                    ? "rgba(10,132,255,0.15)"
                    : "rgba(255,159,10,0.12)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-1.5 py-[1px] rounded"
                    style={{
                      background: statusBg(b.status),
                      color: statusColour(b.status),
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {b.status.toUpperCase()}
                  </span>
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: b.priority === "P0" ? "var(--red)" : "var(--text-3)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {b.priority}
                  </span>
                </div>
                <span
                  className="text-[9px]"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  #{b.id}
                </span>
              </div>
              <div
                className="text-[11px] font-medium truncate"
                style={{ color: "var(--text-2)" }}
                title={b.name}
              >
                {b.name}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {b.claimed_by && (
                  <span
                    className="text-[9px]"
                    style={{
                      color: agentColour(b.claimed_by),
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {b.claimed_by}
                  </span>
                )}
                <span
                  className="text-[9px]"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  {timeAgo(b.claimed_at ?? b.created_at)}
                </span>
              </div>
              {b.failure_reason && (
                <div
                  className="text-[9px] mt-1 truncate"
                  style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}
                  title={b.failure_reason}
                >
                  {b.failure_reason.slice(0, 100)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent completed */}
      {recentCompleted.length > 0 && (
        <div className="space-y-1.5 animate-fade-up delay-3">
          <div className="divider" />
          <div
            className="text-[10px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-3)" }}
          >
            Recently Completed
          </div>
          {recentCompleted.map((b) => (
            <div
              key={b.id}
              className="glass-inner p-2.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "var(--green)" }}
                />
                <span
                  className="text-[10px] truncate"
                  style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
                  title={b.name}
                >
                  {b.name}
                </span>
              </div>
              <span
                className="text-[9px] flex-shrink-0 ml-2"
                style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
              >
                {timeAgo(b.completed_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel 3: Agent Dispatch Status                                     */
/* ------------------------------------------------------------------ */

function AgentDispatchPanel({
  agents,
  briefs,
}: {
  agents: AgentActivity[];
  briefs: BriefRow[];
}) {
  if (agents.length === 0) return <SkeletonPanel />;

  // Build a map of brief_id -> brief name for reference
  const briefMap = new Map<number, BriefRow>();
  for (const b of briefs) {
    briefMap.set(b.id, b);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-[15px] font-semibold tracking-tight"
          style={{ color: "var(--text-1)" }}
        >
          Agent Dispatch
        </h2>
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
        >
          {agents.length} agents
        </span>
      </div>

      <div className="space-y-2">
        {agents.map((agent, i) => {
          const isRecent =
            Date.now() - new Date(agent.lastSeen).getTime() < 300_000; // 5 min
          const briefNames = agent.briefIds
            .map((id) => briefMap.get(id))
            .filter(Boolean)
            .map((b) => b!.name);

          return (
            <div
              key={agent.agent}
              className={`glass-inner p-3.5 animate-fade-up delay-${Math.min(i + 1, 8)}`}
              style={{
                borderColor: isRecent
                  ? agentColour(agent.agent) + "22"
                  : "rgba(255,255,255,0.04)",
              }}
            >
              {/* Agent header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${isRecent ? "animate-soft-pulse" : ""}`}
                    style={{
                      background: agentColour(agent.agent),
                      boxShadow: isRecent
                        ? `0 0 8px ${agentColour(agent.agent)}88`
                        : "none",
                    }}
                  />
                  <span
                    className="text-[13px] font-semibold tracking-wide"
                    style={{
                      color: agentColour(agent.agent),
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {agent.agent}
                  </span>
                  {isRecent && (
                    <span
                      className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-[1px] rounded-full"
                      style={{
                        background: "var(--green-dim)",
                        color: "var(--green)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>
                <span
                  className="text-[9px]"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  {timeAgo(agent.lastSeen)}
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div>
                  <div
                    className="text-[9px] uppercase tracking-wider"
                    style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                  >
                    Ops
                  </div>
                  <div
                    className="text-[14px] font-bold tabular-nums"
                    style={{ color: "var(--text-1)", fontFamily: "var(--font-mono)" }}
                  >
                    {agent.ops}
                  </div>
                </div>
                <div>
                  <div
                    className="text-[9px] uppercase tracking-wider"
                    style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                  >
                    Sessions
                  </div>
                  <div
                    className="text-[14px] font-bold tabular-nums"
                    style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
                  >
                    {agent.activeSessions}
                  </div>
                </div>
                <div>
                  <div
                    className="text-[9px] uppercase tracking-wider"
                    style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                  >
                    Errors
                  </div>
                  <div
                    className="text-[14px] font-bold tabular-nums"
                    style={{
                      color: agent.errors > 0 ? "var(--red)" : "var(--text-4)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {agent.errors}
                  </div>
                </div>
              </div>

              {/* Last operation */}
              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] uppercase tracking-wider"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  Last:
                </span>
                <span
                  className="text-[10px] px-1.5 py-[1px] rounded"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--text-2)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {agent.lastOp}
                </span>
              </div>

              {/* Brief associations */}
              {briefNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {briefNames.slice(0, 3).map((name, j) => (
                    <span
                      key={j}
                      className="text-[8px] px-1.5 py-[1px] rounded-full truncate"
                      style={{
                        background: "var(--blue-dim)",
                        color: "var(--blue)",
                        fontFamily: "var(--font-mono)",
                        maxWidth: "200px",
                      }}
                      title={name}
                    >
                      {name.length > 40 ? name.slice(0, 37) + "..." : name}
                    </span>
                  ))}
                  {briefNames.length > 3 && (
                    <span
                      className="text-[8px] px-1.5 py-[1px]"
                      style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                    >
                      +{briefNames.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel 4: System Health                                             */
/* ------------------------------------------------------------------ */

function SystemHealthPanel({
  summary,
  briefs,
}: {
  summary: LogSummary | null;
  briefs: BriefRow[];
}) {
  if (!summary) return <SkeletonPanel />;

  // Stale claims: CLAIMED for > 30 minutes
  const staleClaims = briefs.filter((b) => {
    if (b.status.toUpperCase() !== "CLAIMED") return false;
    if (!b.claimed_at) return false;
    return Date.now() - new Date(b.claimed_at).getTime() > 1800_000;
  });

  // Failed briefs (recent)
  const failedBriefs = briefs
    .filter((b) => b.status.toUpperCase() === "FAILED")
    .slice(0, 5);

  // Error rate
  const errorRate =
    summary.totalLogs > 0
      ? Math.round((summary.totalErrors / summary.totalLogs) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-[15px] font-semibold tracking-tight"
          style={{ color: "var(--text-1)" }}
        >
          System Health
        </h2>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${staleClaims.length === 0 && errorRate < 10 ? "animate-soft-pulse" : ""}`}
            style={{
              background:
                staleClaims.length > 0
                  ? "var(--red)"
                  : errorRate > 10
                    ? "var(--orange)"
                    : "var(--green)",
              boxShadow:
                staleClaims.length > 0
                  ? "0 0 8px rgba(255,69,58,0.5)"
                  : errorRate > 10
                    ? "0 0 8px rgba(255,159,10,0.5)"
                    : "0 0 8px rgba(48,209,88,0.5)",
            }}
          />
          <span
            className="text-[10px] font-medium"
            style={{
              color:
                staleClaims.length > 0
                  ? "var(--red)"
                  : errorRate > 10
                    ? "var(--orange)"
                    : "var(--green)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {staleClaims.length > 0
              ? "DEGRADED"
              : errorRate > 10
                ? "WARNING"
                : "HEALTHY"}
          </span>
        </div>
      </div>

      {/* Throughput metrics */}
      <div className="grid grid-cols-2 gap-2 animate-fade-up delay-1">
        <div className="glass-inner p-3 text-center">
          <div
            className="text-lg font-bold tabular-nums"
            style={{ color: "var(--text-1)", fontFamily: "var(--font-mono)" }}
          >
            {summary.opsLastHour}
          </div>
          <div
            className="text-[9px] uppercase tracking-wider"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Ops / hour
          </div>
        </div>
        <div className="glass-inner p-3 text-center">
          <div
            className="text-lg font-bold tabular-nums"
            style={{ color: "var(--text-1)", fontFamily: "var(--font-mono)" }}
          >
            {summary.uniqueSessionsLastHour}
          </div>
          <div
            className="text-[9px] uppercase tracking-wider"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Sessions / hour
          </div>
        </div>
      </div>

      {/* Error rate */}
      <div className="glass-inner p-3.5 animate-fade-up delay-2">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-3)" }}
          >
            Error Rate
          </span>
          <span
            className="text-[14px] font-bold tabular-nums"
            style={{
              color: errorRate > 10 ? "var(--red)" : "var(--green)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {errorRate}%
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(errorRate, 100)}%`,
              background:
                errorRate > 20
                  ? "var(--red)"
                  : errorRate > 10
                    ? "var(--orange)"
                    : "var(--green)",
            }}
          />
        </div>
        <div
          className="flex justify-between mt-1.5 text-[9px]"
          style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
        >
          <span>{summary.totalErrors} errors</span>
          <span>{summary.totalLogs} total ops</span>
        </div>
      </div>

      {/* Stale claims warning */}
      {staleClaims.length > 0 && (
        <div
          className="glass-inner p-3.5 space-y-2 animate-fade-up delay-3"
          style={{ borderColor: "rgba(255,69,58,0.2)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background: "var(--red)",
                boxShadow: "0 0 6px rgba(255,69,58,0.5)",
              }}
            />
            <span
              className="text-[10px] font-semibold tracking-wider uppercase"
              style={{ color: "var(--red)" }}
            >
              Stale Claims ({staleClaims.length})
            </span>
          </div>
          {staleClaims.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between text-[10px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span
                className="truncate"
                style={{ color: "var(--text-2)", maxWidth: "70%" }}
                title={b.name}
              >
                #{b.id} {b.name}
              </span>
              <span style={{ color: "var(--red)" }}>
                {timeAgo(b.claimed_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent failures */}
      {failedBriefs.length > 0 && (
        <div className="space-y-1.5 animate-fade-up delay-4">
          <div
            className="text-[10px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-3)" }}
          >
            Recent Failures
          </div>
          {failedBriefs.map((b) => (
            <div key={b.id} className="glass-inner p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className="text-[10px] font-medium truncate"
                  style={{
                    color: "var(--text-2)",
                    fontFamily: "var(--font-mono)",
                    maxWidth: "70%",
                  }}
                  title={b.name}
                >
                  #{b.id} {b.name}
                </span>
                <span
                  className="text-[9px]"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  {timeAgo(b.completed_at ?? b.created_at)}
                </span>
              </div>
              {b.failure_reason && (
                <div
                  className="text-[9px] truncate"
                  style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}
                  title={b.failure_reason}
                >
                  {b.failure_reason.slice(0, 120)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header({
  lastRefresh,
  error,
  onRefresh,
  summary,
}: {
  lastRefresh: string;
  error: string | null;
  onRefresh: () => void;
  summary: LogSummary | null;
}) {
  return (
    <header
      className="sticky top-0 z-50 animate-fade-in"
      style={{
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full animate-soft-pulse"
              style={{
                background: "var(--green)",
                boxShadow: "0 0 10px rgba(48,209,88,0.5)",
              }}
            />
            <span
              className="text-[15px] font-semibold tracking-tight"
              style={{ color: "var(--text-1)", fontFamily: "var(--font-display)" }}
            >
              Sovereign
            </span>
          </div>
          <div
            className="h-4 w-px"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
          <NavBar />
        </div>

        {/* Right: Stats + Refresh */}
        <div className="flex items-center gap-5">
          {summary && (
            <div className="hidden sm:flex items-center gap-4">
              <span
                className="text-[11px] font-medium"
                style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
              >
                {summary.opsLastHour} ops/hr
              </span>
              <span
                className="text-[11px] font-medium"
                style={{
                  color:
                    summary.recentErrors > 0 ? "var(--red)" : "var(--text-4)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {summary.recentErrors} errors
              </span>
            </div>
          )}

          {error && (
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--red)" }}
            >
              {error}
            </span>
          )}

          <span
            className="text-[11px] hidden sm:inline"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            {lastRefresh || "\u2014"}
          </span>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "var(--text-2)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.09)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              style={{ opacity: 0.7 }}
            >
              <path
                d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z"
                fill="currentColor"
              />
            </svg>
            Sync
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [logRes, briefRes] = await Promise.all([
        fetch("/api/execution-log").then((r) => r.json()),
        fetch("/api/briefs").then((r) => r.json()),
      ]);

      if (logRes.error) {
        setError(logRes.error);
      } else {
        setLogs(logRes.logs ?? []);
        setSummary(logRes.summary ?? null);
      }

      setBriefs(briefRes.briefs ?? []);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 15_000); // Poll every 15s for near-realtime
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  return (
    <div className="relative min-h-screen" style={{ zIndex: 1 }}>
      <Header
        lastRefresh={lastRefresh}
        error={error}
        onRefresh={fetchAll}
        summary={summary}
      />

      <main className="max-w-[1600px] mx-auto px-6 lg:px-10 py-8 space-y-6">
        {/* KPI row */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 animate-fade-up delay-1">
            <KPI
              label="Agents Active"
              value={summary.agentActivity.filter(
                (a) => Date.now() - new Date(a.lastSeen).getTime() < 300_000
              ).length}
              color="var(--green)"
              sub={`of ${summary.agentActivity.length} total`}
            />
            <KPI
              label="Ops / Hour"
              value={summary.opsLastHour}
              color="var(--blue)"
            />
            <KPI
              label="Queued"
              value={
                briefs.filter((b) => b.status.toUpperCase() === "QUEUED").length
              }
              color="var(--orange)"
            />
            <KPI
              label="Claimed"
              value={
                briefs.filter((b) => b.status.toUpperCase() === "CLAIMED").length
              }
              color="var(--blue)"
            />
            <KPI
              label="Error Rate"
              value={
                summary.totalLogs > 0
                  ? `${Math.round(
                      (summary.totalErrors / summary.totalLogs) * 100
                    )}%`
                  : "0%"
              }
              color={
                summary.totalLogs > 0 &&
                summary.totalErrors / summary.totalLogs > 0.1
                  ? "var(--red)"
                  : "var(--green)"
              }
            />
          </div>
        )}

        {/* Four-panel grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top-left: Live execution log */}
          <div className="glass p-5 animate-fade-up delay-2">
            <ExecutionLogPanel logs={logs} />
          </div>

          {/* Top-right: BRIEF queue */}
          <div className="glass p-5 animate-fade-up delay-3">
            <BriefQueuePanel briefs={briefs} />
          </div>

          {/* Bottom-left: Agent dispatch */}
          <div className="glass p-5 animate-fade-up delay-4">
            <AgentDispatchPanel
              agents={summary?.agentActivity ?? []}
              briefs={briefs}
            />
          </div>

          {/* Bottom-right: System health */}
          <div className="glass p-5 animate-fade-up delay-5">
            <SystemHealthPanel summary={summary} briefs={briefs} />
          </div>
        </div>
      </main>
    </div>
  );
}
