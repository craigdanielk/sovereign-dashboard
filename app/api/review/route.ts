import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: list artifacts needing human review
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("artifacts")
      .select("id, name, agent_name, artifact_type, status, summary, vercel_url, created_at")
      .eq("verified_by_human", false)
      .order("created_at", { ascending: false });

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

// POST: mark an artifact as reviewed
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const artifactId = body?.id;

    if (!artifactId) {
      return NextResponse.json({ error: "Missing artifact id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("artifacts")
      .update({ verified_by_human: true })
      .eq("id", artifactId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, id: artifactId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
