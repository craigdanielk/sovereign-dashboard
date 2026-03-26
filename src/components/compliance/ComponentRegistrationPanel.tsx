"use client";

import { useEffect, useState, useCallback } from "react";
import ComplianceCard, { type TrafficLight } from "./ComplianceCard";

// Expected component counts based on control_tower manifest
const EXPECTED_COMPONENTS = {
  agents: 18,
  workflows: 10,
  schemas: 6,
  commands: 5,
};

const EXPECTED_TOTAL = Object.values(EXPECTED_COMPONENTS).reduce(
  (a, b) => a + b,
  0
);

export default function ComponentRegistrationPanel() {
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(0);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/graph");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      // The graph API returns { nodes: [...], links: [...] }
      const nodeCount = data.nodes?.length ?? 0;
      setRegistered(nodeCount);
    } catch {
      // API not available — show zero
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const pct =
    EXPECTED_TOTAL > 0
      ? Math.min(100, Math.round((registered / EXPECTED_TOTAL) * 100))
      : 0;

  const light: TrafficLight =
    pct >= 90 ? "green" : pct >= 60 ? "amber" : "red";

  return (
    <ComplianceCard
      title="Component Registration"
      metric={loading ? "---" : `${pct}%`}
      light={light}
      detail={
        loading
          ? "Loading..."
          : `${registered} nodes registered of ${EXPECTED_TOTAL} expected (${Object.entries(
              EXPECTED_COMPONENTS
            )
              .map(([k, v]) => `${v} ${k}`)
              .join(", ")})`
      }
      loading={loading}
    />
  );
}
