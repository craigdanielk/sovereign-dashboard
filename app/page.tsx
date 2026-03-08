"use client";

import { useEffect, useState, useCallback } from "react";

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

const STATUS_COLORS: Record<string, string> = {
  operational: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  beta: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  pending: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  offline: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PROFICIENCY_COLORS: Record<string, string> = {
  production: "bg-emerald-500/20 text-emerald-400",
  "near-production": "bg-blue-500/20 text-blue-400",
  beta: "bg-amber-500/20 text-amber-400",
  prototype: "bg-purple-500/20 text-purple-400",
  unknown: "bg-gray-500/20 text-gray-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-500/20 text-red-400 border-red-500/30",
  P1: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  P2: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  P3: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

/* ─── Badge Components ───────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${STATUS_COLORS[status] ?? STATUS_COLORS.pending}`}>
      {status}
    </span>
  );
}

function ProficiencyBadge({ level }: { level: string }) {
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${PROFICIENCY_COLORS[level] ?? PROFICIENCY_COLORS.unknown}`}>
      {level}
    </span>
  );
}

/* ─── Panel: Army ────────────────────────────────────── */

function ArmyPanel({ agents }: { agents: Agent[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-4">
        Node Directors
        <span className="ml-2 text-emerald-400">{agents.length}</span>
      </h2>
      {agents.map((agent) => (
        <div
          key={agent.name}
          className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-sm text-slate-100">{agent.name}</span>
            <StatusBadge status={agent.status} />
          </div>
          {agent.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.slice(0, 5).map((cap) => (
                <span key={cap} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                  {cap}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
            {agent.lastCommit && <span>#{agent.lastCommit.slice(0, 7)}</span>}
            <span>{timeAgo(agent.lastUpdated)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Panel: System ──────────────────────────────────── */

function SystemPanel({ data }: { data: SystemData | null }) {
  if (!data) return <div className="text-slate-500 font-mono text-sm">Loading system data...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-4">
        System Health
        <span className="ml-2 text-slate-500">SDM {data.sdmVersion}</span>
      </h2>

      <div className={`rounded-lg border p-3 ${data.coreInfraComplete ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${data.coreInfraComplete ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-xs font-mono text-slate-300">
            Core Infrastructure: {data.coreInfraComplete ? "COMPLETE" : "IN PROGRESS"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(["P0", "P1", "P2", "P3"] as const).map((p) => (
          <div key={p} className={`rounded border text-center py-2 ${PRIORITY_COLORS[p]}`}>
            <div className="text-lg font-mono font-bold">{data.gapCounts[p]}</div>
            <div className="text-[10px] font-mono">{p}</div>
          </div>
        ))}
      </div>

      <div className="text-xs font-mono text-slate-500">
        {data.totalGaps} gaps remaining &middot; Updated {timeAgo(data.sdmLastUpdated)}
      </div>

      {data.activeJobs.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-mono text-slate-400 uppercase">Active Jobs</div>
          {data.activeJobs.map((job, i) => (
            <div key={i} className="rounded border border-blue-500/30 bg-blue-500/5 p-2">
              <span className="text-xs font-mono text-blue-400">{job.details.slice(0, 120)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Panel: Pipeline ────────────────────────────────── */

function PipelinePanel({ data }: { data: PipelineData | null }) {
  if (!data) return <div className="text-slate-500 font-mono text-sm">Loading pipeline...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-4">
        Pipeline
        <span className="ml-2 text-slate-500">{data.capabilities.length} capabilities</span>
      </h2>

      <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
        <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">RECON Status</div>
        <div className="text-xs font-mono text-slate-300">{data.pipelineStatus.slice(0, 150)}</div>
      </div>

      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_80px_90px_60px] gap-2 text-[10px] font-mono text-slate-500 uppercase px-2">
          <span>Capability</span>
          <span>Level</span>
          <span>Rate</span>
          <span>Hrs</span>
        </div>
        {data.capabilities.map((cap) => (
          <div
            key={cap.capability_id}
            className="grid grid-cols-[1fr_80px_90px_60px] gap-2 items-center rounded border border-slate-700/30 bg-slate-800/30 px-2 py-1.5"
          >
            <div>
              <div className="text-xs font-mono text-slate-200">{cap.label}</div>
              <div className="text-[10px] font-mono text-slate-500">{cap.owned_by.join(", ")}</div>
            </div>
            <ProficiencyBadge level={cap.proficiency} />
            <span className="text-[10px] font-mono text-slate-400">{cap.market_rate}</span>
            <span className="text-[10px] font-mono text-slate-400">{cap.time_to_deploy_hrs}h</span>
          </div>
        ))}
      </div>

      {data.knownGaps.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase">Known Gaps</div>
          <div className="flex flex-wrap gap-1">
            {data.knownGaps.map((gap) => (
              <span key={gap} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.pendingGap && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
          <div className="text-[10px] font-mono text-amber-400 uppercase">Pending GAP Review</div>
          <div className="text-xs font-mono text-slate-300">
            {(data.pendingGap as Record<string, string>).gap_description ?? "Details in RAG"}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Suggested: {(data.pendingGap as Record<string, string>).suggested_skill_name ?? "\u2014"}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────── */

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [system, setSystem] = useState<SystemData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [armyRes, sysRes, pipeRes] = await Promise.all([
        fetch("/api/army"),
        fetch("/api/system"),
        fetch("/api/pipeline"),
      ]);

      const armyData = await armyRes.json();
      const sysData = await sysRes.json();
      const pipeData = await pipeRes.json();

      setAgents(armyData.agents ?? []);
      setSystem(sysData.error ? null : sysData);
      setPipeline(pipeData.error ? null : pipeData);
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
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <header className="border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="font-mono text-sm font-bold text-slate-200 tracking-wider uppercase">
              SOVEREIGN
            </h1>
            <span className="font-mono text-[10px] text-slate-500">Command Centre</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
            {error && <span className="text-red-400">{error}</span>}
            <span>Last sync: {lastRefresh || "\u2014"}</span>
            <button
              onClick={fetchAll}
              className="px-2 py-1 rounded border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
            <ArmyPanel agents={agents} />
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
            <SystemPanel data={system} />
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
            <PipelinePanel data={pipeline} />
          </div>
        </div>
      </main>
    </div>
  );
}
