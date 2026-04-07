import { NextRequest, NextResponse } from "next/server";
import { searchCatalogue } from "@/lib/catalogue";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const results = searchCatalogue(query, limit);

  return NextResponse.json({ query, results, total: results.length }, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
  });
}
