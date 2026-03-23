"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { withAlpha } from "@/lib/colours";
import EventStream from "@/components/EventStream";

/* ── Types ────────────────────────────────────────────────────── */

interface RagNode {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  status: string;
}

interface RagEdge {
  source: string;
  target: string;
  type: string;
}

interface SimNode extends RagNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colour: string;
  edgeCount: number;
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
    case "gap":
      return "#ff0040";
    default:
      return "#737373";
  }
}

function edgeStyle(type: string): { dash: number[]; colour: string } {
  const colour = "rgba(0,255,65,0.3)";
  switch (type) {
    case "depends_on":
      return { dash: [], colour };
    case "integrates_with":
      return { dash: [8, 4], colour };
    case "used_by":
      return { dash: [2, 4], colour };
    default:
      return { dash: [4, 4], colour };
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

/* ── Force simulation (canvas-based) ─────────────────────────── */

function useForceGraph(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  nodes: SimNode[],
  edges: RagEdge[],
  hoveredId: string | null,
  onClickNode: (id: string) => void
) {
  const nodesRef = useRef<SimNode[]>([]);
  const animRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const clickCbRef = useRef(onClickNode);
  clickCbRef.current = onClickNode;

  // Sync hovered state
  useEffect(() => {
    hoveredRef.current = hoveredId;
  }, [hoveredId]);

  // Init nodes once, preserve positions on subsequent data updates
  useEffect(() => {
    const existing = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodesRef.current = nodes.map((n) => {
      const prev = existing.get(n.id);
      if (prev) {
        return { ...n, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy };
      }
      return { ...n };
    });
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // Mouse tracking for hover detection
    function onMouseMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onClick() {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      for (const n of nodesRef.current) {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (dx * dx + dy * dy < n.radius * n.radius) {
          clickCbRef.current(n.id);
          return;
        }
      }
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);

    // Edge lookup for connected-node highlighting
    const connectedTo = (nodeId: string): Set<string> => {
      const set = new Set<string>();
      for (const e of edges) {
        if (e.source === nodeId) set.add(e.target);
        if (e.target === nodeId) set.add(e.source);
      }
      return set;
    };

    function simulate() {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const ns = nodesRef.current;
      const cx = w / 2;
      const cy = h / 2;

      // Gravity toward center
      for (const n of ns) {
        const isSovereign = n.name === "SOVEREIGN" || n.id.toUpperCase() === "SOVEREIGN";
        const gravity = isSovereign ? 0.02 : 0.003;
        n.vx += (cx - n.x) * gravity;
        n.vy += (cy - n.y) * gravity;
      }

      // Repulsion between all node pairs
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x;
          const dy = ns[i].y - ns[j].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 8000 / (dist * dist);
          ns[i].vx += (dx / dist) * force;
          ns[i].vy += (dy / dist) * force;
          ns[j].vx -= (dx / dist) * force;
          ns[j].vy -= (dy / dist) * force;
        }
      }

      // Spring force for edges
      for (const edge of edges) {
        const src = ns.find((n) => n.id === edge.source);
        const tgt = ns.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 180) * 0.008;
        src.vx += (dx / dist) * force;
        src.vy += (dy / dist) * force;
        tgt.vx -= (dx / dist) * force;
        tgt.vy -= (dy / dist) * force;
      }

      // Damping and bounds
      for (const n of ns) {
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(60, Math.min(w - 60, n.x));
        n.y = Math.max(60, Math.min(h - 60, n.y));
      }

      // ── Render ──

      ctx.clearRect(0, 0, w, h);

      const hovered = hoveredRef.current;
      const hoveredConnected = hovered ? connectedTo(hovered) : new Set<string>();

      // Draw edges
      for (const edge of edges) {
        const src = ns.find((n) => n.id === edge.source);
        const tgt = ns.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;

        const style = edgeStyle(edge.type);
        const isHighlighted =
          hovered && (edge.source === hovered || edge.target === hovered);
        const alpha = hovered ? (isHighlighted ? 0.7 : 0.08) : 0.3;

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash(style.dash);
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = `rgba(0,255,65,${alpha})`;
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        const arrowLen = 8;
        const arrowX = tgt.x - Math.cos(angle) * tgt.radius;
        const arrowY = tgt.y - Math.sin(angle) * tgt.radius;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLen * Math.cos(angle - 0.4),
          arrowY - arrowLen * Math.sin(angle - 0.4)
        );
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLen * Math.cos(angle + 0.4),
          arrowY - arrowLen * Math.sin(angle + 0.4)
        );
        ctx.strokeStyle = `rgba(0,255,65,${alpha})`;
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();
        ctx.restore();
      }

      // Draw nodes
      for (const n of ns) {
        const isHoveredNode = hovered === n.id;
        const isConnected = hoveredConnected.has(n.id);
        const dimmed = hovered && !isHoveredNode && !isConnected;
        const alpha = dimmed ? 0.15 : isHoveredNode ? 1.0 : 0.7;

        // Glow for hovered
        if (isHoveredNode) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha(n.colour, 0.2);
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(n.colour, alpha * 0.4);
        ctx.fill();
        ctx.strokeStyle = withAlpha(n.colour, alpha);
        ctx.lineWidth = isHoveredNode ? 2.5 : 1.5;
        ctx.stroke();

        // Label
        ctx.fillStyle = withAlpha(n.colour, dimmed ? 0.2 : 0.9);
        ctx.font = `${isHoveredNode ? "bold " : ""}11px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.fillText(n.name, n.x, n.y + n.radius + 14);
      }

      // Detect hover via mouse position
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      let foundHover: string | null = null;
      for (const n of ns) {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (dx * dx + dy * dy < n.radius * n.radius) {
          foundHover = n.id;
          break;
        }
      }
      if (canvas) {
        canvas.style.cursor = foundHover ? "pointer" : "default";
      }

      animRef.current = requestAnimationFrame(simulate);
    }

    animRef.current = requestAnimationFrame(simulate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [canvasRef, edges]);
}

/* ── Detail Card ──────────────────────────────────────────────── */

function DetailCard({
  detail,
  loading,
  onClose,
  onNavigate,
}: {
  detail: EntityDetail | null;
  loading: boolean;
  onClose: () => void;
  onNavigate: (name: string) => void;
}) {
  if (!detail && !loading) return null;

  return (
    <div
      className="absolute top-0 right-0 h-full w-[350px] border-l border-[#00ff41]/30 flex flex-col z-10"
      style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(8px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#00ff41]/20">
        <div className="flex items-center gap-2 min-w-0">
          {detail && (
            <>
              <span
                className="shrink-0 w-2 h-2 rounded-full"
                style={{ background: statusDot(detail.entity.status) }}
              />
              <span
                className="text-xs font-bold truncate"
                style={{ color: nodeColour(detail.entity.type), fontFamily: "'JetBrains Mono', monospace" }}
              >
                {detail.entity.name}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  background: withAlpha(typeBadgeColour(detail.entity.type), 0.15),
                  color: typeBadgeColour(detail.entity.type),
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {detail.entity.type.toUpperCase()}
              </span>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[#737373] hover:text-[#00ff41] text-sm shrink-0 ml-2"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          [X]
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {loading && (
          <div className="text-[10px] text-[#737373] animate-pulse">Loading entity data...</div>
        )}

        {detail && (
          <>
            {/* Description */}
            {detail.entity.description && (
              <div>
                <div className="text-[9px] text-[#737373] tracking-wider mb-1">DESCRIPTION</div>
                <div className="text-[11px] text-[#d4d4d4] leading-relaxed">
                  {detail.entity.description}
                </div>
              </div>
            )}

            {/* Relationships */}
            {detail.relationships.length > 0 && (
              <div>
                <div className="text-[9px] text-[#737373] tracking-wider mb-1">
                  RELATIONSHIPS ({detail.relationships.length})
                </div>
                <div className="space-y-1">
                  {detail.relationships.map((r, i) => (
                    <button
                      key={`${r.target}-${r.type}-${i}`}
                      onClick={() => onNavigate(r.target)}
                      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-[#1a1a1a] transition-colors"
                    >
                      <span className="text-[10px] text-[#00ff41]">
                        {r.direction === "outgoing" ? "->" : "<-"}
                      </span>
                      <span className="text-[10px] text-[#00b4d8] truncate flex-1">
                        {r.target}
                      </span>
                      <span className="text-[9px] text-[#404040]">{r.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Related projects */}
            {detail.entity.related_projects.length > 0 && (
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

            {/* Last updated */}
            {detail.entity.last_updated && (
              <div>
                <div className="text-[9px] text-[#737373] tracking-wider mb-1">LAST UPDATED</div>
                <div className="text-[10px] text-[#d4d4d4]">
                  {new Date(detail.entity.last_updated).toLocaleString("en-GB")}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function BattlefieldTab() {
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<RagEdge[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hoveredId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch graph data from API route
  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const rawNodes: RagNode[] = data.nodes || [];
      const rawEdges: RagEdge[] = data.edges || [];

      // Count edges per node
      const edgeCounts = new Map<string, number>();
      for (const e of rawEdges) {
        edgeCounts.set(e.source, (edgeCounts.get(e.source) || 0) + 1);
        edgeCounts.set(e.target, (edgeCounts.get(e.target) || 0) + 1);
      }

      // Convert to SimNodes
      const simNodes: SimNode[] = rawNodes.map((n, i) => {
        const isSovereign = n.name.toUpperCase() === "SOVEREIGN" || n.id.toUpperCase() === "SOVEREIGN";
        const count = edgeCounts.get(n.id) || 0;
        const radius = isSovereign
          ? 50
          : Math.max(20, Math.min(45, 20 + count * 3));
        const angle = (i / rawNodes.length) * Math.PI * 2;
        const spread = isSovereign ? 0 : 200 + Math.random() * 150;

        return {
          ...n,
          x: 400 + Math.cos(angle) * spread,
          y: 300 + Math.sin(angle) * spread,
          vx: 0,
          vy: 0,
          radius,
          colour: nodeColour(n.entity_type),
          edgeCount: count,
        };
      });

      setNodes(simNodes);
      setEdges(rawEdges);
      setAgentCount(rawNodes.filter((n) => n.entity_type === "agent").length);
      setServiceCount(rawNodes.filter((n) => n.entity_type === "service").length);
      setEdgeCount(rawEdges.length);
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

  // Handle node click
  const handleNodeClick = useCallback(
    (id: string) => {
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

  // Force graph
  useForceGraph(canvasRef, nodes, edges, hoveredId, handleNodeClick);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Event Stream */}
      <div className="w-56 shrink-0">
        <EventStream />
      </div>

      {/* Center: Graph + Metrics */}
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
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: l.colour }} />
                <span className="text-[9px] text-[#737373]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Force graph canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ background: "#0a0a0a" }}
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[10px] text-[#00ff41] animate-pulse"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Fetching graph from RAG...
              </span>
            </div>
          )}

          {error && !loading && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[10px] text-[#ff1744]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                RAG unavailable — {error}
              </span>
            </div>
          )}

          {/* Detail Card */}
          {selectedId && (
            <DetailCard
              detail={detail}
              loading={detailLoading}
              onClose={() => {
                setSelectedId(null);
                setDetail(null);
              }}
              onNavigate={handleNavigate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
