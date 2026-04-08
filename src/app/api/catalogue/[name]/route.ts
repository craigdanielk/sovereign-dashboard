import { NextRequest, NextResponse } from "next/server";
import type { CatalogueIndex } from "@/lib/types";
import catalogueRaw from "@/data/catalogue-index.json";

const catalogue = catalogueRaw as unknown as CatalogueIndex;

const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);

  const component = catalogue.components.find(
    (c) => c.name.toLowerCase() === decoded.toLowerCase()
  );

  if (!component) {
    return NextResponse.json(
      { error: `Component "${decoded}" not found` },
      { status: 404, headers: CACHE_HEADERS }
    );
  }

  const categoryDef = catalogue.categories.find(
    (cat) => cat.id === component.category
  );

  return NextResponse.json(
    { component, category: categoryDef ?? null },
    { headers: CACHE_HEADERS }
  );
}
