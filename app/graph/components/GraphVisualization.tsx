"use client";

import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";

/* ─── Types ──────────────────────────────────────────── */

export interface GraphNode {
  id: string;
  type: "agent" | "skill" | "tool";
  label: string;
  status?: string;
  capabilities?: string[];
  proficiency?: string;
  classification?: string;
  description?: string;
  calls?: string[];
  called_by?: string[];
  gaps?: string[];
  layer?: string;
  category?: string;
  connectionCount?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "calls" | "called_by" | "uses_skill" | "depends_on";
}

/* D3 extends these with x, y, vx, vy at runtime */
interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  type: "agent" | "skill" | "tool";
  label: string;
  status?: string;
  capabilities?: string[];
  proficiency?: string;
  classification?: string;
  description?: string;
  calls?: string[];
  called_by?: string[];
  gaps?: string[];
  layer?: string;
  category?: string;
  connectionCount?: number;
  metadata?: Record<string, unknown>;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: "calls" | "called_by" | "uses_skill" | "depends_on";
}

/* ─── Helpers ────────────────────────────────────────── */

function nodeRadius(node: SimNode): number {
  const count = node.connectionCount ?? 0;
  // Scale radius between 12 and 32 based on connection count
  const minR = 12;
  const maxR = 32;
  return Math.min(maxR, Math.max(minR, minR + count * 2.5));
}

function nodeColor(node: SimNode): string {
  if (node.type === "skill") return "#a78bfa"; // purple
  if (node.type === "tool") return "#6b7280"; // gray

  // Agent coloring by classification
  if (node.classification === "orchestrator" || (node.connectionCount ?? 0) >= 6) {
    return "#22c55e"; // green for orchestrators
  }
  if (node.classification === "checker") {
    return "#3b82f6"; // blue for checkers
  }
  return "#14b8a6"; // teal for other agents
}

function edgeDasharray(type: string): string {
  switch (type) {
    case "calls":
      return ""; // solid
    case "depends_on":
      return "6 3"; // dashed
    case "called_by":
      return "2 3"; // dotted
    case "uses_skill":
      return "4 2"; // short dash
    default:
      return "";
  }
}

/* ─── Component ──────────────────────────────────────── */

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId?: string | null;
}

export function GraphVisualization({ nodes, edges, onNodeClick, selectedNodeId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  /* Build / rebuild the force simulation whenever data changes */
  const buildGraph = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;

    // Clear previous
    d3.select(svg).selectAll("*").remove();
    simulationRef.current?.stop();

    /* Deep-clone data so D3 can mutate safely */
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = edges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
      }));

    /* Root <g> for zoom/pan */
    const root = d3.select(svg);

    /* Defs for arrowhead markers */
    const defs = root.append("defs");

    // Create arrowhead markers for each edge type
    const markerTypes = [
      { id: "arrow-calls", color: "rgba(255,255,255,0.25)" },
      { id: "arrow-called_by", color: "rgba(255,255,255,0.25)" },
      { id: "arrow-depends_on", color: "rgba(255,255,255,0.25)" },
      { id: "arrow-uses_skill", color: "rgba(255,255,255,0.25)" },
      { id: "arrow-highlight", color: "rgba(255,255,255,0.6)" },
    ];

    for (const mt of markerTypes) {
      defs
        .append("marker")
        .attr("id", mt.id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", mt.color);
    }

    const g = root.append("g");

    /* Zoom behaviour */
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    root.call(zoom);

    /* Edges — rendered BEFORE nodes so nodes appear on top */
    const link = g
      .append("g")
      .attr("class", "edges")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "rgba(255,255,255,0.25)")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.4)
      .attr("stroke-dasharray", (d) => edgeDasharray(d.type))
      .attr("marker-end", (d) => `url(#arrow-${d.type})`);

    /* Node groups — rendered AFTER edges */
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        onNodeClick({
          id: d.id,
          type: d.type,
          label: d.label,
          status: d.status,
          capabilities: d.capabilities,
          proficiency: d.proficiency,
          classification: d.classification,
          description: d.description,
          calls: d.calls,
          called_by: d.called_by,
          gaps: d.gaps,
          layer: d.layer,
          category: d.category,
          connectionCount: d.connectionCount,
          metadata: d.metadata,
        });
      })
      .on("mouseenter", (_event, d) => {
        // Highlight connected edges
        link
          .attr("stroke-opacity", (l) => {
            const src = (l.source as SimNode).id ?? l.source;
            const tgt = (l.target as SimNode).id ?? l.target;
            return src === d.id || tgt === d.id ? 0.8 : 0.15;
          })
          .attr("stroke-width", (l) => {
            const src = (l.source as SimNode).id ?? l.source;
            const tgt = (l.target as SimNode).id ?? l.target;
            return src === d.id || tgt === d.id ? 2 : 1;
          })
          .attr("marker-end", (l) => {
            const src = (l.source as SimNode).id ?? l.source;
            const tgt = (l.target as SimNode).id ?? l.target;
            return src === d.id || tgt === d.id
              ? "url(#arrow-highlight)"
              : `url(#arrow-${l.type})`;
          });
      })
      .on("mouseleave", () => {
        link
          .attr("stroke-opacity", 0.4)
          .attr("stroke-width", 1)
          .attr("marker-end", (l) => `url(#arrow-${l.type})`);
      });

    /* Glow ring for selected node */
    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d) + 6)
      .attr("fill", "none")
      .attr("stroke", (d) => nodeColor(d))
      .attr("stroke-width", 2)
      .attr("stroke-opacity", (d) => (d.id === selectedNodeId ? 0.5 : 0))
      .attr("class", "selection-ring");

    /* Circle */
    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => nodeColor(d))
      .attr("fill-opacity", 0.18)
      .attr("stroke", (d) => nodeColor(d))
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    /* Inner dot for status */
    node
      .append("circle")
      .attr("r", 3)
      .attr("fill", (d) => {
        if (!d.status) return "transparent";
        switch (d.status) {
          case "operational":
            return "#30d158";
          case "beta":
            return "#0a84ff";
          case "pending":
            return "#ff9f0a";
          case "offline":
            return "#ff453a";
          default:
            return "rgba(255,255,255,0.3)";
        }
      })
      .attr("fill-opacity", (d) => (d.status ? 1 : 0));

    /* Label */
    node
      .append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d) + 14)
      .attr("fill", "rgba(245,245,247,0.38)")
      .attr("font-size", (d) => (d.type === "agent" ? 11 : 9))
      .attr("font-family", "'JetBrains Mono', ui-monospace, monospace")
      .attr("pointer-events", "none");

    /* Drag behaviour */
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    /* Force simulation */
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120),
      )
      .force(
        "charge",
        d3.forceManyBody<SimNode>().strength((d) => {
          if (d.type === "agent" && (d.classification === "orchestrator" || (d.connectionCount ?? 0) >= 6)) {
            return -400;
          }
          return d.type === "agent" ? -250 : -120;
        }),
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 10),
      )
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => {
            const src = d.source as SimNode;
            const tgt = d.target as SimNode;
            const dx = (tgt.x ?? 0) - (src.x ?? 0);
            const dy = (tgt.y ?? 0) - (src.y ?? 0);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const r = nodeRadius(tgt);
            return (tgt.x ?? 0) - (dx / dist) * r;
          })
          .attr("y2", (d) => {
            const src = d.source as SimNode;
            const tgt = d.target as SimNode;
            const dx = (tgt.x ?? 0) - (src.x ?? 0);
            const dy = (tgt.y ?? 0) - (src.y ?? 0);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const r = nodeRadius(tgt);
            return (tgt.y ?? 0) - (dy / dist) * r;
          });

        node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    simulationRef.current = simulation;
  }, [nodes, edges, onNodeClick, selectedNodeId]);

  /* Initial build + resize handler */
  useEffect(() => {
    buildGraph();

    const handleResize = () => buildGraph();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      simulationRef.current?.stop();
    };
  }, [buildGraph]);

  return (
    <svg
      ref={svgRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: "transparent",
      }}
    />
  );
}
