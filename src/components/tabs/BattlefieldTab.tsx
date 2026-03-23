"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { withAlpha } from "@/lib/colours";
import EventStream from "@/components/EventStream";

/* ── Types ────────────────────────────────────────────────────── */

interface RagNode {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  status: string;
  related_projects?: string[];
}

interface RagEdge {
  source: string;
  target: string;
  type: string;
}

interface EntityDetail {
  entity: {
    name: string;
    type: string;
    description: string;
    related_projects: string[];
    last_updated: string | null;
    status: string;
  };
  relationships: Array<{
    target: string;
    type: string;
    direction: string;
  }>;
}

/* ── Colour helpers ───────────────────────────────────────────── */

function nodeColour(entityType: string): string {
  switch (entityType) {
    case "agent":
      return "#00ff41";
    case "service":
      return "#00b4d8";
    case "tool":
      return "#ffd60a";
    case "workflow":
      return "#a855f7";
    case "gap":
      return "#ff0040";
    default:
      return "#737373";
  }
}

function statusDot(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "operational" || s === "active" || s === "ready") return "#00ff41";
  if (s === "beta" || s === "partial" || s === "degraded") return "#ffb800";
  return "#ff0040";
}

function typeBadgeColour(type: string): string {
  return nodeColour(type);
}

/* ── Graph data interfaces ────────────────────────────────────── */

interface GraphNodeObj {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  status: string;
  related_projects?: string[];
  colour: string;
  val: number;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLinkObj {
  source: string | GraphNodeObj;
  target: string | GraphNodeObj;
  type: string;
}

interface GraphData {
  nodes: GraphNodeObj[];
  links: GraphLinkObj[];
}

/* ── Globe props interface ────────────────────────────────────── */

interface GlobeProps {
  graphData: GraphData;
  onNodeClick: (node: GraphNodeObj) => void;
  highlightNodes: Set<string>;
  selectedId: string | null;
}

/* ── 3D Globe wrapper (dynamic, SSR disabled) ─────────────────── */

const ForceGraph3DComponent = dynamic<GlobeProps>(
  () => import("3d-force-graph").then((mod) => {
    const ForceGraph3DConstructor = mod.default;

    function Globe({ graphData, onNodeClick, highlightNodes, selectedId }: GlobeProps) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graphRef = useRef<any>(null);
      const mountRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        // Create graph instance using 'new'
        const graph = new ForceGraph3DConstructor(container);
        graphRef.current = graph;

        // Configure
        graph
          .backgroundColor("#0a0a0a")
          .showNavInfo(false)
          .nodeColor((node: object) => {
            const n = node as GraphNodeObj;
            return n.colour || "#737373";
          })
          .nodeVal((node: object) => (node as GraphNodeObj).val || 2)
          .nodeLabel((node: object) => {
            const n = node as GraphNodeObj;
            return `${n.name} (${n.entity_type})`;
          })
          .nodeOpacity(0.9)
          .linkColor(() => "rgba(0,255,65,0.15)")
          .linkWidth(1)
          .linkDirectionalArrowLength(3)
          .linkDirectionalArrowRelPos(1)
          .linkOpacity(0.4)
          .onNodeClick((node: object) => {
            const n = node as GraphNodeObj;
            onNodeClick(n);
            // Zoom camera toward clicked node
            const distance = 200;
            const distRatio = 1 + distance / Math.hypot(n.x || 0, n.y || 0, n.z || 0);
            graph.cameraPosition(
              {
                x: (n.x || 0) * distRatio,
                y: (n.y || 0) * distRatio,
                z: (n.z || 0) * distRatio,
              },
              { x: n.x || 0, y: n.y || 0, z: n.z || 0 },
              1000
            );
          })
          .graphData(graphData);

        // Handle resize
        function handleResize() {
          if (container && graph) {
            graph.width(container.clientWidth);
            graph.height(container.clientHeight);
          }
        }

        const observer = new ResizeObserver(handleResize);
        observer.observe(container);
        handleResize();

        return () => {
          observer.disconnect();
          if (graph && typeof graph._destructor === "function") {
            graph._destructor();
          } else {
            // Fallback: remove canvas elements
            const canvases = container.querySelectorAll("canvas");
            canvases.forEach((c: HTMLCanvasElement) => c.remove());
          }
          graphRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      // Update data when graphData changes (but not on mount)
      const isFirstRender = useRef(true);
      useEffect(() => {
        if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
        }
        if (graphRef.current) {
          graphRef.current.graphData(graphData);
        }
      }, [graphData]);

      // Update highlight state
      useEffect(() => {
        if (graphRef.current) {
          graphRef.current.nodeColor((node: object) => {
            const n = node as GraphNodeObj;
            if (highlightNodes.size === 0) return n.colour || "#737373";
            return highlightNodes.has(n.id) ? (n.colour || "#737373") : withAlpha(n.colour || "#737373", 0.15);
          });
        }
      }, [highlightNodes]);

      // Zoom to selected node when selectedId changes from registry click
      useEffect(() => {
        if (!selectedId || !graphRef.current) return;
        const graph = graphRef.current;
        const data = graph.graphData();
        const node = (data.nodes as GraphNodeObj[]).find((n: GraphNodeObj) => n.id === selectedId);
        if (!node) return;
        const distance = 200;
        const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
        graph.cameraPosition(
          {
            x: (node.x || 0) * distRatio,
            y: (node.y || 0) * distRatio,
            z: (node.z || 0) * distRatio,
          },
          { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
          1000
        );
      }, [selectedId]);

      return (
        <div
          ref={mountRef}
          style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
        />
      );
    }

    return Globe;
  }),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <span
          className="text-[10px] text-[#00ff41] animate-pulse"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Initializing 3D globe...
        </span>
      </div>
    ),
  }
);

/* ── Registry Section (collapsible) ──────────────────────────── */

function RegistrySection({
  title,
  colour,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  colour: string;
  items: RagNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-2 py-1 hover:bg-[#1a1a1a] rounded transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[9px]" style={{ color: colour }}>
            {collapsed ? "+" : "-"}
          </span>
          <span
            className="text-[9px] font-bold tracking-wider"
            style={{ color: colour, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {title}
          </span>
        </div>
        <span
          className="text-[9px]"
          style={{ color: withAlpha(colour, 0.5), fontFamily: "'JetBrains Mono', monospace" }}
        >
          {items.length}
        </span>
      </button>
      {!collapsed && (
        <div className="pl-2 space-y-0">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full text-left flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] transition-colors ${
                selectedId === item.id ? "bg-[#1a2a1a]" : "hover:bg-[#1a1a1a]"
              }`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ background: statusDot(item.status) }}
              />
              <span
                className="truncate"
                style={{
                  color: selectedId === item.id ? colour : "#d4d4d4",
                }}
              >
                {item.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Detail Card (slide-up from bottom) ──────────────────────── */

function DetailCard({
  node,
  detail,
  loading,
  edges,
  nodes,
  onClose,
  onNavigate,
}: {
  node: RagNode | null;
  detail: EntityDetail | null;
  loading: boolean;
  edges: RagEdge[];
  nodes: RagNode[];
  onClose: () => void;
  onNavigate: (name: string) => void;
}) {
  if (!node && !loading) return null;

  const relationships = detail?.relationships || [];
  const relatedWorkflows = edges
    .filter(
      (e) =>
        (e.source === node?.id || e.target === node?.id) &&
        nodes.find(
          (n) =>
            n.id === (e.source === node?.id ? e.target : e.source) &&
            n.entity_type === "workflow"
        )
    )
    .map((e) => (e.source === node?.id ? e.target : e.source));

  const capabilities = detail?.entity?.description
    ? detail.entity.description
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length < 50)
        .slice(0, 8)
    : [];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 flex flex-col transition-all duration-300"
      style={{
        height: "40%",
        background: "rgba(10,10,10,0.95)",
        borderTop: "1px solid rgba(0,255,65,0.3)",
        backdropFilter: "blur(8px)",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* ROW 1: Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[#00ff41]/20">
        {node && (
          <>
            <span
              className="text-sm font-bold"
              style={{ color: nodeColour(node.entity_type) }}
            >
              {node.name}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{
                background: withAlpha(typeBadgeColour(node.entity_type), 0.15),
                color: typeBadgeColour(node.entity_type),
              }}
            >
              {node.entity_type.toUpperCase()}
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: statusDot(node.status) }}
            />
          </>
        )}
        <button
          onClick={onClose}
          className="ml-auto text-[#737373] hover:text-[#00ff41] text-sm"
        >
          [X]
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {loading && (
          <div className="text-[10px] text-[#737373] animate-pulse">
            Loading entity data...
          </div>
        )}

        {/* ROW 2: Description */}
        {(node?.description || detail?.entity?.description) && (
          <div className="text-[11px] text-[#88cc88] leading-relaxed">
            {detail?.entity?.description || node?.description}
          </div>
        )}

        {/* ROW 3: Stats bar */}
        <div className="flex gap-4 text-[9px]">
          {detail && (
            <>
              <span className="text-[#737373]">
                RELATIONS: <span className="text-[#00ff41]">{relationships.length}</span>
              </span>
              <span className="text-[#737373]">
                WORKFLOWS: <span className="text-[#a855f7]">{relatedWorkflows.length}</span>
              </span>
              {detail.entity.last_updated && (
                <span className="text-[#737373]">
                  UPDATED:{" "}
                  <span className="text-[#d4d4d4]">
                    {new Date(detail.entity.last_updated).toLocaleDateString("en-GB")}
                  </span>
                </span>
              )}
            </>
          )}
        </div>

        {/* ROW 4: Two columns */}
        <div className="grid grid-cols-2 gap-4">
          {/* Relationships */}
          {relationships.length > 0 && (
            <div>
              <div className="text-[9px] text-[#737373] tracking-wider mb-1">
                RELATIONSHIPS ({relationships.length})
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {relationships.map((r, i) => (
                  <button
                    key={`${r.target}-${r.type}-${i}`}
                    onClick={() => onNavigate(r.target)}
                    className="w-full text-left flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-[#1a1a1a] transition-colors text-[10px]"
                  >
                    <span className="text-[#00ff41]">
                      {r.direction === "outgoing" ? "->" : "<-"}
                    </span>
                    <span className="text-[#00b4d8] truncate flex-1">{r.target}</span>
                    <span className="text-[#404040]">{r.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Workflows */}
          {relatedWorkflows.length > 0 && (
            <div>
              <div className="text-[9px] text-[#737373] tracking-wider mb-1">
                WORKFLOWS ({relatedWorkflows.length})
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {relatedWorkflows.map((w) => (
                  <button
                    key={w}
                    onClick={() => onNavigate(w)}
                    className="w-full text-left flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-[#1a1a1a] transition-colors text-[10px] text-[#a855f7]"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ROW 5: Capabilities as tag pills */}
        {capabilities.length > 0 && (
          <div>
            <div className="text-[9px] text-[#737373] tracking-wider mb-1">CAPABILITIES</div>
            <div className="flex flex-wrap gap-1">
              {capabilities.map((cap, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    background: "rgba(0,255,65,0.08)",
                    color: "#88cc88",
                    border: "1px solid rgba(0,255,65,0.15)",
                  }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related projects */}
        {detail?.entity?.related_projects && detail.entity.related_projects.length > 0 && (
          <div>
            <div className="text-[9px] text-[#737373] tracking-wider mb-1">PROJECTS</div>
            <div className="flex flex-wrap gap-1">
              {detail.entity.related_projects.map((p) => (
                <span
                  key={p}
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(0,255,65,0.1)", color: "#00ff41" }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function BattlefieldTab() {
  const [nodes, setNodes] = useState<RagNode[]>([]);
  const [edges, setEdges] = useState<RagEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterText, setFilterText] = useState("");

  // Fetch graph data from API route
  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const rawNodes: RagNode[] = data.nodes || [];
      const rawEdges: RagEdge[] = data.edges || data.links || [];

      setNodes(rawNodes);
      setEdges(rawEdges);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch graph:", err);
      setError(String(err));
      setLoading(false);
    }
  }, []);

  // Fetch detail for selected node
  const fetchDetail = useCallback(async (name: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/graph/detail/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EntityDetail = await res.json();
      setDetail(data);
    } catch (err) {
      console.error("Failed to fetch detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Handle node click (from globe or registry)
  const handleNodeClick = useCallback(
    (nodeOrId: GraphNodeObj | string) => {
      const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
      setSelectedId(id);
      fetchDetail(id);
    },
    [fetchDetail]
  );

  // Handle navigating to a related node from the detail card
  const handleNavigate = useCallback(
    (name: string) => {
      setSelectedId(name);
      fetchDetail(name);
    },
    [fetchDetail]
  );

  // Initial fetch + polling
  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 60000);
    return () => clearInterval(interval);
  }, [fetchGraph]);

  // Compute edge counts per node
  const edgeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of edges) {
      counts.set(e.source, (counts.get(e.source) || 0) + 1);
      counts.set(e.target, (counts.get(e.target) || 0) + 1);
    }
    return counts;
  }, [edges]);

  // Build graph data for 3d-force-graph
  const graphData: GraphData = useMemo(() => {
    const graphNodes: GraphNodeObj[] = nodes.map((n) => ({
      ...n,
      colour: nodeColour(n.entity_type),
      val: Math.max(2, (edgeCounts.get(n.id) || 0) + 1),
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const graphLinks: GraphLinkObj[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ ...e }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, edges, edgeCounts]);

  // Highlight set for selected node
  const highlightNodes = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const e of edges) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [selectedId, edges]);

  // Group nodes by type for registry
  const groupedNodes = useMemo(() => {
    const filter = filterText.toLowerCase();
    const filtered = filter
      ? nodes.filter(
          (n) =>
            n.name.toLowerCase().includes(filter) ||
            n.entity_type.toLowerCase().includes(filter)
        )
      : nodes;

    return {
      agents: filtered.filter((n) => n.entity_type === "agent"),
      services: filtered.filter((n) => n.entity_type === "service"),
      tools: filtered.filter((n) => n.entity_type === "tool"),
      workflows: filtered.filter((n) => n.entity_type === "workflow"),
      gaps: filtered.filter((n) => n.entity_type === "gap"),
      other: filtered.filter(
        (n) => !["agent", "service", "tool", "workflow", "gap"].includes(n.entity_type)
      ),
    };
  }, [nodes, filterText]);

  // Counts for metrics bar
  const agentCount = nodes.filter((n) => n.entity_type === "agent").length;
  const serviceCount = nodes.filter((n) => n.entity_type === "service").length;
  const edgeCount = edges.length;

  const selectedNode = nodes.find((n) => n.id === selectedId) || null;

  return (
    <div className="h-full flex overflow-hidden">
      {/* LEFT PANE: System Registry */}
      <div
        className="w-[250px] shrink-0 flex flex-col h-full overflow-hidden"
        style={{
          background: "#0d0d0d",
          borderRight: "1px solid rgba(0,255,65,0.2)",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {/* Header */}
        <div className="shrink-0 px-2 py-1.5 border-b border-[#00ff41]/20">
          <div className="text-[10px] font-bold text-[#00ff41] tracking-wider mb-1.5">
            SYSTEM REGISTRY
          </div>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter..."
            className="w-full bg-[#1a1a1a] border border-[#00ff41]/20 rounded px-2 py-0.5 text-[10px] text-[#d4d4d4] placeholder-[#404040] outline-none focus:border-[#00ff41]/50"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>

        {/* Scrollable registry */}
        <div className="flex-1 overflow-y-auto p-1">
          {groupedNodes.agents.length > 0 && (
            <RegistrySection
              title="AGENTS"
              colour="#00ff41"
              items={groupedNodes.agents}
              selectedId={selectedId}
              onSelect={handleNodeClick}
            />
          )}
          {groupedNodes.services.length > 0 && (
            <RegistrySection
              title="SERVICES"
              colour="#00b4d8"
              items={groupedNodes.services}
              selectedId={selectedId}
              onSelect={handleNodeClick}
            />
          )}
          {groupedNodes.tools.length > 0 && (
            <RegistrySection
              title="TOOLS"
              colour="#ffd60a"
              items={groupedNodes.tools}
              selectedId={selectedId}
              onSelect={handleNodeClick}
            />
          )}
          {groupedNodes.workflows.length > 0 && (
            <RegistrySection
              title="WORKFLOWS"
              colour="#a855f7"
              items={groupedNodes.workflows}
              selectedId={selectedId}
              onSelect={handleNodeClick}
            />
          )}
          {groupedNodes.gaps.length > 0 && (
            <RegistrySection
              title="GAPS"
              colour="#ff0040"
              items={groupedNodes.gaps}
              selectedId={selectedId}
              onSelect={handleNodeClick}
            />
          )}
          {groupedNodes.other.length > 0 && (
            <RegistrySection
              title="OTHER"
              colour="#737373"
              items={groupedNodes.other}
              selectedId={selectedId}
              onSelect={handleNodeClick}
            />
          )}

          {nodes.length === 0 && !loading && (
            <div className="text-[10px] text-[#404040] text-center py-4">
              No entities loaded
            </div>
          )}
        </div>
      </div>

      {/* CENTRE PANE: 3D Globe + Detail Card */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Metrics bar */}
        <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-text-muted tracking-wider">AGENTS</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "#00ff41" }}>
              {agentCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-text-muted tracking-wider">SERVICES</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "#00b4d8" }}>
              {serviceCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-text-muted tracking-wider">EDGES</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "#ffd60a" }}>
              {edgeCount}
            </span>
          </div>

          {/* Legend */}
          <div className="ml-auto flex items-center gap-3">
            {[
              { label: "Agent", colour: "#00ff41" },
              { label: "Service", colour: "#00b4d8" },
              { label: "Tool", colour: "#ffd60a" },
              { label: "Workflow", colour: "#a855f7" },
              { label: "Gap", colour: "#ff0040" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: l.colour }} />
                <span className="text-[9px] text-[#737373]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3D Globe */}
        <div className="flex-1 relative" style={{ background: "#0a0a0a" }}>
          {!loading && nodes.length > 0 && (
            <ForceGraph3DComponent
              graphData={graphData}
              onNodeClick={handleNodeClick}
              highlightNodes={highlightNodes}
              selectedId={selectedId}
            />
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span
                className="text-[10px] text-[#00ff41] animate-pulse"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Fetching graph from RAG...
              </span>
            </div>
          )}

          {error && !loading && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span
                className="text-[10px] text-[#ff1744]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                RAG unavailable — {error}
              </span>
            </div>
          )}

          {/* Detail Card (slides up from bottom) */}
          {selectedId && (
            <DetailCard
              node={selectedNode}
              detail={detail}
              loading={detailLoading}
              edges={edges}
              nodes={nodes}
              onClose={() => {
                setSelectedId(null);
                setDetail(null);
              }}
              onNavigate={handleNavigate}
            />
          )}
        </div>
      </div>

      {/* RIGHT PANE: Event Stream */}
      <div
        className="w-[220px] shrink-0"
        style={{
          background: "#0d0d0d",
          borderLeft: "1px solid rgba(0,255,65,0.2)",
        }}
      >
        <EventStream />
      </div>
    </div>
  );
}
