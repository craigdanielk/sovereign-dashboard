import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface TemplatesData {
  templates: Array<{
    name: string;
    category: string;
    trigger: string;
    steps: string[];
    output: string;
    roiTier?: string;
    description: string;
  }>;
  categories: Array<{ name: string; count: number }>;
  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<TemplatesData>("templates", async () => {
      // Build pseudo-templates from briefs data (unique brief name patterns)
      const { data: briefs, error } = await supabase
        .from("briefs")
        .select("id, name, priority, status, summary, triggered_by, created_at")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const rows = briefs ?? [];

      // Group by triggered_by to build categories
      const categoryMap = new Map<string, { count: number; briefs: string[] }>();
      for (const row of rows) {
        const trigger = row.triggered_by ?? "manual";
        const existing = categoryMap.get(trigger);
        if (!existing) {
          categoryMap.set(trigger, { count: 1, briefs: [row.name] });
        } else {
          existing.count++;
          existing.briefs.push(row.name);
        }
      }

      const templates = rows.map((row) => ({
        name: row.name,
        category: row.triggered_by ?? "manual",
        trigger: row.triggered_by ?? "",
        steps: [] as string[],
        output: row.summary ?? "",
        roiTier: row.priority ?? undefined,
        description: row.summary ?? "",
      }));

      const categories = Array.from(categoryMap.entries()).map(([name, info]) => ({
        name,
        count: info.count,
      }));

      return { templates, categories, fetchedAt: new Date().toISOString() };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/templates]", msg);
    return NextResponse.json({ error: msg, templates: [], categories: [] }, { status: 500 });
  }
}
