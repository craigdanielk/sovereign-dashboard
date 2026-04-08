import React from "react";

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export default function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ padding: "48px 24px", color: "#6B6B6B" }}
    >
      {icon ?? (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          style={{ marginBottom: 12, opacity: 0.4 }}
        >
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
      <span style={{ fontSize: 13, textAlign: "center" }}>{message}</span>
    </div>
  );
}
