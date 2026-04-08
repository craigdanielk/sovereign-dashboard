"use client";

interface LinearGroupHeaderProps {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}

export default function LinearGroupHeader({
  label,
  count,
  expanded,
  onToggle,
}: LinearGroupHeaderProps) {
  return (
    <div className="group-header" onClick={onToggle}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        style={{
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.15s",
          flexShrink: 0,
        }}
      >
        <path
          d="M4 2L8 6L4 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span style={{ fontWeight: 500, color: "#A0A0A0" }}>{label}</span>
      <span
        style={{
          fontSize: 10,
          background: "#2A2A2A",
          color: "#6B6B6B",
          borderRadius: 4,
          padding: "0 5px",
          lineHeight: "16px",
        }}
      >
        {count}
      </span>
    </div>
  );
}
