"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Brief } from "@/lib/supabase";

const STATUS_BG: Record<string, string> = {
  QUEUED: "bg-accent-blue",
  CLAIMED: "bg-accent-yellow",
  COMPLETED: "bg-accent-green",
  FAILED: "bg-accent-red",
  PENDING: "bg-text-muted",
  SUPERSEDED: "bg-accent-purple",
};

const STATUS_TEXT: Record<string, string> = {
  QUEUED: "text-accent-blue",
  CLAIMED: "text-accent-yellow",
  COMPLETED: "text-accent-green",
  FAILED: "text-accent-red",
  PENDING: "text-text-muted",
  SUPERSEDED: "text-accent-purple",
};

function timeAgo(ts: string | null): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function BriefQueue() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("QUEUED");

  const fetchBriefs = useCallback(async () => {
    const { data } = await supabase
      .from("briefs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) {
      setBriefs(data);
      const c: Record<string, number> = {};
      data.forEach((b: Brief) => {
        c[b.status] = (c[b.status] || 0) + 1;
      });
      setCounts(c);
    }
  }, []);

  useEffect(() => {
    fetchBriefs();

    const channel = supabase
      .channel("briefs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefs" },
        () => fetchBriefs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBriefs]);

  const filtered = briefs.filter((b) => b.status === activeTab);
  const tabs = ["QUEUED", "CLAIMED", "COMPLETED", "FAILED"];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border">
        <h2 className="text-sm font-bold tracking-wider uppercase text-accent-blue mb-2">
          BRIEF Queue
        </h2>
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded transition-colors ${
                activeTab === tab
                  ? "bg-bg-card-hover " + (STATUS_TEXT[tab] || "")
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_BG[tab] || "bg-gray-500"}`} />
              {tab}
              <span className="font-mono">{counts[tab] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((brief) => (
          <div
            key={brief.id}
            className="px-3 py-2 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-accent-yellow text-xs font-bold">#{brief.id}</span>
                <span className="text-xs font-medium text-text-primary truncate max-w-[180px]">
                  {brief.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BG[brief.status] || "bg-gray-500"} text-black font-bold`}
                >
                  {brief.status}
                </span>
                <span className="text-[10px] text-text-muted">P:{brief.priority}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-text-muted">
              {brief.claimed_by && (
                <span>
                  agent: <span className="text-accent-purple">{brief.claimed_by}</span>
                </span>
              )}
              {brief.wsjf_score != null && (
                <span>WSJF: {Number(brief.wsjf_score).toFixed(1)}</span>
              )}
              {brief.triggered_by && <span>from: {brief.triggered_by}</span>}
              <span className="ml-auto">{timeAgo(brief.created_at)}</span>
            </div>
            {brief.summary && (
              <p className="text-[10px] text-text-secondary mt-1 truncate">{brief.summary}</p>
            )}
            {brief.failure_reason && (
              <p className="text-[10px] text-accent-red mt-1 truncate">{brief.failure_reason}</p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-text-muted py-4 text-xs">No {activeTab} briefs</div>
        )}
      </div>
    </div>
  );
}
