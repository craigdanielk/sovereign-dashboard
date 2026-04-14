"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Brief } from "@/lib/supabase";
import BriefDetailPanel from "./BriefDetailPanel";

interface AgentStatus {
  agent: string;
  briefId: number | null;
  briefName: string;
  lastActivity: string;
  toolCalls: number;
  status: "active" | "idle" | "stale";
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export default function AgentDispatch({ 
  selectedBrief, 
  onSelect 
}: { 
  selectedBrief: Brief | null, 
  onSelect: (b: Brief | null) => void 
}) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [activeTenant, setActiveTenant] = useState("NORTH-STAR");
  const [claimedBriefs, setClaimedBriefs] = useState<Brief[]>([]);

  const fetchAgentStatus = useCallback(async () => {
    const { data: claimed } = await supabase
      .from("briefs")
      .select("*")
      .eq("status", "CLAIMED");

    if (claimed) setClaimedBriefs(claimed);

    const { data: recentLogs } = await supabase
      .from("execution_log")
      .select("agent, session_id, brief_id, created_at, operation")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!recentLogs) return;

    const agentMap = new Map<string, AgentStatus>();
    const now = Date.now();

    for (const log of recentLogs) {
      if (!agentMap.has(log.agent)) {
        const age = now - new Date(log.created_at).getTime();
        const matchedBrief = claimed?.find((b: Brief) => b.id === log.brief_id);

        agentMap.set(log.agent, {
          agent: log.agent,
          briefId: log.brief_id,
          briefName: matchedBrief?.name || "",
          lastActivity: log.created_at,
          toolCalls: 0,
          status: age < 5 * 60000 ? "active" : age > 30 * 60000 ? "stale" : "idle",
        });
      }
      agentMap.get(log.agent)!.toolCalls++;
    }

    const sorted = Array.from(agentMap.values()).sort((a, b) => {
      const order = { active: 0, idle: 1, stale: 2 };
      return order[a.status] - order[b.status];
    });

    setAgents(sorted);
  }, []);

    const saved = (localStorage.getItem("ns_active_tenant") || "NORTH-STAR").toUpperCase();
    setActiveTenant(saved);

    const onTenantChange = (e: Event) => {
      setActiveTenant((e as CustomEvent).detail.toUpperCase());
    };

    window.addEventListener("tenant-change", onTenantChange);
    fetchAgentStatus();

    const channel = supabase
      .channel("agent-dispatch-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "execution_log" }, () =>
        fetchAgentStatus()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, () =>
        fetchAgentStatus()
      )
      .subscribe();

    const interval = setInterval(fetchAgentStatus, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchAgentStatus]);

  const statusDot = { active: "bg-accent-green", idle: "bg-accent-yellow", stale: "bg-text-muted" };
  const statusLabel = { active: "text-accent-green", idle: "text-accent-yellow", stale: "text-text-muted" };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wider uppercase text-accent-purple">
            Agent Dispatch
          </h2>
          <div className="flex gap-3 text-[10px]">
            <span className="text-accent-green">
              {agents.filter((a) => a.status === "active").length} active
            </span>
            <span className="text-accent-yellow">
              {agents.filter((a) => a.status === "idle").length} idle
            </span>
            <span className="text-text-muted">
              {agents.filter((a) => a.status === "stale").length} stale
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {agents.map((agent) => (
          <div
            key={agent.agent}
            onClick={() => {
              if (agent.briefId) {
                const b = claimedBriefs.find(cb => cb.id === agent.briefId);
                if (b) onSelect(b);
              }
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors ${agent.briefId ? 'cursor-pointer' : ''}`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${statusDot[agent.status]} ${
                agent.status === "active" ? "animate-[pulse-dot_1.5s_ease-in-out_infinite]" : ""
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${statusLabel[agent.status]}`}>
                  {agent.agent.toUpperCase()}
                </span>
                {agent.briefId && (
                  <span className="text-[10px] text-accent-yellow">#{agent.briefId}</span>
                )}
              </div>
              {agent.briefName && (
                <p className="text-[10px] text-text-secondary truncate">{agent.briefName}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-text-muted">{timeAgo(agent.lastActivity)}</div>
              <div className="text-[10px] text-text-muted">{agent.toolCalls} calls</div>
            </div>
          </div>
        ))}
        {agents.length === 0 && (
          <div className="text-center text-text-muted py-4 text-xs">No agent activity yet</div>
        )}
      </div>

    </div>
  );
}
