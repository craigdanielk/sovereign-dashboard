"use client";

import { useState, useMemo } from "react";
import { withAlpha } from "@/lib/colours";

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

export type ViewMode = "WAR_ROOM" | "AGENT_VIEW" | "WORKFLOW_VIEW" | "SERVICE_VIEW";

interface NavigationTreeProps {
  nodes: RagNode[];
  loading: boolean;
  selectedId: string | null;
  viewMode: ViewMode;
  onSelectWarRoom: () => void;
  onSelectEntity: (id: string, mode: ViewMode) => void;
}

/* ── Status dot colour ────────────────────────────────────────── */

function statusDotFromRecency(lastUpdated: string | null, status: string): string {
  if (!lastUpdated) return statusDot(status);
  const age = Date.now() - new Date(lastUpdated).getTime();
  const hours = age / (1000 * 60 * 60);
  if (hours < 1) return "#00ff41";
  if (hours < 24) return "#39ff14";
  if (hours < 168) return "#ffb800";
  return "#737373";
}

function statusDot(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "operational" || s === "active" || s === "ready") return "#00ff41";
  if (s === "beta" || s === "partial" || s === "degraded") return "#ffb800";
  if (s.includes("locked") || s.includes("disabled")) return "#ff0040";
  return "#ff0040";
}

/* ── Templatised workflow names (known from YAML registry) ───── */

const TEMPLATISED_WORKFLOWS = new Set([
  "prism-routing",
  "gap-resolution",
  "build-validation",
  "migration",
  "website-build",
  "agent-test-scaffold",
  "client-agent-bootstrap",
  "gitops-project-bootstrap",
  "shopify-data-audit",
  "lore-pattern-promote",
  "skill-agent-wiring",
  "shopify-css-scope-enforcement",
  // Slash-command workflows — sequential, not magentic
  "executor-loop",
  "planner-loop",
  "r17-task-ingestion",
  "rag-operations",
  "brief-creation",
  "demand-intelligence",
  "deep-research",
  "content-generation",
  "shopify-store-setup",
  "quality-gate",
  "demo-delivery",
  "e-commerce-migration",
]);

/* ── Collapsible tree section ─────────────────────────────────── */

function TreeSection({
  title,
  colour,
  items,
  selectedId,
  onSelect,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  colour: string;
  items?: RagNode[];
  selectedId: string | null;
  onSelect?: (id: string) => void;
  defaultCollapsed?: boolean;
  children?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const count = items?.length ?? 0;

  return (
    <div className="mb-0.5">
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
        {count > 0 && (
          <span
            className="text-[9px]"
            style={{ color: withAlpha(colour, 0.5), fontFamily: "'JetBrains Mono', monospace" }}
          >
            {count}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="pl-2 space-y-0">
          {items && onSelect && items.map((item) => (
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
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Main NavigationTree ──────────────────────────────────────── */

export default function NavigationTree({
  nodes,
  loading,
  selectedId,
  viewMode,
  onSelectWarRoom,
  onSelectEntity,
}: NavigationTreeProps) {
  const [filterText, setFilterText] = useState("");

  // Group and filter nodes
  const grouped = useMemo(() => {
    const filter = filterText.toLowerCase();
    const filtered = filter
      ? nodes.filter(
          (n) =>
            n.name.toLowerCase().includes(filter) ||
            n.entity_type.toLowerCase().includes(filter)
        )
      : nodes;

    const agents = filtered
      .filter((n) => n.entity_type === "agent")
      .sort((a, b) => a.name.localeCompare(b.name));

    const allWorkflows = filtered.filter((n) => n.entity_type === "workflow");
    const templatised = allWorkflows
      .filter((n) => TEMPLATISED_WORKFLOWS.has(n.name.toLowerCase()) || TEMPLATISED_WORKFLOWS.has(n.id.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
    const magentic = allWorkflows
      .filter((n) => !TEMPLATISED_WORKFLOWS.has(n.name.toLowerCase()) && !TEMPLATISED_WORKFLOWS.has(n.id.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));

    const services = filtered
      .filter((n) => n.entity_type === "service")
      .sort((a, b) => a.name.localeCompare(b.name));

    const skills = filtered
      .filter((n) => n.entity_type === "skill" || n.entity_type === "content")
      .sort((a, b) => a.name.localeCompare(b.name));

    return { agents, templatised, magentic, services, skills, allWorkflows };
  }, [nodes, filterText]);

  return (
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
          NAVIGATION
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

      {/* Scrollable tree */}
      <div className="flex-1 overflow-y-auto p-1">
        {/* War Room (master view) */}
        <button
          onClick={onSelectWarRoom}
          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[10px] transition-colors mb-1 ${
            viewMode === "WAR_ROOM" ? "bg-[#1a2a1a]" : "hover:bg-[#1a1a1a]"
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <span
            className="shrink-0 w-2 h-2 rounded-sm"
            style={{
              background: viewMode === "WAR_ROOM" ? "#00ff41" : "#404040",
              boxShadow: viewMode === "WAR_ROOM" ? "0 0 6px rgba(0,255,65,0.5)" : "none",
            }}
          />
          <span style={{ color: viewMode === "WAR_ROOM" ? "#00ff41" : "#d4d4d4", fontWeight: viewMode === "WAR_ROOM" ? 700 : 400 }}>
            War Room
          </span>
          <span className="text-[9px] text-[#737373] ml-auto">full graph</span>
        </button>

        {/* Separator */}
        <div className="border-t border-[#1e1e1e] my-1" />

        {/* Agents */}
        {grouped.agents.length > 0 && (
          <TreeSection
            title="AGENTS"
            colour="#00ff41"
            items={grouped.agents}
            selectedId={selectedId}
            onSelect={(id) => onSelectEntity(id, "AGENT_VIEW")}
          />
        )}

        {/* Workflows - hierarchical */}
        {grouped.allWorkflows.length > 0 && (
          <TreeSection
            title="WORKFLOWS"
            colour="#a855f7"
            selectedId={selectedId}
          >
            {/* Templatised sub-group */}
            {grouped.templatised.length > 0 && (
              <TreeSection
                title="Templatised"
                colour="#a855f7"
                items={grouped.templatised}
                selectedId={selectedId}
                onSelect={(id) => onSelectEntity(id, "WORKFLOW_VIEW")}
              />
            )}
            {/* Magentic sub-group */}
            {grouped.magentic.length > 0 && (
              <TreeSection
                title="Magentic"
                colour="#a855f7"
                items={grouped.magentic}
                selectedId={selectedId}
                onSelect={(id) => onSelectEntity(id, "WORKFLOW_VIEW")}
                defaultCollapsed={true}
              />
            )}
          </TreeSection>
        )}

        {/* Services */}
        {grouped.services.length > 0 && (
          <TreeSection
            title="SERVICES"
            colour="#00b4d8"
            items={grouped.services}
            selectedId={selectedId}
            onSelect={(id) => onSelectEntity(id, "SERVICE_VIEW")}
          />
        )}

        {/* Skills */}
        {grouped.skills.length > 0 && (
          <TreeSection
            title="SKILLS"
            colour="#e879f9"
            items={grouped.skills}
            selectedId={selectedId}
            onSelect={(id) => onSelectEntity(id, "AGENT_VIEW")}
            defaultCollapsed={true}
          />
        )}

        {nodes.length === 0 && !loading && (
          <div className="text-[10px] text-[#404040] text-center py-4">
            No entities loaded
          </div>
        )}
      </div>
    </div>
  );
}
