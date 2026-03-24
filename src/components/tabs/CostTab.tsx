"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────
interface AgentCost {
  agent: string;
  sessions: number;
  events: number;
  estCost: number;
}

interface BriefCost {
  id: number;
  name: string;
  agent: string;
  durationSec: number;
  events: number;
  qualityGrade: string | null;
  estCost: number;
}

interface DailyBar {
  date: string;
  events: number;
  estCost: number;
}

// Cost-per-event factor (configurable via env, default $0.002)
const COST_PER_EVENT =
  typeof window !== "undefined"
    ? Number(process.env.NEXT_PUBLIC_COST_PER_EVENT || "0.002")
    : 0.002;

// ── Helpers ──────────────────────────────────────────────────────
function fmtCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function gradeColour(grade: string | null): string {
  if (!grade) return "#404040";
  const g = grade.toUpperCase();
  if (g === "GREEN") return "#00ff41";
  if (g === "YELLOW") return "#ffb800";
  if (g === "RED") return "#ff1744";
  return "#404040";
}

// ── Component ────────────────────────────────────────────────────
export default function CostTab() {
  const [agentCosts, setAgentCosts] = useState<AgentCost[]>([]);
  const [briefCosts, setBriefCosts] = useState<BriefCost[]>([]);
  const [dailyBars, setDailyBars] = useState<DailyBar[]>([]);
  const [summary24h, setSummary24h] = useState({ sessions: 0, events: 0, cost: 0 });
  const [sortCol, setSortCol] = useState<"agent" | "sessions" | "events" | "estCost">("events");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<"agents" | "briefs">("agents");

  const fetchCosts = useCallback(async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000).toISOString();

    // ── Per-agent (24h) ──
    const { data: logData } = await supabase
      .from("system_events")
      .select("source, session_id, created_at")
      .gte("created_at", twentyFourHoursAgo);

    const agentMap = new Map<string, { sessions: Set<string>; events: number }>();
    if (logData) {
      for (const row of logData) {
        const a = (row as { source: string }).source || "unknown";
        if (!agentMap.has(a)) agentMap.set(a, { sessions: new Set(), events: 0 });
        const entry = agentMap.get(a)!;
        if ((row as { session_id: string }).session_id) entry.sessions.add((row as { session_id: string }).session_id);
        entry.events++;
      }
    }
    const agents: AgentCost[] = Array.from(agentMap.entries())
      .map(([agent, d]) => ({
        agent,
        sessions: d.sessions.size,
        events: d.events,
        estCost: d.events * COST_PER_EVENT,
      }))
      .sort((a, b) => b.events - a.events);
    setAgentCosts(agents);

    const totalSessions = agents.reduce((s, e) => s + e.sessions, 0);
    const totalEvents = agents.reduce((s, e) => s + e.events, 0);
    setSummary24h({ sessions: totalSessions, events: totalEvents, cost: totalEvents * COST_PER_EVENT });

    // ── Per-BRIEF ──
    const { data: briefData } = await supabase
      .from("briefs")
      .select("id, name, claimed_by, quality_grade, claimed_at, completed_at")
      .in("status", ["COMPLETED", "CLAIMED"])
      .order("claimed_at", { ascending: false })
      .limit(100);

    if (briefData) {
      // Count events per brief from system_events
      const briefIds = briefData.map((b: { id: number }) => b.id);
      const { data: briefEvents } = await supabase
        .from("system_events")
        .select("brief_id, source")
        .in("brief_id", briefIds);

      const evtMap = new Map<number, { events: number; agent: string }>();
      if (briefEvents) {
        for (const e of briefEvents) {
          const bid = (e as { brief_id: number }).brief_id;
          if (!evtMap.has(bid)) evtMap.set(bid, { events: 0, agent: (e as { source: string }).source || "unknown" });
          evtMap.get(bid)!.events++;
        }
      }

      const bc: BriefCost[] = briefData.map((b: Record<string, unknown>) => {
        const evt = evtMap.get(b.id as number) || { events: 0, agent: (b.claimed_by as string) || "unknown" };
        const claimed = b.claimed_at ? new Date(b.claimed_at as string).getTime() : 0;
        const completed = b.completed_at ? new Date(b.completed_at as string).getTime() : Date.now();
        const dur = claimed ? Math.round((completed - claimed) / 1000) : 0;
        return {
          id: b.id as number,
          name: b.name as string,
          agent: evt.agent || (b.claimed_by as string) || "--",
          durationSec: dur,
          events: evt.events,
          qualityGrade: (b.quality_grade as string) || null,
          estCost: evt.events * COST_PER_EVENT,
        };
      });
      setBriefCosts(bc);
    }

    // ── Daily chart (30 days) ──
    const { data: dailyData } = await supabase
      .from("system_events")
      .select("created_at")
      .gte("created_at", thirtyDaysAgo);

    if (dailyData) {
      const dayMap = new Map<string, number>();
      for (const row of dailyData) {
        const day = (row as { created_at: string }).created_at.slice(0, 10);
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
      // Fill gaps
      const bars: DailyBar[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const events = dayMap.get(key) || 0;
        bars.push({ date: key, events, estCost: events * COST_PER_EVENT });
      }
      setDailyBars(bars);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  // Sorting for agent table
  const sortedAgents = [...agentCosts].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "agent") return a.agent.localeCompare(b.agent) * mul;
    return ((a[sortCol] as number) - (b[sortCol] as number)) * mul;
  });

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const maxDailyEvents = Math.max(...dailyBars.map((b) => b.events), 1);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-3">
        <span className="text-[10px] font-bold text-accent-orange tracking-wider">
          COST CENTRE
        </span>
        <span className="text-[9px] text-text-muted">estimated</span>

        <div className="flex gap-1 ml-4">
          <button
            onClick={() => setView("agents")}
            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
              view === "agents"
                ? "border-accent-orange text-accent-orange"
                : "border-border text-text-muted hover:text-text-secondary"
            }`}
          >
            PER AGENT
          </button>
          <button
            onClick={() => setView("briefs")}
            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
              view === "briefs"
                ? "border-accent-orange text-accent-orange"
                : "border-border text-text-muted hover:text-text-secondary"
            }`}
          >
            PER BRIEF
          </button>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-center">
            <div className="text-[9px] text-text-muted">SESSIONS</div>
            <div className="text-[12px] font-bold text-accent-cyan tabular-nums">{summary24h.sessions}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-text-muted">EVENTS</div>
            <div className="text-[12px] font-bold text-accent-yellow tabular-nums">{summary24h.events}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-text-muted">EST. COST</div>
            <div className="text-[12px] font-bold text-accent-orange tabular-nums">{fmtCost(summary24h.cost)}</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Table */}
        <div className="flex-1 flex flex-col border-r border-border min-w-0">
          {view === "agents" ? (
            <>
              {/* Agent table header */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-border text-[9px] text-text-muted font-bold">
                <button onClick={() => toggleSort("agent")} className="w-28 text-left hover:text-text-secondary">
                  AGENT {sortCol === "agent" ? (sortDir === "asc" ? "^" : "v") : ""}
                </button>
                <button onClick={() => toggleSort("sessions")} className="w-16 text-right hover:text-text-secondary">
                  SESSIONS {sortCol === "sessions" ? (sortDir === "asc" ? "^" : "v") : ""}
                </button>
                <button onClick={() => toggleSort("events")} className="w-16 text-right hover:text-text-secondary">
                  EVENTS {sortCol === "events" ? (sortDir === "asc" ? "^" : "v") : ""}
                </button>
                <button onClick={() => toggleSort("estCost")} className="w-20 text-right hover:text-text-secondary">
                  EST. COST {sortCol === "estCost" ? (sortDir === "asc" ? "^" : "v") : ""}
                </button>
                <span className="flex-1 text-left pl-2">SHARE</span>
              </div>
              {/* Agent rows */}
              <div className="flex-1 overflow-y-auto">
                {sortedAgents.map((a) => {
                  const pct = summary24h.events > 0 ? Math.round((a.events / summary24h.events) * 100) : 0;
                  return (
                    <div
                      key={a.agent}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-card-hover border-b border-border transition-colors"
                    >
                      <span className="w-28 text-[10px] text-accent-green font-bold uppercase truncate">
                        {a.agent}
                      </span>
                      <span className="w-16 text-[10px] text-text-secondary text-right tabular-nums">
                        {a.sessions}
                      </span>
                      <span className="w-16 text-[10px] text-text-secondary text-right tabular-nums">
                        {a.events}
                      </span>
                      <span className="w-20 text-[10px] text-accent-orange text-right tabular-nums font-bold">
                        {fmtCost(a.estCost)}
                      </span>
                      <div className="flex-1 flex items-center gap-1 pl-2">
                        <div className="flex-1 h-1.5 bg-bg-secondary rounded overflow-hidden">
                          <div className="h-full bg-accent-orange rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-text-muted w-8 text-right tabular-nums">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
                {sortedAgents.length === 0 && (
                  <div className="text-[10px] text-text-muted text-center py-8">No cost data available</div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Brief table header */}
              <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-border text-[9px] text-text-muted font-bold">
                <span className="w-10">ID</span>
                <span className="flex-1">BRIEF</span>
                <span className="w-20">AGENT</span>
                <span className="w-16 text-right">DURATION</span>
                <span className="w-14 text-right">EVENTS</span>
                <span className="w-10 text-center">GRADE</span>
                <span className="w-16 text-right">EST. COST</span>
              </div>
              {/* Brief rows */}
              <div className="flex-1 overflow-y-auto">
                {briefCosts.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-card-hover border-b border-border transition-colors"
                  >
                    <span className="w-10 text-[10px] text-accent-yellow font-bold">#{b.id}</span>
                    <span className="flex-1 text-[10px] text-text-primary truncate">{b.name}</span>
                    <span className="w-20 text-[10px] text-accent-purple font-bold uppercase truncate">
                      {b.agent}
                    </span>
                    <span className="w-16 text-[10px] text-text-secondary text-right tabular-nums">
                      {b.durationSec > 0 ? `${Math.round(b.durationSec / 60)}m` : "--"}
                    </span>
                    <span className="w-14 text-[10px] text-text-secondary text-right tabular-nums">
                      {b.events}
                    </span>
                    <span className="w-10 flex justify-center">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: gradeColour(b.qualityGrade) }}
                        title={b.qualityGrade || "N/A"}
                      />
                    </span>
                    <span className="w-16 text-[10px] text-accent-orange text-right tabular-nums font-bold">
                      {fmtCost(b.estCost)}
                    </span>
                  </div>
                ))}
                {briefCosts.length === 0 && (
                  <div className="text-[10px] text-text-muted text-center py-8">No BRIEF cost data</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Daily chart */}
        <div className="w-[320px] flex flex-col min-w-0">
          <div className="shrink-0 px-3 py-1.5 border-b border-border">
            <span className="text-[10px] font-bold text-accent-yellow tracking-wider">
              DAILY COST (30D)
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex items-end gap-0.5 h-[200px]">
              {dailyBars.map((bar) => {
                const height = maxDailyEvents > 0 ? Math.max((bar.events / maxDailyEvents) * 100, 1) : 1;
                return (
                  <div
                    key={bar.date}
                    className="flex-1 flex flex-col items-center justify-end group relative"
                    style={{ height: "100%" }}
                  >
                    <div
                      className="w-full bg-accent-orange/60 hover:bg-accent-orange rounded-t transition-colors min-h-[1px]"
                      style={{ height: `${height}%` }}
                    />
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-bg-card border border-border rounded px-1.5 py-1 text-[9px] text-text-primary whitespace-nowrap z-10">
                      <div>{bar.date}</div>
                      <div>{bar.events} events</div>
                      <div className="text-accent-orange">{fmtCost(bar.estCost)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* X-axis labels */}
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-text-muted">{dailyBars[0]?.date.slice(5) || ""}</span>
              <span className="text-[8px] text-text-muted">{dailyBars[dailyBars.length - 1]?.date.slice(5) || ""}</span>
            </div>

            {/* Total 30d */}
            <div className="mt-4 px-3 py-2 rounded bg-bg-card border border-border">
              <div className="text-[9px] text-text-muted mb-1">30-DAY TOTAL</div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-secondary">
                  {dailyBars.reduce((s, b) => s + b.events, 0)} events
                </span>
                <span className="text-[12px] font-bold text-accent-orange tabular-nums">
                  {fmtCost(dailyBars.reduce((s, b) => s + b.estCost, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
