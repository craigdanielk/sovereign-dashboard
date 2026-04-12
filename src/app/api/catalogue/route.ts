import { NextRequest, NextResponse } from "next/server";
import type { CatalogueIndex, CatalogueComponent } from "@/lib/types";
import catalogueRaw from "@/data/catalogue-index.json";

const catalogue = catalogueRaw as unknown as CatalogueIndex;

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
};

function searchComponent(c: CatalogueComponent, q: string): boolean {
  const lower = q.toLowerCase();
  if (c.name.toLowerCase().includes(lower)) return true;
  if (c.body.toLowerCase().includes(lower)) return true;
  for (const v of Object.values(c.template_fields)) {
    if (v.toLowerCase().includes(lower)) return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const minCompleteness = searchParams.get("min_completeness");

  const hasFilters = category || search || status || minCompleteness;

  // No filters → return summary stats
  if (!hasFilters) {
    const components = catalogue.components;

    // Compute actual count per category from components
    const countByCategory: Record<string, number> = {};
    const statusDist: Record<string, number> = {};
    let totalCompleteness = 0;
    let totalGaps = 0;

    for (const c of components) {
      countByCategory[c.category] = (countByCategory[c.category] ?? 0) + 1;
      statusDist[c.operational_status] =
        (statusDist[c.operational_status] ?? 0) + 1;
      totalCompleteness += c.completeness_score;
      totalGaps += c.gap_count;
    }

    const categoriesWithCount = catalogue.categories.map((cat) => ({
      ...cat,
      actual_count: countByCategory[cat.id] ?? 0,
    }));

    return NextResponse.json(
      {
        generated_at: catalogue.generated_at,
        total_components: components.length,
        categories: categoriesWithCount,
        status_distribution: statusDist,
        avg_completeness:
          components.length > 0
            ? Math.round((totalCompleteness / components.length) * 10) / 10
            : 0,
        total_gaps: totalGaps,
      },
      { headers: CACHE_HEADERS }
    );
  }

  // Filtered response → return matching components
  let results = catalogue.components;

  if (category) {
    results = results.filter(
      (c) => c.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (status) {
    results = results.filter(
      (c) => c.operational_status.toLowerCase() === status.toLowerCase()
    );
  }

  if (minCompleteness) {
    const threshold = parseFloat(minCompleteness);
    if (!isNaN(threshold)) {
      results = results.filter((c) => c.completeness_score >= threshold);
    }
  }

  if (search) {
    results = results.filter((c) => searchComponent(c, search));
  }

  return NextResponse.json(
    { count: results.length, components: results },
    { headers: CACHE_HEADERS }
  );
}
