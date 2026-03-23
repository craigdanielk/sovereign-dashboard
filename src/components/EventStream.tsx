"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, type ExecutionLog } from "@/lib/supabase";
import { getAgentColour } from "@/lib/colours";

export default function EventStream() {
  const [events, setEvents] = useState<ExecutionLog[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleInsert = useCallback((payload: { new: ExecutionLog }) => {
    setEvents((prev) => [...prev.slice(-99), payload.new as ExecutionLog]);
  }, []);

  useEffect(() => {
    supabase
      .from("execution_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setEvents(data.reverse());
      });

    const channel = supabase
      .channel("event-stream-realtime")
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  function formatTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-2 py-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-accent-green tracking-wider">
            EVENT STREAM
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected
                ? "bg-accent-green animate-[pulse-dot_1.5s_ease-in-out_infinite]"
                : "bg-accent-red"
            }`}
          />
        </div>
        <span className="text-[9px] text-text-muted">{events.length}</span>
      </div>

      {/* Events */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-1 space-y-0">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-1 px-1 py-0.5 text-[10px] leading-tight hover:bg-bg-card-hover rounded animate-[fade-in-up_0.2s_ease-out]"
          >
            <span className="text-text-muted shrink-0 w-10 tabular-nums">
              [{formatTime(ev.created_at)}]
            </span>
            <span className="shrink-0 w-1">+</span>
            <span
              className="shrink-0 font-bold truncate"
              style={{
                color: getAgentColour(ev.agent),
                maxWidth: "60px",
              }}
            >
              {ev.agent.toUpperCase()}
            </span>
            <span className="text-text-secondary truncate flex-1">
              {ev.operation}
              {ev.input_summary ? ` ${ev.input_summary.slice(0, 40)}` : ""}
            </span>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-[10px] text-text-muted text-center py-4">
            Awaiting events...
          </div>
        )}
      </div>
    </div>
  );
}
