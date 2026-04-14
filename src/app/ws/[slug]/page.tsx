"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { WORKSPACES } from "@/lib/types";
import { getWorkspaceColour } from "@/lib/colours";
import BriefRow from "@/components/workspace/BriefRow";
import type { Brief } from "@/lib/supabase";
import Link from "next/link";

export default function WorkspaceBoard() {
  const params = useParams();
  const slug = params.slug as string;
  const workspace = WORKSPACES.find((w) => w.slug === slug);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    if (slug === "r17") {
      // For R17, try r17_briefs first, fall back to regular briefs
      const { data: r17Data } = await supabase
        .from("r17_briefs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (r17Data && r17Data.length > 0) {
        setBriefs(
          r17Data.map((b: Record<string, unknown>) => ({
            id: b.id as number,
            name: (b.name as string) || (b.title as string) || "",
            priority: (b.priority as string) || "P2",
            status: (b.status as string) || "QUEUED",
            triggered_by: null,
            blocked_by: null,
            created_at: b.created_at as string,
            claimed_at: null,
            completed_at: null,
            claimed_by: (b.client_slug as string) || null,
            failure_reason: null,
            summary: (b.client_name as string) || null,
            payload: null,
            wsjf_score: (b.wsjf_score as number) || null,
            quality_grade: (b.quality_grade as string) || null,
            tenant_id: (b.client_slug as string) || null, // Added tenant_id
          }))
        );
      } else {
        // Fallback to regular briefs
        const { data } = await supabase
          .from("briefs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (data) setBriefs(data);
      }
    } else {
      // Generic workspace — show briefs
      const { data } = await supabase
        .from("briefs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setBriefs(data);
    }

    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered =
    statusFilter === "ALL" ? briefs : briefs.filter((b) => b.status === statusFilter);

  const statuses = ["ALL", ...new Set(briefs.map((b) => b.status))];

  // For R17, group by client_slug (stored in claimed_by for our mapping)
  const isR17 = slug === "r17";
  const clientGroups = isR17
    ? filtered.reduce<Record<string, Brief[]>>((acc, b) => {
        const client = b.claimed_by || "unassigned";
        if (!acc[client]) acc[client] = [];
        acc[client].push(b);
        return acc;
      }, {})
    : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-bg-secondary">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span
              className="text-xl font-black"
              style={{ color: getWorkspaceColour(workspace?.colour || "accent-cyan") }}
            >
              {workspace?.icon || slug.toUpperCase()}
            </span>
            <h1 className="text-lg font-bold text-text-primary">
              {workspace?.name || slug}
            </h1>
          </div>
          <span className="text-xs text-text-muted">
            {filtered.length} items
          </span>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                statusFilter === s
                  ? "bg-bg-card-hover text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {s}
              {s !== "ALL" && (
                <span className="ml-1 font-mono">
                  {briefs.filter((b) => b.status === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && (
          <div className="text-center text-text-muted py-8 text-xs">Loading...</div>
        )}

        {!loading && isR17 && clientGroups && (
          <div className="space-y-4">
            {Object.entries(clientGroups).map(([client, items]) => (
              <div key={client}>
                <Link
                  href={`/ws/r17/${client}`}
                  className="flex items-center gap-2 mb-2 group"
                >
                  <h3 className="text-sm font-bold text-accent-purple group-hover:text-white transition-colors capitalize">
                    {client.replace(/-/g, " ")}
                  </h3>
                  <span className="text-[10px] text-text-muted">
                    {items.length} items
                  </span>
                </Link>
                <div className="space-y-1">
                  {items.map((b) => (
                    <BriefRow
                      key={b.id}
                      id={b.id}
                      name={b.name}
                      status={b.status}
                      priority={b.priority}
                      wsjfScore={b.wsjf_score}
                      claimedBy={b.claimed_by}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !isR17 && (
          <div className="space-y-1">
            {filtered.map((b) => (
              <BriefRow
                key={b.id}
                id={b.id}
                name={b.name}
                status={b.status}
                priority={b.priority}
                wsjfScore={b.wsjf_score}
                claimedBy={b.claimed_by}
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center text-text-muted py-8 text-xs">
            No items in this workspace
          </div>
        )}
      </div>
    </div>
  );
}
