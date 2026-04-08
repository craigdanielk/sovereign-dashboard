"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Communication } from "@/lib/types";
import LinearListRow from "@/components/LinearListRow";
import EmptyState from "@/components/EmptyState";

const PLATFORMS = ["all", "gmail", "slack", "monday", "whatsapp", "linkedin", "github"];

const PLATFORM_COLOURS: Record<string, string> = {
  gmail:    "#EF4444",
  slack:    "#7C3AED",
  monday:   "#F59E0B",
  whatsapp: "#10B981",
  linkedin: "#6366F1",
  github:   "#A0A0A0",
};

function getPlatformColour(platform: string): string {
  return PLATFORM_COLOURS[platform.toLowerCase()] ?? "#6B6B6B";
}

export default function CommsTab() {
  const [messages, setMessages] = useState<Communication[]>([]);
  const [platformFilter, setPlatformFilter] = useState("all");
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
      {/* Section header */}
      <div
        className="flex items-center justify-between flex-shrink-0 border-b"
        style={{ height: 48, padding: "0 16px", borderColor: "#2A2A2A" }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 15, fontWeight: 600, color: "#E5E5E5" }}>Comms</span>
          {unreadCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#6366F1",
                background: "#6366F118",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              {unreadCount} unread
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "#6B6B6B" }}>{messages.length} messages</span>
      </div>

      {/* Platform filter strip */}
      <div
        className="flex items-center gap-2 flex-shrink-0 border-b overflow-x-auto"
        style={{ padding: "8px 16px", borderColor: "#2A2A2A" }}
      >
        {PLATFORMS.map((p) => {
          const active = platformFilter === p;
          const colour = p === "all" ? "#7C3AED" : getPlatformColour(p);
          return (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              style={{
                fontSize: 11,
                padding: "2px 10px",
                borderRadius: 4,
                border: `1px solid ${active ? colour : "#2A2A2A"}`,
                color: active ? colour : "#6B6B6B",
                background: active ? `${colour}15` : "transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                textTransform: "capitalize",
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <EmptyState message="Loading messages…" />
        ) : messages.length === 0 ? (
          <EmptyState message={platformFilter !== "all" ? `No messages on ${platformFilter}` : "No messages"} />
        ) : (
          messages.map((msg) => (
            <LinearListRow
              key={msg.id}
              title={msg.subject || msg.sender || "(no subject)"}
              secondaryText={msg.sender || undefined}
              status={msg.is_actioned ? "ACTIONED" : msg.is_read ? "READ" : "UNREAD"}
              badge={msg.platform}
              badgeColor={getPlatformColour(msg.platform)}
              timestamp={msg.created_at}
            />
          ))
        )}
      </div>
    </div>
  );
}
