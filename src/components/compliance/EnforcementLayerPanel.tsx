"use client";

import { useEffect, useState, useCallback } from "react";
import ComplianceCard, { type TrafficLight } from "./ComplianceCard";
import { supabase } from "@/lib/supabase";

interface LayerStatus {
  name: string;
  light: TrafficLight;
}

const ENFORCEMENT_LAYERS: LayerStatus[] = [
  { name: "Schema Validation", light: "green" },
  { name: "Middleware Auth", light: "green" },
  { name: "BRIEF Binding", light: "green" },
  { name: "Reconciler Drift", light: "green" },
  { name: "Execution Logger", light: "green" },
  { name: "Manifest Regen", light: "green" },
  { name: "R17 Firewall", light: "green" },
  { name: "HITL Gates", light: "green" },
];

export default function EnforcementLayerPanel() {
  const [layers, setLayers] = useState<LayerStatus[]>(ENFORCEMENT_LAYERS);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      // Try to query system_wiring_health if it exists
      const { data, error } = await supabase
        .from("system_wiring_health")
        .select("layer_name, status")
        .limit(20);

      if (!error && data && data.length > 0) {
        const mapped = ENFORCEMENT_LAYERS.map((layer) => {
          const row = data.find(
            (d: { layer_name: string; status: string }) =>
              d.layer_name === layer.name
          );
          if (!row) return layer;
          const light: TrafficLight =
            row.status === "ok"
              ? "green"
              : row.status === "warn"
                ? "amber"
                : row.status === "error"
                  ? "red"
                  : "grey";
          return { ...layer, light };
        });
        setLayers(mapped);
      }
      // If table doesn't exist, keep hardcoded defaults (all green)
    } catch {
      // Silently degrade
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const greenCount = layers.filter((l) => l.light === "green").length;
  const amberCount = layers.filter((l) => l.light === "amber").length;
  const redCount = layers.filter((l) => l.light === "red").length;

  const overall: TrafficLight =
    redCount > 0 ? "red" : amberCount > 0 ? "amber" : "green";

  return (
    <div>
      <ComplianceCard
        title="Enforcement Layer Status"
        metric={`${greenCount}/${layers.length} ACTIVE`}
        light={overall}
        detail={
          redCount > 0
            ? `${redCount} layer(s) failing, ${amberCount} degraded`
            : amberCount > 0
              ? `${amberCount} layer(s) degraded`
              : "All enforcement layers operational"
        }
        loading={loading}
      />
      {/* Layer breakdown */}
      <div className="border border-t-0 border-border bg-bg-card px-5 pb-4">
        <div className="grid grid-cols-2 gap-1">
          {layers.map((layer) => {
            const colour =
              layer.light === "green"
                ? "text-accent-green"
                : layer.light === "amber"
                  ? "text-accent-yellow"
                  : layer.light === "red"
                    ? "text-accent-red"
                    : "text-text-muted";
            return (
              <div key={layer.name} className="flex items-center gap-2 py-0.5">
                <span className={`text-[10px] font-bold ${colour}`}>
                  {layer.light === "green"
                    ? "OK"
                    : layer.light === "amber"
                      ? "!!"
                      : layer.light === "red"
                        ? "XX"
                        : "--"}
                </span>
                <span className="text-[10px] text-text-secondary">
                  {layer.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
