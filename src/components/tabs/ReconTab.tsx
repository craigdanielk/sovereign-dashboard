"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { FeedSource, PatternDetection } from "@/lib/types";
import LinearListRow from "@/components/LinearListRow";
import EmptyState from "@/components/EmptyState";

const SIGNAL_COLOURS: Record<string, string> = {
  GO:   "#10B981",
  GAP:  "#F59E0B",
  SKIP: "#EF4444",
};

export default function ReconTab() {
  const [feedSources, setFeedSources] = useState<FeedSource[]>([]);
  const [patterns, setPatterns] = useState<PatternDetection[]>([]);
  const [signalFilter, setSignalFilter] = useState<string | null>(null);
  const [signalCounts, setSignalCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

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
      .limit(200);
    if (data) {
      setPatterns(data);
      const c: Record<string, number> = {};
      data.forEach((p: PatternDetection) => {
        const s = p.status?.toUpperCase() || "UNKNOWN";
        c[s] = (c[s] || 0) + 1;
      });
      setSignalCounts(c);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
    fetchPatterns();

    const channel = supabase
      .channel("recon-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_sources" }, fetchFeeds)
      .on("postgres_changes", { event: "*", schema: "public", table: "pattern_detections" }, fetchPatterns)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeeds, fetchPatterns]);

  const filteredPatterns = signalFilter
    ? patterns.filter((p) => p.status?.toUpperCase() === signalFilter)
    : patterns;

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Pattern detections (main) ─────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Section header */}
        <div
          className="flex items-center justify-between flex-shrink-0 border-b"
          style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: "#E5E5E5" }}>Recon</span>
          <span style={{ fontSize: 12, color: "#6B6B6B" }}>{patterns.length} detections</span>
        </div>

        {/* Signal filter strip */}
        <div
          className="flex items-center gap-2 flex-shrink-0 border-b"
          style={{ padding: "8px 16px", borderColor: "#2A2A2A" }}
        >
          {["GO", "GAP", "SKIP"].map((s) => (
            <button
              key={s}
              onClick={() => setSignalFilter(signalFilter === s ? null : s)}
              style={{
                fontSize: 11,
                padding: "2px 10px",
                borderRadius: 4,
                border: `1px solid ${signalFilter === s ? SIGNAL_COLOURS[s] : "#2A2A2A"}`,
                color: signalFilter === s ? SIGNAL_COLOURS[s] : "#6B6B6B",
                background: signalFilter === s ? `${SIGNAL_COLOURS[s]}15` : "transparent",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {s}
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{signalCounts[s] || 0}</span>
            </button>
          ))}
          {signalFilter && (
            <button
              onClick={() => setSignalFilter(null)}
              style={{ fontSize: 11, color: "#6B6B6B", cursor: "pointer", padding: "2px 8px" }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Pattern list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <EmptyState message="Loading signals…" />
          ) : filteredPatterns.length === 0 ? (
            <EmptyState message={signalFilter ? `No ${signalFilter} signals` : "No pattern detections"} />
          ) : (
            filteredPatterns.map((p) => (
              <LinearListRow
                key={p.id}
                title={p.signal}
                status={p.status?.toUpperCase() ?? undefined}
                badge={p.client_slug || undefined}
                badgeColor="#7C3AED"
                secondaryText={p.pattern_type}
                timestamp={p.created_at}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Feed sources (right panel, fixed width) ───────────────── */}
      <div
        className="flex flex-col border-l overflow-hidden flex-shrink-0"
        style={{ width: 260, background: "#161616", borderColor: "#2A2A2A" }}
      >
        <div
          className="flex items-center border-b flex-shrink-0"
          style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "#E5E5E5" }}>Feed Sources</span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0" }}>
          {feedSources.length === 0 ? (
            <EmptyState message="No feed sources" />
          ) : (
            feedSources.map((fs) => (
              <div
                key={fs.id}
                className="list-row"
                style={{ paddingLeft: 16, paddingRight: 16 }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background:
                      fs.status === "active" ? "#10B981"
                        : fs.status === "error" ? "#EF4444"
                        : "#6B6B6B",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="flex-1 truncate"
                  style={{ fontSize: 13, color: "#E5E5E5" }}
                >
                  {fs.name}
                </span>
                <span style={{ fontSize: 11, color: "#6B6B6B" }}>{fs.source_type}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
