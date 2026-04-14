"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BriefRow from "@/components/workspace/BriefRow";
import type { Brief } from "@/lib/supabase";

export default function R17ClientBoard() {
  const params = useParams();
  const clientSlug = params.client as string;
  const clientName = clientSlug.replace(/-/g, " ");
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Try r17_briefs filtered by client_slug
    const { data: r17Data } = await supabase
      .from("r17_briefs")
      .select("*")
      .eq("client_slug", clientSlug)
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
          claimed_by: (b.assigned_agent as string) || null,
          failure_reason: null,
          summary: (b.client_name as string) || null,
          payload: null,
          wsjf_score: (b.wsjf_score as number) || null,
          quality_grade: (b.quality_grade as string) || null,
          tenant_id: clientSlug || null, // Added tenant_id
        }))
      );
    } else {
      setBriefs([]);
    }

    setLoading(false);
  }, [clientSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-accent-purple">R17</span>
          <h1 className="text-lg font-bold text-text-primary capitalize">
            {clientName}
          </h1>
          <span className="text-xs text-text-muted">{briefs.length} items</span>
        </div>
      </div>

      {/* Briefs list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && (
          <div className="text-center text-text-muted py-8 text-xs">Loading...</div>
        )}

        {!loading && briefs.length > 0 && (
          <div className="space-y-1">
            {briefs.map((b) => (
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

        {!loading && briefs.length === 0 && (
          <div className="text-center text-text-muted py-8 text-xs">
            No briefs found for {clientName}
          </div>
        )}
      </div>
    </div>
  );
}
