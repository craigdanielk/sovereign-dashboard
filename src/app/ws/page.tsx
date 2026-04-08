"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import TenantWorkspacePanel from "@/components/TenantWorkspacePanel";

interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
}

interface TenantRow {
  id: string;
  slug: string;
}

const EXCLUDE_SLUGS = ["north-star", "r17", "comms"];

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [tenantMap, setTenantMap] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // Fetch client workspaces
    const { data: wsData } = await supabase
      .from("workspaces")
      .select("id, slug, name")
      .order("name");

    const filtered = (wsData || []).filter(
      (w: WorkspaceRow) => !EXCLUDE_SLUGS.includes(w.slug)
    );

    // Fetch tenants to map slug → tenant UUID
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("id, slug");

    const map: Record<string, string> = {};
    for (const t of (tenantData || []) as TenantRow[]) {
      if (t.slug) map[t.slug] = t.id;
    }

    setWorkspaces(filtered);
    setTenantMap(map);

    // Default to champion-grip if available, else first workspace
    const defaultWs = filtered.find((w: WorkspaceRow) => w.slug === "champion-grip") || filtered[0];
    if (defaultWs) setSelected(defaultWs.slug);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tenantId = selected ? tenantMap[selected] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-[10px] text-text-muted animate-pulse">LOADING WORKSPACES…</span>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-[10px] text-text-muted">No workspaces configured</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Workspace selector */}
      <div className="shrink-0 px-4 py-2 border-b border-border bg-bg-secondary flex items-center gap-3">
        <span className="text-[9px] text-text-muted font-bold tracking-wider">WORKSPACE</span>
        <select
          value={selected || ""}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-transparent border border-border rounded px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:border-[#00ff41] transition-colors"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
        >
          {workspaces.map((ws) => (
            <option key={ws.slug} value={ws.slug} style={{ backgroundColor: "#0a0a0a" }}>
              {ws.name}
            </option>
          ))}
        </select>
      </div>

      {/* Panel */}
      <div className="flex-1 overflow-hidden">
        {tenantId ? (
          <TenantWorkspacePanel key={tenantId} tenantId={tenantId} />
        ) : (
          <div className="flex items-center justify-center h-40">
            <span className="text-[10px] text-accent-yellow">
              No tenant found for workspace &quot;{selected}&quot;
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
