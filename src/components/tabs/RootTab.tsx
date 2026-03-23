"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { WORKSPACES } from "@/lib/types";
import { getWorkspaceColour, withAlpha } from "@/lib/colours";

interface WorkspaceLiveCounts {
  [slug: string]: number;
}

interface PinnedItem {
  id: number;
  workspace_slug: string;
  item_type: string;
  item_id: number;
  label?: string;
}

export default function RootTab() {
  const [counts, setCounts] = useState<WorkspaceLiveCounts>({});
  const [pins, setPins] = useState<PinnedItem[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchCounts = useCallback(async () => {
    const { data: briefs } = await supabase
      .from("briefs")
      .select("id")
      .in("status", ["QUEUED", "CLAIMED", "IN_PROGRESS"]);

    const { data: r17 } = await supabase
      .from("r17_briefs")
      .select("id")
      .in("status", ["QUEUED", "CLAIMED", "IN_PROGRESS"]);

    const cutoff = new Date(Date.now() - 3600000).toISOString();
    const { data: logs } = await supabase
      .from("execution_log")
      .select("id")
      .gte("created_at", cutoff);

    const { data: comms } = await supabase
      .from("communications")
      .select("id")
      .eq("is_read", false);

    setCounts({
      "north-star": briefs?.length || 0,
      r17: r17?.length || 0,
      battlefield: logs?.length || 0,
      comms: comms?.length || 0,
    });
  }, []);

  const fetchPins = useCallback(async () => {
    const { data } = await supabase
      .from("workspace_pins")
      .select("*")
      .order("position", { ascending: true })
      .limit(8);
    if (data) setPins(data as PinnedItem[]);
  }, []);

  useEffect(() => {
    fetchCounts();
    fetchPins();

    const channel = supabase
      .channel("root-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCounts, fetchPins]);

  void tick;

  function navigateTab(slug: string) {
    const tabKey = slug === "north-star" ? "north-star" : slug;
    const setter = (window as unknown as Record<string, unknown>).__setActiveTab as
      | ((tab: string) => void)
      | undefined;
    if (setter) setter(tabKey);
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(#1e1e1e 1px, transparent 1px), linear-gradient(90deg, #1e1e1e 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-[0.4em] text-accent-green/10 uppercase glow-green">
              COMMAND SURFACE
            </h1>
          </div>
        </div>

        <div className="absolute inset-4 grid grid-cols-2 grid-rows-2 gap-3">
          {WORKSPACES.map((ws) => {
            const colour = getWorkspaceColour(ws.colour);
            const count = counts[ws.slug] || 0;
            return (
              <button
                key={ws.slug}
                onClick={() => navigateTab(ws.slug)}
                className="group relative rounded border border-border hover:border-border-bright bg-bg-card hover:bg-bg-card-hover transition-all text-left"
                style={{ borderLeftColor: withAlpha(colour, 0.5), borderLeftWidth: 3 }}
              >
                <div className="p-4 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black" style={{ color: colour }}>
                        {ws.icon}
                      </span>
                      <span className="text-xs font-bold text-text-primary group-hover:text-white transition-colors">
                        {ws.name}
                      </span>
                    </div>
                    <span
                      className="text-xl font-black tabular-nums"
                      style={{ color: withAlpha(colour, 0.7) }}
                    >
                      {count}
                    </span>
                  </div>

                  <p className="text-[10px] text-text-secondary flex-1">
                    {ws.description}
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <span
                      className="text-[9px] uppercase tracking-widest font-bold"
                      style={{ color: withAlpha(colour, 0.6) }}
                    >
                      /{ws.slug}
                    </span>
                    <span className="text-[9px] text-text-muted group-hover:text-text-secondary transition-colors">
                      OPEN &gt;
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {pins.length > 0 && (
        <div className="shrink-0 px-4 py-1.5 border-t border-border flex items-center gap-3 overflow-x-auto">
          <span className="text-[9px] text-text-muted font-bold tracking-wider shrink-0">
            PINNED
          </span>
          {pins.map((pin) => (
            <span
              key={pin.id}
              className="text-[10px] text-text-secondary px-2 py-0.5 bg-bg-card rounded border border-border shrink-0"
            >
              {pin.item_type} #{pin.item_id}
            </span>
          ))}
        </div>
      )}

      <div className="shrink-0 px-4 py-1 border-t border-border flex items-center gap-4 text-[9px] text-text-muted">
        <span>{WORKSPACES.length} workspaces</span>
        <span className="text-border">|</span>
        <span>
          {new Date().toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="text-border">|</span>
        <span className="text-accent-green/50">SOVEREIGN v2</span>
      </div>
    </div>
  );
}
