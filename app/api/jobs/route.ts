import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/rag";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = (await searchEntities(
      "BRIEF COMPLETED",
      "brief",
      30,
    )) as {
      entities?: Array<{
        name: string;
        description: string;
        last_updated: string | null;
        score?: number;
      }>;
    };

    const entities = result?.entities ?? [];

    // Filter to COMPLETED briefs and deduplicate by name
    const seen = new Map<
      string,
      { name: string; description: string; last_updated: string | null }
    >();

    for (const e of entities) {
      const desc = e.description ?? "";
      if (
        !desc.includes('"COMPLETED"') &&
        !desc.includes("COMPLETED") &&
        !desc.includes("status: COMPLETED")
      )
        continue;
      const existing = seen.get(e.name);
      if (
        !existing ||
        (e.last_updated ?? "") > (existing.last_updated ?? "")
      ) {
        seen.set(e.name, e);
      }
    }

    const jobs = Array.from(seen.values()).map((e) => {
      const desc = e.description ?? "";

      // Try to parse JSON brief
      let summary = "";
      let completedAt = "";
      let definitionOfDone: string[] = [];

      try {
        const parsed = JSON.parse(desc);
        summary = parsed.summary ?? "";
        completedAt =
          parsed.completed_at ?? parsed.completed ?? e.last_updated ?? "";
        const dod =
          parsed.node_3_deliverables?.definition_of_done ??
          parsed.node_3?.definition_of_done ??
          [];
        definitionOfDone = Array.isArray(dod)
          ? dod.slice(0, 8)
          : [];
      } catch {
        // Fallback: extract from plain text
        summary = desc.slice(0, 500);
        completedAt = e.last_updated ?? "";
      }

      return {
        name: e.name,
        summary,
        completedAt,
        definitionOfDone,
        lastUpdated: e.last_updated,
      };
    });

    // Sort by completion date, newest first
    jobs.sort(
      (a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
    );

    return NextResponse.json({ jobs, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, jobs: [] }, { status: 500 });
  }
}
