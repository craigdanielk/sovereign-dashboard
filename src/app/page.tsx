"use client";

import WorkspaceCard from "@/components/workspace/WorkspaceCard";
import { WORKSPACES } from "@/lib/types";

// Spatial positions for the 4 workspace cards on the canvas
const CARD_POSITIONS: Record<string, React.CSSProperties> = {
  "north-star": { top: "8%", left: "6%" },
  r17: { top: "6%", right: "8%" },
  "champion-grip": { bottom: "12%", left: "8%" },
  "comms-hub": { bottom: "10%", right: "6%" },
};

export default function RootWhiteboard() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-bg-primary">
      {/* Grid background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-[0.3em] text-text-muted/20 uppercase">
            Command Surface
          </h1>
          <p className="text-xs text-text-muted/15 mt-2 tracking-widest uppercase">
            SOVEREIGN Orchestration Workspace
          </p>
        </div>
      </div>

      {/* Workspace cards — spatially positioned */}
      {WORKSPACES.map((ws) => (
        <WorkspaceCard
          key={ws.slug}
          workspace={ws}
          style={CARD_POSITIONS[ws.slug]}
        />
      ))}

      {/* Quick stats footer */}
      <div className="absolute bottom-0 left-0 right-0 px-6 py-2 flex items-center gap-6 text-[10px] text-text-muted border-t border-border/50 bg-bg-primary/80 backdrop-blur-sm">
        <span>4 workspaces</span>
        <span className="text-border">|</span>
        <span>
          {new Date().toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="text-border">|</span>
        <span className="text-accent-cyan">cmd+k to search</span>
      </div>
    </div>
  );
}
