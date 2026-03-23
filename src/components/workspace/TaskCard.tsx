"use client";

import Link from "next/link";
import { getStatusColour, getPriorityColour, getPlatformColour, withAlpha } from "@/lib/colours";

interface TaskCardProps {
  id: number;
  title: string;
  status: string;
  priority: string;
  platform?: string | null;
  type?: string;
}

export default function TaskCard({ id, title, status, priority, platform, type = "task" }: TaskCardProps) {
  const statusCol = getStatusColour(status);
  const priorityCol = getPriorityColour(priority);

  return (
    <Link
      href={`/item/${type}/${id}`}
      className="flex items-center gap-3 px-3 py-2 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors group"
    >
      <span className="text-[10px] font-bold shrink-0 w-6" style={{ color: priorityCol }}>
        {priority}
      </span>

      <span className="text-xs text-text-primary flex-1 truncate group-hover:text-white transition-colors">
        {title}
      </span>

      <span
        className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
        style={{ color: statusCol, backgroundColor: withAlpha(statusCol, 0.2) }}
      >
        {status}
      </span>

      {platform && (
        <span className="text-[10px] shrink-0" style={{ color: getPlatformColour(platform) }}>
          {platform}
        </span>
      )}

      <span className="text-[10px] text-text-muted shrink-0">#{id}</span>
    </Link>
  );
}
