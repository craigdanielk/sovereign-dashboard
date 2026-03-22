import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface BriefsData {
  briefs: Array<{
    id: number;
    name: string;
    priority: string;
    status: string;
    triggered_by: string | null;
    blocked_by: string[] | null;
    created_at: string;
    claimed_at: string | null;
    completed_at: string | null;
    claimed_by: string | null;
    failure_reason: string | null;
    summary: string | null;
  }>;
  total: number;
  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<BriefsData>("briefs", async () => {
      const { data, error } = await supabase
        .from("briefs")
        .select(
          "id, name, priority, status, triggered_by, blocked_by, created_at, claimed_at, completed_at, claimed_by, failure_reason, summary"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);

      return {
        briefs: data ?? [],
        total: (data ?? []).length,
        fetchedAt: new Date().toISOString(),
      };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/briefs]", msg);
    return NextResponse.json({ error: msg, briefs: [], total: 0 }, { status: 500 });
  }
}
