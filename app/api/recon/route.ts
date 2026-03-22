import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface ReconData {
  lastRun: string;
  signalsFound: number;
  authStatus: "ok";
  queueDepth: number;
  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<ReconData>("recon", async () => {
      // RECON data: count queued briefs, recent activity
      const { data: queued, error: queuedError } = await supabase
        .from("briefs")
        .select("id", { count: "exact" })
        .eq("status", "QUEUED");

      if (queuedError) throw new Error(queuedError.message);

      // Most recent brief activity
      const { data: recentBriefs, error: recentError } = await supabase
        .from("briefs")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentError) throw new Error(recentError.message);

      // Count artifacts created in last 24h as "signals"
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: signalCount, error: signalError } = await supabase
        .from("artifacts")
        .select("id", { count: "exact" })
        .gte("created_at", oneDayAgo);

      if (signalError) throw new Error(signalError.message);

      return {
        lastRun: recentBriefs?.[0]?.created_at ?? "",
        signalsFound: signalCount ?? 0,
        authStatus: "ok" as const,
        queueDepth: queued?.length ?? 0,
        fetchedAt: new Date().toISOString(),
      };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
