"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export const NORTH_STAR_ID = "00000000-0000-0000-0000-000000000001";

export const TENANT_NAMES: Record<string, string> = {
  [NORTH_STAR_ID]: "NORTH-STAR",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTenantId(id: string): boolean {
  return UUID_RE.test(id);
}

export function resolveTenantName(id: string): string {
  return TENANT_NAMES[id] ?? "NORTH-STAR";
}

interface TenantNode {
  id: string;
  parent_tenant_id: string | null;
}

// Returns the given tenant ID + all descendant IDs (recursive)
function getDescendants(id: string, byParent: Record<string, string[]>): string[] {
  const children = byParent[id] ?? [];
  return [id, ...children.flatMap((c) => getDescendants(c, byParent))];
}

interface TenantContextValue {
  activeTenant: string;
  tenantName: string;
  setActiveTenant: (id: string) => void;
  /** Active tenant + all its descendants — use for task/data queries */
  activeTenantIds: string[];
}

const TenantContext = createContext<TenantContextValue>({
  activeTenant: NORTH_STAR_ID,
  tenantName: "NORTH-STAR",
  setActiveTenant: () => {},
  activeTenantIds: [NORTH_STAR_ID],
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [activeTenant, setActiveTenantState] = useState<string>(NORTH_STAR_ID);
  const [allTenants, setAllTenants] = useState<TenantNode[]>([]);

  // Load tenant tree once on mount
  useEffect(() => {
    supabase
      .from("tenants")
      .select("id, name, parent_tenant_id")
      .then(({ data }) => {
        if (!data) return;
        for (const t of data) {
          TENANT_NAMES[(t as { id: string; name: string }).id] =
            (t as { id: string; name: string }).name;
        }
        setAllTenants(data as TenantNode[]);
      });
  }, []);

  // Restore from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("ns_active_tenant");
    if (saved && isValidTenantId(saved)) {
      setActiveTenantState(saved);
    } else if (saved) {
      localStorage.removeItem("ns_active_tenant");
    }
  }, []);

  const setActiveTenant = useCallback((id: string) => {
    setActiveTenantState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("ns_active_tenant", id);
      window.dispatchEvent(new CustomEvent("tenant-change", { detail: id }));
    }
  }, []);

  // Build parent→children map, then compute the subtree for activeTenant
  const activeTenantIds = useMemo<string[]>(() => {
    if (allTenants.length === 0) return [activeTenant];

    const byParent: Record<string, string[]> = {};
    for (const t of allTenants) {
      if (t.parent_tenant_id) {
        byParent[t.parent_tenant_id] = byParent[t.parent_tenant_id] ?? [];
        byParent[t.parent_tenant_id].push(t.id);
      }
    }

    return getDescendants(activeTenant, byParent);
  }, [activeTenant, allTenants]);

  const tenantName = resolveTenantName(activeTenant);

  return (
    <TenantContext.Provider value={{ activeTenant, tenantName, setActiveTenant, activeTenantIds }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
