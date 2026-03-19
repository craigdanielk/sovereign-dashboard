import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface SystemData {
  sdmVersion: string;
  totalGaps: number;
  gapCounts: Record<string, number>;
  gaps: Array<unknown>;
  activeJobs: Array<{ status: string; details: string }>;
  sdmLastUpdated: string | null;
  coreInfraComplete: boolean;
  statusCounts: Record<string, number>;
  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<SystemData>("system", async () => {
      // Query briefs for queue counts by status
      const { data: briefs, error } = await supabase
        .from("briefs")
        .select("id, name, status, priority, created_at, claimed_at, completed_at, failure_reason");

      if (error) throw new Error(error.message);

      const rows = briefs ?? [];

      // Count by status
      const statusCounts: Record<string, number> = {
        QUEUED: 0,
        CLAIMED: 0,
        COMPLETED: 0,
        FAILED: 0,
      };

      // Count by priority
      const priorityCounts: Record<string, number> = {
        P0: 0,
        P1: 0,
        P2: 0,
        P3: 0,
      };

      let latestUpdated: string | null = null;

      for (const brief of rows) {
        const s = (brief.status ?? "").toUpperCase();
        if (s in statusCounts) statusCounts[s]++;

        const p = (brief.priority ?? "").toUpperCase();
        if (p in priorityCounts) priorityCounts[p]++;

        // Track most recent activity
        const date = brief.completed_at ?? brief.claimed_at ?? brief.created_at;
        if (date && (!latestUpdated || date > latestUpdated)) {
          latestUpdated = date;
        }
      }

      const totalGaps = statusCounts.QUEUED + statusCounts.CLAIMED; // outstanding work
      const activeJobs = rows
        .filter((b) => (b.status ?? "").toUpperCase() === "CLAIMED")
        .slice(0, 5)
        .map((b) => ({
          status: "active",
          details: `${b.name}${b.failure_reason ? ` — ${b.failure_reason}` : ""}`,
        }));

      return {
        sdmVersion: `${rows.length} briefs`,
        totalGaps,
        gapCounts: priorityCounts,
        gaps: [],
        activeJobs,
        sdmLastUpdated: latestUpdated,
        coreInfraComplete: statusCounts.FAILED === 0 && statusCounts.QUEUED === 0,
        statusCounts,
        fetchedAt: new Date().toISOString(),
      };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
