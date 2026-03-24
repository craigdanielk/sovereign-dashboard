"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ReplayEvent {
  agent: string;
  event_type: string;
  target_agent: string | null;
  operation: string;
  tool_or_service: string | null;
  duration_ms: number | null;
  created_at: string;
  relative_ms: number;
}

interface BriefOption {
  id: number;
  name: string;
  completed_at: string;
}

interface ServicePulse {
  from: string;
  to: string;
  tool: string;
  timestamp: number;
}

interface ReplayControlsProps {
  onEventFire: (event: ReplayEvent, resolvedAgent: string | null) => void;
  onReset: () => void;
  onServicePulse?: (pulse: ServicePulse) => void;
}

export type { ReplayEvent, ServicePulse };

export default function ReplayControls({
  onEventFire,
  onReset,
  onServicePulse,
}: ReplayControlsProps) {
  const [briefs, setBriefs] = useState<BriefOption[]>([]);
  const [selectedBrief, setSelectedBrief] = useState<number | null>(null);
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [replayMode, setReplayMode] = useState<
    "brief_id" | "time_range" | "global" | null
  >(null);
  const [resolvedAgent, setResolvedAgent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const lastIndexRef = useRef<number>(0);

  // Fetch completed briefs for dropdown
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    fetch(
      `${supabaseUrl}/rest/v1/briefs?status=eq.COMPLETED&order=completed_at.desc&limit=10&select=id,name,completed_at`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )
      .then((r) => r.json())
      .then((data) => setBriefs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Load events when a brief is selected
  const loadEvents = useCallback(
    async (briefId: number) => {
      setLoading(true);
      setPlaying(false);
      setCurrentIndex(0);
      lastIndexRef.current = 0;
      onReset();

      try {
        const res = await fetch(`/api/replay/${briefId}`);
        const data = await res.json();
        setEvents(data.events || []);
        setReplayMode(data.mode || null);
        setResolvedAgent(data.resolved_agent || null);
      } catch {
        setEvents([]);
        setReplayMode(null);
      } finally {
        setLoading(false);
      }
    },
    [onReset]
  );

  // Resolve tool_or_service to a service name for pulse animation
  const resolveServiceForPulse = useCallback(
    (tool: string | null): string | null => {
      if (!tool) return null;
      if (tool.includes("Supabase")) return "Supabase";
      if (tool.includes("rag_system") || tool.includes("Claude_Web_MCP"))
        return "RAG";
      if (tool.includes("Vercel")) return "Vercel";
      if (tool.includes("monday")) return "Monday";
      if (tool.includes("github") || tool.includes("gh")) return "GitHub";
      return null;
    },
    []
  );

  // Playback loop using requestAnimationFrame
  useEffect(() => {
    if (!playing || events.length === 0) return;

    startTimeRef.current =
      performance.now() -
      (events[lastIndexRef.current]?.relative_ms || 0) / speed;

    const tick = (now: number) => {
      const elapsed = (now - startTimeRef.current) * speed;

      // Find all events up to current elapsed time
      let newIndex = lastIndexRef.current;
      while (
        newIndex < events.length &&
        events[newIndex].relative_ms <= elapsed
      ) {
        const ev = events[newIndex];
        onEventFire(ev, resolvedAgent);

        // Emit service pulse for tool calls
        if (onServicePulse && ev.tool_or_service) {
          const serviceName = resolveServiceForPulse(ev.tool_or_service);
          if (serviceName) {
            onServicePulse({
              from: ev.agent,
              to: serviceName,
              tool: ev.tool_or_service,
              timestamp: performance.now(),
            });
          }
        }

        newIndex++;
      }

      if (newIndex !== lastIndexRef.current) {
        lastIndexRef.current = newIndex;
        setCurrentIndex(newIndex);
      }

      if (newIndex >= events.length) {
        setPlaying(false);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    playing,
    events,
    speed,
    onEventFire,
    onServicePulse,
    resolveServiceForPulse,
    resolvedAgent,
  ]);

  const handleSelectBrief = (id: number) => {
    setSelectedBrief(id);
    loadEvents(id);
  };

  const handlePlayPause = () => {
    if (currentIndex >= events.length && events.length > 0) {
      // Reset to beginning
      setCurrentIndex(0);
      lastIndexRef.current = 0;
      onReset();
    }
    setPlaying(!playing);
  };

  const handleScrub = (index: number) => {
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);

    // Reset and replay up to scrub point
    onReset();
    for (let i = 0; i <= index && i < events.length; i++) {
      onEventFire(events[i], resolvedAgent);
    }
    setCurrentIndex(index);
    lastIndexRef.current = index;
  };

  const totalDuration =
    events.length > 0 ? events[events.length - 1].relative_ms : 0;
  const currentEvent =
    currentIndex > 0 && currentIndex <= events.length
      ? events[currentIndex - 1]
      : null;

  // Suppress unused-var lint — totalDuration reserved for future elapsed-time display
  void totalDuration;

  const font = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 border-t border-[#00ff41]/20"
      style={{ ...font, background: "#0d0d0d" }}
    >
      {/* Brief selector */}
      <select
        value={selectedBrief || ""}
        onChange={(e) =>
          e.target.value && handleSelectBrief(Number(e.target.value))
        }
        className="bg-[#1a1a1a] border border-[#00ff41]/20 rounded px-1.5 py-0.5 text-[9px] text-[#d4d4d4] outline-none max-w-[200px] truncate"
        style={font}
      >
        <option value="">Select BRIEF...</option>
        {briefs.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name.replace("BRIEF::", "").substring(0, 40)}
          </option>
        ))}
      </select>

      {/* Play/Pause */}
      <button
        onClick={handlePlayPause}
        disabled={events.length === 0 || loading}
        className="px-2 py-0.5 rounded text-[9px] border border-[#00ff41]/20 hover:bg-[#1a1a1a] disabled:opacity-30"
        style={{ ...font, color: playing ? "#ffb800" : "#00ff41" }}
      >
        {loading ? "..." : playing ? "||" : ">"}
      </button>

      {/* Speed — 1x/5x/10x/25x with 10x default */}
      <div className="flex items-center gap-1">
        {[1, 5, 10, 25].map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className="px-1 py-0.5 rounded text-[8px] border transition-colors"
            style={{
              ...font,
              color: speed === s ? "#0a0a0a" : "#00ff41",
              background: speed === s ? "#00ff41" : "transparent",
              borderColor: "rgba(0,255,65,0.2)",
            }}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Timeline scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(events.length - 1, 0)}
        value={Math.min(currentIndex, Math.max(events.length - 1, 0))}
        onChange={(e) => handleScrub(Number(e.target.value))}
        className="flex-1 h-1 accent-[#00ff41]"
        disabled={events.length === 0}
      />

      {/* Event counter + mode badge */}
      <span className="text-[9px] text-[#737373] whitespace-nowrap">
        {currentIndex}/{events.length}
      </span>
      {replayMode && replayMode !== "brief_id" && (
        <span
          className="text-[8px] px-1 py-0.5 rounded whitespace-nowrap"
          style={{
            ...font,
            color: replayMode === "global" ? "#ffb800" : "#00ff41",
            background:
              replayMode === "global"
                ? "rgba(255,184,0,0.1)"
                : "rgba(0,255,65,0.1)",
            border: `1px solid ${replayMode === "global" ? "rgba(255,184,0,0.3)" : "rgba(0,255,65,0.2)"}`,
          }}
        >
          {replayMode === "global" ? "GLOBAL" : "TIME"}
        </span>
      )}

      {/* Current event */}
      {currentEvent && (
        <span className="text-[8px] text-[#00ff41] whitespace-nowrap max-w-[150px] truncate">
          {currentEvent.agent} &rarr; {currentEvent.operation}
        </span>
      )}
    </div>
  );
}
