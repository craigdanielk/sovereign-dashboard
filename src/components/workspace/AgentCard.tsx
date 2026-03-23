"use client";

interface AgentCardProps {
  name: string;
  status: "active" | "idle" | "stale";
  lastRun: string | null;
}

function timeAgo(ts: string | null): string {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_DOT: Record<string, string> = {
  active: "bg-accent-green animate-[pulse-dot_1.5s_ease-in-out_infinite]",
  idle: "bg-accent-yellow",
  stale: "bg-text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  active: "text-accent-green",
  idle: "text-accent-yellow",
  stale: "text-text-muted",
};

export default function AgentCard({ name, status, lastRun }: AgentCardProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded bg-bg-card border border-border">
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
      <span className={`text-xs font-bold ${STATUS_LABEL[status]}`}>
        {name.toUpperCase()}
      </span>
      <span className="text-[10px] text-text-muted ml-auto">{timeAgo(lastRun)}</span>
    </div>
  );
}
