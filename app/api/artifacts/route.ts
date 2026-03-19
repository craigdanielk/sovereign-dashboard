import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface ArtifactsData {
  artifacts: Array<{
    id: number;
    name: string;
    agent_name: string | null;
    artifact_type: string | null;
    status: string | null;
    verified_by_human: boolean | null;
    summary: string | null;
    vercel_url: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  total: number;
  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<ArtifactsData>("artifacts", async () => {
      const { data, error } = await supabase
        .from("artifacts")
        .select(
          "id, name, agent_name, artifact_type, status, verified_by_human, summary, vercel_url, created_at, updated_at"
        )
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);

      return {
        artifacts: data ?? [],
        total: (data ?? []).length,
        fetchedAt: new Date().toISOString(),
      };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/artifacts]", msg);
    return NextResponse.json({ error: msg, artifacts: [], total: 0 }, { status: 500 });
  }
}
