"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

// The canonical UUID for NORTH-STAR
export const NORTH_STAR_ID = "00000000-0000-0000-0000-000000000001";

// UUID → friendly name map — populated at runtime from tenants table
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

  // Load from localStorage on mount — validate it's a real UUID, not a stale slug
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("ns_active_tenant");
    if (saved && isValidTenantId(saved)) {
      setActiveTenantState(saved);
    } else if (saved) {
      // Stale slug — clear it and fall back to North Star
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
