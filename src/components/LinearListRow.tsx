import React from "react";
import StatusChip from "./StatusChip";
import PriorityChip from "./PriorityChip";

interface LinearListRowProps {
  id?: string | number;
  title: string;
  status?: string;
  priority?: string;
  badge?: string;
  badgeColor?: string;
  secondaryText?: string;
  timestamp?: string;
  onClick?: () => void;
  className?: string;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function LinearListRow({
  id,
  title,
  status,
  priority,
  badge,
  badgeColor = "#6B6B6B",
  secondaryText,
  timestamp,
  onClick,
  className = "",
}: LinearListRowProps) {
  return (
    <div
      className={`list-row ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      {/* Checkbox placeholder */}
      <span
        className="flex-shrink-0"
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: "1px solid #2A2A2A",
          display: "inline-block",
        }}
      />

      {/* ID */}
      {id !== undefined && (
        <span
          className="flex-shrink-0 font-mono"
          style={{ fontSize: 11, color: "#6B6B6B", minWidth: 28 }}
        >
          #{id}
        </span>
      )}

      {/* Title */}
      <span
        className="flex-1 truncate"
        style={{ fontSize: 13, color: "#E5E5E5" }}
      >
        {title}
      </span>

      {/* Secondary text */}
      {secondaryText && (
        <span
          className="hidden sm:block truncate flex-shrink-0"
          style={{ fontSize: 11, color: "#6B6B6B", maxWidth: 160 }}
        >
          {secondaryText}
        </span>
      )}

      {/* Status chip */}
      {status && <StatusChip status={status} />}

      {/* Priority chip */}
      {priority && <PriorityChip priority={priority} />}

      {/* Badge (tenant/client label) */}
      {badge && (
        <span
          className="flex-shrink-0 hidden sm:inline-flex"
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: badgeColor,
            background: `${badgeColor}18`,
            borderRadius: 4,
            padding: "1px 5px",
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </span>
      )}

      {/* Timestamp */}
      {timestamp && (
        <span
          className="flex-shrink-0"
          style={{ fontSize: 11, color: "#6B6B6B", minWidth: 28, textAlign: "right" }}
        >
          {timeAgo(timestamp)}
        </span>
      )}
    </div>
  );
}
