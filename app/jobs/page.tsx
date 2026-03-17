"use client";

import { useEffect, useState, useCallback } from "react";
import { ExpandableText } from "../components/ExpandableText";
import { NavBar } from "../components/NavBar";

interface Job {
  name: string;
  summary: string;
  completedAt: string;
  definitionOfDone: string[];
  lastUpdated: string | null;
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

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function JobCard({ job }: { job: Job }) {
  return (
    <div className="glass-inner p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: "var(--green)",
              boxShadow: "0 0 8px rgba(48,209,88,0.4)",
            }}
          />
          <h3
            className="text-[13px] font-semibold tracking-wide truncate"
            style={{
              color: "var(--text-1)",
              fontFamily: "var(--font-display)",
            }}
          >
            {job.name.replace(/^BRIEF::/, "").replace(/::.*$/, "")}
          </h3>
        </div>
        <span
          className="text-[10px] font-medium flex-shrink-0"
          style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
        >
          {formatDate(job.completedAt)}
        </span>
      </div>

      {/* Summary */}
      {job.summary && (
        <ExpandableText
          text={job.summary}
          maxLength={180}
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--text-2)" }}
        />
      )}

      {/* Definition of Done */}
      {job.definitionOfDone.length > 0 && (
        <div className="space-y-1.5">
          <div
            className="text-[10px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-4)" }}
          >
            What was built
          </div>
          <ul className="space-y-1">
            {job.definitionOfDone.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[10px] leading-relaxed"
                style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
              >
                <span
                  className="flex-shrink-0 mt-1"
                  style={{ color: "var(--green)" }}
                >
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div
        className="text-[10px] pt-1"
        style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
      >
        Updated {timeAgo(job.lastUpdated)}
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobs(data.jobs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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
            onClick={fetchJobs}
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
            style={{ color: "var(--text-1)", fontFamily: "var(--font-display)" }}
          >
            Completed Jobs
          </h1>
          <span
            className="text-[12px] font-medium"
            style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
          >
            {jobs.length} jobs
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="glass p-8 text-center">
            <div
              className="text-[13px]"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
            >
              Loading completed jobs…
            </div>
          </div>
        ) : error ? (
          <div className="glass p-8 text-center">
            <div className="text-[13px]" style={{ color: "var(--red)" }}>
              {error}
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="glass p-8 text-center">
            <div
              className="text-[13px]"
              style={{ color: "var(--text-3)", fontFamily: "var(--font-mono)" }}
            >
              No completed jobs found
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job, i) => (
              <div
                key={job.name}
                className={`glass p-5 animate-fade-up delay-${Math.min(i + 1, 8)}`}
              >
                <JobCard job={job} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
