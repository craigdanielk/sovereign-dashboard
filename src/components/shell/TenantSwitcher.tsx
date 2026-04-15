"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant, TENANT_NAMES, NORTH_STAR_ID } from "@/lib/tenant-context";

interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  parent_tenant_id: string | null;
}

interface TreeNode {
  tenant: TenantRecord;
  children: TreeNode[];
}

function buildTree(tenants: TenantRecord[]): TreeNode[] {
  const map: Record<string, TreeNode> = {};
  for (const t of tenants) map[t.id] = { tenant: t, children: [] };

  const roots: TreeNode[] = [];
  for (const t of tenants) {
    const node = map[t.id];
    if (!t.parent_tenant_id) {
      roots.push(node);
    } else if (map[t.parent_tenant_id]) {
      map[t.parent_tenant_id].children.push(node);
    } else {
      roots.push(node); // orphan — show at root level
    }
  }

  const sort = (nodes: TreeNode[]) =>
    nodes.sort((a, b) => {
      // North Star always first
      if (a.tenant.id === NORTH_STAR_ID) return -1;
      if (b.tenant.id === NORTH_STAR_ID) return 1;
      return a.tenant.name.localeCompare(b.tenant.name);
    });

  const sortAll = (nodes: TreeNode[]): TreeNode[] =>
    sort(nodes).map((n) => ({ ...n, children: sortAll(n.children) }));

  return sortAll(roots);
}

function TenantItem({
  node,
  depth,
  activeTenant,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activeTenant: string;
  onSelect: (id: string) => void;
}) {
  const t = node.tenant;
  const isActive = activeTenant === t.id;
  const hasChildren = node.children.length > 0;
  const isAncestor = node.children.some(
    (c) =>
      c.tenant.id === activeTenant ||
      c.children.some((gc) => gc.tenant.id === activeTenant)
  );

  return (
    <>
      <button
        onClick={() => onSelect(t.id)}
        style={{
          width: "100%",
          padding: `6px ${12 + depth * 14}px 6px ${12 + depth * 14}px`,
          textAlign: "left",
          fontSize: 11,
          color: isActive ? "#7C3AED" : isAncestor ? "#A0A0A0" : "#666666",
          background: isActive ? "#7C3AED11" : "transparent",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {/* Tree connector */}
        {depth > 0 && (
          <span style={{ color: "#2A2A2A", fontSize: 9, flexShrink: 0 }}>
            {hasChildren ? "▸" : "└"}
          </span>
        )}

        <span
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: isActive ? 700 : 400,
            flex: 1,
          }}
        >
          {t.name.replace(" (internal)", "").replace(" (client work)", "")}
        </span>

        {isActive && (
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7C3AED", flexShrink: 0 }} />
        )}
      </button>

      {/* Children always visible — tree is always expanded */}
      {node.children.map((child) => (
        <TenantItem
          key={child.tenant.id}
          node={child}
          depth={depth + 1}
          activeTenant={activeTenant}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export default function TenantSwitcher() {
  const { activeTenant, tenantName, setActiveTenant } = useTenant();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchTenants() {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, parent_tenant_id")
        .order("name");

      if (!data) return;

      // Populate TENANT_NAMES cache
      for (const t of data) TENANT_NAMES[t.id] = t.name;

      setTree(buildTree(data as TenantRecord[]));
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
        <span style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {tenantName.replace(" (internal)", "").replace(" (client work)", "")}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ marginLeft: 4, transform: isOpen ? "rotate(180deg)" : "none" }}
        >
          <path d="M2 4L5 7L8 4" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 6,
            minWidth: 220,
            background: "#161616",
            border: "1px solid #2A2A2A",
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
            zIndex: 1000,
            padding: 4,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          {tree.map((node) => (
            <TenantItem
              key={node.tenant.id}
              node={node}
              depth={0}
              activeTenant={activeTenant}
              onSelect={switchTenant}
            />
          ))}
        </div>
      )}
    </div>
  );
}
