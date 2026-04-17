"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, type Brief } from "@/lib/supabase";

function displayName(name: string): string {
  let n = name.replace(/^BRIEF::/, "");
  n = n.replace(/::[\d]{8}-[\d]{6}$/, "").replace(/::[\d]{4}-[\d]{2}-[\d]{2}$/, "");
  return n;
}

export default function HitlBriefGate() {
  const [rows, setRows] = useState<Brief[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("briefs")
      .select("*")
      .eq("status", "QUEUED")
      .in("supervision_mode", ["HITL", "SUPERVISED"])
      .order("created_at", { ascending: false })
      .limit(40);
    if (!error && data) setRows(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("hitl-briefs-gate")
      .on("postgres_changes", { event: "*", schema: "public", table: "briefs" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  async function act(id: number, action: "approve" | "reject") {
    const key = `${id}-${action}`;
    setBusy(key);
    try {
      if (action === "approve") {
        await supabase
          .from("briefs")
          .update({
            status: "CLAIMED",
            claimed_at: new Date().toISOString(),
          })
          .eq("id", id);
      } else {
        await supabase
          .from("briefs")
          .update({
            status: "FAILED",
            failure_reason: "Rejected at HITL gate",
          })
          .eq("id", id);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="flex-shrink-0 border-b overflow-hidden"
      style={{ borderColor: "#1C1C1C", maxHeight: 200 }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "rgba(124,58,237,0.06)" }}
      >
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#9D6FEB" }}>
          HITL gate
        </span>
        <span className="text-[9px] font-mono text-[#525252]">{rows.length} pending</span>
      </div>
      <div className="overflow-y-auto custom-scrollbar px-2 pb-2" style={{ maxHeight: 160 }}>
        {rows.length === 0 && (
          <div className="text-[9px] text-[#333333] py-2 px-1">No supervised briefs awaiting approval.</div>
        )}
        {rows.map((b) => (
          <div
            key={b.id}
            className="flex items-start gap-2 py-1.5 border-b border-[#1A1A1A] last:border-0"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-[#E5E5E5] leading-snug truncate" title={b.name}>
                {displayName(b.name)}
              </div>
              <div className="text-[8px] font-mono text-[#444444]">
                B-{b.id} · {b.supervision_mode ?? "—"}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => act(b.id, "approve")}
                className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/40 disabled:opacity-40"
              >
                {busy === `${b.id}-approve` ? "…" : "OK"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => act(b.id, "reject")}
                className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-red-900/50 text-red-400 hover:bg-red-950/40 disabled:opacity-40"
              >
                {busy === `${b.id}-reject` ? "…" : "✕"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
