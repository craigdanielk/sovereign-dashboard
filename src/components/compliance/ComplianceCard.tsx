"use client";

export type TrafficLight = "green" | "amber" | "red" | "grey";

const LIGHT_COLOUR: Record<TrafficLight, string> = {
  green: "bg-accent-green",
  amber: "bg-accent-yellow",
  red: "bg-accent-red",
  grey: "bg-text-muted",
};

const LIGHT_GLOW: Record<TrafficLight, string> = {
  green: "shadow-[0_0_8px_rgba(0,255,65,0.5)]",
  amber: "shadow-[0_0_8px_rgba(255,184,0,0.5)]",
  red: "shadow-[0_0_8px_rgba(255,23,68,0.5)]",
  grey: "",
};

interface ComplianceCardProps {
  title: string;
  metric: string;
  light: TrafficLight;
  detail: string;
  loading?: boolean;
}

export default function ComplianceCard({
  title,
  metric,
  light,
  detail,
  loading = false,
}: ComplianceCardProps) {
  return (
    <div className="border border-border bg-bg-card p-5 flex flex-col gap-3 hover:border-border-bright transition-colors">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary">
          {title}
        </h3>
        <div
          className={`w-3 h-3 rounded-full ${LIGHT_COLOUR[light]} ${LIGHT_GLOW[light]}`}
          title={light.toUpperCase()}
        />
      </div>

      {/* Metric */}
      <div className="text-2xl font-bold text-accent-green glow-green tracking-tight">
        {loading ? (
          <span className="text-text-muted animate-pulse">---</span>
        ) : (
          metric
        )}
      </div>

      {/* Detail */}
      <p className="text-[11px] text-text-secondary leading-relaxed">
        {loading ? "Loading..." : detail}
      </p>
    </div>
  );
}
