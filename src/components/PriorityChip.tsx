import React from "react";

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  P0: { label: "Urgent", color: "#EF4444" },
  P1: { label: "High",   color: "#F59E0B" },
  P2: { label: "Medium", color: "#6366F1" },
  P3: { label: "Low",    color: "#6B6B6B" },
};

interface PriorityChipProps {
  priority: string;
  className?: string;
}

export default function PriorityChip({ priority, className = "" }: PriorityChipProps) {
  const config = PRIORITY_CONFIG[priority?.toUpperCase?.()] ?? {
    label: priority || "—",
    color: "#6B6B6B",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 flex-shrink-0 ${className}`}
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: config.color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: config.color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}
