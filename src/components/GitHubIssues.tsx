"use client";

import { useEffect, useState, useCallback } from "react";

interface IssueItem {
  repo: string;
  number: number;
  title: string;
  state: string;
  labels: { name: string; color: string }[];
  assignee: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

const ALL_REPOS = [
  "control-tower",
  "scripts",
  "sovereign-dashboard",
  "aragon-engine",
  "skills",
];

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function GitHubIssues() {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRepo, setFilterRepo] = useState<string>("all");
  const [filterState, setFilterState] = useState<string>("open");
  const [filterLabel, setFilterLabel] = useState<string>("all");

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch("/api/github-issues");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: IssueItem[] = await res.json();
      setIssues(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch issues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    const interval = setInterval(fetchIssues, 60_000);
    return () => clearInterval(interval);
  }, [fetchIssues]);

  // Collect unique labels across all issues
  const allLabels = Array.from(
    new Set(issues.flatMap((i) => i.labels.map((l) => l.name)))
  ).sort();

  // Apply filters
  const filtered = issues.filter((i) => {
    if (filterRepo !== "all" && i.repo !== filterRepo) return false;
    if (filterState !== "all" && i.state !== filterState) return false;
    if (filterLabel !== "all" && !i.labels.some((l) => l.name === filterLabel))
      return false;
    return true;
  });

  // Group by repo
  const grouped: Record<string, IssueItem[]> = {};
  for (const issue of filtered) {
    if (!grouped[issue.repo]) grouped[issue.repo] = [];
    grouped[issue.repo].push(issue);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[10px] text-text-muted animate-pulse">
          FETCHING GITHUB ISSUES...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[10px] text-accent-red">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header + filters */}
      <div className="px-4 py-2 border-b border-border">
        <h2 className="text-sm font-bold tracking-wider uppercase text-text-primary mb-2">
          GitHub Issues
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* Repo filter */}
          <select
            value={filterRepo}
            onChange={(e) => setFilterRepo(e.target.value)}
            className="text-[10px] bg-bg-card border border-border rounded px-1.5 py-0.5 text-text-primary focus:outline-none focus:border-accent-green"
          >
            <option value="all">All repos</option>
            {ALL_REPOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* State filter */}
          <div className="flex gap-1">
            {["open", "closed", "all"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterState(s)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  filterState === s
                    ? s === "open"
                      ? "bg-accent-green/20 text-accent-green"
                      : s === "closed"
                        ? "bg-accent-purple/20 text-accent-purple"
                        : "bg-bg-card-hover text-text-primary"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Label filter */}
          {allLabels.length > 0 && (
            <select
              value={filterLabel}
              onChange={(e) => setFilterLabel(e.target.value)}
              className="text-[10px] bg-bg-card border border-border rounded px-1.5 py-0.5 text-text-primary focus:outline-none focus:border-accent-green"
            >
              <option value="all">All labels</option>
              {allLabels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}

          <span className="text-[9px] text-text-muted ml-auto self-center">
            {filtered.length} issue{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Issue list grouped by repo */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Object.entries(grouped).map(([repo, repoIssues]) => (
          <div key={repo}>
            <div className="flex items-center gap-2 px-2 mb-1">
              <span className="text-[10px] font-bold text-accent-cyan tracking-wider uppercase">
                {repo}
              </span>
              <span className="text-[9px] text-text-muted">
                {repoIssues.length}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-0.5">
              {repoIssues.map((issue) => (
                <a
                  key={`${issue.repo}-${issue.number}`}
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-1.5 rounded bg-bg-card hover:bg-bg-card-hover border border-border transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[9px] font-bold shrink-0 ${
                          issue.state === "open"
                            ? "text-accent-green"
                            : "text-accent-purple"
                        }`}
                      >
                        #{issue.number}
                      </span>
                      <span className="text-[10px] text-text-primary truncate">
                        {issue.title}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-muted shrink-0 ml-2">
                      {timeAgo(issue.updated_at)}
                    </span>
                  </div>

                  {/* Labels */}
                  {issue.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {issue.labels.map((label) => (
                        <span
                          key={label.name}
                          className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{
                            backgroundColor: `#${label.color}25`,
                            color: `#${label.color}`,
                          }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Assignee */}
                  {issue.assignee && (
                    <span className="text-[9px] text-text-muted mt-0.5 block">
                      assigned: {issue.assignee}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center text-text-muted py-4 text-xs">
            No issues match filters
          </div>
        )}
      </div>
    </div>
  );
}
