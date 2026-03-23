"use client";

import Link from "next/link";
import { getStatusColour, getPriorityColour, withAlpha } from "@/lib/colours";

interface BriefRowProps {
  id: number;
  name: string;
  status: string;
  priority: string;
  wsjfScore?: number | null;
  claimedBy?: string | null;
}

export default function BriefRow({ id, name, status, priority, wsjfScore, claimedBy }: BriefRowProps) {
  const statusCol = getStatusColour(status);
  const priorityCol = getPriorityColour(priority);

  return (
    <Link
      href={`/item/brief/${id}`}
      className="flex items-center gap-3 px-3 py-2 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors group"
    >
      <span className="text-accent-yellow text-[10px] font-bold shrink-0 w-10">
        #{id}
      </span>

      <span className="text-xs text-text-primary flex-1 truncate group-hover:text-white transition-colors">
        {name}
      </span>

      <span className="text-[10px] font-bold shrink-0" style={{ color: priorityCol }}>
        {priority}
      </span>

      <span
        className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
        style={{ color: statusCol, backgroundColor: withAlpha(statusCol, 0.2) }}
      >
        {status}
      </span>

      {wsjfScore != null && (
        <span className="text-[10px] text-text-muted shrink-0 w-12 text-right">
          WSJF {Number(wsjfScore).toFixed(1)}
        </span>
      )}

      {claimedBy && (
        <span className="text-[10px] text-accent-purple shrink-0">
          {claimedBy}
        </span>
      )}
    </Link>
  );
}
