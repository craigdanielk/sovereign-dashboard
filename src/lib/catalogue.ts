import catalogueData from "@/data/catalogue.json";

export interface CatalogueEntry {
  name: string;
  display_name: string;
  category: string;
  operational_status: string;
  completeness_score: number;
  gap_count: number;
  has_gaps: boolean;
  source_files: string[];
  brief_id: string | null;
  version: string;
  generated_at: string;
  role_description: string;
  dependencies_agents: string[];
  dependencies_services: string[];
  dependencies_skills: string[];
  body_preview: string;
  body: string;
  search_text: string;
  file_path: string;
}

export interface CatalogueData {
  generated_at: string;
  total: number;
  categories: Record<string, number>;
  entries: CatalogueEntry[];
}

const catalogue = catalogueData as CatalogueData;

// Index by lowercase name for fast lookup
const byName = new Map<string, CatalogueEntry>();
const byDisplayName = new Map<string, CatalogueEntry>();

for (const entry of catalogue.entries) {
  byName.set(entry.name.toLowerCase(), entry);
  byDisplayName.set(entry.display_name.toLowerCase(), entry);
}

export function lookupCataloguePage(nodeName: string): CatalogueEntry | null {
  const lower = nodeName.toLowerCase();
  return byName.get(lower) || byDisplayName.get(lower) || null;
}

export function getCatalogueByCategory(category: string): CatalogueEntry[] {
  return catalogue.entries.filter((e) => e.category === category);
}

export function getCategoryStats(): Array<{
  category: string;
  total: number;
  working: number;
  configured: number;
  broken: number;
  partial: number;
  other: number;
  avg_completeness: number;
}> {
  const stats: Record<string, { total: number; working: number; configured: number; broken: number; partial: number; other: number; completeness_sum: number }> = {};

  for (const entry of catalogue.entries) {
    const cat = entry.category;
    if (!stats[cat]) {
      stats[cat] = { total: 0, working: 0, configured: 0, broken: 0, partial: 0, other: 0, completeness_sum: 0 };
    }
    stats[cat].total++;
    stats[cat].completeness_sum += entry.completeness_score;
    const s = (entry.operational_status || "").toUpperCase();
    if (s === "WORKING") stats[cat].working++;
    else if (s === "CONFIGURED") stats[cat].configured++;
    else if (s === "BROKEN") stats[cat].broken++;
    else if (s === "PARTIAL") stats[cat].partial++;
    else stats[cat].other++;
  }

  return Object.entries(stats).map(([category, s]) => ({
    category,
    total: s.total,
    working: s.working,
    configured: s.configured,
    broken: s.broken,
    partial: s.partial,
    other: s.other,
    avg_completeness: s.total > 0 ? Math.round(s.completeness_sum / s.total) : 0,
  })).sort((a, b) => a.category.localeCompare(b.category));
}

export function searchCatalogue(query: string, limit = 50): CatalogueEntry[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);

  const scored: Array<{ entry: CatalogueEntry; score: number }> = [];

  for (const entry of catalogue.entries) {
    let score = 0;
    const searchText = entry.search_text;
    const name = entry.name.toLowerCase();
    const displayName = entry.display_name.toLowerCase();

    // Exact name match = highest priority
    if (name === q || displayName === q) score += 100;
    // Name starts with query
    else if (name.startsWith(q) || displayName.startsWith(q)) score += 50;
    // Name contains query
    else if (name.includes(q) || displayName.includes(q)) score += 30;

    // Word matches in search_text
    for (const word of words) {
      if (word.length < 2) continue;
      if (name.includes(word)) score += 10;
      else if (searchText.includes(word)) score += 2;
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

export function getTaxonomyOverview() {
  const total = catalogue.total;
  const statusCounts = { WORKING: 0, CONFIGURED: 0, BROKEN: 0, PARTIAL: 0, UNKNOWN: 0 };
  let totalCompleteness = 0;
  let withGaps = 0;

  for (const entry of catalogue.entries) {
    const s = (entry.operational_status || "UNKNOWN").toUpperCase() as keyof typeof statusCounts;
    if (s in statusCounts) statusCounts[s]++;
    else statusCounts.UNKNOWN++;
    totalCompleteness += entry.completeness_score;
    if (entry.has_gaps) withGaps++;
  }

  const workingPct = total > 0 ? Math.round((statusCounts.WORKING / total) * 100) : 0;
  const avgCompleteness = total > 0 ? Math.round(totalCompleteness / total) : 0;

  return {
    total,
    categories: catalogue.categories,
    status_counts: statusCounts,
    working_pct: workingPct,
    avg_completeness: avgCompleteness,
    with_gaps: withGaps,
    generated_at: catalogue.generated_at,
  };
}

export { catalogue };
