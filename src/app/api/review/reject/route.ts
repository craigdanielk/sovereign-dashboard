import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  let body: { artifact_id?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { artifact_id, reason } = body;
  if (!artifact_id || typeof artifact_id !== "number") {
    return NextResponse.json(
      { error: "artifact_id (number) is required" },
      { status: 400 }
    );
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json(
      { error: "reason (string) is required" },
      { status: 400 }
    );
  }

  // 1. Mark artifact as failed with rejection reason
  const { error: updateError } = await supabase
    .from("artifacts")
    .update({
      status: "failed",
      notes: reason.trim(),
    })
    .eq("id", artifact_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 2. Look up the artifact to get its brief_name for the new BRIEF
  const { data: artifact } = await supabase
    .from("artifacts")
    .select("title, brief_name, artifact_type")
    .eq("id", artifact_id)
    .single();

  // 3. Log rejection to system_events
  await supabase.from("system_events").insert({
    event_type: "human_rejection",
    source: "morning-review",
    brief_name: artifact?.brief_name || null,
    payload: {
      artifact_id,
      artifact_title: artifact?.title || null,
      artifact_type: artifact?.artifact_type || null,
      rejection_reason: reason.trim(),
      rejected_at: new Date().toISOString(),
    },
  });

  // 4. Auto-create a new P0 BRIEF for the rejection
  const briefName = `fix-rejected-${artifact_id}-${Date.now()}`;
  const { error: insertError } = await supabase.from("briefs").insert({
    name: briefName,
    priority: "P0",
    status: "QUEUED",
    triggered_by: "human-review",
    summary: `Rejected artifact: ${artifact?.title || `#${artifact_id}`} (${artifact?.artifact_type || "unknown"}). Reason: ${reason.trim()}`,
    payload: {
      source: "morning-review",
      rejected_artifact_id: artifact_id,
      original_brief_name: artifact?.brief_name || null,
      rejection_reason: reason.trim(),
    },
  });

  if (insertError) {
    return NextResponse.json(
      {
        ok: true,
        artifact_id,
        brief_created: false,
        brief_error: insertError.message,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({
    ok: true,
    artifact_id,
    brief_created: true,
    brief_name: briefName,
  });
}
