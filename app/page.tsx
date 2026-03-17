"use client";

import { useEffect, useState, useCallback } from "react";
import { ExpandableText } from "./components/ExpandableText";
import { NavBar } from "./components/NavBar";

/* ─── Types ──────────────────────────────────────────── */

interface Agent {
  name: string;
  status: "operational" | "beta" | "pending" | "offline";
  capabilities: string[];
  lastCommit: string | null;
  lastUpdated: string | null;
  relatedProjects: string[];
  description: string;
}

interface SystemData {
  sdmVersion: string;
  totalGaps: number;
  gapCounts: { P0: number; P1: number; P2: number; P3: number };
  gaps: Array<{ name: string; priority: string; description: string }>;
  activeJobs: Array<{ status: string; details: string }>;
  sdmLastUpdated: string | null;
  coreInfraComplete: boolean;
}

interface Capability {
  capability_id: string;
  label: string;
  owned_by: string[];
  proficiency: string;
  market_rate: string;
  time_to_deploy_hrs: number;
  gap_to_close: string | null;
}

interface PipelineData {
  capabilities: Capability[];
  knownGaps: string[];
  pendingGap: Record<string, unknown> | null;
  pipelineStatus: string;
}

interface ReconData {
  lastRun: string;
  signalsFound: number;
  authStatus: "ok" | "error" | "unknown";
  queueDepth: number;
}

/* ─── Helpers ────────────────────────────────────────── */

function timeAgo(iso: string | null): string {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function countOperational(agents: Agent[]): number {
  return agents.filter((a) => a.status === "operational").length;
}

/* ─── Status Dot ─────────────────────────────────────── */

function StatusDot({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "w-2.5 h-2.5" : "w-[7px] h-[7px]";
  const pulseClass = status === "operational" ? "animate-soft-pulse" : "";
  return <div className={`${sizeClass} rounded-full dot-${status} ${pulseClass}`} />;
}

/* ─── Skeleton Loader ────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="space-y-5 p-1">
      <div className="skeleton h-5 w-32" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

/* ─── Metric Block ───────────────────────────────────── */

function Metric({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="text-center">
      <div
        className="text-2xl font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: color ?? "var(--text-1)" }}
      >
        {value}
      </div>
      <div
        className="text-[11px] font-medium tracking-wide uppercase mt-0.5"
        style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
    </div>
  );
}

/* ─── Panel: Agents ──────────────────────────────────── */

function AgentsPanel({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) return <SkeletonCard />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-1)" }}>
          Node Directors
        </h2>
        <span className="text-[12px] font-medium" style={{ color: "var(--text-3)" }}>
          {countOperational(agents)}/{agents.length} online
        </span>
      </div>

      {/* Agent Cards */}
      <div className="space-y-2">
        {agents.map((agent, i) => (
          <div
            key={agent.name}
            className={`glass-inner p-3.5 animate-fade-up delay-${Math.min(i + 1, 8)}`}
          >
            {/* Top row: name + status */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <StatusDot status={agent.status} size="md" />
                <span
                  className="text-[13px] font-semibold tracking-wide"
                  style={{ color: "var(--text-1)", fontFamily: "var(--font-display)" }}
                >
                  {agent.name}
                </span>
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
              >
                {timeAgo(agent.lastUpdated)}
              </span>
            </div>

            {/* Capabilities */}
            {agent.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {agent.capabilities.slice(0, 4).map((cap) => (
                  <span
                    key={cap}
                    className="text-[10px] font-medium px-2 py-[3px] rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--text-2)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {cap}
                  </span>
                ))}
                {agent.capabilities.length > 4 && (
                  <span
                    className="text-[10px] px-2 py-[3px] rounded-full"
                    style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                  >
                    +{agent.capabilities.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            <ExpandableText
              text={agent.description}
              maxLength={160}
              className="text-[11px] leading-relaxed"
              style={{ color: "var(--text-3)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Panel: System Health ───────────────────────────── */

/* ─── RECON Status Widget ────────────────────────────── */

function ReconWidget({ data }: { data: ReconData | null }) {
  if (!data) return null;

  const authColor =
    data.authStatus === "ok"
      ? "var(--green)"
      : data.authStatus === "error"
        ? "var(--red)"
        : "var(--text-4)";

  return (
    <div
      className="glass-inner p-3.5 space-y-2.5 animate-fade-up delay-5"
      style={{ borderColor: "rgba(10,132,255,0.08)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            background: "var(--blue)",
            boxShadow: "0 0 6px rgba(10,132,255,0.5)",
          }}
        />
        <span
          className="text-[10px] font-semibold tracking-wider uppercase"
          style={{ color: "var(--text-3)" }}
        >
          RECON Scanner
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div
            className="text-[10px] font-medium tracking-wide uppercase mb-0.5"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Last Run
          </div>
          <div
            className="text-[12px] font-medium"
            style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
          >
            {data.lastRun ? timeAgo(data.lastRun) : "—"}
          </div>
        </div>

        <div>
          <div
            className="text-[10px] font-medium tracking-wide uppercase mb-0.5"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Signals
          </div>
          <div
            className="text-[12px] font-medium"
            style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
          >
            {data.signalsFound}
          </div>
        </div>

        <div>
          <div
            className="text-[10px] font-medium tracking-wide uppercase mb-0.5"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Auth
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: authColor }}
            />
            <span
              className="text-[12px] font-medium"
              style={{ color: authColor, fontFamily: "var(--font-mono)" }}
            >
              {data.authStatus}
            </span>
          </div>
        </div>

        <div>
          <div
            className="text-[10px] font-medium tracking-wide uppercase mb-0.5"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            Queue
          </div>
          <div
            className="text-[12px] font-medium"
            style={{
              color: data.queueDepth > 0 ? "var(--orange)" : "var(--text-2)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {data.queueDepth} BRIEFs
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Panel: System Health ───────────────────────────── */

function SystemPanel({ data, recon }: { data: SystemData | null; recon: ReconData | null }) {
  if (!data) return <SkeletonCard />;

  const priorityConfig: Record<string, { color: string; bg: string }> = {
    P0: { color: "var(--red)", bg: "var(--red-dim)" },
    P1: { color: "var(--orange)", bg: "var(--orange-dim)" },
    P2: { color: "var(--yellow)", bg: "var(--yellow-dim)" },
    P3: { color: "var(--text-3)", bg: "rgba(255,255,255,0.03)" },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-1)" }}>
          System Health
        </h2>
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
        >
          SDM {data.sdmVersion}
        </span>
      </div>

      {/* Infrastructure Status */}
      <div
        className="glass-inner p-3.5 flex items-center gap-3 animate-fade-up delay-1"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: data.coreInfraComplete ? "var(--green-dim)" : "var(--orange-dim)",
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: data.coreInfraComplete ? "var(--green)" : "var(--orange)",
              boxShadow: data.coreInfraComplete
                ? "0 0 12px rgba(48,209,88,0.4)"
                : "0 0 12px rgba(255,159,10,0.4)",
            }}
          />
        </div>
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--text-1)" }}>
            Core Infrastructure
          </div>
          <div
            className="text-[11px] font-medium"
            style={{
              color: data.coreInfraComplete ? "var(--green)" : "var(--orange)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {data.coreInfraComplete ? "Complete" : "In Progress"}
          </div>
        </div>
      </div>

      {/* Gap Counts */}
      <div className="grid grid-cols-4 gap-2 animate-fade-up delay-2">
        {(["P0", "P1", "P2", "P3"] as const).map((p) => {
          const cfg = priorityConfig[p];
          return (
            <div
              key={p}
              className="rounded-xl text-center py-3 px-2 transition-all duration-200"
              style={{
                background: data.gapCounts[p] > 0 ? cfg.bg : "rgba(255,255,255,0.02)",
                border: `1px solid ${data.gapCounts[p] > 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)"}`,
              }}
            >
              <div
                className="text-xl font-semibold"
                style={{
                  color: data.gapCounts[p] > 0 ? cfg.color : "var(--text-4)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {data.gapCounts[p]}
              </div>
              <div
                className="text-[10px] font-semibold tracking-wider mt-0.5"
                style={{
                  color: data.gapCounts[p] > 0 ? cfg.color : "var(--text-4)",
                  fontFamily: "var(--font-mono)",
                  opacity: data.gapCounts[p] > 0 ? 0.7 : 0.5,
                }}
              >
                {p}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="divider" />
      <div className="flex items-center justify-between animate-fade-up delay-3">
        <span className="text-[11px]" style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
          {data.totalGaps} gaps remaining
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}>
          {timeAgo(data.sdmLastUpdated)}
        </span>
      </div>

      {/* Active Jobs */}
      {data.activeJobs.length > 0 && (
        <div className="space-y-2 animate-fade-up delay-4">
          <div
            className="text-[11px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-3)" }}
          >
            Active Jobs
          </div>
          {data.activeJobs.map((job, i) => (
            <div
              key={i}
              className="glass-inner p-3"
              style={{ borderColor: "rgba(10,132,255,0.12)" }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: "var(--blue)", boxShadow: "0 0 6px rgba(10,132,255,0.5)" }}
                />
                <ExpandableText
                  text={job.details}
                  maxLength={140}
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECON Status */}
      <ReconWidget data={recon} />
    </div>
  );
}

/* ─── Panel: Pipeline ────────────────────────────────── */

function PipelinePanel({ data }: { data: PipelineData | null }) {
  if (!data) return <SkeletonCard />;

  const proficiencyStyle: Record<string, { color: string; bg: string }> = {
    production: { color: "var(--green)", bg: "var(--green-dim)" },
    "near-production": { color: "var(--blue)", bg: "var(--blue-dim)" },
    beta: { color: "var(--orange)", bg: "var(--orange-dim)" },
    prototype: { color: "var(--purple)", bg: "var(--purple-dim)" },
    unknown: { color: "var(--text-3)", bg: "rgba(255,255,255,0.03)" },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-1)" }}>
          Pipeline
        </h2>
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
        >
          {data.capabilities.length} capabilities
        </span>
      </div>

      {/* RECON Status */}
      <div className="glass-inner p-3.5 animate-fade-up delay-1">
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--blue)", boxShadow: "0 0 6px rgba(10,132,255,0.5)" }}
          />
          <span
            className="text-[10px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-3)" }}
          >
            RECON Status
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {data.pipelineStatus.slice(0, 160)}
        </p>
      </div>

      {/* Capabilities Table */}
      <div className="space-y-1 animate-fade-up delay-2">
        {/* Table Header */}
        <div
          className="grid gap-3 px-3 py-1.5"
          style={{
            gridTemplateColumns: "1fr 90px 70px",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: "var(--text-4)" }}>
            Capability
          </span>
          <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: "var(--text-4)" }}>
            Level
          </span>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-right" style={{ color: "var(--text-4)" }}>
            Deploy
          </span>
        </div>

        {/* Table Rows */}
        {data.capabilities.map((cap, i) => {
          const prof = proficiencyStyle[cap.proficiency] ?? proficiencyStyle.unknown;
          return (
            <div
              key={cap.capability_id}
              className={`glass-inner grid gap-3 items-center px-3 py-2.5 animate-fade-up delay-${Math.min(i + 3, 8)}`}
              style={{ gridTemplateColumns: "1fr 90px 70px" }}
            >
              <div>
                <div className="text-[12px] font-medium" style={{ color: "var(--text-1)" }}>
                  {cap.label}
                </div>
                <div
                  className="text-[10px] mt-0.5"
                  style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                >
                  {cap.owned_by.join(", ")}
                </div>
              </div>
              <span
                className="text-[10px] font-medium px-2 py-1 rounded-full text-center"
                style={{
                  background: prof.bg,
                  color: prof.color,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {cap.proficiency}
              </span>
              <span
                className="text-[12px] font-medium text-right"
                style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)" }}
              >
                {cap.time_to_deploy_hrs}h
              </span>
            </div>
          );
        })}
      </div>

      {/* Known Gaps */}
      {data.knownGaps.length > 0 && (
        <div className="space-y-2.5 animate-fade-up delay-5">
          <div className="divider" />
          <div
            className="text-[11px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-3)" }}
          >
            Known Gaps
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.knownGaps.map((gap) => (
              <span
                key={gap}
                className="text-[10px] font-medium px-2.5 py-[3px] rounded-full"
                style={{
                  background: "var(--red-dim)",
                  color: "var(--red)",
                  fontFamily: "var(--font-mono)",
                  border: "1px solid rgba(255,69,58,0.1)",
                }}
              >
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pending GAP */}
      {data.pendingGap && (
        <div
          className="glass-inner p-3.5 space-y-1.5 animate-fade-up delay-6"
          style={{ borderColor: "rgba(255,159,10,0.12)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: "var(--orange)", boxShadow: "0 0 6px rgba(255,159,10,0.5)" }}
            />
            <span
              className="text-[10px] font-semibold tracking-wider uppercase"
              style={{ color: "var(--orange)", opacity: 0.8 }}
            >
              Pending GAP Review
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            {(data.pendingGap as Record<string, string>).gap_description ?? "Details in RAG"}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}>
            Suggested: {(data.pendingGap as Record<string, string>).suggested_skill_name ?? "\u2014"}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────── */

function Header({
  agents,
  system,
  lastRefresh,
  error,
  onRefresh,
}: {
  agents: Agent[];
  system: SystemData | null;
  lastRefresh: string;
  error: string | null;
  onRefresh: () => void;
}) {
  const online = countOperational(agents);
  const total = agents.length;

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
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <StatusDot status={online > 0 ? "operational" : "offline"} size="md" />
            <span
              className="text-[15px] font-semibold tracking-tight"
              style={{ color: "var(--text-1)", fontFamily: "var(--font-display)" }}
            >
              Sovereign
            </span>
          </div>
          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          <NavBar />
        </div>

        {/* Right: Stats + Refresh */}
        <div className="flex items-center gap-5">
          {/* Quick stats in header */}
          {total > 0 && (
            <div className="hidden sm:flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
                >
                  {online} agents
                </span>
              </div>
              {system && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
                  >
                    {system.totalGaps} gaps
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <span className="text-[11px] font-medium" style={{ color: "var(--red)" }}>
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
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7 }}>
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

/* ─── Overview Metrics Bar ───────────────────────────── */

function MetricsBar({ agents, system }: { agents: Agent[]; system: SystemData | null }) {
  if (agents.length === 0 && !system) return null;

  return (
    <div className="glass p-5 animate-fade-up delay-1">
      <div className="flex items-center justify-around flex-wrap gap-6">
        <Metric value={agents.length} label="Directors" />
        <Metric
          value={countOperational(agents)}
          label="Online"
          color="var(--green)"
        />
        {system && (
          <>
            <Metric value={system.sdmVersion} label="SDM" />
            <Metric value={system.totalGaps} label="Total Gaps" color={system.gapCounts.P0 > 0 ? "var(--red)" : "var(--text-2)"} />
            <Metric
              value={system.coreInfraComplete ? "Complete" : "Building"}
              label="Infrastructure"
              color={system.coreInfraComplete ? "var(--green)" : "var(--orange)"}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────── */

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [system, setSystem] = useState<SystemData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [recon, setRecon] = useState<ReconData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [armyRes, sysRes, pipeRes, reconRes] = await Promise.all([
        fetch("/api/army"),
        fetch("/api/system"),
        fetch("/api/pipeline"),
        fetch("/api/recon"),
      ]);

      const armyData = await armyRes.json();
      const sysData = await sysRes.json();
      const pipeData = await pipeRes.json();
      const reconData = await reconRes.json();

      setAgents(armyData.agents ?? []);
      setSystem(sysData.error ? null : sysData);
      setPipeline(pipeData.error ? null : pipeData);
      setRecon(reconData.error ? null : reconData);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await fetchAll();
    };
    run();
    const interval = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [fetchAll]);

  return (
    <div className="relative min-h-screen" style={{ zIndex: 1 }}>
      <Header
        agents={agents}
        system={system}
        lastRefresh={lastRefresh}
        error={error}
        onRefresh={fetchAll}
      />

      <main className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 space-y-6">
        {/* Metrics Overview */}
        <MetricsBar agents={agents} system={system} />

        {/* Three-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="glass p-5 animate-fade-up delay-2">
            <AgentsPanel agents={agents} />
          </div>
          <div className="glass p-5 animate-fade-up delay-3">
            <SystemPanel data={system} recon={recon} />
          </div>
          <div className="glass p-5 animate-fade-up delay-4">
            <PipelinePanel data={pipeline} />
          </div>
        </div>
      </main>
    </div>
  );
}
