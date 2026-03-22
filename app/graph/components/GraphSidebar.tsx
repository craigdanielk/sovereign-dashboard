"use client";

import { useState, useMemo } from "react";
import type { GraphNode } from "./GraphVisualization";

/* ─── Helpers ────────────────────────────────────────── */

function statusDotClass(status?: string): string {
  switch (status) {
    case "operational":
      return "dot-operational";
    case "beta":
      return "dot-beta";
    case "pending":
      return "dot-pending";
    case "offline":
      return "dot-offline";
    default:
      return "";
  }
}

function statusDotColor(status?: string): string {
  switch (status) {
    case "operational":
      return "#30d158";
    case "beta":
      return "#ff9f0a";
    case "pending":
      return "rgba(142,142,147,0.6)";
    case "offline":
      return "#ff453a";
    default:
      return "rgba(255,255,255,0.2)";
  }
}

/* ─── Types ──────────────────────────────────────────── */

interface Props {
  nodes: GraphNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GraphNode) => void;
  visible: boolean;
  onToggle: () => void;
}

/* ─── Section Component ──────────────────────────────── */

function SidebarSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          borderRadius: 8,
          transition: "background 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "none";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            style={{
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          >
            <path d="M3 1l4 4-4 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(245,245,247,0.5)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {title}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "rgba(245,245,247,0.3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {count}
        </span>
      </button>
      {open && <div style={{ paddingLeft: 4, paddingRight: 4 }}>{children}</div>}
    </div>
  );
}

/* ─── Node Item ──────────────────────────────────────── */

function NodeItem({
  node,
  selected,
  onClick,
}: {
  node: GraphNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: selected ? "rgba(255,255,255,0.06)" : "none",
        border: selected ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        borderRadius: 8,
        cursor: "pointer",
        transition: "all 0.15s ease",
        marginBottom: 1,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = "none";
        }
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: statusDotColor(node.status),
          flexShrink: 0,
          boxShadow: node.status === "operational" ? "0 0 6px rgba(48,209,88,0.4)" : undefined,
        }}
        className={statusDotClass(node.status)}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: selected ? 500 : 400,
          color: selected ? "var(--text-1)" : "var(--text-2)",
          fontFamily: "var(--font-mono)",
          textAlign: "left",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {node.label}
      </span>
    </button>
  );
}

/* ─── Main Sidebar ───────────────────────────────────── */

export function GraphSidebar({ nodes, selectedNodeId, onNodeSelect, visible, onToggle }: Props) {
  const [filter, setFilter] = useState("");

  const lowerFilter = filter.toLowerCase();

  const filtered = useMemo(
    () => nodes.filter((n) => n.label.toLowerCase().includes(lowerFilter) || n.id.toLowerCase().includes(lowerFilter)),
    [nodes, lowerFilter],
  );

  const directors = useMemo(
    () => filtered.filter((n) => n.type === "agent" && (n.classification === "orchestrator" || (n.connectionCount ?? 0) >= 6)),
    [filtered],
  );

  const workers = useMemo(
    () => filtered.filter((n) => n.type === "agent" && n.classification !== "orchestrator" && (n.connectionCount ?? 0) < 6),
    [filtered],
  );

  const skills = useMemo(() => filtered.filter((n) => n.type === "skill"), [filtered]);

  const tools = useMemo(() => filtered.filter((n) => n.type === "tool"), [filtered]);

  return (
    <>
      {/* Toggle button (visible when sidebar hidden on mobile) */}
      {!visible && (
        <button
          onClick={onToggle}
          style={{
            position: "fixed",
            top: 68,
            left: 12,
            zIndex: 80,
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(28,28,30,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-2)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Sidebar */}
      <div
        style={{
          position: "fixed",
          top: 56,
          left: 0,
          bottom: 0,
          width: 280,
          zIndex: 70,
          background: "rgba(18,18,20,0.92)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          overflowY: "auto",
          transform: visible ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header with close button on mobile */}
        <div
          style={{
            padding: "12px 12px 8px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* Search/Filter */}
          <div
            style={{
              flex: 1,
              position: "relative",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.4,
              }}
            >
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10.5" y1="10.5" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter nodes..."
              style={{
                width: "100%",
                height: 32,
                paddingLeft: 30,
                paddingRight: 10,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--text-1)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              }}
            />
          </div>

          {/* Close sidebar (mobile toggle) */}
          <button
            onClick={onToggle}
            className="lg:hidden"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "var(--text-3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 12px 4px" }} />

        {/* Sections */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 4px" }}>
          {directors.length > 0 && (
            <SidebarSection title="Node Directors" count={directors.length}>
              {directors.map((n) => (
                <NodeItem
                  key={n.id}
                  node={n}
                  selected={n.id === selectedNodeId}
                  onClick={() => onNodeSelect(n)}
                />
              ))}
            </SidebarSection>
          )}

          {workers.length > 0 && (
            <SidebarSection title="Worker Agents" count={workers.length}>
              {workers.map((n) => (
                <NodeItem
                  key={n.id}
                  node={n}
                  selected={n.id === selectedNodeId}
                  onClick={() => onNodeSelect(n)}
                />
              ))}
            </SidebarSection>
          )}

          {skills.length > 0 && (
            <SidebarSection title="Skills" count={skills.length} defaultOpen={false}>
              {skills.map((n) => (
                <NodeItem
                  key={n.id}
                  node={n}
                  selected={n.id === selectedNodeId}
                  onClick={() => onNodeSelect(n)}
                />
              ))}
            </SidebarSection>
          )}

          {tools.length > 0 && (
            <SidebarSection title="Tools & Services" count={tools.length} defaultOpen={false}>
              {tools.map((n) => (
                <NodeItem
                  key={n.id}
                  node={n}
                  selected={n.id === selectedNodeId}
                  onClick={() => onNodeSelect(n)}
                />
              ))}
            </SidebarSection>
          )}

          {filtered.length === 0 && (
            <div
              style={{
                padding: "24px 12px",
                textAlign: "center",
                fontSize: 11,
                color: "var(--text-4)",
                fontFamily: "var(--font-mono)",
              }}
            >
              No matching nodes
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            fontSize: 10,
            color: "var(--text-4)",
            fontFamily: "var(--font-mono)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{nodes.length} nodes</span>
          <span>{filter ? `${filtered.length} shown` : "all"}</span>
        </div>
      </div>
    </>
  );
}
