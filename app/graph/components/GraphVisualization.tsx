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
  metadata?: Record<string, unknown>;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: "calls" | "called_by" | "uses_skill" | "depends_on";
}

/* ─── Helpers ────────────────────────────────────────── */

function nodeRadius(type: string): number {
  if (type === "agent") return 24;
  if (type === "skill") return 16;
  return 12;
}

function nodeColor(node: SimNode): string {
  if (node.type === "skill") return "var(--purple, #a78bfa)";
  if (node.type === "tool") return "var(--yellow, #facc15)";
  // agent — color by status
  switch (node.status) {
    case "operational":
      return "var(--green, #30d158)";
    case "beta":
      return "var(--blue, #0a84ff)";
    case "pending":
      return "var(--orange, #ff9f0a)";
    case "offline":
      return "var(--text-4, rgba(245,245,247,0.18))";
    default:
      return "var(--text-3, rgba(245,245,247,0.38))";
  }
}

function edgeStyle(type: string): { dasharray: string; opacity: number } {
  switch (type) {
    case "calls":
      return { dasharray: "", opacity: 0.4 };
    case "called_by":
      return { dasharray: "6 3", opacity: 0.3 };
    case "uses_skill":
    case "depends_on":
      return { dasharray: "2 3", opacity: 0.2 };
    default:
      return { dasharray: "", opacity: 0.2 };
  }
}

/* ─── Component ──────────────────────────────────────── */

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (node: GraphNode) => void;
}

export function GraphVisualization({ nodes, edges, onNodeClick }: Props) {
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
    const g = root.append("g");

    /* Zoom behaviour */
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    root.call(zoom);

    /* Edges */
    const link = g
      .append("g")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "var(--text-4, rgba(245,245,247,0.18))")
      .attr("stroke-width", 1)
      .each(function (d) {
        const s = edgeStyle(d.type);
        d3.select(this)
          .attr("stroke-opacity", s.opacity)
          .attr("stroke-dasharray", s.dasharray);
      });

    /* Node groups */
    const node = g
      .append("g")
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
          metadata: d.metadata,
        });
      });

    /* Circle */
    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d.type))
      .attr("fill", (d) => nodeColor(d))
      .attr("fill-opacity", 0.18)
      .attr("stroke", (d) => nodeColor(d))
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.6);

    /* Label */
    node
      .append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d.type) + 14)
      .attr("fill", "var(--text-3, rgba(245,245,247,0.38))")
      .attr("font-size", (d) => (d.type === "agent" ? 11 : 9))
      .attr("font-family", "var(--font-mono)")
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
          .distance(100),
      )
      .force(
        "charge",
        d3.forceManyBody<SimNode>().strength((d) => (d.type === "agent" ? -300 : -150)),
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((d) => nodeRadius(d.type) + 8),
      )
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x ?? 0)
          .attr("y1", (d) => (d.source as SimNode).y ?? 0)
          .attr("x2", (d) => (d.target as SimNode).x ?? 0)
          .attr("y2", (d) => (d.target as SimNode).y ?? 0);

        node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    simulationRef.current = simulation;
  }, [nodes, edges, onNodeClick]);

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
