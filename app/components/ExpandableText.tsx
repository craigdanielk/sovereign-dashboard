"use client";

import { useState } from "react";

interface ExpandableTextProps {
  text: string;
  maxLength?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ExpandableText({
  text,
  maxLength = 200,
  className = "",
  style,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxLength;

  return (
    <div>
      <p className={className} style={style}>
        {expanded || !needsTruncation ? text : `${text.slice(0, maxLength)}…`}
      </p>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-medium mt-1 cursor-pointer transition-colors"
          style={{
            color: "var(--blue)",
            fontFamily: "var(--font-mono)",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          {expanded ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}
