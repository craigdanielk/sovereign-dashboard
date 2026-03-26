"use client";

import { useEffect, useState, useCallback } from "react";
import ComplianceCard, { type TrafficLight } from "./ComplianceCard";
import { supabase } from "@/lib/supabase";

export default function RiskRegisterPanel() {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [open, setOpen] = useState(0);
  const [mitigated, setMitigated] = useState(0);

  const fetchRisks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("risk_register")
        .select("id, status")
        .limit(500);

      if (error || !data) {
        setExists(false);
        setLoading(false);
        return;
      }

      setExists(true);
      const openCount = data.filter(
        (r: { status: string }) =>
          r.status === "OPEN" || r.status === "open"
      ).length;
      const mitigatedCount = data.filter(
        (r: { status: string }) =>
          r.status === "MITIGATED" || r.status === "mitigated"
      ).length;
      setOpen(openCount);
      setMitigated(mitigatedCount);
    } catch {
      setExists(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  if (!exists && !loading) {
    return (
      <ComplianceCard
        title="Risk Register Coverage"
        metric="NOT CONFIGURED"
        light="grey"
        detail="Configure risk register table in Supabase to enable risk tracking"
      />
    );
  }

  const total = open + mitigated;
  const coverage = total > 0 ? Math.round((mitigated / total) * 100) : 0;
  const light: TrafficLight =
    open > 5 ? "red" : open > 0 ? "amber" : "green";

  return (
    <ComplianceCard
      title="Risk Register Coverage"
      metric={loading ? "---" : `${coverage}% MITIGATED`}
      light={light}
      detail={
        loading
          ? "Loading..."
          : `${mitigated} mitigated, ${open} open of ${total} total risks`
      }
      loading={loading}
    />
  );
}
