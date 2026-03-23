"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CommsRow from "@/components/comms/CommsRow";
import type { Communication } from "@/lib/types";
import { PLATFORM_COLOURS } from "@/lib/types";

export default function CommsFiltered() {
  const params = useParams();
  const filter = params.filter as string;
  const [messages, setMessages] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine if filter is a platform name or a client_slug
  const isPlatform = Object.keys(PLATFORM_COLOURS).includes(filter.toLowerCase());

  const fetchComms = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("communications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (isPlatform) {
      query = query.eq("platform", filter.toLowerCase());
    } else {
      query = query.eq("client_slug", filter);
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
  }, [filter, isPlatform]);

  useEffect(() => {
    fetchComms();
  }, [fetchComms]);

  const label = isPlatform
    ? filter.charAt(0).toUpperCase() + filter.slice(1)
    : filter.replace(/-/g, " ");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-accent-yellow">CH</span>
          <h1 className="text-lg font-bold text-text-primary capitalize">{label}</h1>
          <span className="text-[10px] text-text-muted uppercase">
            {isPlatform ? "platform" : "client"}
          </span>
          <span className="text-xs text-text-muted ml-auto">
            {messages.length} messages
          </span>
        </div>
      </div>

      {/* Messages */}
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
            No messages for {label}
          </div>
        )}
      </div>
    </div>
  );
}
