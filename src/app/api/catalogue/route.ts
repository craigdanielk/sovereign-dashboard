import { NextRequest, NextResponse } from "next/server";
import { getCategoryStats, getTaxonomyOverview, getCatalogueByCategory } from "@/lib/catalogue";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  if (category) {
    const entries = getCatalogueByCategory(category);
    return NextResponse.json({ category, entries, total: entries.length }, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  const stats = getCategoryStats();
  const overview = getTaxonomyOverview();

  return NextResponse.json({ stats, overview }, {
    headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
  });
}
