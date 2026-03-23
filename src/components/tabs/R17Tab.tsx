"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { R17Brief } from "@/lib/types";
import { getStatusColour, getPriorityColour } from "@/lib/colours";

interface ClientCard {
  slug: string;
  name: string;
  briefCount: number;
  activeCount: number;
  latestUpdate: string | null;
}

export default function R17Tab() {
  const [clients, setClients] = useState<ClientCard[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<R17Brief[]>([]);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from("r17_briefs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return;

    const clientMap = new Map<string, ClientCard>();
    for (const b of data as R17Brief[]) {
      if (!clientMap.has(b.client_slug)) {
        clientMap.set(b.client_slug, {
          slug: b.client_slug,
          name: b.client_name || b.client_slug,
          briefCount: 0,
          activeCount: 0,
          latestUpdate: null,
        });
      }
      const c = clientMap.get(b.client_slug)!;
      c.briefCount++;
      if (["QUEUED", "CLAIMED", "IN_PROGRESS"].includes(b.status)) {
        c.activeCount++;
      }
      if (!c.latestUpdate || b.created_at > c.latestUpdate) {
        c.latestUpdate = b.created_at;
      }
    }

    setBriefs(data as R17Brief[]);
    setClients(
      Array.from(clientMap.values()).sort((a, b) => b.activeCount - a.activeCount)
    );
  }, []);

  useEffect(() => {
    fetchClients();

    const channel = supabase
      .channel("r17-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "r17_briefs" }, () =>
        fetchClients()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchClients]);

  const filteredBriefs = selectedClient
    ? briefs.filter((b) => b.client_slug === selectedClient)
    : briefs;

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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Client cards strip */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-2 overflow-x-auto">
        <span className="text-[9px] text-text-muted font-bold tracking-wider shrink-0 mr-1">
          CLIENTS
        </span>
        <button
          onClick={() => setSelectedClient(null)}
          className={`shrink-0 text-[9px] px-2 py-0.5 rounded border transition-colors ${
            !selectedClient
              ? "border-accent-purple text-accent-purple"
              : "border-border text-text-muted hover:text-text-secondary"
          }`}
        >
          ALL ({briefs.length})
        </button>
        {clients.map((c) => (
          <button
            key={c.slug}
            onClick={() => setSelectedClient(c.slug)}
            className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
              selectedClient === c.slug
                ? "border-accent-purple text-accent-purple bg-bg-card-hover"
                : "border-border text-text-secondary hover:text-text-primary hover:border-border-bright"
            }`}
          >
            <span className="text-[10px] font-bold">{c.name}</span>
            {c.activeCount > 0 && (
              <span className="text-[9px] text-accent-green">{c.activeCount}</span>
            )}
            <span className="text-[9px] text-text-muted">/{c.briefCount}</span>
          </button>
        ))}
        {clients.length === 0 && (
          <span className="text-[10px] text-text-muted">No R17 clients</span>
        )}
      </div>

      {/* Brief list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredBriefs.map((brief) => (
          <div
            key={brief.id}
            className="px-3 py-2 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors"
          >
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-accent-yellow text-[10px] font-bold shrink-0">
                  #{brief.id}
                </span>
                <span className="text-[10px] text-accent-purple font-bold shrink-0">
                  {brief.client_name}
                </span>
                <span className="text-[10px] text-text-primary truncate">
                  {brief.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[9px] font-bold"
                  style={{ color: getStatusColour(brief.status) }}
                >
                  {brief.status}
                </span>
                <span
                  className="text-[9px] font-bold"
                  style={{ color: getPriorityColour(brief.priority) }}
                >
                  {brief.priority}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-text-muted">
              {brief.wsjf_score != null && (
                <span>WSJF:{Number(brief.wsjf_score).toFixed(1)}</span>
              )}
              <span className="ml-auto">{timeAgo(brief.created_at)}</span>
            </div>
          </div>
        ))}
        {filteredBriefs.length === 0 && (
          <div className="text-[10px] text-text-muted text-center py-8">
            No R17 briefs{selectedClient ? ` for ${selectedClient}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
