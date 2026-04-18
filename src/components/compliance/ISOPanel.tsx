"use client";

import ComplianceCard from "./ComplianceCard";

export default function ISOPanel() {
  return (
    <ComplianceCard
      title="ISO 42001 Controls"
      metric="51 Controls — 49% Implemented"
      light="amber"
      detail="25 implemented / 21 partial / 3 planned / 2 N/A. 4-phase remediation roadmap active. Next review: 2026-07-18"
    />
  );
}
