"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Brief, type ExecutionLog } from "@/lib/supabase";
import { getStatusColour, getAgentColour } from "@/lib/colours";

interface AgentStripItem {
  agent: string;
  status: "active" | "idle" | "stale";
  lastSeen: string;
  briefId: number | null;
}

export default function NorthStarTab() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [agents, setAgents] = useState<AgentStripItem[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [briefTab, setBriefTab] = useState<"QUEUED" | "CLAIMED" | "COMPLETED" | "FAILED">("QUEUED");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchBriefs = useCallback(async () => {
    const { data } = await supabase
      .from("briefs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) {
      setBriefs(data);
      const c: Record<string, number> = {};
      data.forEach((b: Brief) => {
        c[b.status] = (c[b.status] || 0) + 1;
      });
      setCounts(c);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    const { data: recentLogs } = await supabase
      .from("execution_log")
      .select("agent, brief_id, created_at")
      .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (!recentLogs) return;

    const agentMap = new Map<string, AgentStripItem>();
    const now = Date.now();

    for (const log of recentLogs) {
      if (!agentMap.has(log.agent)) {
        const age = now - new Date(log.created_at).getTime();
        agentMap.set(log.agent, {
          agent: log.agent,
          status: age < 5 * 60000 ? "active" : age < 30 * 60000 ? "idle" : "stale",
          lastSeen: log.created_at,
          briefId: log.brief_id,
        });
      }
    }

    const sorted = Array.from(agentMap.values()).sort((a, b) => {
      const order = { active: 0, idle: 1, stale: 2 };
      return order[a.status] - order[b.status];
    });

    setAgents(sorted);
  }, []);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("execution_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setLogs(data);
  }, []);

  useEffect(() => {
    fetchBriefs();
    fetchAgents();
    fetchLogs();

    const channel = supabase
      .channel("northstar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, () => {
        fetchBriefs();
        fetchAgents();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "execution_log" }, () => {
        fetchLogs();
        fetchAgents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBriefs, fetchAgents, fetchLogs]);

  const filtered = briefs.filter((b) => b.status === briefTab);
  const tabs: Array<"QUEUED" | "CLAIMED" | "COMPLETED" | "FAILED"> = ["QUEUED", "CLAIMED", "COMPLETED", "FAILED"];

  const demoBriefs = briefs.filter((b) => b.name?.toLowerCase().includes("demo"));
  const demoCompleted = demoBriefs.filter((b) => b.status === "COMPLETED").length;
  const demoTotal = Math.max(demoBriefs.length, 5);

  function timeAgo(ts: string | null): string {
    if (!ts) return "";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Agent Army Strip */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-1 overflow-x-auto">
        <span className="text-[9px] text-text-muted font-bold tracking-wider shrink-0 mr-2">
          AGENTS
        </span>
        {agents.map((a) => (
          <div
            key={a.agent}
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-bg-card border border-border"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                a.status === "active"
                  ? "bg-accent-green animate-[pulse-dot_1.5s_ease-in-out_infinite]"
                  : a.status === "idle"
                  ? "bg-accent-yellow"
                  : "bg-text-muted"
              }`}
            />
            <span
              className="text-[10px] font-bold"
              style={{ color: getAgentColour(a.agent) }}
            >
              {a.agent.toUpperCase()}
            </span>
            {a.briefId && (
              <span className="text-[9px] text-accent-yellow">#{a.briefId}</span>
            )}
          </div>
        ))}
        {agents.length === 0 && (
          <span className="text-[10px] text-text-muted">No agent activity</span>
        )}
      </div>

      {/* Main content: 2 columns */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: BRIEF Queue */}
        <div className="flex-1 flex flex-col border-r border-border min-w-0">
          <div className="shrink-0 px-3 py-1.5 border-b border-border">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-bold text-accent-blue tracking-wider">
                BRIEF QUEUE
              </span>
              <span className="text-[9px] text-text-muted ml-auto">
                DEMO GATE{" "}
                <span className="text-accent-green font-bold">{demoCompleted}</span>
                <span className="text-text-muted">/{demoTotal}</span>
              </span>
            </div>
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setBriefTab(tab)}
                  className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                    briefTab === tab
                      ? "bg-bg-card-hover text-accent-green"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {tab}{" "}
                  <span className="tabular-nums">{counts[tab] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.map((brief) => (
              <div
                key={brief.id}
                className="px-2 py-1.5 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-accent-yellow text-[10px] font-bold shrink-0">
                      #{brief.id}
                    </span>
                    <span className="text-[10px] text-text-primary truncate">
                      {brief.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: getStatusColour(brief.status) }}
                    >
                      {brief.status}
                    </span>
                    <span className="text-[9px] text-text-muted">
                      {brief.priority}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-text-muted">
                  {brief.claimed_by && (
                    <span>
                      <span className="text-accent-purple">{brief.claimed_by}</span>
                    </span>
                  )}
                  {brief.wsjf_score != null && (
                    <span>WSJF:{Number(brief.wsjf_score).toFixed(1)}</span>
                  )}
                  <span className="ml-auto">{timeAgo(brief.created_at)}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-[10px] text-text-muted text-center py-4">
                No {briefTab} briefs
              </div>
            )}
          </div>
        </div>

        {/* Right: Execution Log Live Tail */}
        <div className="w-[400px] flex flex-col min-w-0">
          <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-bold text-accent-cyan tracking-wider">
              EXECUTION LOG
            </span>
            <span className="text-[9px] text-text-muted">{logs.length} entries</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-1 px-1 py-0.5 text-[10px] leading-tight hover:bg-bg-card-hover rounded"
              >
                <span className="text-text-muted shrink-0 w-8 text-right tabular-nums">
                  {timeAgo(log.created_at)}
                </span>
                <span
                  className="shrink-0 w-14 truncate font-bold"
                  style={{ color: getAgentColour(log.agent) }}
                >
                  {log.agent.toUpperCase()}
                </span>
                <span className="text-text-secondary truncate flex-1">
                  {log.operation}
                </span>
                {log.brief_id && (
                  <span className="text-accent-yellow shrink-0">#{log.brief_id}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
