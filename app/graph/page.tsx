"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { NavBar } from "../components/NavBar";
import { GraphVisualization } from "./components/GraphVisualization";
import { NodeDetailPanel } from "./components/NodeDetailPanel";
import { GraphSidebar } from "./components/GraphSidebar";
import type { GraphNode, GraphEdge } from "./components/GraphVisualization";

/* ─── Header ─────────────────────────────────────────── */

function Header({
  lastRefresh,
  error,
  onRefresh,
}: {
  lastRefresh: string;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-50 animate-fade-in"
      style={{
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
        {/* Left: Brand + Breadcrumb */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-[7px] h-[7px] rounded-full dot-operational animate-soft-pulse" />
            <Link
              href="/"
              className="text-[15px] font-semibold tracking-tight"
              style={{ color: "var(--text-1)", fontFamily: "var(--font-display)" }}
            >
              Sovereign
            </Link>
          </div>

          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          <NavBar />
          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
          >
            Graph
          </span>
        </div>

        {/* Right: Status + Sync */}
        <div className="flex items-center gap-5">
          {error && (
            <span className="text-[11px] font-medium" style={{ color: "var(--red)" }}>
              {error}
            </span>
          )}

          <span
            className="text-[11px] hidden sm:inline"
            style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
          >
            {lastRefresh || "\u2014"}
          </span>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "var(--text-2)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.09)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7 }}>
              <path
                d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z"
                fill="currentColor"
              />
            </svg>
            Sync
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─── Loading State ──────────────────────────────────── */

function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.06)",
          borderTopColor: "var(--blue)",
          animation: "spin 1s linear infinite",
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-3)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em",
        }}
      >
        Loading graph data...
      </span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ─── Empty State ────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
      }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.2 }}>
        <circle cx="16" cy="24" r="6" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="36" cy="14" r="4" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="36" cy="34" r="4" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22" y1="22" x2="32" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <line x1="22" y1="26" x2="32" y2="33" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      </svg>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-3)",
          fontFamily: "var(--font-display)",
        }}
      >
        No graph data available
      </span>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-4)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Check that /api/graph is returning data
      </span>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  /* Responsive: hide sidebar on small screens by default */
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setSidebarVisible(mql.matches);
    const handler = (e: MediaQueryListEvent) => setSidebarVisible(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const fetchGraph = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/graph");
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setNodes([]);
        setEdges([]);
      } else {
        setNodes(data.nodes ?? []);
        setEdges(data.edges ?? []);
      }

      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await fetchGraph();
    };
    run();
    const interval = setInterval(run, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchGraph]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  /* Navigate to a node by ID (from detail panel clickable dependencies) */
  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (target) {
        setSelectedNode(target);
      }
    },
    [nodes],
  );

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((v) => !v);
  }, []);

  return (
    <div className="relative min-h-screen" style={{ zIndex: 1 }}>
      <Header lastRefresh={lastRefresh} error={error} onRefresh={fetchGraph} />

      {/* Sidebar */}
      {!loading && nodes.length > 0 && (
        <GraphSidebar
          nodes={nodes}
          selectedNodeId={selectedNode?.id ?? null}
          onNodeSelect={handleNodeClick}
          visible={sidebarVisible}
          onToggle={toggleSidebar}
        />
      )}

      {/* Graph fills remaining viewport, offset by sidebar when visible */}
      <div
        style={{
          position: "fixed",
          top: 56,
          left: sidebarVisible && !loading && nodes.length > 0 ? 280 : 0,
          right: 0,
          bottom: 0,
          transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {loading ? (
          <LoadingState />
        ) : nodes.length === 0 ? (
          <EmptyState />
        ) : (
          <GraphVisualization
            nodes={nodes}
            edges={edges}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNode?.id ?? null}
          />
        )}
      </div>

      {/* Detail panel */}
      <NodeDetailPanel
        node={selectedNode}
        edges={edges}
        onClose={handleClosePanel}
        onNavigateToNode={handleNavigateToNode}
      />
    </div>
  );
}
