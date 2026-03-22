import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: list artifacts needing human review
// Optional query params:
//   ?status=staging  — filter by artifact status (e.g. staging demos)
//   ?type=demo       — filter by artifact_type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const typeFilter = searchParams.get("type");

    let query = supabase
      .from("artifacts")
      .select("id, name, agent_name, artifact_type, status, summary, vercel_url, created_at")
      .eq("verified_by_human", false)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    if (typeFilter) {
      query = query.eq("artifact_type", typeFilter);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({
      items: (data ?? []).map((r) => ({
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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, items: [] }, { status: 500 });
  }
}

// POST: mark an artifact as reviewed / approve a staging demo
// Body: { id: string, action?: "approve" }
//   - Default (no action): marks verified_by_human = true
//   - action=approve: also updates status from "staging" to "deployed"
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const artifactId = body?.id;
    const action = body?.action;

    if (!artifactId) {
      return NextResponse.json({ error: "Missing artifact id" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { verified_by_human: true };

    if (action === "approve") {
      updates.status = "deployed";
    }

    const { error } = await supabase
      .from("artifacts")
      .update(updates)
      .eq("id", artifactId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, id: artifactId, action: action ?? "review" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
