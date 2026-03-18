"use client";

import { useEffect, useState, useCallback } from "react";
import { ExpandableText } from "../components/ExpandableText";
import { NavBar } from "../components/NavBar";

/* ── Interfaces ──────────────────────────────────── */

interface WorkflowTemplate {
  name: string;
  category: string;
  trigger: string;
  steps: string[];
  output: string;
  roiTier?: string;
  skillGaps?: string[];
  description?: string;
}

interface TemplateCategory {
  name: string;
  count: number;
  description?: string;
}

/* ── Category Colors ─────────────────────────────── */

const CATEGORY_COLORS: Record<string, { color: string; dim: string }> = {
  "lead-gen": { color: "var(--green)", dim: "var(--green-dim)" },
  CRM: { color: "var(--blue)", dim: "var(--blue-dim)" },
  invoice: { color: "var(--orange)", dim: "var(--orange-dim)" },
  content: { color: "var(--purple)", dim: "var(--purple-dim)" },
  social: { color: "var(--yellow)", dim: "var(--yellow-dim)" },
};

function getCategoryColor(category: string): { color: string; dim: string } {
  return (
    CATEGORY_COLORS[category] ?? {
      color: "var(--text-3)",
      dim: "rgba(142,142,147,0.14)",
    }
  );
}

const ROI_COLORS: Record<string, { color: string; dim: string }> = {
  high: { color: "var(--green)", dim: "var(--green-dim)" },
  medium: { color: "var(--blue)", dim: "var(--blue-dim)" },
  low: { color: "var(--text-3)", dim: "rgba(142,142,147,0.14)" },
};

/* ── Skeleton Card ───────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="skeleton h-4 w-48" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-3 w-36" />
      <div className="space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-5/6" />
        <div className="skeleton h-3 w-4/6" />
      </div>
      <div className="skeleton h-3 w-40" />
    </div>
  );
}

/* ── Category Filter Bar ─────────────────────────── */

function CategoryFilterBar({
  categories,
  active,
  onSelect,
}: {
  categories: TemplateCategory[];
  active: string;
  onSelect: (name: string) => void;
}) {
  const allCount = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter by category"
    >
      {/* All pill */}
      <button
        onClick={() => onSelect("All")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 500,
          background:
            active === "All"
              ? "rgba(255,255,255,0.12)"
              : "rgba(255,255,255,0.04)",
          color: active === "All" ? "var(--text-1)" : "var(--text-3)",
          border:
            active === "All"
              ? "1px solid rgba(255,255,255,0.14)"
              : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        All
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full"
          style={{
            background:
              active === "All"
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.04)",
            color: active === "All" ? "var(--text-2)" : "var(--text-4)",
          }}
        >
          {allCount}
        </span>
      </button>

      {categories.map((cat) => {
        const isActive = active === cat.name;
        const { color, dim } = getCategoryColor(cat.name);
        return (
          <button
            key={cat.name}
            onClick={() => onSelect(cat.name)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 500,
              background: isActive ? dim : "rgba(255,255,255,0.04)",
              color: isActive ? color : "var(--text-3)",
              border: isActive
                ? `1px solid ${color}33`
                : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {cat.name}
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{
                background: isActive
                  ? `${color}1a`
                  : "rgba(255,255,255,0.04)",
                color: isActive ? color : "var(--text-4)",
              }}
            >
              {cat.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Template Card ───────────────────────────────── */

function TemplateCard({ template }: { template: WorkflowTemplate }) {
  const { color, dim } = getCategoryColor(template.category);
  const roiStyle = template.roiTier
    ? ROI_COLORS[template.roiTier] ?? ROI_COLORS.low
    : null;

  const MAX_VISIBLE_STEPS = 5;
  const visibleSteps = template.steps.slice(0, MAX_VISIBLE_STEPS);
  const hiddenSteps = template.steps.slice(MAX_VISIBLE_STEPS);
  const hiddenText = hiddenSteps
    .map((s, i) => `${MAX_VISIBLE_STEPS + i + 1}. ${s}`)
    .join("\n");

  return (
    <div className="glass-inner p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className="text-[13px] font-semibold tracking-wide min-w-0"
          style={{
            color: "var(--text-1)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {template.name}
        </h3>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{
            background: dim,
            color: color,
            fontFamily: "var(--font-mono)",
          }}
        >
          {template.category}
        </span>
      </div>

      {/* Description */}
      {template.description && (
        <ExpandableText
          text={template.description}
          maxLength={140}
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--text-2)" }}
        />
      )}

      {/* Trigger */}
      <div
        className="text-[10px] leading-relaxed"
        style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
      >
        Trigger: <span style={{ color: "var(--text-3)" }}>{template.trigger}</span>
      </div>

      {/* Steps */}
      {template.steps.length > 0 && (
        <div className="space-y-1.5">
          <div
            className="text-[10px] font-semibold tracking-wider uppercase"
            style={{ color: "var(--text-4)" }}
          >
            Steps
          </div>
          <ol className="space-y-1">
            {visibleSteps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[10px] leading-relaxed"
                style={{
                  color: "var(--text-3)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: "var(--text-4)" }}
                >
                  {i + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {hiddenSteps.length > 0 && (
            <ExpandableText
              text={hiddenText}
              maxLength={0}
              className="text-[10px] leading-relaxed whitespace-pre-line"
              style={{
                color: "var(--text-3)",
                fontFamily: "var(--font-mono)",
              }}
            />
          )}
        </div>
      )}

      {/* Output */}
      <div
        className="text-[10px] leading-relaxed"
        style={{ color: "var(--text-4)", fontFamily: "var(--font-mono)" }}
      >
        Output: <span style={{ color: "var(--text-3)" }}>{template.output}</span>
      </div>

      {/* Footer: ROI + Skill Gaps */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {roiStyle && template.roiTier && (
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase"
            style={{
              background: roiStyle.dim,
              color: roiStyle.color,
              fontFamily: "var(--font-mono)",
            }}
          >
            ROI: {template.roiTier}
          </span>
        )}
        {template.skillGaps &&
          template.skillGaps.length > 0 &&
          template.skillGaps.map((gap) => (
            <span
              key={gap}
              className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "var(--red-dim)",
                color: "var(--red)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {gap}
            </span>
          ))}
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────── */

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const fetchTemplates = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTemplates(data.templates ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch templates",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Auto-refresh every 120 seconds
  useEffect(() => {
    const interval = setInterval(fetchTemplates, 120_000);
    return () => clearInterval(interval);
  }, [fetchTemplates]);

  // Derive categories from data
  const categories: TemplateCategory[] = Object.entries(
    templates.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Filtered templates
  const filtered =
    activeCategory === "All"
      ? templates
      : templates.filter((t) => t.category === activeCategory);

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
          <div className="flex items-center gap-3">
            <span
              className="text-[11px] font-medium"
              style={{
                color: "var(--text-4)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {filtered.length} template{filtered.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={fetchTemplates}
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
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 space-y-6">
        {/* Title */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h1
              className="text-[20px] font-semibold tracking-tight"
              style={{
                color: "var(--text-1)",
                fontFamily: "var(--font-display)",
              }}
            >
              Workflow Templates
            </h1>
            <span
              className="text-[11px] font-medium"
              style={{
                color: "var(--text-4)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Templates
            </span>
          </div>
          <span
            className="text-[12px] font-medium"
            style={{
              color: "var(--text-3)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {templates.length} total
          </span>
        </div>

        {/* Category Filter */}
        {!loading && categories.length > 0 && (
          <CategoryFilterBar
            categories={categories}
            active={activeCategory}
            onSelect={setActiveCategory}
          />
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`animate-fade-up delay-${Math.min(i + 1, 8)}`}
              >
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="glass p-8 text-center">
            <div className="text-[13px]" style={{ color: "var(--red)" }}>
              {error}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass p-8 text-center">
            <div
              className="text-[13px]"
              style={{
                color: "var(--text-3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {templates.length === 0
                ? "No templates available"
                : `No templates in "${activeCategory}"`}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((template, i) => (
              <div
                key={template.name}
                className={`glass p-5 animate-fade-up delay-${Math.min(i + 1, 8)}`}
              >
                <TemplateCard template={template} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
