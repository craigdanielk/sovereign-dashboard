"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, type ExecutionLog } from "@/lib/supabase";

function outcomeColor(outcome: string | null): string {
  if (!outcome) return "text-text-secondary";
  if (outcome === "success") return "text-accent-green";
  if (outcome === "failure") return "text-accent-red";
  return "text-accent-yellow";
}

function operationIcon(op: string): string {
  const map: Record<string, string> = {
    session_start: ">>",
    session_end: "<<",
    Bash: "$",
    Read: "R",
    Write: "W",
    Edit: "E",
    Grep: "?",
    Glob: "*",
    Agent: "A",
  };
  return map[op] || "~";
}

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "..." : s;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function LiveLogs() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const handleInsert = useCallback((payload: { new: ExecutionLog }) => {
    if (!pausedRef.current) {
      setLogs((prev) => [payload.new as ExecutionLog, ...prev.slice(0, 199)]);
    }
  }, []);

  useEffect(() => {
    supabase
      .from("execution_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setLogs(data);
      });

    const channel = supabase
      .channel("execution-log-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "execution_log" },
        handleInsert
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleInsert]);

  useEffect(() => {
    // Top-first logs don't need auto-scroll to bottom
  }, [logs, paused]);

  const filtered = filter
    ? logs.filter(
        (l) =>
          l.agent.toLowerCase().includes(filter.toLowerCase()) ||
          l.operation.toLowerCase().includes(filter.toLowerCase()) ||
          (l.input_summary || "").toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold tracking-wider uppercase text-accent-cyan">
            Execution Log
          </h2>
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-accent-green animate-[pulse-dot_1.5s_ease-in-out_infinite]" : "bg-accent-red"
            }`}
          />
          <span className="text-xs text-text-muted">
            {connected ? "LIVE" : "DISCONNECTED"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary w-32 focus:outline-none focus:border-accent-cyan"
          />
          <button
            onClick={() => setPaused(!paused)}
            className={`text-xs px-2 py-1 rounded border ${
              paused
                ? "border-accent-yellow text-accent-yellow"
                : "border-border text-text-secondary"
            } hover:bg-bg-card-hover`}
          >
            {paused ? "PAUSED" : "PAUSE"}
          </button>
          <span className="text-xs text-text-muted">{filtered.length} entries</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.map((log) => (
          <div
            key={log.id}
            style={{ animation: "fade-in-up 0.25s ease-out" }}
            className="flex items-center gap-2 px-3 py-2 hover:bg-bg-hover group cursor-default"
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.022)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#3A3A3A", flexShrink: 0, width: 40, textAlign: "right" }}>
              {timeAgo(log.created_at)}
            </span>
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#5B21B6", flexShrink: 0, width: 16, textAlign: "center", fontWeight: 700 }}>
              {operationIcon(log.operation)}
            </span>
            <span style={{ fontSize: 11, color: "#6366F1", flexShrink: 0, width: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {log.agent}
            </span>
            <span style={{ fontSize: 11, color: "#737373", flexShrink: 0, width: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {log.operation}
            </span>
            <span className={`shrink-0 w-12 text-xs ${outcomeColor(log.actual_outcome)}`}>
              {log.actual_outcome || log.trigger || ""}
            </span>
            <span style={{ fontSize: 11, color: "#525252", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {truncate(log.input_summary || log.output_summary, 100)}
            </span>
            {log.duration_ms != null && (
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#333333", flexShrink: 0 }}>
                {log.duration_ms}ms
              </span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-text-muted py-8">
            {filter ? "No matching logs" : "Waiting for events..."}
          </div>
        )}
      </div>
    </div>
  );
}
