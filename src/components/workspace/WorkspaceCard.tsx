"use client";

import Link from "next/link";
import type { Workspace } from "@/lib/types";
import { getWorkspaceColour, withAlpha } from "@/lib/colours";

interface WorkspaceCardProps {
  workspace: Workspace;
  style?: React.CSSProperties;
}

export default function WorkspaceCard({ workspace, style }: WorkspaceCardProps) {
  const href = workspace.slug === "comms-hub" ? "/comms" : `/ws/${workspace.slug}`;
  const colour = getWorkspaceColour(workspace.colour);

  return (
    <Link
      href={href}
      style={{
        ...style,
        borderColor: withAlpha(colour, 0.3),
      }}
      className="absolute block w-72 group rounded-xl border-2 bg-bg-card hover:bg-bg-card-hover shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] cursor-pointer"
    >
      <div className="p-6">
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl font-black tracking-tighter" style={{ color: colour }}>
            {workspace.icon}
          </span>
          <h2 className="text-lg font-bold text-text-primary group-hover:text-white transition-colors">
            {workspace.name}
          </h2>
        </div>

        {/* Description */}
        <p className="text-xs text-text-secondary leading-relaxed mb-4">
          {workspace.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] uppercase tracking-wider font-bold"
            style={{ color: colour }}
          >
            /{workspace.slug}
          </span>
          <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">
            Open
          </span>
        </div>
      </div>

      {/* Left accent bar */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-r transition-colors"
        style={{ backgroundColor: withAlpha(colour, 0.5) }}
      />
    </Link>
  );
}
