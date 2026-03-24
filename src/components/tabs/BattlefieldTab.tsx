"use client";

import { useEffect, useState, useCallback, useRef, useMemo, type RefObject } from "react";
import dynamic from "next/dynamic";
import { withAlpha } from "@/lib/colours";
import EventStream from "@/components/EventStream";
import ReplayControls, { type ReplayEvent } from "@/components/ReplayControls";

/* ── Types ────────────────────────────────────────────────────── */

interface RagNode {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  status: string;
  last_updated: string | null;
  related_projects?: string[];
}

interface RagEdge {
  source: string;
  target: string;
  type: string;
}

interface ExecutionLogEntry {
  operation: string;
  tool_or_service: string | null;
  created_at: string;
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
  execution_log: ExecutionLogEntry[];
}

interface HealthStatus {
  rag: "ok" | "down";
  supabase: "ok" | "down";
  timestamp: string;
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
    case "content":
    case "skill":
      return "#e879f9";
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
  if (s.includes("locked") || s.includes("disabled")) return "#ff0040";
  return "#ff0040";
}

function statusDotFromRecency(lastUpdated: string | null, status: string): string {
  if (!lastUpdated) return statusDot(status);
  const age = Date.now() - new Date(lastUpdated).getTime();
  const hours = age / (1000 * 60 * 60);
  if (hours < 1) return "#00ff41";
  if (hours < 24) return "#39ff14";
  if (hours < 168) return "#ffb800";
  return "#737373";
}

/* ── Recency-based glow intensity for living memory ───────── */

function recencyIntensity(lastUpdated: string | null): number {
  if (!lastUpdated) return 0.3;
  const age = Date.now() - new Date(lastUpdated).getTime();
  const hours = age / (1000 * 60 * 60);
  if (hours < 1) return 1.0;
  if (hours < 24) return 0.75;
  if (hours < 168) return 0.5;
  return 0.3;
}

/* ── Graph data interfaces ────────────────────────────────────── */

interface GraphNodeObj {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  status: string;
  last_updated: string | null;
  related_projects?: string[];
  colour: string;
  val: number;
  intensity: number;
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

/* ── ForceGraph3D via react-force-graph-3d (dynamic, SSR disabled) ── */

const ForceGraph3D = dynamic(
  () => import("react-force-graph-3d").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          {/* Shimmer skeleton */}
          <div className="w-48 h-2 rounded bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full w-1/3 rounded"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(0,255,65,0.3), transparent)",
                animation: "shimmer 1.5s infinite",
              }}
            />
          </div>
          <span
            className="text-[10px] text-[#00ff41] animate-pulse"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Initializing 3D globe...
          </span>
          <div className="flex gap-1 mt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-8 h-1 rounded bg-[#1a1a1a]"
                style={{
                  animation: `shimmer 1.5s infinite ${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
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
                style={{ background: statusDotFromRecency(item.last_updated, item.status) }}
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

/* ── Workflow Step Diagram ─────────────────────────────────────── */

function WorkflowDiagram({
  description,
}: {
  description: string;
}) {
  // Parse description into steps — look for numbered items or sentence fragments
  const steps = useMemo(() => {
    // Try numbered steps first: "1. Foo 2. Bar" or "Step 1: ..."
    const numberedPattern = /(?:^|\n)\s*(?:step\s*)?(\d+)[.:)\-]\s*([^\n]+)/gi;
    const matches = [...description.matchAll(numberedPattern)];
    if (matches.length >= 2) {
      return matches.map((m) => ({
        number: parseInt(m[1]),
        action: m[2].trim(),
      }));
    }
    // Fall back to splitting on sentence boundaries
    const sentences = description
      .split(/[.;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5 && s.length < 120);
    if (sentences.length >= 2) {
      return sentences.slice(0, 6).map((s, i) => ({
        number: i + 1,
        action: s,
      }));
    }
    return [];
  }, [description]);

  if (steps.length === 0) return null;

  return (
    <div>
      <div className="text-[9px] text-[#737373] tracking-wider mb-2">
        WORKFLOW STEPS ({steps.length})
      </div>
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center shrink-0">
            <div
              className="flex flex-col items-center px-3 py-2 rounded border min-w-[120px] max-w-[180px]"
              style={{
                background: "rgba(168,85,247,0.08)",
                borderColor: "rgba(168,85,247,0.25)",
              }}
            >
              <span
                className="text-[9px] font-bold mb-1"
                style={{ color: "#a855f7" }}
              >
                STEP {step.number}
              </span>
              <span className="text-[10px] text-[#d4d4d4] text-center leading-tight">
                {step.action}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center px-1 shrink-0">
                <svg width="24" height="12" viewBox="0 0 24 12">
                  <line x1="0" y1="6" x2="18" y2="6" stroke="#a855f7" strokeWidth="1.5" strokeOpacity="0.5" />
                  <polygon points="18,2 24,6 18,10" fill="#a855f7" fillOpacity="0.5" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
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
  const [viewMode, setViewMode] = useState<"operations" | "technical">("operations");

  if (!node && !loading) return null;

  // Build relationships from local graph edges (primary source — always accurate)
  const localRelationships = useMemo(() => {
    if (!node) return [];
    return edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => ({
        target: e.source === node.id ? e.target : e.source,
        type: e.type || "related_to",
        direction: e.source === node.id ? "outgoing" : "incoming",
      }));
  }, [node, edges]);

  // Use local edges as primary, fall back to API detail if local is empty
  const relationships = localRelationships.length > 0
    ? localRelationships
    : (detail?.relationships || []);

  const executionLog = detail?.execution_log || [];
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

  const isWorkflow = node?.entity_type === "workflow";

  return (
    <div
      className="shrink-0 flex flex-col transition-all duration-300 overflow-auto"
      style={{
        height: isWorkflow ? "420px" : "340px",
        maxHeight: "50vh",
        background: "rgba(10,10,10,0.97)",
        borderTop: "1px solid rgba(0,255,65,0.3)",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Header */}
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
                background: withAlpha(nodeColour(node.entity_type), 0.15),
                color: nodeColour(node.entity_type),
              }}
            >
              {node.entity_type.toUpperCase()}
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: statusDot(node.status) }}
            />
            <span className="text-[9px] text-[#737373]">{node.status}</span>
          </>
        )}

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 mr-3">
          <button
            onClick={() => setViewMode("operations")}
            className="text-[9px] px-2 py-0.5 rounded transition-colors"
            style={{
              background: viewMode === "operations" ? "rgba(0,255,65,0.15)" : "transparent",
              color: viewMode === "operations" ? "#00ff41" : "#737373",
              border: `1px solid ${viewMode === "operations" ? "rgba(0,255,65,0.3)" : "rgba(115,115,115,0.2)"}`,
            }}
          >
            OPERATIONS
          </button>
          <button
            onClick={() => setViewMode("technical")}
            className="text-[9px] px-2 py-0.5 rounded transition-colors"
            style={{
              background: viewMode === "technical" ? "rgba(0,255,65,0.15)" : "transparent",
              color: viewMode === "technical" ? "#00ff41" : "#737373",
              border: `1px solid ${viewMode === "technical" ? "rgba(0,255,65,0.3)" : "rgba(115,115,115,0.2)"}`,
            }}
          >
            TECHNICAL
          </button>
        </div>

        <button
          onClick={onClose}
          className="text-[#737373] hover:text-[#00ff41] text-sm transition-colors"
        >
          [X]
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {loading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 w-3/4 rounded bg-[#1a1a1a]" />
            <div className="h-3 w-1/2 rounded bg-[#1a1a1a]" />
            <div className="h-3 w-2/3 rounded bg-[#1a1a1a]" />
          </div>
        )}

        {/* ── OPERATIONS VIEW ── */}
        {viewMode === "operations" && !loading && (
          <>
            {/* One-sentence description */}
            {(node?.description || detail?.entity?.description) && (
              <div className="text-[11px] text-[#88cc88] leading-relaxed">
                {(detail?.entity?.description || node?.description || "").split(/[.!?]/)[0]}.
              </div>
            )}

            {/* Stats row */}
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

            {/* Health indicator */}
            {detail?.entity?.status && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#737373] tracking-wider">HEALTH</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden max-w-[200px]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: detail.entity.status === "operational" ? "100%" :
                             detail.entity.status === "beta" || detail.entity.status === "partial" ? "60%" : "20%",
                      background: statusDot(detail.entity.status),
                    }}
                  />
                </div>
                <span className="text-[9px]" style={{ color: statusDot(detail.entity.status) }}>
                  {detail.entity.status.toUpperCase()}
                </span>
              </div>
            )}

            {/* Last 5 actions from execution_log */}
            {executionLog.length > 0 && (
              <div>
                <div className="text-[9px] text-[#737373] tracking-wider mb-1">
                  RECENT ACTIONS ({executionLog.length})
                </div>
                <div className="space-y-0.5 max-h-20 overflow-y-auto">
                  {executionLog.map((log, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-1 py-0.5 text-[10px] rounded hover:bg-[#1a1a1a]"
                    >
                      <span className="text-[#404040] tabular-nums shrink-0 w-12">
                        {new Date(log.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[#00ff41] truncate flex-1">{log.operation}</span>
                      {log.tool_or_service && (
                        <span className="text-[#737373] truncate max-w-[100px]">{log.tool_or_service}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related projects as tags */}
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

            {/* Two columns: relationships + workflows */}
            <div className="grid grid-cols-2 gap-4">
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
                        <span className="text-[#00ff41] shrink-0">
                          {r.direction === "outgoing" ? "\u2192" : "\u2190"}
                        </span>
                        <span className="text-[#404040] shrink-0">{r.type}</span>
                        <span className="text-[#00b4d8] truncate flex-1">{r.target}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
          </>
        )}

        {/* ── TECHNICAL VIEW ── */}
        {viewMode === "technical" && !loading && (
          <>
            {/* Full description */}
            {(node?.description || detail?.entity?.description) && (
              <div className="text-[11px] text-[#88cc88] leading-relaxed">
                {detail?.entity?.description || node?.description}
              </div>
            )}

            {/* Entity metadata */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div>
                <span className="text-[#737373]">ID: </span>
                <span className="text-[#d4d4d4]">{node?.id}</span>
              </div>
              <div>
                <span className="text-[#737373]">TYPE: </span>
                <span style={{ color: nodeColour(node?.entity_type || "unknown") }}>
                  {node?.entity_type}
                </span>
              </div>
              <div>
                <span className="text-[#737373]">STATUS: </span>
                <span style={{ color: statusDot(node?.status || "") }}>
                  {node?.status}
                </span>
              </div>
              {detail?.entity?.last_updated && (
                <div>
                  <span className="text-[#737373]">LAST_UPDATED: </span>
                  <span className="text-[#d4d4d4]">{detail.entity.last_updated}</span>
                </div>
              )}
            </div>

            {/* Raw JSON (expandable) */}
            <details className="group">
              <summary className="text-[9px] text-[#737373] tracking-wider cursor-pointer hover:text-[#d4d4d4] transition-colors">
                RAW ENTITY JSON
              </summary>
              <pre
                className="mt-1 text-[9px] text-[#737373] bg-[#0d0d0d] border border-[#1e1e1e] rounded p-2 overflow-x-auto max-h-32 overflow-y-auto"
              >
                {JSON.stringify(detail?.entity || node, null, 2)}
              </pre>
            </details>

            {/* Relationships */}
            {relationships.length > 0 && (
              <div>
                <div className="text-[9px] text-[#737373] tracking-wider mb-1">
                  RELATIONSHIPS ({relationships.length})
                </div>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {relationships.map((r, i) => (
                    <button
                      key={`${r.target}-${r.type}-${i}`}
                      onClick={() => onNavigate(r.target)}
                      className="w-full text-left flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[#1a1a1a] transition-colors text-[10px]"
                    >
                      <span className="text-[#00ff41] shrink-0">
                        {r.direction === "outgoing" ? "\u2192" : "\u2190"}
                      </span>
                      <span className="text-[#404040] shrink-0">{r.type}</span>
                      <span className="text-[#00b4d8] truncate">{r.target}</span>
                      <span className="text-[#333] shrink-0">{r.direction}</span>
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
                <div className="space-y-0.5">
                  {relatedWorkflows.map((w) => (
                    <button
                      key={w}
                      onClick={() => onNavigate(w)}
                      className="w-full text-left px-1 py-0.5 rounded hover:bg-[#1a1a1a] transition-colors text-[10px] text-[#a855f7]"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Workflow step diagram (both views, if workflow entity) ── */}
        {isWorkflow && (detail?.entity?.description || node?.description) && (
          <WorkflowDiagram description={detail?.entity?.description || node?.description || ""} />
        )}
      </div>
    </div>
  );
}

/* ── Metric with tooltip ──────────────────────────────────────── */

function MetricBadge({
  label,
  value,
  colour,
  tooltip,
}: {
  label: string;
  value: number | string;
  colour: string;
  tooltip: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="flex items-center gap-1.5 relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-[9px] text-text-muted tracking-wider">{label}</span>
      <span className="text-sm font-bold tabular-nums" style={{ color: colour }}>
        {value}
      </span>
      {showTooltip && (
        <div
          className="absolute top-full left-0 mt-1 px-2 py-1 rounded text-[9px] whitespace-nowrap z-50"
          style={{
            background: "rgba(20,20,20,0.95)",
            border: "1px solid rgba(0,255,65,0.2)",
            color: "#737373",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

/* ── Container size hook ────────────────────────────────────── */

function useContainerSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setSize({ width: Math.round(width), height: Math.round(height) });
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

/* ── Edge category helpers ──────────────────────────────────── */

type EdgeCategory = "structural" | "integration" | "execution";

const EDGE_CATEGORIES: Record<EdgeCategory, { label: string; types: Set<string>; colour: string }> = {
  structural: {
    label: "Structural",
    types: new Set(["depends_on", "part_of", "maintained_by", "orchestrates", "orchestrated_by", "manages", "managed_by"]),
    colour: "#00ff41",
  },
  integration: {
    label: "Integration",
    types: new Set(["integrates_with", "deployed_on", "related_to"]),
    colour: "#00b4d8",
  },
  execution: {
    label: "Execution",
    types: new Set(["used_by", "uses", "maintains", "triggers"]),
    colour: "#a855f7",
  },
};

function edgeCategory(type: string): EdgeCategory {
  for (const [cat, def] of Object.entries(EDGE_CATEGORIES) as [EdgeCategory, typeof EDGE_CATEGORIES[EdgeCategory]][]) {
    if (def.types.has(type)) return cat;
  }
  return "structural"; // default
}

/* ── Node Filter Bar ──────────────────────────────────────────── */

interface NodeFilterState {
  agent: boolean;
  service: boolean;
  workflow: boolean;
  skill: boolean;
  brief: boolean;
}

function NodeFilterBar({
  filters,
  onChange,
  counts,
}: {
  filters: NodeFilterState;
  onChange: (key: keyof NodeFilterState) => void;
  counts: Record<string, number>;
}) {
  const items: { key: keyof NodeFilterState; label: string; colour: string }[] = [
    { key: "agent", label: "Agents", colour: "#00ff41" },
    { key: "service", label: "Services", colour: "#00b4d8" },
    { key: "workflow", label: "Workflows", colour: "#a855f7" },
    { key: "skill", label: "Skills", colour: "#e879f9" },
    { key: "brief", label: "Briefs", colour: "#ffb800" },
  ];

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 border-b border-[#1e1e1e]"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <span className="text-[9px] text-[#737373] tracking-wider mr-1">NODES</span>
      {items.map((item) => (
        <label
          key={item.key}
          className="flex items-center gap-1 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={filters[item.key]}
            onChange={() => onChange(item.key)}
            className="sr-only"
          />
          <span
            className="w-3 h-3 rounded-sm border flex items-center justify-center text-[8px]"
            style={{
              borderColor: filters[item.key] ? item.colour : "#404040",
              background: filters[item.key] ? `${item.colour}22` : "transparent",
              color: filters[item.key] ? item.colour : "#404040",
            }}
          >
            {filters[item.key] ? "\u2713" : ""}
          </span>
          <span
            className="text-[9px]"
            style={{ color: filters[item.key] ? item.colour : "#737373" }}
          >
            {item.label} ({counts[item.key] || 0})
          </span>
        </label>
      ))}
    </div>
  );
}

/* ── Edge Filter Bar ─────────────────────────────────────────── */

interface EdgeFilterState {
  structural: boolean;
  integration: boolean;
  execution: boolean;
}

function EdgeFilterBar({
  filters,
  onChange,
  counts,
}: {
  filters: EdgeFilterState;
  onChange: (key: keyof EdgeFilterState) => void;
  counts: Record<string, number>;
}) {
  const items: { key: keyof EdgeFilterState; label: string; colour: string; desc: string }[] = [
    { key: "structural", label: "Structural", colour: "#00ff41", desc: "depends_on, part_of, maintained_by" },
    { key: "integration", label: "Integration", colour: "#00b4d8", desc: "integrates_with, deployed_on" },
    { key: "execution", label: "Execution", colour: "#a855f7", desc: "used_by, maintains, triggers" },
  ];

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 border-b border-[#1e1e1e]"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <span className="text-[9px] text-[#737373] tracking-wider mr-1">EDGES</span>
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className="text-[9px] px-2 py-0.5 rounded-full transition-all"
          title={item.desc}
          style={{
            background: filters[item.key] ? `${item.colour}20` : "transparent",
            color: filters[item.key] ? item.colour : "#404040",
            border: `1px solid ${filters[item.key] ? `${item.colour}50` : "#1e1e1e"}`,
          }}
        >
          {item.label} ({counts[item.key] || 0})
        </button>
      ))}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function BattlefieldTab() {
  const [nodes, setNodes] = useState<RagNode[]>([]);
  const [edges, setEdges] = useState<RagEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTimestamp, setFetchTimestamp] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [filterText, setFilterText] = useState("");

  // Fix 1: Node type filters — agents/services/workflows on by default, skills/briefs off
  const [nodeFilters, setNodeFilters] = useState<NodeFilterState>({
    agent: true,
    service: true,
    workflow: true,
    skill: false,
    brief: false,
  });

  // Fix 2: Edge layer filters — all on by default
  const [edgeFilters, setEdgeFilters] = useState<EdgeFilterState>({
    structural: true,
    integration: true,
    execution: true,
  });

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [reloading, setReloading] = useState(false);

  // Replay state
  const [replayActiveNodes, setReplayActiveNodes] = useState<Set<string>>(new Set());
  const replayTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasSize = useContainerSize(canvasContainerRef);

  // Fetch health status
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data: HealthStatus = await res.json();
        setHealth(data);
      }
    } catch {
      setHealth({ rag: "down", supabase: "down", timestamp: new Date().toISOString() });
    }
  }, []);

  // Fetch graph data from API route — request all types so we have full counts
  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/graph?types=agent,service,workflow,skill,content");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const rawNodes: RagNode[] = (data.nodes || []).map((n: RagNode) => ({
        ...n,
        last_updated: n.last_updated || null,
      }));
      const rawEdges: RagEdge[] = data.edges || data.links || [];

      setNodes(rawNodes);
      setEdges(rawEdges);
      setLoading(false);
      setError(null);
      setFetchTimestamp(new Date().toISOString());
    } catch (err) {
      console.error("Failed to fetch graph:", err);
      setError(String(err));
      setLoading(false);
    }
  }, []);

  // Reload button handler
  const handleReload = useCallback(async () => {
    setReloading(true);
    await Promise.all([fetchGraph(), fetchHealth()]);
    setReloading(false);
  }, [fetchGraph, fetchHealth]);

  // Replay agent/service resolution
  const resolveAgent = useCallback((agentName: string, resolvedAgent: string | null): string => {
    const known = ["SOVEREIGN","FORGE","KIRA","LORE","SAGE","VERIFY","RECON","ARAGON","DELIVER","PRISM","SCRIBE","COMPASS","ATLAS","PULSE","OUTREACH"];
    if (known.includes(agentName)) return agentName;
    if (resolvedAgent) return resolvedAgent;
    return "SOVEREIGN";
  }, []);

  const resolveService = useCallback((tool: string | null): string | null => {
    if (!tool) return null;
    if (tool.includes("Supabase")) return "Supabase";
    if (tool.includes("rag_system") || tool.includes("Claude_Web_MCP")) return "RAG-System";
    if (tool.includes("Vercel")) return "Vercel";
    return null;
  }, []);

  // Replay event handler — highlight agent + service nodes for 2s
  const handleReplayEvent = useCallback((event: ReplayEvent, resolvedAgentFromApi: string | null) => {
    const agentNode = resolveAgent(event.agent, resolvedAgentFromApi);
    const serviceNode = resolveService(event.tool_or_service);
    const targetNode = event.target_agent || null;

    setReplayActiveNodes((prev) => {
      const next = new Set(prev);
      next.add(agentNode);
      if (targetNode) next.add(targetNode);
      if (serviceNode) next.add(serviceNode);
      return next;
    });
    const clearNode = (nodeId: string) => {
      const existing = replayTimeoutsRef.current.get(nodeId);
      if (existing) clearTimeout(existing);
      const timeout = setTimeout(() => {
        setReplayActiveNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        replayTimeoutsRef.current.delete(nodeId);
      }, 2000);
      replayTimeoutsRef.current.set(nodeId, timeout);
    };
    clearNode(agentNode);
    if (targetNode) clearNode(targetNode);
    if (serviceNode) clearNode(serviceNode);
  }, [resolveAgent, resolveService]);

  const handleReplayReset = useCallback(() => {
    replayTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    replayTimeoutsRef.current.clear();
    setReplayActiveNodes(new Set());
  }, []);

  // Fetch detail for selected node (lazy-load on click)
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
      setShowDetail(true);
      fetchDetail(id);

      // Zoom camera to clicked node if it has coordinates
      if (graphRef.current && typeof nodeOrId === "object" && nodeOrId.x !== undefined) {
        const node = nodeOrId;
        const distance = 200;
        const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
        graphRef.current.cameraPosition(
          {
            x: (node.x || 0) * distRatio,
            y: (node.y || 0) * distRatio,
            z: (node.z || 0) * distRatio,
          },
          { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
          1000
        );
      }
    },
    [fetchDetail]
  );

  // Handle registry click — find node in graph data and zoom
  const handleRegistryClick = useCallback(
    (id: string) => {
      setSelectedId(id);
      setShowDetail(true);
      fetchDetail(id);

      // Try to zoom to this node in the 3D graph
      if (graphRef.current) {
        const data = graphRef.current.graphData();
        const node = (data.nodes as GraphNodeObj[]).find((n: GraphNodeObj) => n.id === id);
        if (node && node.x !== undefined) {
          const distance = 200;
          const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
          graphRef.current.cameraPosition(
            {
              x: (node.x || 0) * distRatio,
              y: (node.y || 0) * distRatio,
              z: (node.z || 0) * distRatio,
            },
            { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
            1000
          );
        }
      }
    },
    [fetchDetail]
  );

  // Handle navigating to a related node from the detail card
  const handleNavigate = useCallback(
    (name: string) => {
      setSelectedId(name);
      setShowDetail(true);
      fetchDetail(name);
    },
    [fetchDetail]
  );

  // Configure d3 forces after graph mounts (CP3: spread nodes, centre them)
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || loading || nodes.length === 0) return;

    // Stronger repulsion so nodes spread out
    fg.d3Force("charge")?.strength(-120).distanceMax(500);
    // Keep cluster centred in canvas
    fg.d3Force("center")?.strength(1);
    // Consistent link distance
    fg.d3Force("link")?.distance(80);
    // Re-heat to apply new force parameters
    fg.d3ReheatSimulation();
  }, [loading, nodes.length]);

  // Initial fetch + polling
  useEffect(() => {
    fetchGraph();
    fetchHealth();
    const graphInterval = setInterval(fetchGraph, 60000);
    const healthInterval = setInterval(fetchHealth, 30000);
    return () => {
      clearInterval(graphInterval);
      clearInterval(healthInterval);
    };
  }, [fetchGraph, fetchHealth]);

  // Compute edge counts per node
  const edgeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of edges) {
      counts.set(e.source, (counts.get(e.source) || 0) + 1);
      counts.set(e.target, (counts.get(e.target) || 0) + 1);
    }
    return counts;
  }, [edges]);

  // Map entity_type to our filter keys
  const typeToFilterKey = useCallback((entityType: string): keyof NodeFilterState | null => {
    if (entityType === "agent") return "agent";
    if (entityType === "service") return "service";
    if (entityType === "workflow") return "workflow";
    if (entityType === "skill" || entityType === "content") return "skill";
    return null;
  }, []);

  // Filtered nodes based on node type toggles (Fix 1)
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const key = typeToFilterKey(n.entity_type);
      if (!key) return nodeFilters.agent; // show unknowns if agents are shown
      return nodeFilters[key];
    });
  }, [nodes, nodeFilters, typeToFilterKey]);

  // Filtered edges based on edge type toggles (Fix 2)
  const filteredEdges = useMemo(() => {
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => {
      if (!filteredNodeIds.has(e.source) || !filteredNodeIds.has(e.target)) return false;
      const cat = edgeCategory(e.type);
      return edgeFilters[cat];
    });
  }, [edges, filteredNodes, edgeFilters]);

  // Counts for filter bars
  const nodeFilterCounts = useMemo(() => ({
    agent: nodes.filter((n) => n.entity_type === "agent").length,
    service: nodes.filter((n) => n.entity_type === "service").length,
    workflow: nodes.filter((n) => n.entity_type === "workflow").length,
    skill: nodes.filter((n) => n.entity_type === "skill" || n.entity_type === "content").length,
    brief: 0,
  }), [nodes]);

  const edgeFilterCounts = useMemo(() => {
    const counts = { structural: 0, integration: 0, execution: 0 };
    for (const e of edges) {
      const cat = edgeCategory(e.type);
      counts[cat]++;
    }
    return counts;
  }, [edges]);

  // Build graph data for react-force-graph-3d
  const graphData: GraphData = useMemo(() => {
    const graphNodes: GraphNodeObj[] = filteredNodes.map((n) => {
      const intensity = recencyIntensity(n.last_updated);
      const ec = edgeCounts.get(n.id) || 0;
      // nodeVal scales with edge count: SOVEREIGN (most edges) is the largest
      const val = Math.max(2, ec * 1.5);
      return {
        ...n,
        colour: n.entity_type === "gap" ? "#ff0040" :
                n.status?.toLowerCase().includes("locked") ? "#404040" :
                nodeColour(n.entity_type),
        val,
        intensity,
      };
    });

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const graphLinks: GraphLinkObj[] = filteredEdges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ ...e }));

    return { nodes: graphNodes, links: graphLinks };
  }, [filteredNodes, filteredEdges, edgeCounts]);

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
      skills: filtered.filter((n) => n.entity_type === "skill"),
      workflows: filtered.filter((n) => n.entity_type === "workflow"),
      content: filtered.filter((n) => n.entity_type === "content"),
      gaps: filtered.filter((n) => n.entity_type === "gap"),
      other: filtered.filter(
        (n) => !["agent", "service", "tool", "skill", "workflow", "content", "gap"].includes(n.entity_type)
      ),
    };
  }, [nodes, filterText]);

  // Counts for metrics bar (full, not filtered)
  const agentCount = nodes.filter((n) => n.entity_type === "agent").length;
  const serviceCount = nodes.filter((n) => n.entity_type === "service").length;
  const skillCount = nodes.filter((n) => n.entity_type === "skill").length;
  const workflowCount = nodes.filter((n) => n.entity_type === "workflow").length;
  const edgeCount = filteredEdges.length;

  const selectedNode = nodes.find((n) => n.id === selectedId) || null;

  const healthDotColour = !health ? "#737373" :
    (health.rag === "ok" && health.supabase === "ok") ? "#00ff41" :
    (health.rag === "ok" || health.supabase === "ok") ? "#ffb800" : "#ff0040";

  const isRagDown = health?.rag === "down" && !loading && nodes.length === 0;

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
            placeholder="Filter entities..."
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
              onSelect={handleRegistryClick}
            />
          )}
          {groupedNodes.services.length > 0 && (
            <RegistrySection
              title="SERVICES"
              colour="#00b4d8"
              items={groupedNodes.services}
              selectedId={selectedId}
              onSelect={handleRegistryClick}
            />
          )}
          {groupedNodes.tools.length > 0 && (
            <RegistrySection
              title="TOOLS"
              colour="#ffd60a"
              items={groupedNodes.tools}
              selectedId={selectedId}
              onSelect={handleRegistryClick}
            />
          )}
          {groupedNodes.skills.length > 0 && (
            <RegistrySection
              title="SKILLS"
              colour="#e879f9"
              items={groupedNodes.skills}
              selectedId={selectedId}
              onSelect={handleRegistryClick}
            />
          )}
          {groupedNodes.workflows.length > 0 && (
            <RegistrySection
              title="WORKFLOWS"
              colour="#a855f7"
              items={groupedNodes.workflows}
              selectedId={selectedId}
              onSelect={handleRegistryClick}
            />
          )}
          {groupedNodes.content.length > 0 && (
            <RegistrySection
              title="CONTENT"
              colour="#e879f9"
              items={groupedNodes.content}
              selectedId={selectedId}
              onSelect={handleRegistryClick}
            />
          )}
          {groupedNodes.gaps.length > 0 && (
            <RegistrySection
              title="GAPS"
              colour="#ff0040"
              items={groupedNodes.gaps}
              selectedId={selectedId}
              onSelect={handleRegistryClick}
            />
          )}
          {groupedNodes.other.length > 0 && (
            <RegistrySection
              title="OTHER"
              colour="#737373"
              items={groupedNodes.other}
              selectedId={selectedId}
              onSelect={handleRegistryClick}
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
        <div
          className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-5"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {/* Health dot */}
          <div className="flex items-center gap-1.5 relative group">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                background: healthDotColour,
                boxShadow: `0 0 6px ${healthDotColour}`,
              }}
            />
            <span className="text-[9px] text-text-muted">SYS</span>
            {/* Tooltip */}
            <div
              className="absolute top-full left-0 mt-1 px-2 py-1 rounded text-[9px] whitespace-nowrap z-50 hidden group-hover:block"
              style={{
                background: "rgba(20,20,20,0.95)",
                border: "1px solid rgba(0,255,65,0.2)",
                color: "#737373",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              RAG: {health?.rag || "unknown"} | Supabase: {health?.supabase || "unknown"}
              {health?.timestamp && (
                <span className="ml-2 text-[#404040]">
                  @ {new Date(health.timestamp).toLocaleTimeString("en-GB")}
                </span>
              )}
            </div>
          </div>

          <MetricBadge
            label="AGENTS"
            value={agentCount}
            colour="#00ff41"
            tooltip={`memory_search_entities(agent) | ${fetchTimestamp ? new Date(fetchTimestamp).toLocaleTimeString("en-GB") : "..."}`}
          />
          <MetricBadge
            label="SERVICES"
            value={serviceCount}
            colour="#00b4d8"
            tooltip={`memory_search_entities(service) | ${fetchTimestamp ? new Date(fetchTimestamp).toLocaleTimeString("en-GB") : "..."}`}
          />
          <MetricBadge
            label="SKILLS"
            value={skillCount}
            colour="#e879f9"
            tooltip={`memory_search_entities(skill) | ${fetchTimestamp ? new Date(fetchTimestamp).toLocaleTimeString("en-GB") : "..."}`}
          />
          <MetricBadge
            label="WORKFLOWS"
            value={workflowCount}
            colour="#a855f7"
            tooltip={`memory_search_entities(workflow) | ${fetchTimestamp ? new Date(fetchTimestamp).toLocaleTimeString("en-GB") : "..."}`}
          />
          <MetricBadge
            label="EDGES"
            value={edgeCount}
            colour="#ffd60a"
            tooltip={`rag_traverse(SOVEREIGN+RAG+Supabase) | ${fetchTimestamp ? new Date(fetchTimestamp).toLocaleTimeString("en-GB") : "..."}`}
          />

          {/* Legend */}
          <div className="ml-auto flex items-center gap-3">
            {[
              { label: "Agent", colour: "#00ff41" },
              { label: "Service", colour: "#00b4d8" },
              { label: "Tool", colour: "#ffd60a" },
              { label: "Skill", colour: "#e879f9" },
              { label: "Workflow", colour: "#a855f7" },
              { label: "Content", colour: "#e879f9" },
              { label: "Gap", colour: "#ff0040" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: l.colour }} />
                <span className="text-[9px] text-[#737373]">{l.label}</span>
              </div>
            ))}
          </div>

          {/* Reload button */}
          <button
            onClick={handleReload}
            disabled={reloading}
            className="ml-2 px-2 py-0.5 rounded text-[9px] transition-all hover:bg-[#1a1a1a]"
            style={{
              color: reloading ? "#404040" : "#00ff41",
              border: "1px solid rgba(0,255,65,0.2)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {reloading ? "..." : "RELOAD"}
          </button>
        </div>

        {/* Fix 1: Node type filter bar */}
        <NodeFilterBar
          filters={nodeFilters}
          onChange={(key) => setNodeFilters((prev) => ({ ...prev, [key]: !prev[key] }))}
          counts={nodeFilterCounts}
        />

        {/* Fix 2: Edge layer filter bar */}
        <EdgeFilterBar
          filters={edgeFilters}
          onChange={(key) => setEdgeFilters((prev) => ({ ...prev, [key]: !prev[key] }))}
          counts={edgeFilterCounts}
        />

        {/* Replay Controls */}
        <ReplayControls onEventFire={handleReplayEvent} onReset={handleReplayReset} />

        {/* 3D Globe */}
        <div ref={canvasContainerRef} className="flex-1 relative" style={{ background: "#0a0a0a" }}>
          {/* CRT scanline overlay */}
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, rgba(0,255,65,0.03) 0px, transparent 1px, transparent 2px)",
              backgroundSize: "100% 2px",
            }}
          />

          {!loading && nodes.length > 0 && (
            <ForceGraph3D
              ref={graphRef}
              graphData={graphData}
              width={canvasSize.width}
              height={canvasSize.height}
              backgroundColor="#0a0a0a"
              showNavInfo={false}
              nodeId="id"
              nodeColor={(node: object) => {
                const n = node as GraphNodeObj;
                // Replay highlight — pulsing bright green
                if (replayActiveNodes.has(n.id) || replayActiveNodes.has(n.name)) return "#00ff41";
                if (highlightNodes.size === 0) return n.colour || "#737373";
                return highlightNodes.has(n.id) ? (n.colour || "#737373") : withAlpha(n.colour || "#737373", 0.15);
              }}
              nodeVal={(node: object) => (node as GraphNodeObj).val || 1}
              nodeLabel={(node: object) => {
                const n = node as GraphNodeObj;
                return `${n.name} (${n.entity_type})`;
              }}
              nodeOpacity={0.9}
              nodeRelSize={4}
              nodeThreeObject={(node: object) => {
                const n = node as GraphNodeObj;
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const SpriteText = require("three-spritetext").default;
                const sprite = new SpriteText(n.name);
                sprite.color = n.colour || "#737373";
                sprite.textHeight = 2 + (n.val / 12) * 2;
                sprite.backgroundColor = "rgba(0,0,0,0.6)";
                sprite.padding = 1;
                sprite.borderRadius = 2;
                return sprite;
              }}
              nodeThreeObjectExtend={true}
              /* ── Force simulation tuning (CP3) ── */
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              warmupTicks={100}
              cooldownTicks={300}
              linkColor={() => "rgba(0,255,65,0.15)"}
              linkWidth={1}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              linkOpacity={0.4}
              linkDirectionalParticles={(link: object) => {
                const l = link as GraphLinkObj;
                const sourceId = typeof l.source === "string" ? l.source : l.source?.id;
                const targetId = typeof l.target === "string" ? l.target : l.target?.id;
                if (sourceId && highlightNodes.has(sourceId) && targetId && highlightNodes.has(targetId)) return 2;
                return 0;
              }}
              linkDirectionalParticleSpeed={0.005}
              onNodeClick={(node: object) => handleNodeClick(node as GraphNodeObj)}
              onBackgroundClick={() => {
                setSelectedId(null);
                setDetail(null);
                setShowDetail(false);
              }}
            />
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-48 h-2 rounded bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full w-1/3 rounded"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(0,255,65,0.3), transparent)",
                      animation: "shimmer 1.5s infinite",
                    }}
                  />
                </div>
                <span
                  className="text-[10px] text-[#00ff41] animate-pulse"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Fetching graph from RAG...
                </span>
                {/* Skeleton nodes */}
                <div className="flex gap-2 mt-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-[#1a1a1a]"
                      style={{
                        animation: `pulse-dot 1.5s ease-in-out infinite ${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Reload spinner overlay */}
          {reloading && !loading && (
            <div className="absolute top-2 right-2 z-30">
              <span
                className="text-[10px] text-[#00ff41] animate-pulse px-2 py-1 rounded"
                style={{
                  background: "rgba(0,0,0,0.8)",
                  border: "1px solid rgba(0,255,65,0.3)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Reloading...
              </span>
            </div>
          )}

          {/* Error state: RAG down */}
          {isRagDown && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div
                className="flex flex-col items-center gap-3 p-6 rounded-lg"
                style={{
                  background: "rgba(255,0,0,0.05)",
                  border: "1px solid rgba(255,0,64,0.3)",
                }}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    background: "#ff0040",
                    boxShadow: "0 0 20px rgba(255,0,64,0.5)",
                    animation: "pulse-dot 1s ease-in-out infinite",
                  }}
                />
                <span
                  className="text-sm font-bold text-[#ff0040]"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  SYSTEM OFFLINE
                </span>
                <span
                  className="text-[10px] text-[#ff1744]"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  RAG endpoint unreachable
                </span>
                {error && (
                  <span
                    className="text-[9px] text-[#737373] max-w-[300px] text-center"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {error}
                  </span>
                )}
                <button
                  onClick={handleReload}
                  className="mt-2 px-3 py-1 rounded text-[10px] text-[#ff0040] border border-[#ff0040]/30 hover:bg-[#ff0040]/10 transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  RETRY
                </button>
              </div>
            </div>
          )}

          {/* Non-fatal error with data */}
          {error && !loading && nodes.length > 0 && (
            <div className="absolute top-2 left-2 z-20">
              <span
                className="text-[9px] text-[#ffb800] px-2 py-1 rounded"
                style={{
                  background: "rgba(0,0,0,0.8)",
                  border: "1px solid rgba(255,184,0,0.3)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Partial data — {error}
              </span>
            </div>
          )}

        </div>

        {/* Detail Card (below the canvas — flexbox sibling so canvas resizes) */}
        {selectedId && showDetail && (
          <DetailCard
            node={selectedNode}
            detail={detail}
            loading={detailLoading}
            edges={edges}
            nodes={nodes}
            onClose={() => {
              setShowDetail(false);
              setDetail(null);
            }}
            onNavigate={handleNavigate}
          />
        )}
      </div>

      {/* RIGHT PANE: Event Stream */}
      <div
        className="w-[280px] shrink-0 flex flex-col h-full overflow-hidden"
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
