"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";

/* ── Types ────────────────────────────────────────────────────── */

export type ThemeMode = "dark" | "light";

interface WorkflowNode {
  id: string;
  label: string;
  type: "agent" | "skill" | "workflow" | "gate" | "service" | "endpoint";
  classification?: "orchestrator" | "checker" | "utility" | "builder" | "router";
  x: number;
  y: number;
}

interface WorkflowEdge {
  source: string;
  target: string;
  mode: "templatised" | "magentic";
  step?: number;
  label?: string;
}

interface WorkflowMatrixProps {
  theme?: ThemeMode;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
  compact?: boolean;
}

/* ── Colour palettes ─────────────────────────────────────────── */

const DARK_COLOURS = {
  bg: "#0a0a0a",
  orchestrator: "#00ff41",
  checker: "#00b4d8",
  utility: "#e879f9",
  builder: "#ffd60a",
  router: "#a855f7",
  agent: "#00ff41",
  skill: "#e879f9",
  workflow: "#a855f7",
  gate: "#ffb800",
  service: "#00b4d8",
  endpoint: "#ff6d00",
  templateEdge: "#00ff41",
  magenticEdge: "#a855f7",
  text: "#d4d4d4",
  textMuted: "#737373",
  border: "#1e1e1e",
  surface: "#111111",
};

const LIGHT_COLOURS = {
  bg: "#fafafa",
  orchestrator: "#059669",
  checker: "#0284c7",
  utility: "#9333ea",
  builder: "#ca8a04",
  router: "#7c3aed",
  agent: "#059669",
  skill: "#9333ea",
  workflow: "#7c3aed",
  gate: "#d97706",
  service: "#0284c7",
  endpoint: "#ea580c",
  templateEdge: "#059669",
  magenticEdge: "#7c3aed",
  text: "#171717",
  textMuted: "#737373",
  border: "#e5e5e5",
  surface: "#f0f0f0",
};

/* ── Static workflow matrix data (72 nodes, 99 edges) ────────── */

function buildWorkflowData(): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // Layout constants
  const cx = 600;
  const cy = 450;

  // ── Core orchestration agents (inner ring) ──
  const coreAgents: { id: string; label: string; classification: WorkflowNode["classification"]; angle: number }[] = [
    { id: "SOVEREIGN", label: "SOVEREIGN", classification: "orchestrator", angle: 270 },
    { id: "COMPASS", label: "COMPASS", classification: "router", angle: 310 },
    { id: "LORE", label: "LORE", classification: "checker", angle: 350 },
    { id: "PRISM", label: "PRISM", classification: "router", angle: 30 },
    { id: "FORGE", label: "FORGE", classification: "builder", angle: 70 },
    { id: "VERIFY", label: "VERIFY", classification: "checker", angle: 110 },
    { id: "SCRIBE", label: "SCRIBE", classification: "utility", angle: 150 },
    { id: "SAGE", label: "SAGE", classification: "utility", angle: 190 },
    { id: "KIRA", label: "KIRA", classification: "builder", angle: 230 },
  ];

  const innerRadius = 140;
  for (const a of coreAgents) {
    const rad = (a.angle * Math.PI) / 180;
    nodes.push({
      id: a.id,
      label: a.label,
      type: "agent",
      classification: a.classification,
      x: cx + innerRadius * Math.cos(rad),
      y: cy + innerRadius * Math.sin(rad),
    });
  }

  // ── Outer agents (secondary ring) ──
  const outerAgents: { id: string; label: string; classification: WorkflowNode["classification"]; angle: number }[] = [
    { id: "RECON", label: "RECON", classification: "checker", angle: 290 },
    { id: "ARAGON", label: "ARAGON", classification: "builder", angle: 330 },
    { id: "DELIVER", label: "DELIVER", classification: "builder", angle: 10 },
    { id: "ATLAS", label: "ATLAS", classification: "utility", angle: 50 },
    { id: "PULSE", label: "PULSE", classification: "checker", angle: 90 },
  ];

  const outerRadius = 250;
  for (const a of outerAgents) {
    const rad = (a.angle * Math.PI) / 180;
    nodes.push({
      id: a.id,
      label: a.label,
      type: "agent",
      classification: a.classification,
      x: cx + outerRadius * Math.cos(rad),
      y: cy + outerRadius * Math.sin(rad),
    });
  }

  // ── Templatised workflow nodes ──
  const workflows: { id: string; label: string; x: number; y: number }[] = [
    { id: "wf-prism-routing", label: "prism-routing", x: 180, y: 120 },
    { id: "wf-gap-resolution", label: "gap-resolution", x: 180, y: 280 },
    { id: "wf-build-validation", label: "build-validation", x: 180, y: 440 },
    { id: "wf-website-build", label: "website-build", x: 1020, y: 120 },
    { id: "wf-migration", label: "migration", x: 1020, y: 280 },
    { id: "wf-shopify-audit", label: "shopify-audit", x: 1020, y: 440 },
    { id: "wf-agent-test", label: "agent-test-scaffold", x: 180, y: 600 },
    { id: "wf-gitops-bootstrap", label: "gitops-bootstrap", x: 1020, y: 600 },
    { id: "wf-client-bootstrap", label: "client-bootstrap", x: 180, y: 760 },
    { id: "wf-lore-promote", label: "lore-pattern-promote", x: 1020, y: 760 },
  ];

  for (const w of workflows) {
    nodes.push({ id: w.id, label: w.label, type: "workflow", x: w.x, y: w.y });
  }

  // ── Decision gates ──
  const gates: { id: string; label: string; x: number; y: number }[] = [
    { id: "gate-classify", label: "CLASSIFY", x: 400, y: 120 },
    { id: "gate-skill-check", label: "SKILL CHECK", x: 500, y: 180 },
    { id: "gate-route", label: "ROUTE", x: 700, y: 120 },
    { id: "gate-template-match", label: "TEMPLATE?", x: 600, y: 50 },
    { id: "gate-validation", label: "PASS/FAIL", x: 800, y: 500 },
    { id: "gate-gap-detected", label: "GAP?", x: 300, y: 350 },
  ];

  for (const g of gates) {
    nodes.push({ id: g.id, label: g.label, type: "gate", x: g.x, y: g.y });
  }

  // ── Dispatch endpoints ──
  const endpoints: { id: string; label: string; x: number; y: number }[] = [
    { id: "ep-direct-skill", label: "direct_skill", x: 850, y: 180 },
    { id: "ep-skill-chain", label: "skill_chain", x: 900, y: 240 },
    { id: "ep-agent-team", label: "agent_team", x: 950, y: 300 },
  ];

  for (const ep of endpoints) {
    nodes.push({ id: ep.id, label: ep.label, type: "endpoint", x: ep.x, y: ep.y });
  }

  // ── Services ──
  const services: { id: string; label: string; x: number; y: number }[] = [
    { id: "svc-supabase", label: "Supabase", x: 100, y: 450 },
    { id: "svc-rag", label: "RAG", x: 100, y: 550 },
    { id: "svc-vercel", label: "Vercel", x: 1100, y: 450 },
    { id: "svc-github", label: "GitHub", x: 1100, y: 550 },
    { id: "svc-monday", label: "Monday", x: 1100, y: 350 },
  ];

  for (const s of services) {
    nodes.push({ id: s.id, label: s.label, type: "service", x: s.x, y: s.y });
  }

  // ── Skills (inner cluster, around workflows) ──
  const skills: { id: string; label: string; x: number; y: number }[] = [
    { id: "sk-nextjs", label: "nextjs", x: 950, y: 140 },
    { id: "sk-react", label: "react", x: 950, y: 170 },
    { id: "sk-tailwind", label: "tailwind", x: 950, y: 100 },
    { id: "sk-shopify", label: "shopify", x: 1050, y: 400 },
    { id: "sk-lighthouse", label: "lighthouse", x: 870, y: 440 },
    { id: "sk-github-auto", label: "github-auto", x: 1100, y: 280 },
    { id: "sk-rag-ingest", label: "rag-ingest", x: 100, y: 650 },
    { id: "sk-schema-val", label: "schema-val", x: 100, y: 350 },
    { id: "sk-web-builder", label: "web-builder", x: 900, y: 60 },
    { id: "sk-brief-binding", label: "brief-binding", x: 350, y: 50 },
    { id: "sk-crystallise", label: "crystallise", x: 250, y: 700 },
    { id: "sk-gap-analysis", label: "gap-analysis", x: 250, y: 400 },
    { id: "sk-capability-score", label: "capability-score", x: 750, y: 50 },
    { id: "sk-vercel-deploy", label: "vercel-deploy", x: 1050, y: 500 },
    { id: "sk-monday-sync", label: "monday-sync", x: 1050, y: 320 },
    { id: "sk-test-scaffold", label: "test-scaffold", x: 250, y: 630 },
    { id: "sk-content-gen", label: "content-gen", x: 700, y: 700 },
    { id: "sk-seo-audit", label: "seo-audit", x: 800, y: 700 },
  ];

  for (const sk of skills) {
    nodes.push({ id: sk.id, label: sk.label, type: "skill", x: sk.x, y: sk.y });
  }

  // ── Templatised edges (solid, numbered steps) ──

  // prism-routing: BRIEF > COMPASS.classify > LORE.check > PRISM.route
  edges.push({ source: "wf-prism-routing", target: "gate-classify", mode: "templatised", step: 1 });
  edges.push({ source: "gate-classify", target: "COMPASS", mode: "templatised", step: 1 });
  edges.push({ source: "COMPASS", target: "gate-skill-check", mode: "templatised", step: 2 });
  edges.push({ source: "gate-skill-check", target: "LORE", mode: "templatised", step: 2 });
  edges.push({ source: "LORE", target: "gate-route", mode: "templatised", step: 3 });
  edges.push({ source: "gate-route", target: "PRISM", mode: "templatised", step: 3 });
  edges.push({ source: "PRISM", target: "ep-direct-skill", mode: "templatised", step: 4 });
  edges.push({ source: "PRISM", target: "ep-skill-chain", mode: "templatised", step: 4 });
  edges.push({ source: "PRISM", target: "ep-agent-team", mode: "templatised", step: 4 });

  // gap-resolution: LORE blocked > SCRIBE > SAGE > LORE.ingest > PRISM re-route
  edges.push({ source: "wf-gap-resolution", target: "gate-gap-detected", mode: "templatised", step: 1 });
  edges.push({ source: "gate-gap-detected", target: "LORE", mode: "templatised", step: 1 });
  edges.push({ source: "LORE", target: "SCRIBE", mode: "templatised", step: 2 });
  edges.push({ source: "SCRIBE", target: "SAGE", mode: "templatised", step: 3 });
  edges.push({ source: "SAGE", target: "LORE", mode: "templatised", step: 4, label: "ingest" });
  edges.push({ source: "LORE", target: "PRISM", mode: "templatised", step: 5, label: "re-route" });

  // build-validation: FORGE builds > VERIFY validates > pass/fail loop
  edges.push({ source: "wf-build-validation", target: "FORGE", mode: "templatised", step: 1 });
  edges.push({ source: "FORGE", target: "VERIFY", mode: "templatised", step: 2 });
  edges.push({ source: "VERIFY", target: "gate-validation", mode: "templatised", step: 3 });
  edges.push({ source: "gate-validation", target: "FORGE", mode: "templatised", step: 4, label: "fail" });

  // SOVEREIGN orchestration edges
  edges.push({ source: "SOVEREIGN", target: "COMPASS", mode: "templatised", step: 1 });
  edges.push({ source: "SOVEREIGN", target: "PRISM", mode: "templatised" });
  edges.push({ source: "SOVEREIGN", target: "FORGE", mode: "templatised" });
  edges.push({ source: "SOVEREIGN", target: "VERIFY", mode: "templatised" });
  edges.push({ source: "SOVEREIGN", target: "RECON", mode: "templatised" });
  edges.push({ source: "SOVEREIGN", target: "KIRA", mode: "templatised" });
  edges.push({ source: "SOVEREIGN", target: "DELIVER", mode: "templatised" });

  // Workflow to agent connections
  edges.push({ source: "wf-website-build", target: "FORGE", mode: "templatised" });
  edges.push({ source: "wf-website-build", target: "VERIFY", mode: "templatised" });
  edges.push({ source: "wf-migration", target: "FORGE", mode: "templatised" });
  edges.push({ source: "wf-shopify-audit", target: "RECON", mode: "templatised" });
  edges.push({ source: "wf-agent-test", target: "VERIFY", mode: "templatised" });
  edges.push({ source: "wf-gitops-bootstrap", target: "FORGE", mode: "templatised" });
  edges.push({ source: "wf-client-bootstrap", target: "SOVEREIGN", mode: "templatised" });
  edges.push({ source: "wf-lore-promote", target: "LORE", mode: "templatised" });
  edges.push({ source: "wf-lore-promote", target: "SCRIBE", mode: "templatised" });

  // Skill to agent connections
  edges.push({ source: "FORGE", target: "sk-nextjs", mode: "templatised" });
  edges.push({ source: "FORGE", target: "sk-react", mode: "templatised" });
  edges.push({ source: "FORGE", target: "sk-tailwind", mode: "templatised" });
  edges.push({ source: "FORGE", target: "sk-web-builder", mode: "templatised" });
  edges.push({ source: "VERIFY", target: "sk-lighthouse", mode: "templatised" });
  edges.push({ source: "VERIFY", target: "sk-schema-val", mode: "templatised" });
  edges.push({ source: "VERIFY", target: "sk-test-scaffold", mode: "templatised" });
  edges.push({ source: "LORE", target: "sk-rag-ingest", mode: "templatised" });
  edges.push({ source: "LORE", target: "sk-gap-analysis", mode: "templatised" });
  edges.push({ source: "PRISM", target: "sk-capability-score", mode: "templatised" });
  edges.push({ source: "COMPASS", target: "sk-brief-binding", mode: "templatised" });
  edges.push({ source: "SCRIBE", target: "sk-crystallise", mode: "templatised" });
  edges.push({ source: "DELIVER", target: "sk-vercel-deploy", mode: "templatised" });
  edges.push({ source: "DELIVER", target: "sk-github-auto", mode: "templatised" });
  edges.push({ source: "RECON", target: "sk-shopify", mode: "templatised" });
  edges.push({ source: "ATLAS", target: "sk-monday-sync", mode: "templatised" });
  edges.push({ source: "KIRA", target: "sk-content-gen", mode: "templatised" });
  edges.push({ source: "KIRA", target: "sk-seo-audit", mode: "templatised" });
  edges.push({ source: "ARAGON", target: "sk-content-gen", mode: "templatised" });

  // Service connections
  edges.push({ source: "SOVEREIGN", target: "svc-supabase", mode: "templatised" });
  edges.push({ source: "LORE", target: "svc-rag", mode: "templatised" });
  edges.push({ source: "DELIVER", target: "svc-vercel", mode: "templatised" });
  edges.push({ source: "DELIVER", target: "svc-github", mode: "templatised" });
  edges.push({ source: "FORGE", target: "svc-github", mode: "templatised" });
  edges.push({ source: "ATLAS", target: "svc-monday", mode: "templatised" });
  edges.push({ source: "SAGE", target: "svc-rag", mode: "templatised" });
  edges.push({ source: "sk-vercel-deploy", target: "svc-vercel", mode: "templatised" });
  edges.push({ source: "sk-rag-ingest", target: "svc-rag", mode: "templatised" });

  // ── Magentic edges (dashed, decision tree layout) ──

  // COMPASS.classify > LORE.check > PRISM.route > dispatch
  edges.push({ source: "gate-template-match", target: "COMPASS", mode: "magentic", label: "no match" });
  edges.push({ source: "COMPASS", target: "LORE", mode: "magentic", label: "classify" });
  edges.push({ source: "LORE", target: "PRISM", mode: "magentic", label: "skill check" });

  // Dynamic routing from PRISM to outer agents
  edges.push({ source: "PRISM", target: "RECON", mode: "magentic" });
  edges.push({ source: "PRISM", target: "ARAGON", mode: "magentic" });
  edges.push({ source: "PRISM", target: "DELIVER", mode: "magentic" });
  edges.push({ source: "PRISM", target: "ATLAS", mode: "magentic" });
  edges.push({ source: "PRISM", target: "PULSE", mode: "magentic" });
  edges.push({ source: "PRISM", target: "KIRA", mode: "magentic" });
  edges.push({ source: "PRISM", target: "SCRIBE", mode: "magentic" });
  edges.push({ source: "PRISM", target: "SAGE", mode: "magentic" });
  edges.push({ source: "PRISM", target: "FORGE", mode: "magentic" });

  // Inter-agent magentic connections
  edges.push({ source: "RECON", target: "LORE", mode: "magentic", label: "discovery" });
  edges.push({ source: "PULSE", target: "SOVEREIGN", mode: "magentic", label: "alert" });
  edges.push({ source: "ARAGON", target: "DELIVER", mode: "magentic" });
  edges.push({ source: "FORGE", target: "DELIVER", mode: "magentic" });
  edges.push({ source: "SAGE", target: "SCRIBE", mode: "magentic", label: "knowledge" });

  // Self-learning: magentic success promotes to template
  edges.push({ source: "gate-validation", target: "wf-lore-promote", mode: "magentic", label: "promote" });

  return { nodes, edges };
}

/* ── Drawing helpers ─────────────────────────────────────────── */

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  stroke: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/* ── Main Component ─────────────────────────────────────────── */

export default function WorkflowMatrix({
  theme = "dark",
  className = "",
  onNodeClick,
  compact = false,
}: WorkflowMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "templatised" | "magentic">("all");
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  const colours = theme === "dark" ? DARK_COLOURS : LIGHT_COLOURS;
  const { nodes, edges } = useMemo(() => buildWorkflowData(), []);

  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const filteredEdges = useMemo(() => {
    if (viewMode === "all") return edges;
    return edges.filter((e) => e.mode === viewMode);
  }, [edges, viewMode]);

  const templatisedCount = useMemo(() => edges.filter((e) => e.mode === "templatised").length, [edges]);
  const magenticCount = useMemo(() => edges.filter((e) => e.mode === "magentic").length, [edges]);

  // Hit test for mouse interaction
  const hitTest = useCallback(
    (mx: number, my: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (mx - rect.left) * scaleX;
      const y = (my - rect.top) * scaleY;

      for (const node of nodes) {
        const dx = x - node.x;
        const dy = y - node.y;
        const hitRadius = node.type === "gate" ? 22 : 18;
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          return node.id;
        }
      }
      return null;
    },
    [nodes]
  );

  // Node colour based on type and classification
  const getNodeColour = useCallback(
    (node: WorkflowNode): string => {
      if (node.classification) return colours[node.classification];
      return colours[node.type] || colours.text;
    },
    [colours]
  );

  // Draw the full matrix
  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      timeRef.current = time;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = colours.bg;
      ctx.fillRect(0, 0, W, H);

      // Draw edges
      for (const edge of filteredEdges) {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) continue;

        const isHighlighted =
          hoveredNode === edge.source ||
          hoveredNode === edge.target ||
          selectedNode === edge.source ||
          selectedNode === edge.target;

        ctx.save();
        ctx.beginPath();

        if (edge.mode === "magentic") {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = isHighlighted
            ? colours.magenticEdge
            : colours.magenticEdge + "60";
          ctx.lineWidth = isHighlighted ? 2 : 1;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = isHighlighted
            ? colours.templateEdge
            : colours.templateEdge + "50";
          ctx.lineWidth = isHighlighted ? 2 : 1;
        }

        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();

        // Arrowhead
        ctx.fillStyle = ctx.strokeStyle;
        const midX = tgt.x - (tgt.x - src.x) * 0.15;
        const midY = tgt.y - (tgt.y - src.y) * 0.15;
        drawArrowhead(ctx, src.x, src.y, midX, midY, 6);

        // Step number
        if (edge.step && edge.mode === "templatised") {
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          ctx.font = "bold 9px monospace";
          ctx.fillStyle = colours.templateEdge;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const stepSize = 8;
          ctx.fillStyle = colours.bg;
          ctx.fillRect(mx - stepSize, my - stepSize, stepSize * 2, stepSize * 2);
          ctx.fillStyle = colours.templateEdge;
          ctx.fillText(`${edge.step}`, mx, my);
        }

        // Edge label
        if (edge.label && isHighlighted) {
          const lx = (src.x + tgt.x) / 2;
          const ly = (src.y + tgt.y) / 2 - 12;
          ctx.font = "9px monospace";
          ctx.fillStyle = colours.textMuted;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(edge.label, lx, ly);
        }

        // Animated pulse dot along edge
        if (isHighlighted) {
          const t = ((time / 1500) % 1);
          const px = src.x + (tgt.x - src.x) * t;
          const py = src.y + (tgt.y - src.y) * t;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = edge.mode === "magentic" ? colours.magenticEdge : colours.templateEdge;
          ctx.fill();
        }

        ctx.restore();
      }

      // Draw nodes
      for (const node of nodes) {
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode === node.id;
        const col = getNodeColour(node);
        const isActive = isHovered || isSelected;

        ctx.save();

        if (node.type === "gate") {
          // Diamond shape for gates
          const fillAlpha = isActive ? "30" : "15";
          drawDiamond(ctx, node.x, node.y, 16, col + fillAlpha, col);
        } else {
          // Circle for agents, skills, services, endpoints, workflows
          const radius =
            node.type === "agent" ? 14 :
            node.type === "workflow" ? 12 :
            node.type === "service" ? 11 :
            node.type === "endpoint" ? 10 : 8;

          // Glow
          if (isActive) {
            ctx.shadowColor = col;
            ctx.shadowBlur = 15;
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = col + (isActive ? "30" : "15");
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = isActive ? 2 : 1;
          if (node.type === "workflow") {
            ctx.setLineDash([3, 2]);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
        }

        // Label
        ctx.font = node.type === "agent" ? "bold 10px monospace" : "9px monospace";
        ctx.fillStyle = isActive ? col : colours.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const labelY = node.type === "gate" ? node.y : node.y + (node.type === "agent" ? 22 : 16);
        ctx.fillText(node.label, node.x, labelY);

        // Type badge for non-agent nodes
        if (node.type !== "agent" && node.type !== "gate") {
          ctx.font = "7px monospace";
          ctx.fillStyle = colours.textMuted;
          ctx.fillText(node.type.toUpperCase(), node.x, labelY + 10);
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    },
    [filteredEdges, nodes, nodeMap, hoveredNode, selectedNode, colours, getNodeColour]
  );

  // Start animation loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // Mouse event handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const hit = hitTest(e.clientX, e.clientY);
      setHoveredNode(hit);
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = hit ? "pointer" : "default";
    },
    [hitTest]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const hit = hitTest(e.clientX, e.clientY);
      setSelectedNode(hit);
      if (hit && onNodeClick) onNodeClick(hit);
    },
    [hitTest, onNodeClick]
  );

  // Canvas sizing
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = 1200;
      canvas.height = compact ? 600 : 900;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [compact]);

  const font = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Controls bar */}
      <div
        className="flex items-center gap-3 px-3 py-2"
        style={{
          ...font,
          background: colours.surface,
          borderBottom: `1px solid ${colours.border}`,
        }}
      >
        <span
          className="text-[10px] font-bold tracking-wider"
          style={{ color: colours.templateEdge }}
        >
          WORKFLOW MATRIX
        </span>

        <div className="flex items-center gap-1 ml-4">
          {(["all", "templatised", "magentic"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="px-2 py-0.5 rounded text-[9px] transition-all"
              style={{
                ...font,
                background:
                  viewMode === mode
                    ? (mode === "magentic"
                        ? colours.magenticEdge + "20"
                        : colours.templateEdge + "20")
                    : "transparent",
                color:
                  viewMode === mode
                    ? (mode === "magentic" ? colours.magenticEdge : colours.templateEdge)
                    : colours.textMuted,
                border: `1px solid ${
                  viewMode === mode
                    ? (mode === "magentic"
                        ? colours.magenticEdge + "40"
                        : colours.templateEdge + "40")
                    : colours.border
                }`,
              }}
            >
              {mode === "all"
                ? `ALL (${edges.length})`
                : mode === "templatised"
                ? `TEMPLATISED (${templatisedCount})`
                : `MAGENTIC (${magenticCount})`}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3 text-[9px]" style={{ color: colours.textMuted }}>
          <span>
            <span style={{ color: colours.templateEdge }}>---</span> templatised
          </span>
          <span>
            <span style={{ color: colours.magenticEdge }}>- - -</span> magentic
          </span>
          <span>{nodes.length} nodes</span>
          <span>{edges.length} edges</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{
          minHeight: compact ? 400 : 600,
          background: colours.bg,
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseLeave={() => setHoveredNode(null)}
        />

        {/* Hovered node tooltip */}
        {hoveredNode && (() => {
          const node = nodeMap.get(hoveredNode);
          if (!node) return null;
          const connectedEdges = edges.filter(
            (e) => e.source === hoveredNode || e.target === hoveredNode
          );
          const templ = connectedEdges.filter((e) => e.mode === "templatised").length;
          const mag = connectedEdges.filter((e) => e.mode === "magentic").length;
          return (
            <div
              className="absolute z-50 px-3 py-2 rounded-lg shadow-lg pointer-events-none"
              style={{
                ...font,
                left: node.x > 800 ? undefined : `${(node.x / 1200) * 100}%`,
                right: node.x > 800 ? `${((1200 - node.x) / 1200) * 100}%` : undefined,
                top: `${(node.y / 900) * 100 - 5}%`,
                background: theme === "dark" ? "rgba(20,20,20,0.95)" : "rgba(255,255,255,0.95)",
                border: `1px solid ${colours.border}`,
              }}
            >
              <div className="text-[11px] font-bold" style={{ color: getNodeColour(node) }}>
                {node.label}
              </div>
              <div className="text-[9px]" style={{ color: colours.textMuted }}>
                {node.type}{node.classification ? ` / ${node.classification}` : ""}
              </div>
              <div className="text-[9px] mt-1" style={{ color: colours.text }}>
                {connectedEdges.length} edges
                {templ > 0 && <span style={{ color: colours.templateEdge }}> ({templ} templ)</span>}
                {mag > 0 && <span style={{ color: colours.magenticEdge }}> ({mag} mag)</span>}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
