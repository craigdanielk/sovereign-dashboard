"use client";

import ComplianceCard from "./ComplianceCard";

export default function NISTPanel() {
  return (
    <ComplianceCard
      title="NIST AI RMF"
      metric="17 Risks — 59% Partial"
      light="amber"
      detail="7 HIGH / 9 MEDIUM / 1 LOW — 0 fully implemented, 10 partial, 7 planned. Next review: 2026-07-18"
    />
  );
}
