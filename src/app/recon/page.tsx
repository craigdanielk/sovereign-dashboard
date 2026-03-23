"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { FeedSource, PatternDetection } from "@/lib/types";
import EventStream from "@/components/EventStream";

const SIGNAL_COLOURS: Record<string, string> = {
  GO: "#00ff41",
  GAP: "#ffb800",
  SKIP: "#ff1744",
};

export default function ReconPage() {
  const [feedSources, setFeedSources] = useState<FeedSource[]>([]);
  const [patterns, setPatterns] = useState<PatternDetection[]>([]);
  const [signalFilter, setSignalFilter] = useState<string | null>(null);
  const [signalCounts, setSignalCounts] = useState<Record<string, number>>({});

  const fetchFeeds = useCallback(async () => {
    const { data } = await supabase
      .from("feed_sources")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setFeedSources(data);
  }, []);

  const fetchPatterns = useCallback(async () => {
    const { data } = await supabase
      .from("pattern_detections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) {
      setPatterns(data);
      const c: Record<string, number> = {};
      data.forEach((p: PatternDetection) => {
        const s = p.status?.toUpperCase() || "UNKNOWN";
        c[s] = (c[s] || 0) + 1;
      });
      setSignalCounts(c);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
    fetchPatterns();

    const channel = supabase
      .channel("recon-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_sources" }, () => fetchFeeds())
      .on("postgres_changes", { event: "*", schema: "public", table: "pattern_detections" }, () =>
        fetchPatterns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeeds, fetchPatterns]);

  const filteredPatterns = signalFilter
    ? patterns.filter((p) => p.status?.toUpperCase() === signalFilter)
    : patterns;

  function timeAgo(ts: string | null): string {
    if (!ts) return "--";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Event Stream */}
      <div className="w-56 shrink-0">
        <EventStream />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Signal filter bar */}
        <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-3">
          <span className="text-[10px] font-bold text-accent-blue tracking-wider">
            SIGNAL FEED
          </span>
          <div className="flex gap-1 ml-2">
            {["GO", "GAP", "SKIP"].map((s) => (
              <button
                key={s}
                onClick={() => setSignalFilter(signalFilter === s ? null : s)}
                className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                  signalFilter === s
                    ? "border-current"
                    : "border-border hover:border-border-bright"
                }`}
                style={{
                  color: signalFilter === s ? SIGNAL_COLOURS[s] : "#737373",
                }}
              >
                {s} <span className="tabular-nums">{signalCounts[s] || 0}</span>
              </button>
            ))}
            {signalFilter && (
              <button
                onClick={() => setSignalFilter(null)}
                className="text-[9px] text-text-muted hover:text-text-secondary px-1"
              >
                CLEAR
              </button>
            )}
          </div>
          <span className="text-[9px] text-text-muted ml-auto">
            {patterns.length} detections
          </span>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Pattern detections */}
          <div className="flex-1 flex flex-col border-r border-border min-w-0">
            <div className="shrink-0 px-3 py-1 border-b border-border">
              <span className="text-[9px] text-text-muted tracking-wider">
                PATTERN DETECTIONS
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {filteredPatterns.map((p) => (
                <div
                  key={p.id}
                  className="px-2 py-1.5 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-bold"
                        style={{
                          color: SIGNAL_COLOURS[p.status?.toUpperCase()] || "#404040",
                        }}
                      >
                        {p.status?.toUpperCase() || "?"}
                      </span>
                      <span className="text-[10px] text-text-primary truncate max-w-[200px]">
                        {p.signal}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-accent-purple">
                        {p.pattern_type}
                      </span>
                      {p.confidence != null && (
                        <span className="text-[9px] text-text-muted">
                          {(p.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-text-muted">
                    {p.client_slug && (
                      <span className="text-accent-cyan">{p.client_slug}</span>
                    )}
                    <span className="ml-auto">{timeAgo(p.created_at)}</span>
                  </div>
                </div>
              ))}
              {filteredPatterns.length === 0 && (
                <div className="text-[10px] text-text-muted text-center py-4">
                  No pattern detections{signalFilter ? ` with ${signalFilter} signal` : ""}
                </div>
              )}
            </div>
          </div>

          {/* Source breakdown */}
          <div className="w-64 flex flex-col min-w-0">
            <div className="shrink-0 px-3 py-1 border-b border-border">
              <span className="text-[9px] text-text-muted tracking-wider">
                FEED SOURCES
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {feedSources.map((fs) => (
                <div
                  key={fs.id}
                  className="px-2 py-1.5 rounded bg-bg-card border border-border"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-text-primary truncate">
                      {fs.name}
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        fs.status === "active"
                          ? "text-accent-green"
                          : fs.status === "error"
                          ? "text-accent-red"
                          : "text-text-muted"
                      }`}
                    >
                      {fs.status?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-text-muted">
                    <span>{fs.source_type}</span>
                    <span className="ml-auto">
                      {fs.last_fetched_at ? timeAgo(fs.last_fetched_at) : "never"}
                    </span>
                  </div>
                </div>
              ))}
              {feedSources.length === 0 && (
                <div className="text-[10px] text-text-muted text-center py-4">
                  No feed sources configured
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
