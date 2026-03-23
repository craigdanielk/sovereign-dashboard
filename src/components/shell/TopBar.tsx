"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function TopBar() {
  const [clock, setClock] = useState("");
  const [agentCount, setAgentCount] = useState(0);
  const [queueDepth, setQueueDepth] = useState(0);
  const [healthStatus, setHealthStatus] = useState<"ok" | "warn" | "error">("ok");

  // Live clock
  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Live counts from Supabase
  const fetchCounts = useCallback(async () => {
    // Queue depth: QUEUED + IN_PROGRESS briefs
    const { data: queued } = await supabase
      .from("briefs")
      .select("id")
      .in("status", ["QUEUED", "IN_PROGRESS"]);
    setQueueDepth(queued?.length || 0);

    // Active agents: distinct agents from recent execution_log (last 30min)
    const cutoff = new Date(Date.now() - 30 * 60000).toISOString();
    const { data: recentLogs } = await supabase
      .from("execution_log")
      .select("agent")
      .gte("created_at", cutoff);
    if (recentLogs) {
      const unique = new Set(recentLogs.map((l: { agent: string }) => l.agent));
      setAgentCount(unique.size);
    }

    // Health: check for recent failures
    const { data: failedRecent } = await supabase
      .from("briefs")
      .select("id")
      .eq("status", "FAILED")
      .gte("completed_at", new Date(Date.now() - 3600000).toISOString());
    const failCount = failedRecent?.length || 0;
    setHealthStatus(failCount > 2 ? "error" : failCount > 0 ? "warn" : "ok");
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);

    const channel = supabase
      .channel("topbar-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, () => fetchCounts())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "execution_log" }, () => fetchCounts())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  const healthDot = {
    ok: "bg-accent-green",
    warn: "bg-accent-yellow",
    error: "bg-accent-red",
  };

  return (
    <header className="shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-border bg-bg-secondary">
      {/* Left: System name */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tracking-[0.2em] text-accent-green glow-green">
          SOVEREIGN
        </span>
        <span className="text-text-muted text-[10px]">|</span>
        <span className="text-[10px] text-text-secondary tracking-wider">
          WAR ROOM
        </span>
      </div>

      {/* Right: Live stats + clock */}
      <div className="flex items-center gap-4 text-[10px]">
        {/* Agent count */}
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">AGENTS</span>
          <span className="text-accent-cyan font-bold">{agentCount}</span>
        </div>

        {/* Queue depth */}
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">QUEUE</span>
          <span className={`font-bold ${queueDepth > 10 ? "text-accent-yellow" : "text-accent-green"}`}>
            {queueDepth}
          </span>
        </div>

        {/* Health dot */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${healthDot[healthStatus]} ${
              healthStatus === "ok" ? "" : "animate-[pulse-dot_1.5s_ease-in-out_infinite]"
            }`}
          />
          <span className="text-text-muted">SYS</span>
        </div>

        {/* Divider */}
        <span className="text-text-muted">|</span>

        {/* Clock */}
        <span className="text-accent-green font-bold tracking-wider tabular-nums glow-green">
          {clock}
        </span>
      </div>
    </header>
  );
}
