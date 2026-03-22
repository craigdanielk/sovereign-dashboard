import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface DemosData {
  demos: Array<{
    id: number;
    name: string;
    url: string;
    whatItDoes: string;
    problemSolved: string;
    lastUpdated: string | null;
    status: string;
    verifiedByHuman: boolean;
    agent: string;
  }>;
  gateStatus: { current: number; required: number; approved: boolean };
  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<DemosData>("demos", async () => {
      // Query artifacts where artifact_type = 'demo'
      const { data, error } = await supabase
        .from("artifacts")
        .select("id, name, agent_name, status, verified_by_human, summary, vercel_url, created_at, updated_at")
        .eq("artifact_type", "demo")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const rows = data ?? [];

      const demos = rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.vercel_url ?? "",
        whatItDoes: row.summary ?? "",
        problemSolved: "",
        lastUpdated: row.updated_at ?? row.created_at,
        status: row.status ?? "",
        verifiedByHuman: row.verified_by_human ?? false,
        agent: row.agent_name ?? "",
      }));

      // OUTREACH gate: count verified demos toward 5-demo unlock threshold
      const verifiedDemos = rows.filter((r) => r.verified_by_human === true);
      const gateStatus = {
        current: verifiedDemos.length,
        required: 5,
        approved: verifiedDemos.length >= 5,
      };

      return { demos, gateStatus, fetchedAt: new Date().toISOString() };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg, demos: [], gateStatus: { current: 0, required: 5, approved: false } },
      { status: 500 },
    );
  }
}
