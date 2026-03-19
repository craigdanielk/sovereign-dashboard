import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface PipelineData {
  capabilities: Array<{
    capability_id: string;
    label: string;
    owned_by: string[];
    proficiency: string;
    market_rate: string;
    time_to_deploy_hrs: number;
    gap_to_close: string | null;
  }>;
  knownGaps: string[];
  pendingGap: Record<string, unknown> | null;
  pipelineStatus: string;
  recentActivity: Array<{
    name: string;
    agent: string | null;
    type: string | null;
    status: string | null;
    verifiedByHuman: boolean | null;
    url: string | null;
    createdAt: string | null;
  }>;
  pendingReviews: Array<{
    id: number;
    name: string;
    agent: string | null;
    type: string | null;
    status: string | null;
    summary: string | null;
    url: string | null;
    createdAt: string | null;
  }>;
  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<PipelineData>("pipeline", async () => {
      // Recent activity: artifacts ordered by created_at DESC
      const { data: recentArtifacts, error: artifactError } = await supabase
        .from("artifacts")
        .select("id, name, agent_name, artifact_type, status, verified_by_human, summary, vercel_url, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(30);

      if (artifactError) throw new Error(artifactError.message);

      // Pending reviews: artifacts not yet verified by human
      const { data: pendingReview, error: reviewError } = await supabase
        .from("artifacts")
        .select("id, name, agent_name, artifact_type, status, summary, vercel_url, created_at")
        .eq("verified_by_human", false)
        .order("created_at", { ascending: false });

      if (reviewError) throw new Error(reviewError.message);

      const rows = recentArtifacts ?? [];

      // Build capabilities from artifact types
      const typeSet = new Map<string, { count: number; agents: Set<string> }>();
      for (const row of rows) {
        const t = row.artifact_type ?? "unknown";
        const existing = typeSet.get(t);
        if (!existing) {
          typeSet.set(t, { count: 1, agents: new Set([row.agent_name ?? "unknown"]) });
        } else {
          existing.count++;
          existing.agents.add(row.agent_name ?? "unknown");
        }
      }

      const capabilities = Array.from(typeSet.entries()).map(([type, info]) => ({
        capability_id: type,
        label: type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        owned_by: Array.from(info.agents),
        proficiency: info.count >= 5 ? "production" : info.count >= 3 ? "near-production" : info.count >= 2 ? "beta" : "prototype",
        market_rate: "",
        time_to_deploy_hrs: 0,
        gap_to_close: null,
      }));

      // Pipeline status summary
      const totalArtifacts = rows.length;
      const pendingCount = (pendingReview ?? []).length;
      const pipelineStatus = `${totalArtifacts} artifacts tracked, ${pendingCount} awaiting human review`;

      return {
        capabilities,
        knownGaps: [] as string[],
        pendingGap: null,
        pipelineStatus,
        recentActivity: rows.slice(0, 10).map((r) => ({
          name: r.name,
          agent: r.agent_name,
          type: r.artifact_type,
          status: r.status,
          verifiedByHuman: r.verified_by_human,
          url: r.vercel_url,
          createdAt: r.created_at,
        })),
        pendingReviews: (pendingReview ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          agent: r.agent_name,
          type: r.artifact_type,
          status: r.status,
          summary: r.summary,
          url: r.vercel_url,
          createdAt: r.created_at,
        })),
        fetchedAt: new Date().toISOString(),
      };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
