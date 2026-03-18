import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Query briefs where status = 'COMPLETED'
    const { data, error } = await supabase
      .from("briefs")
      .select("id, name, priority, status, summary, completed_at, claimed_by, created_at")
      .eq("status", "COMPLETED")
      .order("completed_at", { ascending: false });

    if (error) throw new Error(error.message);

    const jobs = (data ?? []).map((row) => ({
      name: row.name,
      summary: row.summary ?? "",
      completedAt: row.completed_at ?? "",
      definitionOfDone: [],
      lastUpdated: row.completed_at ?? row.created_at,
      priority: row.priority ?? "",
      claimedBy: row.claimed_by ?? "",
    }));

    return NextResponse.json({ jobs, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, jobs: [] }, { status: 500 });
  }
}
