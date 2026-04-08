"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

// ── API response types ────────────────────────────────────────
interface SummaryCategory {
  id: string;
  label: string;
  description: string;
  instance_count: number;
  template_fields: string[];
  actual_count: number;
  industry_standard_primary?: string;
  industry_standard_secondary?: string;
}

interface SummaryResponse {
  generated_at: string;
  total_components: number;
  categories: SummaryCategory[];
  status_distribution: Record<string, number>;
  avg_completeness: number;
  total_gaps: number;
}

interface ComponentData {
  name: string;
  category: string;
  operational_status: string;
  completeness_score: number;
  source_files: string[];
  template_fields: Record<string, string>;
  body: string;
  gap_count: number;
  has_gaps: boolean;
}

// ── Status colour map ─────────────────────────────────────────
const STATUS_COLOURS: Record<string, string> = {
  WORKING: "#00ff41",
  DISABLED: "#404040",
  STUB: "#ffb800",
  BROKEN: "#ff1744",
  PLANNED: "#00e5ff",
  PARTIAL: "#b388ff",
  INACTIVE: "#737373",
  UNHOSTED: "#00b4d8",
  DOCUMENTED: "#a855f7",
  REMOVED: "#404040",
};

function statusColour(status: string): string {
  return STATUS_COLOURS[status.toUpperCase()] || "#00e5ff";
}

// ── Views ─────────────────────────────────────────────────────
type CatalogueView =
  | { kind: "taxonomy" }
  | { kind: "category"; categoryId: string }
  | { kind: "detail"; categoryId: string; componentName: string };

// ── Component ─────────────────────────────────────────────────
export default function CatalogueTab() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [compLoading, setCompLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CatalogueView>({ kind: "taxonomy" });

  // Category browser filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [minCompleteness, setMinCompleteness] = useState(0);
  const [sortKey, setSortKey] = useState<"name" | "status" | "completeness" | "gap_count" | "source_files">("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Fetch summary on mount
  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/catalogue");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SummaryResponse = await res.json();
      setSummary(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch catalogue");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch components for a category
  const fetchCategory = useCallback(async (categoryId: string) => {
    setCompLoading(true);
    try {
      const res = await fetch(`/api/catalogue?category=${encodeURIComponent(categoryId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setComponents(json.components || []);
    } catch {
      setComponents([]);
    } finally {
      setCompLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Listen for __catalogueTarget from BattlefieldTab
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const target = w.__catalogueTarget as string | undefined;
    if (target && summary) {
      delete w.__catalogueTarget;
      // Find which category this component belongs to — fetch all to find it
      fetch(`/api/catalogue?search=${encodeURIComponent(target)}`)
        .then((r) => r.json())
        .then((data) => {
          const comp = (data.components || []).find(
            (c: ComponentData) => c.name.toLowerCase() === target.toLowerCase()
          );
          if (comp) {
            setComponents(data.components);
            setView({ kind: "detail", categoryId: comp.category, componentName: comp.name });
          }
        })
        .catch(() => {});
    }
  }, [summary]);

  // When view changes to category, fetch components
  useEffect(() => {
    if (view.kind === "category" || view.kind === "detail") {
      fetchCategory(view.categoryId);
    }
  }, [view.kind === "category" ? view.categoryId : view.kind === "detail" ? view.categoryId : null, fetchCategory]);

  // ── Derived data ────────────────────────────────────────────
  const categoryMap = useMemo(() => {
    if (!summary) return new Map<string, SummaryCategory>();
    return new Map(summary.categories.map((c) => [c.id, c]));
  }, [summary]);

  const activeCategory = useMemo(() => {
    if (view.kind === "category" || view.kind === "detail") {
      return categoryMap.get(view.categoryId) ?? null;
    }
    return null;
  }, [view, categoryMap]);

  const activeComponent = useMemo(() => {
    if (view.kind === "detail") {
      return components.find((c) => c.name === view.componentName) ?? null;
    }
    return null;
  }, [view, components]);

  // Filtered + sorted components
  const filteredComponents = useMemo(() => {
    let items = [...components];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "ALL") {
      items = items.filter((c) => c.operational_status.toUpperCase() === statusFilter);
    }
    items = items.filter((c) => c.completeness_score >= minCompleteness);

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "status":
          cmp = a.operational_status.localeCompare(b.operational_status);
          break;
        case "completeness":
          cmp = a.completeness_score - b.completeness_score;
          break;
        case "gap_count":
          cmp = a.gap_count - b.gap_count;
          break;
        case "source_files":
          cmp = a.source_files.length - b.source_files.length;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return items;
  }, [components, search, statusFilter, minCompleteness, sortKey, sortAsc]);

  // All unique statuses from current components
  const allStatuses = useMemo(() => {
    const s = new Set<string>();
    for (const c of components) {
      s.add(c.operational_status.toUpperCase());
    }
    return Array.from(s).sort();
  }, [components]);

  // ── Helpers ─────────────────────────────────────────────────
  function handleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  function sortIndicator(key: typeof sortKey) {
    if (sortKey !== key) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  }

  function goTaxonomy() {
    setView({ kind: "taxonomy" });
    setSearch("");
    setStatusFilter("ALL");
    setMinCompleteness(0);
  }

  function goCategory(id: string) {
    setView({ kind: "category", categoryId: id });
    setSearch("");
    setStatusFilter("ALL");
    setMinCompleteness(0);
  }

  function goDetail(categoryId: string, componentName: string) {
    setView({ kind: "detail", categoryId, componentName });
  }

  // ── Loading / Error ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[10px] text-text-muted animate-pulse">LOADING CATALOGUE...</span>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <span className="text-[10px] text-accent-red">CATALOGUE FETCH FAILED</span>
        <span className="text-[9px] text-text-muted">{error}</span>
        <button onClick={fetchSummary} className="text-[9px] text-accent-cyan hover:text-accent-green transition-colors">
          RETRY
        </button>
      </div>
    );
  }

  // ── VIEW 1: Taxonomy Overview ───────────────────────────────
  if (view.kind === "taxonomy") {
    const { total_components, avg_completeness, total_gaps, status_distribution, categories } = summary;
    const workingCount = status_distribution["WORKING"] || 0;
    const brokenCount = status_distribution["BROKEN"] || 0;

    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-3 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-accent-green tracking-wider glow-green">
              SYSTEM CATALOGUE
            </span>
            <span className="text-[9px] text-text-muted">{total_components} components</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-text-muted">AVG COMPLETENESS</span>
            <span className="text-[10px] font-bold text-accent-cyan">{Math.round(avg_completeness)}%</span>
            <div className="w-16 h-1.5 bg-bg-card rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${avg_completeness}%`,
                  backgroundColor: avg_completeness >= 80 ? "#00ff41" : avg_completeness >= 50 ? "#ffb800" : "#ff1744",
                }}
              />
            </div>
          </div>
        </div>

        {/* Category Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {categories.map((cat) => {
              const pct = cat.actual_count > 0 ? Math.round((cat.actual_count / total_components) * 100) : 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => goCategory(cat.id)}
                  className="text-left px-3 py-2.5 rounded bg-bg-card hover:bg-bg-card-hover border border-border hover:border-border-bright transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-text-primary group-hover:text-accent-green transition-colors truncate">
                      {cat.label}
                    </span>
                    <span className="text-[9px] text-text-muted shrink-0 ml-2">
                      {cat.actual_count}
                    </span>
                  </div>

                  {/* Share of total */}
                  <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden flex mb-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: "#00b4d8" }}
                    />
                  </div>

                  <div className="text-[9px] text-text-muted truncate">
                    {cat.description.slice(0, 80)}{cat.description.length > 80 ? "..." : ""}
                  </div>
                </button>
              );
            })}
          </div>

          {/* System Health Summary */}
          <div className="mt-4 px-3 py-2.5 rounded bg-bg-card border border-border">
            <span className="text-[10px] font-bold text-accent-cyan tracking-wider">SYSTEM HEALTH</span>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
              <HealthStat label="TOTAL" value={total_components} colour="#d4d4d4" />
              <HealthStat label="WORKING" value={workingCount} colour="#00ff41" />
              <HealthStat label="GAPS" value={total_gaps} colour="#ffb800" />
              <HealthStat label="BROKEN" value={brokenCount} colour="#ff1744" />
            </div>

            {/* Status distribution breakdown */}
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(status_distribution)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <span
                    key={status}
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      color: statusColour(status),
                      backgroundColor: `${statusColour(status)}15`,
                    }}
                  >
                    {status}: {count}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW 2: Category Browser ────────────────────────────────
  if (view.kind === "category" && activeCategory) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header + Breadcrumb */}
        <div className="shrink-0 px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <button onClick={goTaxonomy} className="text-[9px] text-accent-cyan hover:text-accent-green transition-colors">
              &larr; BACK
            </button>
            <span className="text-[9px] text-text-muted">/</span>
            <span className="text-[9px] text-text-muted">CATALOGUE</span>
            <span className="text-[9px] text-text-muted">&gt;</span>
            <span className="text-[9px] text-accent-green font-bold">{activeCategory.label}</span>
            <span className="text-[9px] text-text-muted ml-auto">
              {compLoading ? "loading..." : `${filteredComponents.length} / ${components.length} shown`}
            </span>
          </div>
          <p className="text-[9px] text-text-secondary mb-2">{activeCategory.description}</p>

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-[10px] px-2 py-1 rounded bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:border-accent-green focus:outline-none w-48"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[10px] px-2 py-1 rounded bg-bg-primary border border-border text-text-primary focus:border-accent-green focus:outline-none"
            >
              <option value="ALL">All statuses</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-text-muted">Min:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={minCompleteness}
                onChange={(e) => setMinCompleteness(Number(e.target.value))}
                className="w-20 h-1 accent-accent-green"
              />
              <span className="text-[9px] text-text-secondary tabular-nums w-7">{minCompleteness}%</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {compLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-[10px] text-text-muted animate-pulse">LOADING COMPONENTS...</span>
            </div>
          ) : (
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-bg-secondary z-10">
                <tr className="border-b border-border text-text-muted">
                  <th className="text-left px-3 py-1.5 cursor-pointer hover:text-text-secondary select-none" onClick={() => handleSort("name")}>
                    NAME{sortIndicator("name")}
                  </th>
                  <th className="text-left px-2 py-1.5 cursor-pointer hover:text-text-secondary select-none w-24" onClick={() => handleSort("status")}>
                    STATUS{sortIndicator("status")}
                  </th>
                  <th className="text-left px-2 py-1.5 cursor-pointer hover:text-text-secondary select-none w-36" onClick={() => handleSort("completeness")}>
                    COMPLETENESS{sortIndicator("completeness")}
                  </th>
                  <th className="text-right px-2 py-1.5 cursor-pointer hover:text-text-secondary select-none w-16" onClick={() => handleSort("gap_count")}>
                    GAPS{sortIndicator("gap_count")}
                  </th>
                  <th className="text-right px-3 py-1.5 cursor-pointer hover:text-text-secondary select-none w-16" onClick={() => handleSort("source_files")}>
                    FILES{sortIndicator("source_files")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.map((comp) => (
                  <tr key={comp.name} className="border-b border-border hover:bg-bg-card-hover transition-colors">
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => goDetail(view.kind === "category" ? view.categoryId : comp.category, comp.name)}
                        className="text-accent-cyan hover:text-accent-green transition-colors text-left"
                      >
                        {comp.name}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: statusColour(comp.operational_status),
                          backgroundColor: `${statusColour(comp.operational_status)}15`,
                        }}
                      >
                        {comp.operational_status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-bg-primary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${comp.completeness_score}%`,
                              backgroundColor: comp.completeness_score >= 80 ? "#00ff41" : comp.completeness_score >= 50 ? "#ffb800" : "#ff1744",
                            }}
                          />
                        </div>
                        <span
                          className="text-[9px] font-bold tabular-nums w-7 text-right"
                          style={{ color: comp.completeness_score >= 80 ? "#00ff41" : comp.completeness_score >= 50 ? "#ffb800" : "#ff1744" }}
                        >
                          {comp.completeness_score}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <span style={{ color: comp.gap_count > 0 ? "#ffb800" : "#404040" }}>{comp.gap_count}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-text-secondary">
                      {comp.source_files.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!compLoading && filteredComponents.length === 0 && (
            <div className="text-[10px] text-text-muted text-center py-8">No components match filters</div>
          )}
        </div>
      </div>
    );
  }

  // ── VIEW 3: Component Detail ────────────────────────────────
  if (view.kind === "detail" && activeComponent) {
    const comp = activeComponent;
    const fields = Object.entries(comp.template_fields);
    const filledFields = fields.filter(([, v]) => v && !v.includes("[GAP]")).length;
    const totalFields = fields.length;
    const fillPct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
    const catLabel = activeCategory?.label || view.categoryId;

    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header + Breadcrumb */}
        <div className="shrink-0 px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <button
              onClick={() => goCategory(view.categoryId)}
              className="text-[9px] text-accent-cyan hover:text-accent-green transition-colors"
            >
              &larr; BACK
            </button>
            <span className="text-[9px] text-text-muted">/</span>
            <button onClick={goTaxonomy} className="text-[9px] text-text-muted hover:text-text-secondary transition-colors">
              CATALOGUE
            </button>
            <span className="text-[9px] text-text-muted">&gt;</span>
            <button
              onClick={() => goCategory(view.categoryId)}
              className="text-[9px] text-text-muted hover:text-text-secondary transition-colors"
            >
              {catLabel}
            </button>
            <span className="text-[9px] text-text-muted">&gt;</span>
            <span className="text-[9px] text-accent-green font-bold">{comp.name}</span>
          </div>

          {/* Component header */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-text-primary">{comp.name}</span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{
                color: statusColour(comp.operational_status),
                backgroundColor: `${statusColour(comp.operational_status)}15`,
              }}
            >
              {comp.operational_status}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-24 h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${comp.completeness_score}%`,
                    backgroundColor: comp.completeness_score >= 80 ? "#00ff41" : comp.completeness_score >= 50 ? "#ffb800" : "#ff1744",
                  }}
                />
              </div>
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: comp.completeness_score >= 80 ? "#00ff41" : comp.completeness_score >= 50 ? "#ffb800" : "#ff1744" }}
              >
                {comp.completeness_score}%
              </span>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Left: Metadata table */}
            <div className="rounded bg-bg-card border border-border overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-bold text-accent-cyan tracking-wider">TEMPLATE FIELDS</span>
                <span className="text-[9px] text-text-muted">
                  {filledFields}/{totalFields} filled ({fillPct}%)
                </span>
              </div>
              <div className="divide-y divide-border">
                {fields.map(([key, value]) => {
                  const isGap = value.includes("[GAP]");
                  return (
                    <div key={key} className="flex px-3 py-1.5 text-[10px]">
                      <span className="text-text-muted w-40 shrink-0 truncate" title={key}>{key}</span>
                      <span
                        className={`flex-1 truncate ${isGap ? "text-accent-yellow font-bold" : "text-text-secondary"}`}
                        title={value}
                      >
                        {value || <span className="text-text-muted italic">empty</span>}
                      </span>
                    </div>
                  );
                })}
                {fields.length === 0 && (
                  <div className="px-3 py-4 text-[10px] text-text-muted text-center">No template fields</div>
                )}
              </div>
            </div>

            {/* Right: Source files + gap summary */}
            <div className="space-y-3">
              {/* Source files */}
              <div className="rounded bg-bg-card border border-border overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                  <span className="text-[10px] font-bold text-accent-purple tracking-wider">SOURCE FILES</span>
                  <span className="text-[9px] text-text-muted">{comp.source_files.length} files</span>
                </div>
                <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto">
                  {comp.source_files.map((f) => (
                    <div key={f} className="text-[10px] text-text-secondary px-1 py-0.5 rounded hover:bg-bg-card-hover truncate" title={f}>
                      {f}
                    </div>
                  ))}
                  {comp.source_files.length === 0 && (
                    <div className="text-[10px] text-text-muted text-center py-3">No source files</div>
                  )}
                </div>
              </div>

              {/* Gap summary */}
              <div className="rounded bg-bg-card border border-border overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border">
                  <span className="text-[10px] font-bold text-accent-yellow tracking-wider">GAP SUMMARY</span>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[20px] font-bold tabular-nums" style={{ color: comp.gap_count > 0 ? "#ffb800" : "#00ff41" }}>
                      {comp.gap_count}
                    </span>
                    <span className="text-[9px] text-text-muted">
                      {comp.gap_count === 0 ? "No gaps detected" : `gap${comp.gap_count !== 1 ? "s" : ""} identified`}
                    </span>
                  </div>
                  {comp.gap_count > 0 && (
                    <div className="space-y-0.5">
                      {fields
                        .filter(([, v]) => v.includes("[GAP]"))
                        .map(([key]) => (
                          <div key={key} className="text-[9px] flex items-center gap-1.5">
                            <span className="text-accent-red">&#x25CF;</span>
                            <span className="text-accent-yellow">{key}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Completeness indicator */}
              <div className="rounded bg-bg-card border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-accent-green tracking-wider">COMPLETENESS</span>
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: fillPct >= 80 ? "#00ff41" : fillPct >= 50 ? "#ffb800" : "#ff1744" }}
                  >
                    {fillPct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: fillPct >= 80 ? "#00ff41" : fillPct >= 50 ? "#ffb800" : "#ff1744",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-text-muted">{filledFields} filled</span>
                  <span className="text-[9px] text-text-muted">{totalFields - filledFields} remaining</span>
                </div>
              </div>
            </div>
          </div>

          {/* Body / markdown content */}
          {comp.body && (
            <div className="mt-3 rounded bg-bg-card border border-border overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border">
                <span className="text-[10px] font-bold text-accent-blue tracking-wider">BODY</span>
              </div>
              <pre className="p-3 text-[10px] text-text-secondary whitespace-pre-wrap break-words leading-relaxed overflow-y-auto max-h-96">
                {comp.body}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Detail view loading state
  if (view.kind === "detail" && !activeComponent && compLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[10px] text-text-muted animate-pulse">LOADING COMPONENT...</span>
      </div>
    );
  }

  // Fallback
  return (
    <div className="h-full flex items-center justify-center">
      <span className="text-[10px] text-text-muted">No view selected</span>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────
function HealthStat({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="text-center">
      <div className="text-[18px] font-bold tabular-nums" style={{ color: colour }}>{value}</div>
      <div className="text-[9px] text-text-muted tracking-wider">{label}</div>
    </div>
  );
}
