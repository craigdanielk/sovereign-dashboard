"use client";

import { useEffect, useState, useCallback, useRef, useMemo, type RefObject } from "react";
import dynamic from "next/dynamic";
import { withAlpha } from "@/lib/colours";
import EventStream from "@/components/EventStream";
import ReplayControls, { type ReplayEvent, type ServicePulse } from "@/components/ReplayControls";
import NavigationTree, { type ViewMode } from "@/components/battlefield/NavigationTree";
import WorkflowMatrix from "@/components/shared/WorkflowMatrix";
import type { CatalogueEntry } from "@/lib/catalogue";

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
  catalogue_page: CatalogueEntry | null;
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

function catalogueStatusColour(status: string): string {
  const s = (status || "").toUpperCase();
  if (s === "WORKING") return "#00ff41";
  if (s === "BROKEN") return "#ff0040";
  if (s === "CONFIGURED" || s === "PARTIAL") return "#ffb800";
  return "#737373";
}

function renderMarkdownText(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
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

            {/* ── Catalogue page data ── */}
            {detail?.catalogue_page ? (
              <div
                className="rounded p-2 space-y-2"
                style={{ background: "rgba(0,180,216,0.05)", border: "1px solid rgba(0,180,216,0.2)" }}
              >
                {/* Header: label + category + status + version + brief_id */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] text-[#00b4d8] tracking-wider font-bold">FRACTALOS CATALOGUE</span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(0,180,216,0.15)", color: "#00b4d8" }}
                  >
                    {detail.catalogue_page.category}
                  </span>
                  {/* Operational status — color-coded */}
                  <span
                    className="text-[9px] font-bold flex items-center gap-0.5"
                    style={{ color: catalogueStatusColour(detail.catalogue_page.operational_status) }}
                  >
                    ●&nbsp;{detail.catalogue_page.operational_status}
                  </span>
                  {detail.catalogue_page.version && detail.catalogue_page.version !== "unknown" && (
                    <span className="text-[9px] text-[#404040]">v{detail.catalogue_page.version}</span>
                  )}
                  {detail.catalogue_page.brief_id && (
                    <span className="text-[9px] text-[#404040]">BRIEF #{detail.catalogue_page.brief_id}</span>
                  )}
                </div>

                {/* Metadata table: display_name row */}
                {detail.catalogue_page.display_name && detail.catalogue_page.display_name !== detail.catalogue_page.name && (
                  <div className="text-[9px]">
                    <span className="text-[#737373]">DISPLAY_NAME: </span>
                    <span className="text-[#d4d4d4]">{detail.catalogue_page.display_name}</span>
                  </div>
                )}

                {/* Role description */}
                {detail.catalogue_page.role_description && (
                  <div className="text-[10px] text-[#88cc88] leading-relaxed">
                    {detail.catalogue_page.role_description}
                  </div>
                )}

                {/* Completeness bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[#737373] shrink-0 w-24">COMPLETENESS</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${detail.catalogue_page.completeness_score}%`,
                        background: detail.catalogue_page.completeness_score >= 80
                          ? "#00ff41"
                          : detail.catalogue_page.completeness_score >= 50
                          ? "#ffb800"
                          : "#ff0040",
                      }}
                    />
                  </div>
                  <span
                    className="text-[9px] font-bold tabular-nums"
                    style={{
                      color: detail.catalogue_page.completeness_score >= 80
                        ? "#00ff41"
                        : detail.catalogue_page.completeness_score >= 50
                        ? "#ffb800"
                        : "#ff0040",
                    }}
                  >
                    {detail.catalogue_page.completeness_score}%
                  </span>
                  {detail.catalogue_page.has_gaps && (
                    <span className="text-[9px] text-[#ff0040]">[{detail.catalogue_page.gap_count} GAPs]</span>
                  )}
                </div>

                {/* Body preview — markdown stripped to plain text */}
                {detail.catalogue_page.body_preview && (
                  <pre
                    className="text-[9px] text-[#737373] leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap rounded p-1.5"
                    style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {renderMarkdownText(detail.catalogue_page.body_preview)}
                  </pre>
                )}

                {/* Source files */}
                {detail.catalogue_page.source_files.length > 0 && (
                  <div>
                    <span className="text-[9px] text-[#737373] tracking-wider">SOURCE_FILES </span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {detail.catalogue_page.source_files.map((f) => (
                        <span
                          key={f}
                          className="text-[9px] px-1 py-0.5 rounded"
                          style={{ background: "rgba(0,255,65,0.08)", color: "#88cc88", fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {(detail.catalogue_page.dependencies_agents.length > 0 ||
                  detail.catalogue_page.dependencies_services.length > 0 ||
                  detail.catalogue_page.dependencies_skills.length > 0) && (
                  <div className="flex flex-wrap gap-3 text-[9px]">
                    {detail.catalogue_page.dependencies_agents.length > 0 && (
                      <div>
                        <span className="text-[#737373]">AGENTS: </span>
                        <span className="text-[#00ff41]">{detail.catalogue_page.dependencies_agents.join(", ")}</span>
                      </div>
                    )}
                    {detail.catalogue_page.dependencies_services.length > 0 && (
                      <div>
                        <span className="text-[#737373]">SERVICES: </span>
                        <span className="text-[#00b4d8]">{detail.catalogue_page.dependencies_services.join(", ")}</span>
                      </div>
                    )}
                    {detail.catalogue_page.dependencies_skills.length > 0 && (
                      <div>
                        <span className="text-[#737373]">SKILLS: </span>
                        <span className="text-[#e879f9]">{detail.catalogue_page.dependencies_skills.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : detail && !loading && (
              /* Fallback: node has no catalogue page — show RAG entity metadata */
              <div
                className="rounded p-2 space-y-1.5"
                style={{ background: "rgba(115,115,115,0.05)", border: "1px solid rgba(115,115,115,0.15)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[#737373] tracking-wider font-bold">RAG ENTITY</span>
                  <span className="text-[9px] text-[#404040]">no catalogue page</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px]">
                  <div>
                    <span className="text-[#737373]">TYPE: </span>
                    <span className="text-[#d4d4d4]">{detail.entity.type}</span>
                  </div>
                  <div>
                    <span className="text-[#737373]">STATUS: </span>
                    <span style={{ color: statusDot(detail.entity.status) }}>{detail.entity.status}</span>
                  </div>
                  {detail.entity.last_updated && (
                    <div className="col-span-2">
                      <span className="text-[#737373]">UPDATED: </span>
                      <span className="text-[#d4d4d4]">{detail.entity.last_updated}</span>
                    </div>
                  )}
                </div>
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

/* ── Status colour for catalogue entries ──────────────────────── */

function catStatusColour(status: string): string {
  const s = (status || "").toUpperCase();
  if (s === "WORKING") return "#00ff41";
  if (s === "CONFIGURED") return "#00b4d8";
  if (s === "PARTIAL") return "#ffb800";
  if (s === "BROKEN") return "#ff0040";
  return "#737373";
}

/* ── Taxonomy Overview Panel ─────────────────────────────────── */

interface TaxonomyOverviewData {
  total: number;
  categories: Record<string, number>;
  status_counts: Record<string, number>;
  working_pct: number;
  avg_completeness: number;
  with_gaps: number;
  generated_at: string;
}

interface CategoryStat {
  category: string;
  total: number;
  working: number;
  configured: number;
  broken: number;
  partial: number;
  avg_completeness: number;
}

function TaxonomyOverviewPanel({ onSelectCategory }: { onSelectCategory: (cat: string) => void }) {
  const [overview, setOverview] = useState<TaxonomyOverviewData | null>(null);
  const [stats, setStats] = useState<CategoryStat[]>([]);

  useEffect(() => {
    fetch("/api/catalogue")
      .then((r) => r.json())
      .then((d) => {
        setOverview(d.overview);
        setStats(d.stats || []);
      })
      .catch(() => {});
  }, []);

  if (!overview) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[10px] text-[#737373] animate-pulse" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Loading taxonomy...
        </span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-[#00b4d8]">FRACTALOS CATALOGUE</span>
        <span className="text-[9px] text-[#737373]">generated {overview.generated_at}</span>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "COMPONENTS", value: overview.total, colour: "#d4d4d4" },
          { label: "WORKING", value: `${overview.working_pct}%`, colour: "#00ff41" },
          { label: "AVG COMPLETENESS", value: `${overview.avg_completeness}%`, colour: "#ffb800" },
          { label: "WITH GAPS", value: overview.with_gaps, colour: "#ff0040" },
        ].map((m) => (
          <div
            key={m.label}
            className="p-2 rounded"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-[9px] text-[#737373] tracking-wider">{m.label}</div>
            <div className="text-lg font-bold mt-0.5" style={{ color: m.colour }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div>
        <div className="text-[9px] text-[#737373] tracking-wider mb-2">STATUS DISTRIBUTION</div>
        <div className="flex gap-3">
          {Object.entries(overview.status_counts).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: catStatusColour(status) }} />
              <span className="text-[10px]" style={{ color: catStatusColour(status) }}>{status}</span>
              <span className="text-[10px] text-[#737373]">({count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category grid */}
      <div>
        <div className="text-[9px] text-[#737373] tracking-wider mb-2">CATEGORIES ({stats.length})</div>
        <div className="grid grid-cols-2 gap-2">
          {stats.map((cat) => (
            <button
              key={cat.category}
              onClick={() => onSelectCategory(cat.category)}
              className="text-left p-2 rounded transition-colors hover:bg-[#1a2a1a]"
              style={{ background: "rgba(0,180,216,0.04)", border: "1px solid rgba(0,180,216,0.15)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[#00b4d8]">{cat.category.replace(/_/g, " ")}</span>
                <span className="text-[10px] text-[#737373]">{cat.total}</span>
              </div>
              {/* mini status bar */}
              <div className="flex gap-0.5 h-1 rounded overflow-hidden mb-1">
                {cat.working > 0 && (
                  <div style={{ width: `${(cat.working / cat.total) * 100}%`, background: "#00ff41" }} />
                )}
                {cat.configured > 0 && (
                  <div style={{ width: `${(cat.configured / cat.total) * 100}%`, background: "#00b4d8" }} />
                )}
                {cat.partial > 0 && (
                  <div style={{ width: `${(cat.partial / cat.total) * 100}%`, background: "#ffb800" }} />
                )}
                {cat.broken > 0 && (
                  <div style={{ width: `${(cat.broken / cat.total) * 100}%`, background: "#ff0040" }} />
                )}
              </div>
              <div className="flex gap-2 text-[8px] text-[#737373]">
                <span style={{ color: "#00ff41" }}>{cat.working} ok</span>
                {cat.broken > 0 && <span style={{ color: "#ff0040" }}>{cat.broken} broken</span>}
                <span className="ml-auto">{cat.avg_completeness}% done</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Catalogue Browser Panel ─────────────────────────────────── */

interface CatBrowserEntry {
  name: string;
  display_name: string;
  category: string;
  operational_status: string;
  completeness_score: number;
  has_gaps: boolean;
  gap_count: number;
  source_files: string[];
  role_description: string;
  body_preview: string;
}

function CatalogueBrowserPanel({ onNodeSelect }: { onNodeSelect: (name: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatBrowserEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryEntries, setCategoryEntries] = useState<CatBrowserEntry[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [catalogueView, setCatalogueView] = useState<"overview" | "category" | "search">("overview");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      if (catalogueView === "search") setCatalogueView("overview");
      return;
    }
    setCatalogueView("search");
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalogue/search?q=${encodeURIComponent(q)}&limit=50`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [catalogueView]);

  const handleSelectCategory = useCallback(async (cat: string) => {
    setSelectedCategory(cat);
    setCatalogueView("category");
    setLoadingCategory(true);
    try {
      const res = await fetch(`/api/catalogue?category=${encodeURIComponent(cat)}`);
      const data = await res.json();
      setCategoryEntries(data.entries || []);
    } catch {
      setCategoryEntries([]);
    } finally {
      setLoadingCategory(false);
    }
  }, []);

  const renderEntryList = (entries: CatBrowserEntry[]) => (
    <div className="space-y-1">
      {entries.map((entry) => (
        <button
          key={entry.name}
          onClick={() => onNodeSelect(entry.display_name)}
          className="w-full text-left p-2 rounded transition-colors hover:bg-[#1a1a1a]"
          style={{ border: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catStatusColour(entry.operational_status) }} />
            <span className="text-[11px] font-bold text-[#d4d4d4]">{entry.display_name}</span>
            <span className="text-[9px] text-[#737373]">{entry.category}</span>
            <span className="ml-auto text-[9px] tabular-nums" style={{
              color: entry.completeness_score >= 80 ? "#00ff41" : entry.completeness_score >= 50 ? "#ffb800" : "#ff0040"
            }}>
              {entry.completeness_score}%
            </span>
            {entry.has_gaps && (
              <span className="text-[8px] text-[#ff0040]">[{entry.gap_count}G]</span>
            )}
          </div>
          {entry.role_description && (
            <div className="text-[9px] text-[#737373] mt-0.5 truncate pl-4">{entry.role_description}</div>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Search bar */}
      <div className="shrink-0 p-3 border-b border-[#1e1e1e]">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search 428 catalogue pages..."
            className="w-full px-3 py-1.5 rounded text-[11px] outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(0,180,216,0.3)",
              color: "#d4d4d4",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          {searching && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#00b4d8] animate-pulse">
              ...
            </span>
          )}
        </div>

        {/* Breadcrumb nav */}
        <div className="flex items-center gap-1.5 mt-1.5 text-[9px]">
          <button
            onClick={() => { setCatalogueView("overview"); setSearchQuery(""); }}
            className="text-[#00b4d8] hover:text-[#38bdf8] transition-colors"
          >
            CATALOGUE
          </button>
          {catalogueView === "category" && selectedCategory && (
            <>
              <span className="text-[#404040]">/</span>
              <span className="text-[#d4d4d4]">{selectedCategory.replace(/_/g, " ")}</span>
              {loadingCategory ? null : (
                <span className="text-[#737373]">({categoryEntries.length})</span>
              )}
            </>
          )}
          {catalogueView === "search" && (
            <>
              <span className="text-[#404040]">/</span>
              <span className="text-[#d4d4d4]">search: {searchQuery}</span>
              <span className="text-[#737373]">({searchResults.length})</span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {catalogueView === "overview" && (
          <TaxonomyOverviewPanel onSelectCategory={handleSelectCategory} />
        )}

        {catalogueView === "category" && (
          loadingCategory ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[10px] text-[#737373] animate-pulse">Loading...</span>
            </div>
          ) : (
            renderEntryList(categoryEntries as CatBrowserEntry[])
          )
        )}

        {catalogueView === "search" && (
          searchResults.length === 0 && !searching ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[10px] text-[#737373]">No results for &quot;{searchQuery}&quot;</span>
            </div>
          ) : (
            renderEntryList(searchResults)
          )
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
  const [fetchTimestamp, setFetchTimestamp] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [filterText, setFilterText] = useState("");

  // Drilldown view mode: WAR_ROOM shows all, others filter to subgraph
  const [viewMode, setViewMode] = useState<ViewMode>("WAR_ROOM");
  const [drilldownEntityId, setDrilldownEntityId] = useState<string | null>(null);

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

  // View mode: globe (3D) or matrix (2D workflow visualization)
  const [graphView, setGraphView] = useState<"globe" | "matrix">("globe");

  // Centre pane: graph or catalogue browser
  const [centreView, setCentreView] = useState<"graph" | "catalogue">("graph");

  // Replay state
  const [replayActiveNodes, setReplayActiveNodes] = useState<Set<string>>(new Set());
  const replayTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Service pulse state for animated data flow lines
  const [servicePulses, setServicePulses] = useState<ServicePulse[]>([]);

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
    setServicePulses([]);
  }, []);

  // Handle service pulse from replay — animate data flow to service nodes
  const handleServicePulse = useCallback((pulse: ServicePulse) => {
    setServicePulses((prev) => [...prev.slice(-20), pulse]); // keep last 20
    // Auto-expire pulse after 600ms
    setTimeout(() => {
      setServicePulses((prev) => prev.filter((p) => p.timestamp !== pulse.timestamp));
    }, 600);
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

  // Drilldown: select entity from NavigationTree
  const handleDrilldownSelect = useCallback(
    (id: string, mode: ViewMode) => {
      setViewMode(mode);
      setDrilldownEntityId(id);
      setSelectedId(id);
      setShowDetail(true);
      fetchDetail(id);

      // Re-heat simulation for the new subgraph after a tick
      setTimeout(() => {
        const fg = graphRef.current;
        if (fg) {
          fg.d3Force("charge")?.strength(-200).distanceMax(400);
          fg.d3Force("center")?.strength(1);
          fg.d3Force("link")?.distance(100);
          fg.d3ReheatSimulation();
        }
      }, 100);
    },
    [fetchDetail]
  );

  // Drilldown: return to War Room
  const handleBackToWarRoom = useCallback(() => {
    setViewMode("WAR_ROOM");
    setDrilldownEntityId(null);
    setSelectedId(null);
    setDetail(null);
    setShowDetail(false);

    // Re-apply default forces
    setTimeout(() => {
      const fg = graphRef.current;
      if (fg) {
        fg.d3Force("charge")?.strength(-120).distanceMax(500);
        fg.d3Force("center")?.strength(1);
        fg.d3Force("link")?.distance(80);
        fg.d3ReheatSimulation();
      }
    }, 100);
  }, []);

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

  // Drilldown subgraph filtering: when a specific entity is drilled into,
  // show only that entity + its immediate neighbours
  const drilldownNodes = useMemo(() => {
    if (viewMode === "WAR_ROOM" || !drilldownEntityId) return filteredNodes;

    // Find all nodes connected to the drilldown entity via edges
    const neighbourIds = new Set<string>([drilldownEntityId]);
    for (const e of edges) {
      if (e.source === drilldownEntityId) neighbourIds.add(e.target);
      if (e.target === drilldownEntityId) neighbourIds.add(e.source);
    }

    return filteredNodes.filter((n) => neighbourIds.has(n.id));
  }, [viewMode, drilldownEntityId, filteredNodes, edges]);

  const drilldownEdges = useMemo(() => {
    if (viewMode === "WAR_ROOM" || !drilldownEntityId) return filteredEdges;

    const drilldownNodeIds = new Set(drilldownNodes.map((n) => n.id));
    return filteredEdges.filter(
      (e) => drilldownNodeIds.has(e.source) && drilldownNodeIds.has(e.target)
    );
  }, [viewMode, drilldownEntityId, filteredEdges, drilldownNodes]);

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

  // Build graph data for react-force-graph-3d (uses drilldown-filtered data)
  const graphData: GraphData = useMemo(() => {
    const activeNodes = drilldownNodes;
    const activeEdges = drilldownEdges;

    const graphNodes: GraphNodeObj[] = activeNodes.map((n) => {
      const intensity = recencyIntensity(n.last_updated);
      const ec = edgeCounts.get(n.id) || 0;
      // In drilldown mode, make the focal node larger
      const isDrilldownFocal = viewMode !== "WAR_ROOM" && n.id === drilldownEntityId;
      const val = isDrilldownFocal ? Math.max(8, ec * 2) : Math.max(2, ec * 1.5);
      return {
        ...n,
        colour: n.entity_type === "gap" ? "#ff0040" :
                n.status?.toLowerCase().includes("locked") ? "#404040" :
                nodeColour(n.entity_type),
        val,
        intensity,
      };
    });

    const nodeIds = new Set(activeNodes.map((n) => n.id));
    const graphLinks: GraphLinkObj[] = activeEdges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ ...e }));

    return { nodes: graphNodes, links: graphLinks };
  }, [drilldownNodes, drilldownEdges, edgeCounts, viewMode, drilldownEntityId]);

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
      {/* LEFT PANE: Navigation Tree (drilldown-capable) */}
      <NavigationTree
        nodes={nodes}
        loading={loading}
        selectedId={selectedId}
        viewMode={viewMode}
        onSelectWarRoom={handleBackToWarRoom}
        onSelectEntity={handleDrilldownSelect}
      />

      {/* CENTRE PANE: 3D Globe + Detail Card */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Drilldown breadcrumb bar */}
        {viewMode !== "WAR_ROOM" && drilldownEntityId && (
          <div
            className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-[#00ff41]/20"
            style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,255,65,0.03)" }}
          >
            <button
              onClick={handleBackToWarRoom}
              className="text-[10px] text-[#00ff41] hover:text-[#39ff14] transition-colors flex items-center gap-1"
            >
              <span>&larr;</span>
              <span>War Room</span>
            </button>
            <span className="text-[9px] text-[#404040]">/</span>
            <span
              className="text-[10px] font-bold"
              style={{
                color: viewMode === "AGENT_VIEW" ? "#00ff41" :
                       viewMode === "WORKFLOW_VIEW" ? "#a855f7" :
                       viewMode === "SERVICE_VIEW" ? "#00b4d8" : "#d4d4d4",
              }}
            >
              {drilldownEntityId}
            </span>
            <span className="text-[9px] text-[#404040] ml-1">
              ({viewMode === "AGENT_VIEW" ? "agent subgraph" :
                viewMode === "WORKFLOW_VIEW" ? "workflow subgraph" :
                viewMode === "SERVICE_VIEW" ? "service subgraph" : ""} &middot; {drilldownNodes.length} nodes &middot; {drilldownEdges.length} edges)
            </span>
          </div>
        )}

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

          {/* Globe / Matrix view toggle */}
          <div className="flex items-center gap-0.5 ml-2">
            {(["globe", "matrix"] as const).map((view) => (
              <button
                key={view}
                onClick={() => { setGraphView(view); setCentreView("graph"); }}
                className="px-2 py-0.5 rounded text-[9px] transition-all"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: centreView === "graph" && graphView === view ? "#0a0a0a" : "#00ff41",
                  background: centreView === "graph" && graphView === view ? "#00ff41" : "transparent",
                  border: "1px solid rgba(0,255,65,0.2)",
                }}
              >
                {view === "globe" ? "3D" : "MATRIX"}
              </button>
            ))}
            <button
              onClick={() => setCentreView(centreView === "catalogue" ? "graph" : "catalogue")}
              className="px-2 py-0.5 rounded text-[9px] transition-all ml-0.5"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: centreView === "catalogue" ? "#0a0a0a" : "#00b4d8",
                background: centreView === "catalogue" ? "#00b4d8" : "transparent",
                border: "1px solid rgba(0,180,216,0.3)",
              }}
            >
              CATALOGUE
            </button>
          </div>
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
        <ReplayControls onEventFire={handleReplayEvent} onReset={handleReplayReset} onServicePulse={handleServicePulse} />

        {/* Catalogue Browser Panel — replaces graph when active */}
        {centreView === "catalogue" && (
          <div className="flex-1 overflow-hidden" style={{ background: "#0d0d0d" }}>
            <CatalogueBrowserPanel
              onNodeSelect={(name) => {
                setCentreView("graph");
                handleNodeClick(name);
              }}
            />
          </div>
        )}

        {/* 3D Globe or Workflow Matrix */}
        <div
          ref={canvasContainerRef}
          className={centreView === "catalogue" ? "hidden" : "flex-1 relative"}
          style={{ background: "#0a0a0a" }}
        >
          {/* Service pulse animations overlay */}
          {servicePulses.length > 0 && (
            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
              {servicePulses.map((pulse) => {
                const age = performance.now() - pulse.timestamp;
                const progress = Math.min(age / 600, 1);
                const opacity = 1 - progress;
                return (
                  <div
                    key={pulse.timestamp}
                    className="absolute flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "8px",
                      left: `${30 + progress * 40}%`,
                      top: `${20 + (pulse.timestamp % 60)}%`,
                      opacity,
                      background: "rgba(0,255,65,0.15)",
                      border: "1px solid rgba(0,255,65,0.3)",
                      color: "#00ff41",
                      transform: `translateX(${progress * 100}px)`,
                      transition: "transform 0.1s linear",
                    }}
                  >
                    <span style={{ color: "#00ff41" }}>{pulse.from}</span>
                    <span style={{ color: "#737373" }}>&rarr;</span>
                    <span style={{ color: "#00b4d8" }}>{pulse.to}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Workflow Matrix view */}
          {graphView === "matrix" && (
            <div className="absolute inset-0 z-5 overflow-auto">
              <WorkflowMatrix
                theme="dark"
                className="h-full"
                onNodeClick={(id) => {
                  // Try to map matrix node ID to a graph node
                  const matchedNode = nodes.find((n) =>
                    n.id === id || n.name === id || n.name === id.replace(/^(wf-|sk-|svc-|gate-|ep-)/, "")
                  );
                  if (matchedNode) handleNodeClick(matchedNode.id);
                }}
              />
            </div>
          )}

          {/* CRT scanline overlay */}
          {graphView === "globe" && (
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                backgroundImage: "repeating-linear-gradient(0deg, rgba(0,255,65,0.03) 0px, transparent 1px, transparent 2px)",
                backgroundSize: "100% 2px",
              }}
            />
          )}

          {graphView === "globe" && !loading && nodes.length > 0 && (
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
                if (viewMode === "WAR_ROOM") {
                  setSelectedId(null);
                  setDetail(null);
                  setShowDetail(false);
                }
                // In drilldown mode, background click just deselects detail but stays in drilldown
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
        <EventStream filterSource={viewMode !== "WAR_ROOM" ? drilldownEntityId : null} />
      </div>
    </div>
  );
}
