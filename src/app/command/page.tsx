"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type Brief } from "@/lib/supabase";
import { getStatusColour } from "@/lib/colours";

interface ApprovalItem {
  id: number;
  type: string;
  name: string;
  status: string;
  detail: string;
  created_at: string;
}

export default function CommandPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [recentBriefs, setRecentBriefs] = useState<Brief[]>([]);

  const fetchApprovals = useCallback(async () => {
    // Fetch briefs that need approval (HITL gates)
    const { data: pendingBriefs } = await supabase
      .from("briefs")
      .select("*")
      .in("status", ["QUEUED", "PENDING"])
      .order("created_at", { ascending: false })
      .limit(20);

    const items: ApprovalItem[] = [];
    if (pendingBriefs) {
      for (const b of pendingBriefs as Brief[]) {
        // Check if it's an OUTREACH or LORE approval
        const name = b.name?.toLowerCase() || "";
        if (name.includes("outreach") || name.includes("lore") || name.includes("go lead")) {
          items.push({
            id: b.id,
            type: name.includes("outreach") ? "OUTREACH" : name.includes("lore") ? "LORE" : "GO_LEAD",
            name: b.name,
            status: b.status,
            detail: b.summary || "",
            created_at: b.created_at,
          });
        }
      }
    }
    setApprovals(items);
  }, []);

  const fetchRecentBriefs = useCallback(async () => {
    const { data } = await supabase
      .from("briefs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setRecentBriefs(data as Brief[]);
  }, []);

  useEffect(() => {
    fetchApprovals();
    fetchRecentBriefs();

    const channel = supabase
      .channel("command-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, () => {
        fetchApprovals();
        fetchRecentBriefs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchApprovals, fetchRecentBriefs]);

  function timeAgo(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  const gateColours: Record<string, string> = {
    OUTREACH: "#ff6d00",
    LORE: "#b388ff",
    GO_LEAD: "#00ff41",
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Command triggers */}
      <div className="flex-1 flex flex-col border-r border-border">
        <div className="shrink-0 px-3 py-1.5 border-b border-border">
          <span className="text-[10px] font-bold text-accent-green tracking-wider glow-green">
            COMMAND TRIGGERS
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Sprint trigger */}
          <div className="rounded bg-bg-card border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-accent-green">/sprint</span>
              <span className="text-[9px] text-text-muted">SOVEREIGN loop trigger</span>
            </div>
            <p className="text-[10px] text-text-secondary mb-2">
              Initiates SOVEREIGN polling loop. Checks for QUEUED briefs and dispatches
              to available agents.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-accent-yellow">
                Requires: active terminal with --dangerously-skip-permissions
              </span>
            </div>
          </div>

          {/* LORE approvals */}
          <div className="rounded bg-bg-card border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-accent-purple">LORE APPROVALS</span>
              <span className="text-[9px] text-text-muted">Pattern promotion</span>
            </div>
            <p className="text-[10px] text-text-secondary">
              Review and approve LORE pattern promotions from observation to best practice.
            </p>
          </div>

          {/* GO lead review */}
          <div className="rounded bg-bg-card border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-accent-cyan">GO LEAD REVIEW</span>
              <span className="text-[9px] text-text-muted">RECON signals</span>
            </div>
            <p className="text-[10px] text-text-secondary">
              Review GO-rated RECON signals for lead qualification and outreach activation.
            </p>
          </div>

          {/* OUTREACH HITL gate */}
          <div className="rounded bg-bg-card border border-accent-orange/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-accent-orange">
                OUTREACH HITL GATE
              </span>
              <span className="text-[9px] text-accent-red">APPROVE REQUIRED</span>
            </div>
            <p className="text-[10px] text-text-secondary mb-2">
              All outreach emails require explicit Craig approval before sending.
              This gate cannot be bypassed by any agent.
            </p>
          </div>
        </div>
      </div>

      {/* Right: Approval queue + recent briefs */}
      <div className="w-96 flex flex-col">
        {/* Approval queue */}
        <div className="flex-1 flex flex-col border-b border-border">
          <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-bold text-accent-yellow tracking-wider">
              APPROVAL QUEUE
            </span>
            <span className="text-[9px] text-text-muted">{approvals.length} pending</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {approvals.map((item) => (
              <div
                key={item.id}
                className="px-2 py-1.5 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded"
                      style={{
                        color: gateColours[item.type] || "#737373",
                        backgroundColor: `${gateColours[item.type] || "#737373"}15`,
                      }}
                    >
                      {item.type}
                    </span>
                    <span className="text-[10px] text-text-primary truncate max-w-[180px]">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[9px] text-text-muted">{timeAgo(item.created_at)}</span>
                </div>
                {item.detail && (
                  <p className="text-[9px] text-text-secondary truncate">{item.detail}</p>
                )}
              </div>
            ))}
            {approvals.length === 0 && (
              <div className="text-[10px] text-text-muted text-center py-4">
                No pending approvals
              </div>
            )}
          </div>
        </div>

        {/* Recent briefs */}
        <div className="h-48 flex flex-col">
          <div className="shrink-0 px-3 py-1.5 border-b border-border">
            <span className="text-[10px] font-bold text-accent-blue tracking-wider">
              RECENT BRIEFS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0">
            {recentBriefs.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] hover:bg-bg-card-hover rounded"
              >
                <span className="text-accent-yellow shrink-0">#{b.id}</span>
                <span
                  className="shrink-0 w-14 text-[9px] font-bold"
                  style={{ color: getStatusColour(b.status) }}
                >
                  {b.status}
                </span>
                <span className="text-text-primary truncate flex-1">{b.name}</span>
                <span className="text-text-muted shrink-0">{timeAgo(b.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
