"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import CommsRow from "@/components/comms/CommsRow";
import type { Communication } from "@/lib/types";

const PLATFORMS = ["all", "gmail", "slack", "monday", "whatsapp", "linkedin", "github"];

export default function CommsInbox() {
  const [messages, setMessages] = useState<Communication[]>([]);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchComms = useCallback(async () => {
    setLoading(true);

    // Try v_inbox view first, fall back to communications table
    let query = supabase
      .from("communications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (platformFilter !== "all") {
      query = query.eq("platform", platformFilter);
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
  }, [platformFilter]);

  useEffect(() => {
    fetchComms();
  }, [fetchComms]);

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-bg-secondary">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-accent-yellow">CH</span>
            <h1 className="text-lg font-bold text-text-primary">Comms Hub</h1>
            {unreadCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue font-bold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <span className="text-xs text-text-muted">
            {messages.length} messages
          </span>
        </div>

        {/* Platform filter tabs */}
        <div className="flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`text-[10px] px-2 py-1 rounded transition-colors capitalize ${
                platformFilter === p
                  ? "bg-bg-card-hover text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-center text-text-muted py-8 text-xs">Loading...</div>
        )}

        {!loading && messages.length > 0 && (
          <div>
            {messages.map((msg) => (
              <CommsRow
                key={msg.id}
                id={msg.id}
                platform={msg.platform}
                sender={msg.sender}
                subject={msg.subject}
                preview={msg.preview}
                timestamp={msg.created_at}
                isRead={msg.is_read}
                threadId={msg.thread_id}
              />
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-text-muted py-8 text-xs">
            No messages{platformFilter !== "all" ? ` on ${platformFilter}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
