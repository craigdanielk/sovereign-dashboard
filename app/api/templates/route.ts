import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/rag";
import { dedupByName } from "@/lib/dedup";

export const dynamic = "force-dynamic";

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

interface RagEntity {
  name: string;
  description: string;
  last_updated?: string | null;
  related_projects?: string[];
}

export async function GET() {
  try {
    const [patternResult, categoryResult] = await Promise.all([
      searchEntities("workflow-pattern", "workflow-pattern", 50) as Promise<{ entities?: RagEntity[] }>,
      searchEntities("workflow-category", "config", 10) as Promise<{ entities?: RagEntity[] }>,
    ]);

    const patterns = dedupByName(patternResult?.entities ?? []);
    const categories = dedupByName(categoryResult?.entities ?? []);

    // Parse workflow-pattern entities into templates
    const templates: WorkflowTemplate[] = [];
    for (const entity of patterns) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(entity.description);
      } catch {
        // description is not JSON; skip or use raw
      }

      templates.push({
        name: (parsed.name as string) ?? entity.name,
        category: (parsed.category as string) ?? "uncategorized",
        trigger: (parsed.trigger as string) ?? "",
        steps: Array.isArray(parsed.steps) ? (parsed.steps as string[]) : [],
        output: (parsed.output as string) ?? "",
        roiTier: (parsed.roi_tier as string) ?? undefined,
        skillGaps: Array.isArray(parsed.skill_gaps) ? (parsed.skill_gaps as string[]) : undefined,
        description: entity.description,
      });
    }

    // Build category list from RAG category entities
    const categoryMap = new Map<string, TemplateCategory>();

    for (const entity of categories) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(entity.description);
      } catch {
        // not JSON
      }

      const name = (parsed.name as string) ?? entity.name;
      categoryMap.set(name, {
        name,
        count: 0,
        description: (parsed.description as string) ?? undefined,
      });
    }

    // Count templates per category, adding missing categories as needed
    for (const t of templates) {
      const existing = categoryMap.get(t.category);
      if (existing) {
        existing.count += 1;
      } else {
        categoryMap.set(t.category, { name: t.category, count: 1 });
      }
    }

    return NextResponse.json({
      templates,
      categories: Array.from(categoryMap.values()),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/templates]", msg);
    return NextResponse.json({ error: msg, templates: [], categories: [] }, { status: 500 });
  }
}
