import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    return NextResponse.json({
      demos,
      gateStatus,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg, demos: [], gateStatus: { current: 0, required: 5, approved: false } },
      { status: 500 },
    );
  }
}
