"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

// UUID → friendly name map
export const TENANT_NAMES: Record<string, string> = {
  "00000000-0000-0000-0000-000000000001": "NORTH-STAR",
};

export function resolveTenantName(id: string): string {
  return TENANT_NAMES[id] ?? id;
}

// The canonical UUID for NORTH-STAR
export const NORTH_STAR_ID = "00000000-0000-0000-0000-000000000001";

interface TenantContextValue {
  activeTenant: string;       // UUID or slug
  tenantName: string;         // friendly display name
  setActiveTenant: (id: string) => void;
}

const TenantContext = createContext<TenantContextValue>({
  activeTenant: NORTH_STAR_ID,
  tenantName: "NORTH-STAR",
  setActiveTenant: () => {},
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [activeTenant, setActiveTenantState] = useState<string>(NORTH_STAR_ID);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("ns_active_tenant");
    if (saved) setActiveTenantState(saved);
  }, []);

  const setActiveTenant = useCallback((id: string) => {
    setActiveTenantState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("ns_active_tenant", id);
      window.dispatchEvent(new CustomEvent("tenant-change", { detail: id }));
    }
  }, []);

  const tenantName = resolveTenantName(activeTenant);

  return (
    <TenantContext.Provider value={{ activeTenant, tenantName, setActiveTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
