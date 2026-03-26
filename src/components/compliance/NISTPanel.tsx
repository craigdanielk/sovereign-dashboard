"use client";

import ComplianceCard from "./ComplianceCard";

export default function NISTPanel() {
  return (
    <ComplianceCard
      title="NIST AI Agent Standards"
      metric="PENDING"
      light="grey"
      detail="Assessment pending — configure NIST AI 600-1 mapping to enable automated scoring"
    />
  );
}
