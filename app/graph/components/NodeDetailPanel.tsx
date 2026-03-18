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
      return { color: "var(--yellow)", bg: "var(--yellow-dim)" };
    default:
      return { color: "var(--text-3)", bg: "rgba(255,255,255,0.04)" };
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
      return "var(--text-4)";
    default:
      return "var(--text-3)";
  }
}

/* ─── Component ──────────────────────────────────────── */

interface Props {
  node: GraphNode | null;
  edges: GraphEdge[];
  onClose: () => void;
}

export function NodeDetailPanel({ node, edges, onClose }: Props) {
  if (!node) return null;

  const badge = typeBadgeStyle(node.type);

  /* Find connected nodes */
  const calls = edges
    .filter((e) => e.source === node.id && (e.type === "calls" || e.type === "uses_skill"))
    .map((e) => e.target);

  const calledBy = edges
    .filter((e) => e.target === node.id && (e.type === "calls" || e.type === "called_by"))
    .map((e) => e.source);

  const dependsOn = edges
    .filter((e) => e.source === node.id && e.type === "depends_on")
    .map((e) => e.target);

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
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          zIndex: 100,
          background: "rgba(28, 28, 30, 0.88)",
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
          {/* Node name */}
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

          {/* Type badge + status */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
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

          {/* Capabilities */}
          {node.capabilities && node.capabilities.length > 0 && (
            <Section title="Capabilities">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {node.capabilities.map((cap) => (
                  <span
                    key={cap}
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--text-2)",
                      fontFamily: "var(--font-mono)",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Calls */}
          {calls.length > 0 && (
            <Section title="Calls">
              <ConnectionList items={calls} color="var(--green)" />
            </Section>
          )}

          {/* Called By */}
          {calledBy.length > 0 && (
            <Section title="Called By">
              <ConnectionList items={calledBy} color="var(--blue)" />
            </Section>
          )}

          {/* Depends On */}
          {dependsOn.length > 0 && (
            <Section title="Depends On">
              <ConnectionList items={dependsOn} color="var(--orange)" />
            </Section>
          )}

          {/* Metadata */}
          {node.metadata && Object.keys(node.metadata).length > 0 && (
            <Section title="Metadata">
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-3)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                {JSON.stringify(node.metadata, null, 2)}
              </div>
            </Section>
          )}
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

function ConnectionList({ items, color }: { items: string[]; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item) => (
        <div
          key={item}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
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
            }}
          >
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}
