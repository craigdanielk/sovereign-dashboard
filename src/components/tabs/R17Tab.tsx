"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { R17Brief } from "@/lib/types";
import LinearListRow from "@/components/LinearListRow";
import LinearGroupHeader from "@/components/LinearGroupHeader";
import EmptyState from "@/components/EmptyState";

interface ClientGroup {
  slug: string;
  name: string;
  briefs: R17Brief[];
  activeCount: number;
}

export default function R17Tab() {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [totalBriefs, setTotalBriefs] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBriefs = useCallback(async () => {
    const { data } = await supabase
      .from("r17_briefs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return;

    const briefs = data as R17Brief[];
    const clientMap = new Map<string, ClientGroup>();

    for (const b of briefs) {
      if (!clientMap.has(b.client_slug)) {
        clientMap.set(b.client_slug, {
          slug: b.client_slug,
          name: b.client_name || b.client_slug,
          briefs: [],
          activeCount: 0,
        });
      }
      const g = clientMap.get(b.client_slug)!;
      g.briefs.push(b);
      if (["QUEUED", "CLAIMED", "IN_PROGRESS"].includes(b.status)) {
        g.activeCount++;
      }
    }

    const sorted = Array.from(clientMap.values()).sort(
      (a, b) => b.activeCount - a.activeCount || b.briefs.length - a.briefs.length
    );

    setGroups(sorted);
    setTotalBriefs(briefs.length);
    // Expand groups that have active briefs by default
    setExpandedSlugs(new Set(sorted.filter((g) => g.activeCount > 0).map((g) => g.slug)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBriefs();

    const channel = supabase
      .channel("r17-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "r17_briefs" }, fetchBriefs)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBriefs]);

  function toggleGroup(slug: string) {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Section header */}
      <div
        className="flex items-center justify-between flex-shrink-0 border-b"
        style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: "#E5E5E5" }}>R17</span>
        <span style={{ fontSize: 12, color: "#6B6B6B" }}>
          {totalBriefs} briefs · {groups.length} clients
        </span>
      </div>

      {/* Grouped brief list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <EmptyState message="Loading R17 briefs…" />
        ) : groups.length === 0 ? (
          <EmptyState message="No R17 briefs" />
        ) : (
          groups.map((group) => {
            const expanded = expandedSlugs.has(group.slug);
            return (
              <div key={group.slug}>
                <LinearGroupHeader
                  label={group.name}
                  count={group.briefs.length}
                  expanded={expanded}
                  onToggle={() => toggleGroup(group.slug)}
                />
                {expanded &&
                  group.briefs.map((brief) => (
                    <LinearListRow
                      key={brief.id}
                      id={brief.id}
                      title={brief.name}
                      status={brief.status}
                      priority={brief.priority}
                      badge={group.name}
                      badgeColor="#7C3AED"
                      timestamp={brief.created_at}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
