"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function TenantSwitcher() {
  const [tenants, setTenants] = useState<string[]>([]);

  useEffect(() => {
    async function fetchTenants() {
      const [
        { data: briefsData },
        { data: intakesData }
      ] = await Promise.all([
        supabase.from("briefs").select("tenant_slug"),
        supabase.from("phase0_intakes").select("tenant_slug")
      ]);
      
      const slugs = [
        ...(briefsData || []).map(b => b.tenant_slug),
        ...(intakesData || []).map(i => i.tenant_slug)
      ].filter(Boolean);

      const unique = Array.from(new Set(slugs));
      const defaults = ["NORTH-STAR", "CHAMPION-GRIP", "R17-VENTURES"];
      const combined = Array.from(new Set([...defaults, ...unique]));
      setTenants(combined);
    }
    fetchTenants();
  }, []);
  const [activeTenant, setActiveTenant] = useState("north-star");
  const [isOpen, setIsOpen] = useState(false);

  // Sync with localStorage so the session persists
  useEffect(() => {
    const saved = localStorage.getItem("ns_active_tenant");
    if (saved) {
      setActiveTenant(saved);
      window.dispatchEvent(new CustomEvent("tenant-change", { detail: saved }));
    }
  }, []);

  const switchTenant = (slug: string) => {
    setActiveTenant(slug);
    localStorage.setItem("ns_active_tenant", slug);
    setIsOpen(false);
    // Notify the rest of the dashboard
    window.dispatchEvent(new CustomEvent("tenant-change", { detail: slug }));
  };

  const addTenant = () => {
    const slug = prompt("Enter new Tenant Slug (e.g. project-x):");
    if (slug && !tenants.includes(slug)) {
      setTenants(prev => [...prev, slug]);
      switchTenant(slug);
    }
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
          transition: "border-color 0.2s"
        }}
      >
        <span style={{ color: "#7C3AED", fontWeight: 700 }}>T:</span>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{activeTenant}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4, transform: isOpen ? "rotate(180deg)" : "none" }}>
          <path d="M2 4L5 7L8 4" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          marginTop: 6,
          width: 180,
          background: "#161616",
          border: "1px solid #2A2A2A",
          borderRadius: 8,
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
          zIndex: 1000,
          padding: 4
        }}>
          {tenants.map(t => (
            <button
              key={t}
              onClick={() => switchTenant(t)}
              style={{
                width: "100%",
                padding: "8px 12px",
                textAlign: "left",
                fontSize: 12,
                color: activeTenant === t ? "#7C3AED" : "#A0A0A0",
                background: activeTenant === t ? "#7C3AED11" : "transparent",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                textTransform: "uppercase",
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              {t}
              {activeTenant === t && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7C3AED", alignSelf: "center" }} />}
            </button>
          ))}
          <div style={{ height: 1, background: "#2A2A2A", margin: "4px 0" }} />
          <button
            onClick={addTenant}
            style={{
              width: "100%",
              padding: "8px 12px",
              textAlign: "left",
              fontSize: 11,
              color: "#10B981",
              background: "transparent",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            + New Tenant
          </button>
        </div>
      )}
    </div>
  );
}
