"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Communication } from "@/lib/types";
import { getPlatformColour } from "@/lib/colours";

const PLATFORMS = ["all", "gmail", "slack", "monday", "whatsapp", "linkedin", "github"];

export default function CommsPage() {
  const [messages, setMessages] = useState<Communication[]>([]);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchComms = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("communications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (platformFilter !== "all") {
      query = query.eq("platform", platformFilter);
    }
    if (clientFilter) {
      query = query.eq("client_slug", clientFilter);
    }

    const { data } = await query;
    if (data) {
      setMessages(
        data.map((m: Record<string, unknown>) => ({
          id: (m.id as number) || 0,
          platform: (m.platform as string) || "unknown",
          sender: (m.sender as string) || (m.from as string) || "",
          subject: (m.subject as string) || "",
          preview: (m.preview as string) || (m.body as string) || "",
          thread_id: (m.thread_id as string) || null,
          client_slug: (m.client_slug as string) || null,
          is_read: (m.is_read as boolean) || false,
          is_actioned: (m.is_actioned as boolean) || false,
          created_at: (m.created_at as string) || "",
        }))
      );
    }

    setLoading(false);
  }, [platformFilter, clientFilter]);

  useEffect(() => {
    fetchComms();
  }, [fetchComms]);

  const unreadCount = messages.filter((m) => !m.is_read).length;
  const clientSlugs = [...new Set(messages.map((m) => m.client_slug).filter(Boolean))] as string[];

  function timeAgo(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-3">
        <span className="text-[10px] font-bold text-accent-yellow tracking-wider">
          COMMS
        </span>
        {unreadCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-blue/20 text-accent-blue font-bold">
            {unreadCount} UNREAD
          </span>
        )}

        <span className="text-text-muted text-[10px]">|</span>

        {/* Platform filter chips */}
        <div className="flex gap-1">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors uppercase ${
                platformFilter === p
                  ? "border-accent-yellow text-accent-yellow"
                  : "border-border text-text-muted hover:text-text-secondary hover:border-border-bright"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Client filter */}
        {clientSlugs.length > 0 && (
          <>
            <span className="text-text-muted text-[10px]">|</span>
            <div className="flex gap-1">
              {clientFilter && (
                <button
                  onClick={() => setClientFilter(null)}
                  className="text-[9px] text-accent-red px-1"
                >
                  CLEAR
                </button>
              )}
              {clientSlugs.slice(0, 5).map((slug) => (
                <button
                  key={slug}
                  onClick={() => setClientFilter(clientFilter === slug ? null : slug)}
                  className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                    clientFilter === slug
                      ? "border-accent-purple text-accent-purple"
                      : "border-border text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {slug}
                </button>
              ))}
            </div>
          </>
        )}

        <span className="text-[9px] text-text-muted ml-auto">
          {messages.length} messages
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-[10px] text-text-muted text-center py-4">Loading...</div>
        )}

        {!loading &&
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-center gap-2 px-3 py-1.5 border-b border-border hover:bg-bg-card-hover transition-colors ${
                msg.is_read ? "opacity-50" : ""
              }`}
            >
              {/* Unread dot */}
              <span className="w-2 shrink-0 flex justify-center">
                {!msg.is_read && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                )}
              </span>

              {/* Platform label */}
              <span
                className="text-[9px] uppercase font-bold shrink-0 w-14"
                style={{ color: getPlatformColour(msg.platform) }}
              >
                {msg.platform}
              </span>

              {/* Sender */}
              <span
                className={`text-[10px] shrink-0 w-28 truncate ${
                  msg.is_read ? "text-text-secondary" : "text-text-primary font-bold"
                }`}
              >
                {msg.sender}
              </span>

              {/* Subject + preview */}
              <div className="flex-1 flex items-baseline gap-2 min-w-0">
                <span
                  className={`text-[10px] truncate ${
                    msg.is_read ? "text-text-secondary" : "text-text-primary"
                  }`}
                >
                  {msg.subject}
                </span>
                <span className="text-[9px] text-text-muted truncate">
                  {msg.preview}
                </span>
              </div>

              {/* Client slug */}
              {msg.client_slug && (
                <span className="text-[9px] text-accent-purple shrink-0">
                  {msg.client_slug}
                </span>
              )}

              {/* Time */}
              <span className="text-[9px] text-text-muted shrink-0 w-8 text-right">
                {timeAgo(msg.created_at)}
              </span>
            </div>
          ))}

        {!loading && messages.length === 0 && (
          <div className="text-[10px] text-text-muted text-center py-8">
            No messages{platformFilter !== "all" ? ` on ${platformFilter}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
