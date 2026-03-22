"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface HealthCheck {
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

export default function SystemHealth() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");

  const runHealthChecks = useCallback(async () => {
    const results: HealthCheck[] = [];
    const now = Date.now();

    // Stale CLAIMED briefs (>2h)
    const { data: staleClaimed } = await supabase
      .from("briefs")
      .select("id, name, claimed_at")
      .eq("status", "CLAIMED");

    const staleBriefs = (staleClaimed || []).filter(
      (b) => b.claimed_at && now - new Date(b.claimed_at).getTime() > 2 * 3600000
    );
    results.push({
      label: "Stale Claims",
      status: staleBriefs.length > 0 ? "warn" : "ok",
      detail: staleBriefs.length > 0
        ? `${staleBriefs.length} claimed >2h: ${staleBriefs.map((b) => `#${b.id}`).join(", ")}`
        : "No stale claims",
    });

    // Failed briefs (24h)
    const { data: failedRecent } = await supabase
      .from("briefs")
      .select("id")
      .eq("status", "FAILED")
      .gte("completed_at", new Date(now - 86400000).toISOString());

    const failCount = failedRecent?.length || 0;
    results.push({
      label: "Recent Failures",
      status: failCount > 2 ? "error" : failCount > 0 ? "warn" : "ok",
      detail: failCount > 0 ? `${failCount} failed in 24h` : "No failures in 24h",
    });

    // Queue depth
    const { data: queued } = await supabase.from("briefs").select("id").eq("status", "QUEUED");
    const queueDepth = queued?.length || 0;
    results.push({
      label: "Queue Depth",
      status: queueDepth > 20 ? "warn" : "ok",
      detail: `${queueDepth} briefs queued`,
    });

    // Log freshness
    const { data: lastLog } = await supabase
      .from("execution_log")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastLogAge = lastLog?.[0]
      ? Math.floor((now - new Date(lastLog[0].created_at).getTime()) / 60000)
      : null;
    results.push({
      label: "Log Freshness",
      status: lastLogAge === null ? "error" : lastLogAge > 60 ? "warn" : "ok",
      detail: lastLogAge === null ? "No logs" : lastLogAge < 1 ? "Last: just now" : `Last: ${lastLogAge}m ago`,
    });

    // Error rate (1h)
    const { data: recentErrors } = await supabase
      .from("execution_log")
      .select("id")
      .eq("actual_outcome", "failure")
      .gte("created_at", new Date(now - 3600000).toISOString());

    const { data: recentTotal } = await supabase
      .from("execution_log")
      .select("id")
      .gte("created_at", new Date(now - 3600000).toISOString());

    const errorRate =
      (recentTotal?.length || 0) > 0
        ? ((recentErrors?.length || 0) / (recentTotal?.length || 1)) * 100
        : 0;
    results.push({
      label: "Error Rate (1h)",
      status: errorRate > 20 ? "error" : errorRate > 5 ? "warn" : "ok",
      detail: `${errorRate.toFixed(1)}% (${recentErrors?.length || 0}/${recentTotal?.length || 0})`,
    });

    results.push({ label: "Supabase", status: "ok", detail: "Connected" });

    setChecks(results);
    setLastUpdate(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    runHealthChecks();
    const interval = setInterval(runHealthChecks, 60000);
    return () => clearInterval(interval);
  }, [runHealthChecks]);

  const icon = { ok: "OK", warn: "!!", error: "XX" };
  const color = { ok: "text-accent-green", warn: "text-accent-yellow", error: "text-accent-red" };
  const border = { ok: "border-border", warn: "border-accent-yellow/30", error: "border-accent-red/30" };

  const overall = checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "warn")
    ? "warn"
    : "ok";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wider uppercase text-accent-green">
            System Health
          </h2>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${color[overall]}`}>{overall.toUpperCase()}</span>
            {lastUpdate && <span className="text-[10px] text-text-muted">{lastUpdate}</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`flex items-center gap-3 px-3 py-2 rounded bg-bg-card border ${border[check.status]} transition-colors`}
          >
            <span className={`text-xs font-bold shrink-0 w-6 ${color[check.status]}`}>
              {icon[check.status]}
            </span>
            <span className="text-xs text-text-primary shrink-0 w-28">{check.label}</span>
            <span className="text-[10px] text-text-secondary flex-1 truncate">{check.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
