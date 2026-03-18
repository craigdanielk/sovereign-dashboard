"use client";

import type { GraphNode, GraphEdge } from "./GraphVisualization";

/* ─── Helpers ────────────────────────────────────────── */

function typeBadgeStyle(type: string): { color: string; bg: string } {
  switch (type) {
    case "agent":
      return { color: "var(--green)", bg: "var(--green-dim)" };
    case "skill":
      return { color: "var(--purple)", bg: "var(--purple-dim)" };
    case "tool":
      return { color: "#6b7280", bg: "rgba(107,114,128,0.14)" };
    default:
      return { color: "var(--text-3)", bg: "rgba(255,255,255,0.04)" };
  }
}

function classificationBadgeStyle(classification?: string): { color: string; bg: string } | null {
  if (!classification) return null;
  switch (classification) {
    case "orchestrator":
      return { color: "#22c55e", bg: "rgba(34,197,94,0.14)" };
    case "checker":
      return { color: "#3b82f6", bg: "rgba(59,130,246,0.14)" };
    default:
      return { color: "#14b8a6", bg: "rgba(20,184,166,0.14)" };
  }
}

function statusColor(status?: string): string {
  switch (status) {
    case "operational":
      return "var(--green)";
    case "beta":
      return "var(--blue)";
    case "pending":
      return "var(--orange)";
    case "offline":
      return "var(--red)";
    default:
      return "var(--text-3)";
  }
}

/* ─── Component ──────────────────────────────────────── */

interface Props {
  node: GraphNode | null;
  edges: GraphEdge[];
  onClose: () => void;
  onNavigateToNode?: (nodeId: string) => void;
}

export function NodeDetailPanel({ node, edges, onClose, onNavigateToNode }: Props) {
  if (!node) return null;

  const badge = typeBadgeStyle(node.type);
  const classBadge = classificationBadgeStyle(node.classification);

  /* Find connected nodes from edges */
  const callTargets = edges
    .filter((e) => e.source === node.id && (e.type === "calls" || e.type === "uses_skill"))
    .map((e) => e.target);

  const calledByNodes = edges
    .filter((e) => e.target === node.id && (e.type === "calls" || e.type === "called_by"))
    .map((e) => e.source);

  const dependsOn = edges
    .filter((e) => e.source === node.id && e.type === "depends_on")
    .map((e) => e.target);

  /* Also use node.calls and node.called_by for items not in edges */
  const allCalls = [...new Set([...callTargets, ...(node.calls ?? [])])];
  const allCalledBy = [...new Set([...calledByNodes, ...(node.called_by ?? [])])];

  return (
    <>
      {/* Backdrop scrim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(0,0,0,0.3)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 56,
          right: 0,
          bottom: 0,
          width: 380,
          zIndex: 100,
          background: "rgba(18,18,20,0.92)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          overflowY: "auto",
          animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {/* Close button */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "16px 20px 0",
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-3)",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "12px 20px 32px" }}>
          {/* ─── Header: Name + badges + status ─── */}
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-1)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            {node.label}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {/* Type badge */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 10px",
                borderRadius: 999,
                background: badge.bg,
                color: badge.color,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {node.type}
            </span>

            {/* Classification badge */}
            {classBadge && node.classification && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: classBadge.bg,
                  color: classBadge.color,
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {node.classification}
              </span>
            )}

            {/* Status indicator */}
            {node.status && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: statusColor(node.status),
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: statusColor(node.status),
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {node.status}
                </span>
              </div>
            )}

            {/* Proficiency */}
            {node.proficiency && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text-3)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {node.proficiency}
              </span>
            )}
          </div>

          {/* ─── Description ─── */}
          {node.description && (
            <Section title="Description">
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "var(--text-2)",
                  fontFamily: "var(--font-display)",
                  margin: 0,
                }}
              >
                {node.description}
              </p>
            </Section>
          )}

          {/* ─── Capabilities ─── */}
          {node.capabilities && node.capabilities.length > 0 && (
            <Section title="Capabilities">
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {node.capabilities.map((cap) => (
                  <li
                    key={cap}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 11,
                      color: "var(--text-2)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span style={{ color: "var(--text-4)", marginTop: 2, flexShrink: 0 }}>-</span>
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* ─── Dependencies: Calls ─── */}
          {allCalls.length > 0 && (
            <Section title="Calls">
              <ConnectionList items={allCalls} color="var(--green)" onItemClick={onNavigateToNode} />
            </Section>
          )}

          {/* ─── Dependencies: Called By ─── */}
          {allCalledBy.length > 0 && (
            <Section title="Called By">
              <ConnectionList items={allCalledBy} color="var(--blue)" onItemClick={onNavigateToNode} />
            </Section>
          )}

          {/* ─── Dependencies: Depends On ─── */}
          {dependsOn.length > 0 && (
            <Section title="Depends On">
              <ConnectionList items={dependsOn} color="var(--orange)" onItemClick={onNavigateToNode} />
            </Section>
          )}

          {/* ─── Gaps ─── */}
          {node.gaps && node.gaps.length > 0 && (
            <Section title="Gaps">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {node.gaps.map((gap, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "var(--red-dim)",
                      border: "1px solid rgba(255,69,58,0.12)",
                    }}
                  >
                    <span style={{ color: "var(--red)", fontSize: 11, marginTop: 1, flexShrink: 0 }}>!</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--red)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {gap}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ─── Metadata ─── */}
          <Section title="Metadata">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {node.layer && (
                <MetadataRow label="Layer" value={node.layer} />
              )}
              {node.classification && (
                <MetadataRow label="Classification" value={node.classification} />
              )}
              {node.category && (
                <MetadataRow label="Category" value={node.category} />
              )}
              {node.connectionCount !== undefined && (
                <MetadataRow label="Connections" value={String(node.connectionCount)} />
              )}
              {node.metadata?.lastUpdated != null && (
                <MetadataRow label="Last Updated" value={String(node.metadata.lastUpdated)} />
              )}
              {node.metadata?.apqcCode != null && (
                <MetadataRow label="APQC Code" value={String(node.metadata.apqcCode)} />
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-4)",
          marginBottom: 8,
          fontFamily: "var(--font-mono)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 6,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "var(--text-4)",
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-2)",
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ConnectionList({
  items,
  color,
  onItemClick,
}: {
  items: string[];
  color: string;
  onItemClick?: (nodeId: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onItemClick?.(item)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            cursor: onItemClick ? "pointer" : "default",
            width: "100%",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (onItemClick) {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-2)",
              fontFamily: "var(--font-mono)",
              textAlign: "left",
            }}
          >
            {item}
          </span>
          {onItemClick && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              style={{ marginLeft: "auto", opacity: 0.3 }}
            >
              <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
