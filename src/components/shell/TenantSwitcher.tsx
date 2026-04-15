"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant, TENANT_NAMES, NORTH_STAR_ID } from "@/lib/tenant-context";

export default function TenantSwitcher() {
  const { activeTenant, tenantName, setActiveTenant } = useTenant();
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchTenants() {
      // Query tenants table directly — source of truth for all tenants
      const { data } = await supabase
        .from("tenants")
        .select("id, name, is_sub_tenant")
        .order("name");

      if (!data) return;

      // Populate TENANT_NAMES cache for resolveTenantName()
      for (const t of data) {
        TENANT_NAMES[t.id] = t.name;
      }

      // Show top-level tenants only (sub-tenants accessible via parent context)
      const topLevel = data.filter((t) => !t.is_sub_tenant);

      // Ensure North Star is always first
      const sorted = [
        ...topLevel.filter((t) => t.id === NORTH_STAR_ID),
        ...topLevel.filter((t) => t.id !== NORTH_STAR_ID),
      ];

      setTenants(sorted.map((t) => ({ id: t.id, name: t.name })));
    }
    fetchTenants();
  }, []);

  const switchTenant = (id: string) => {
    setActiveTenant(id);
    setIsOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#1E1E1E",
          border: "1px solid #2A2A2A",
          borderRadius: 6,
          padding: "4px 10px",
          color: "#E5E5E5",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <span style={{ color: "#7C3AED", fontWeight: 700 }}>T:</span>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{tenantName}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4, transform: isOpen ? "rotate(180deg)" : "none" }}>
          <path d="M2 4L5 7L8 4" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: 6,
          minWidth: 180,
          background: "#161616",
          border: "1px solid #2A2A2A",
          borderRadius: 8,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
          zIndex: 1000,
          padding: 4,
        }}>
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTenant(t.id)}
              style={{
                width: "100%",
                padding: "8px 12px",
                textAlign: "left",
                fontSize: 12,
                color: activeTenant === t.id ? "#7C3AED" : "#A0A0A0",
                background: activeTenant === t.id ? "#7C3AED11" : "transparent",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                textTransform: "uppercase",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {t.name}
              {activeTenant === t.id && (
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7C3AED" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
