"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, type ExecutionLog } from "@/lib/supabase";
import { getAgentColour } from "@/lib/colours";

/* Unified event type for both execution_log and system_events */
interface StreamEvent {
  id: string;
  source: string; // agent name or event source
  event_type: string; // operation or event_type
  summary: string;
  created_at: string;
  origin: "execution_log" | "system_events";
}

function toStreamEvent(ev: ExecutionLog): StreamEvent {
  return {
    id: `exec-${ev.id}`,
    source: ev.agent,
    event_type: ev.operation,
    summary: ev.input_summary ? ev.input_summary.slice(0, 60) : ev.operation,
    created_at: ev.created_at,
    origin: "execution_log",
  };
}

interface SystemEvent {
  id: number;
  source: string;
  event_type: string;
  brief_id: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

function systemEventToStream(ev: SystemEvent): StreamEvent {
  const briefLabel = ev.brief_id ? `BRIEF-${ev.brief_id}` : "";
  const payloadSummary = ev.payload?.summary || ev.payload?.message || "";
  const summary = [briefLabel, payloadSummary].filter(Boolean).join(" ").slice(0, 60) || ev.event_type;
  return {
    id: `sys-${ev.id}`,
    source: ev.source,
    event_type: ev.event_type,
    summary,
    created_at: ev.created_at,
    origin: "system_events",
  };
}

export default function EventStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleExecInsert = useCallback((payload: { new: ExecutionLog }) => {
    const ev = toStreamEvent(payload.new);
    setEvents((prev) => [...prev.slice(-99), ev]);
  }, []);

  const handleSystemInsert = useCallback((payload: { new: SystemEvent }) => {
    const ev = systemEventToStream(payload.new);
    setEvents((prev) => [...prev.slice(-99), ev]);
  }, []);

  useEffect(() => {
    // Fetch initial execution_log events
    const fetchExecLog = supabase
      .from("execution_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }: { data: ExecutionLog[] | null }) => {
        return (data || []).reverse().map(toStreamEvent);
      });

    // Fetch initial system_events
    const fetchSystemEvents = supabase
      .from("system_events")
      .select("id,source,event_type,brief_id,payload,created_at")
      .in("event_type", ["hook_fired", "status_transition", "quality_grade"])
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }: { data: SystemEvent[] | null }) => {
        return (data || []).reverse().map(systemEventToStream);
      });

    Promise.all([fetchExecLog, fetchSystemEvents]).then(([execEvents, sysEvents]) => {
      // Merge and sort by created_at
      const merged = [...execEvents, ...sysEvents].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setEvents(merged.slice(-50));
    });

    // Real-time subscriptions for both tables
    const channel = supabase
      .channel("event-stream-realtime-v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "execution_log" },
        handleExecInsert
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_events" },
        handleSystemInsert
      )
      .subscribe((status: string) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleExecInsert, handleSystemInsert]);

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

  // Event type badge colour
  function eventTypeBadge(eventType: string): string {
    if (eventType === "hook_fired") return "#ffb800";
    if (eventType === "status_transition") return "#00b4d8";
    if (eventType === "quality_grade") return "#a855f7";
    return "#737373";
  }

  return (
    <div className="flex flex-col h-full">
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
            {ev.origin === "system_events" ? (
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full mt-0.5"
                style={{ background: eventTypeBadge(ev.event_type) }}
              />
            ) : (
              <span className="shrink-0 w-1">+</span>
            )}
            <span
              className="shrink-0 font-bold truncate"
              style={{
                color: getAgentColour(ev.source),
                maxWidth: "60px",
              }}
            >
              {ev.source.toUpperCase()}
            </span>
            <span className="text-text-secondary truncate flex-1">
              {ev.summary}
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
