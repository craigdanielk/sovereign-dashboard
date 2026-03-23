"use client";

import Link from "next/link";
import { getPlatformColour } from "@/lib/colours";

interface CommsRowProps {
  id: number;
  platform: string;
  sender: string;
  subject: string;
  preview: string;
  timestamp: string;
  isRead: boolean;
  threadId?: string | null;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function CommsRow({
  id,
  platform,
  sender,
  subject,
  preview,
  timestamp,
  isRead,
}: CommsRowProps) {
  return (
    <Link
      href={`/item/comms/${id}`}
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-border transition-colors hover:bg-bg-card-hover ${
        isRead ? "opacity-60" : ""
      }`}
    >
      <span className="w-3 shrink-0 flex justify-center">
        {!isRead && <span className="w-2 h-2 rounded-full bg-accent-blue" />}
      </span>

      <span
        className="text-[10px] uppercase font-bold shrink-0 w-16"
        style={{ color: getPlatformColour(platform) }}
      >
        {platform}
      </span>

      <span className={`text-xs shrink-0 w-32 truncate ${isRead ? "text-text-secondary" : "text-text-primary font-medium"}`}>
        {sender}
      </span>

      <div className="flex-1 flex items-baseline gap-2 min-w-0">
        <span className={`text-xs truncate ${isRead ? "text-text-secondary" : "text-text-primary"}`}>
          {subject}
        </span>
        <span className="text-[10px] text-text-muted truncate">
          {preview}
        </span>
      </div>

      <span className="text-[10px] text-text-muted shrink-0">
        {timeAgo(timestamp)}
      </span>
    </Link>
  );
}
