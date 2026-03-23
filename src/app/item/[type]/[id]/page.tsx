"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStatusColour, getPriorityColour, withAlpha } from "@/lib/colours";

export default function ItemDetail() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;
  const [item, setItem] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchItem = useCallback(async () => {
    setLoading(true);
    let data = null;

    const tableMap: Record<string, string> = {
      brief: "briefs",
      task: "tasks",
      r17_brief: "r17_briefs",
      comms: "communications",
      log: "execution_log",
    };

    const table = tableMap[type];
    if (table) {
      const { data: result } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .single();
      data = result;
    }

    setItem(data);
    setLoading(false);
  }, [type, id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-xs">
        Loading {type} #{id}...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-xs">
        {type} #{id} not found
      </div>
    );
  }

  const status = (item.status as string) || "";
  const priority = (item.priority as string) || "";
  const statusCol = getStatusColour(status);
  const priorityCol = getPriorityColour(priority);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] uppercase text-text-muted font-bold tracking-wider">
              {type}
            </span>
            <span className="text-accent-yellow text-sm font-bold">#{id}</span>
            {status && (
              <span
                className="text-[10px] px-2 py-0.5 rounded font-medium"
                style={{ color: statusCol, backgroundColor: withAlpha(statusCol, 0.2) }}
              >
                {status}
              </span>
            )}
            {priority && (
              <span className="text-[10px] font-bold" style={{ color: priorityCol }}>
                {priority}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-text-primary">
            {(item.name as string) ||
              (item.title as string) ||
              (item.subject as string) ||
              (item.operation as string) ||
              `${type} #${id}`}
          </h1>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {Object.entries(item).map(([key, value]) => {
            if (key === "id") return null;
            const display =
              value === null || value === undefined
                ? "\u2014"
                : typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value);

            return (
              <div key={key} className="flex gap-4 text-xs">
                <span className="text-text-muted shrink-0 w-36 text-right">
                  {key}
                </span>
                {typeof value === "object" && value !== null ? (
                  <pre className="text-text-secondary flex-1 overflow-x-auto bg-bg-card rounded p-2 text-[10px]">
                    {display}
                  </pre>
                ) : (
                  <span className="text-text-primary flex-1 break-all">
                    {display}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
