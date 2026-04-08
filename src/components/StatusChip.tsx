import React from "react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  // Brief/task statuses
  QUEUED:      { label: "Queued",      color: "#6366F1", bg: "#6366F115" },
  CLAIMED:     { label: "Claimed",     color: "#F59E0B", bg: "#F59E0B15" },
  IN_PROGRESS: { label: "In Progress", color: "#F59E0B", bg: "#F59E0B15" },
  COMPLETED:   { label: "Done",        color: "#10B981", bg: "#10B98115" },
  DONE:        { label: "Done",        color: "#10B981", bg: "#10B98115" },
  FAILED:      { label: "Failed",      color: "#EF4444", bg: "#EF444415" },
  BLOCKED:     { label: "Blocked",     color: "#EF4444", bg: "#EF444415" },
  CANCELLED:   { label: "Cancelled",   color: "#EF4444", bg: "#EF444415" },
  SUPERSEDED:  { label: "Superseded",  color: "#6B6B6B", bg: "#6B6B6B15" },
  PENDING:     { label: "Pending",     color: "#6B6B6B", bg: "#6B6B6B15" },
  DRAFT:       { label: "Draft",       color: "#6B6B6B", bg: "#6B6B6B15" },
  // Recon verdicts
  GO:   { label: "GO",   color: "#10B981", bg: "#10B98115" },
  GAP:  { label: "GAP",  color: "#F59E0B", bg: "#F59E0B15" },
  SKIP: { label: "SKIP", color: "#EF4444", bg: "#EF444415" },
  // Artifact statuses
  DELIVERED: { label: "Delivered", color: "#10B981", bg: "#10B98115" },
  VERIFIED:  { label: "Verified",  color: "#10B981", bg: "#10B98115" },
};

interface StatusChipProps {
  status: string;
  className?: string;
}

export default function StatusChip({ status, className = "" }: StatusChipProps) {
  const config = STATUS_CONFIG[status?.toUpperCase?.()] ?? {
    label: status,
    color: "#6B6B6B",
    bg: "#6B6B6B15",
  };

  return (
    <span
      className={`inline-flex items-center flex-shrink-0 ${className}`}
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: config.color,
        background: config.bg,
        borderRadius: 4,
        padding: "1px 6px",
        lineHeight: "18px",
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  );
}
