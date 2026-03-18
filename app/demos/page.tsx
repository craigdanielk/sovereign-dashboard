"use client";

import { useEffect, useState, useCallback } from "react";
import { ExpandableText } from "../components/ExpandableText";
import { NavBar } from "../components/NavBar";

interface Demo {
  id: number;
  name: string;
  url: string;
  whatItDoes: string;
  problemSolved: string;
  lastUpdated: string | null;
  status: string;
  verifiedByHuman: boolean;
  agent: string;
}

interface GateStatus {
  current: number;
  required: number;
  approved: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── OUTREACH Gate Section ────────────────────────── */

function OutreachGate({
  gateStatus,
  onApprove,
}: {
  gateStatus: GateStatus;
  onApprove: () => void;
}) {
  const canApprove =
    gateStatus.current >= gateStatus.required && !gateStatus.approved;
  const progressPct = Math.min(
    (gateStatus.current / gateStatus.required) * 100,
    100,
  );

  return (
    <div
      className="glass p-5 space-y-4"
      style={{
        borderColor: gateStatus.approved
          ? "rgba(48,209,88,0.15)"
          : "rgba(255,159,10,0.15)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: gateStatus.approved
                ? "var(--green)"
                : "var(--orange)",
              boxShadow: gateStatus.approved
                ? "0 0 10px rgba(48,209,88,0.4)"
                : "0 0 10px rgba(255,159,10,0.4)",
            }}
          />
          <h2
            className="text-[15px] font-semibold tracking-tight"
            style={{
              color: "var(--text-1)",
              fontFamily: "var(--font-display)",
            }}
          >
            OUTREACH Gate
          </h2>
        </div>
        <span
          className="text-[12px] font-semibold px-3 py-1 rounded-full"
          style={{
            background: gateStatus.approved
              ? "var(--green-dim)"
              : "var(--orange-dim)",
            color: gateStatus.approved ? "var(--green)" : "var(--orange)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {gateStatus.approved
            ? "APPROVED"
            : `${gateStatus.current}/${gateStatus.required}`}
        </span>
      </div>

      {/* Progress Bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progressPct}%`,
            background: gateStatus.approved
              ? "var(--green)"
              : progressPct >= 100
                ? "var(--green)"
                : "var(--orange)",
          }}
        />
      </div>

      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "var(--text-3)" }}
      >
        {gateStatus.approved
          ? "OUTREACH is approved. The system can send outreach messages to prospects."
          : gateStatus.current >= gateStatus.required
            ? "All demos ready. Click Approve to activate OUTREACH pipeline."
            : `${gateStatus.required - gateStatus.current} more demo(s) needed before OUTREACH can be activated.`}
      </p>

      {/* Approve Button */}
      <button
        onClick={onApprove}
        disabled={!canApprove}
        className="w-full py-2.5 rounded-xl text-[12px] font-semibold tracking-wide transition-all duration-200 cursor-pointer"
        style={{
          fontFamily: "var(--font-mono)",
          background: canApprove
            ? "var(--green-dim)"
            : "rgba(255,255,255,0.03)",
          color: canApprove ? "var(--green)" : "var(--text-4)",
          border: canApprove
            ? "1px solid rgba(48,209,88,0.2)"
            : "1px solid rgba(255,255,255,0.04)",
          opacity: canApprove ? 1 : 0.5,
          cursor: canApprove ? "pointer" : "not-allowed",
        }}
      >
        {gateStatus.approved
          ? "✓ OUTREACH APPROVED"
          : canApprove
            ? "APPROVE OUTREACH"
            : `LOCKED — ${gateStatus.current}/${gateStatus.required} DEMOS`}
      </button>
    </div>
  );
}

/* ── Demo Card ────────────────────────────────────── */

function DemoCard({ demo, onReview }: { demo: Demo; onReview: (id: number) => void }) {
  return (
    <div className="glass-inner p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: demo.verifiedByHuman ? "var(--green)" : "var(--orange)",
              boxShadow: demo.verifiedByHuman
                ? "0 0 8px rgba(48,209,88,0.4)"
                : "0 0 8px rgba(255,159,10,0.4)",
            }}
          />
          <h3
            className="text-[13px] font-semibold tracking-wide truncate"
            style={{
              color: "var(--text-1)",
              fontFamily: "var(--font-display)",
            }}
          >
            {demo.name
              .replace(/^delivery::/, "")
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())}
          </h3>
        </div>
        <span
          className="text-[10px] font-medium flex-shrink-0"
          style={{
            color: "var(--text-4)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {timeAgo(demo.lastUpdated)}
        </span>
      </div>

      {/* Agent + Status */}
      <div className="flex items-center gap-2">
        {demo.agent && (
          <span
            className="text-[10px] font-medium px-2 py-[3px] rounded-full"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-2)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {demo.agent}
          </span>
        )}
        {demo.status && (
          <span
            className="text-[10px] font-medium px-2 py-[3px] rounded-full"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-3)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {demo.status}
          </span>
        )}
      </div>

      {/* URL */}
      {demo.url && (
        <a
          href={demo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[11px] font-medium transition-colors"
          style={{
            color: "var(--blue)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{ opacity: 0.7 }}
          >
            <path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9.5a2 2 0 0 1-1.88 1.5H4a1.5 1.5 0 1 1 0-3h2.354M9.646 10.5H12a3 3 0 0 0 0-6H9a3 3 0 0 0-2.83 4h.34A2 2 0 0 1 8.5 7H12a1.5 1.5 0 0 1 0 3H9.646z" />
          </svg>
          {demo.url.replace(/^https?:\/\//, "")}
        </a>
      )}

      {/* What it does */}
      {demo.whatItDoes && (
        <div className="space-y-1">
          <div
            className="text-[10px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-4)" }}
          >
            What it does
          </div>
          <ExpandableText
            text={demo.whatItDoes}
            maxLength={200}
            className="text-[11px] leading-relaxed"
            style={{ color: "var(--text-2)" }}
          />
        </div>
      )}

      {/* Human Review Button */}
      {!demo.verifiedByHuman && (
        <button
          onClick={() => onReview(demo.id)}
          className="w-full py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 cursor-pointer"
          style={{
            fontFamily: "var(--font-mono)",
            background: "var(--blue-dim)",
            color: "var(--blue)",
            border: "1px solid rgba(10,132,255,0.2)",
          }}
        >
          MARK AS REVIEWED
        </button>
      )}
      {demo.verifiedByHuman && (
        <div
          className="text-[10px] font-medium text-center py-1.5"
          style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}
        >
          Verified by human
        </div>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────── */

export default function DemosPage() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [gateStatus, setGateStatus] = useState<GateStatus>({
    current: 0,
    required: 5,
    approved: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDemos = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/demos");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDemos(data.demos ?? []);
      setGateStatus(
        data.gateStatus ?? { current: 0, required: 5, approved: false },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch demos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDemos();
  }, [fetchDemos]);

  const handleApprove = async () => {
    // Gate is now auto-calculated from verified demo count
    setGateStatus((prev) => ({ ...prev, approved: true }));
  };

  const handleReview = async (demoId: number) => {
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: demoId }),
      });
      const data = await res.json();
      if (data.ok) {
        // Update local state
        setDemos((prev) =>
          prev.map((d) =>
            d.id === demoId ? { ...d, verifiedByHuman: true } : d,
          ),
        );
        // Recalculate gate
        const newVerified = demos.filter(
          (d) => d.verifiedByHuman || d.id === demoId,
        ).length;
        setGateStatus((prev) => ({
          ...prev,
          current: newVerified,
          approved: newVerified >= prev.required,
        }));
      }
    } catch {
      // silent fail — user can retry
    }
  };

  return (
    <div className="relative min-h-screen" style={{ zIndex: 1 }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 animate-fade-in"
        style={{
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span
              className="text-[15px] font-semibold tracking-tight"
              style={{
                color: "var(--text-1)",
                fontFamily: "var(--font-display)",
              }}
            >
              Sovereign
            </span>
            <div
              className="h-4 w-px"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <NavBar />
          </div>
          <button
            onClick={fetchDemos}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "var(--text-2)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              style={{ opacity: 0.7 }}
            >
              <path
                d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z"
                fill="currentColor"
              />
            </svg>
            Sync
          </button>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 space-y-6">
        {/* Title */}
        <div className="flex items-baseline justify-between">
          <h1
            className="text-[20px] font-semibold tracking-tight"
            style={{
              color: "var(--text-1)",
              fontFamily: "var(--font-display)",
            }}
          >
            Demo Library
          </h1>
          <span
            className="text-[12px] font-medium"
            style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
          >
            {demos.length} demos
          </span>
        </div>

        {/* OUTREACH Gate */}
        <OutreachGate gateStatus={gateStatus} onApprove={handleApprove} />

        {/* Content */}
        {loading ? (
          <div className="glass p-8 text-center">
            <div
              className="text-[13px]"
              style={{
                color: "var(--text-3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Loading demos…
            </div>
          </div>
        ) : error ? (
          <div className="glass p-8 text-center">
            <div className="text-[13px]" style={{ color: "var(--red)" }}>
              {error}
            </div>
          </div>
        ) : demos.length === 0 ? (
          <div className="glass p-8 text-center">
            <div
              className="text-[13px]"
              style={{
                color: "var(--text-3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              No demos found. Complete more BRIEFs to populate the demo library.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demos.map((demo, i) => (
              <div
                key={demo.id ?? demo.name}
                className={`glass p-5 animate-fade-up delay-${Math.min(i + 1, 8)}`}
              >
                <DemoCard demo={demo} onReview={handleReview} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
