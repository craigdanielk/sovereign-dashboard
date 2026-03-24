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

  let body: { artifact_id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { artifact_id } = body;
  if (!artifact_id || typeof artifact_id !== "number") {
    return NextResponse.json(
      { error: "artifact_id (number) is required" },
      { status: 400 }
    );
  }

  // 1. Mark artifact as verified
  const { error } = await supabase
    .from("artifacts")
    .update({
      verified_by_human: true,
      verified_at: new Date().toISOString(),
    })
    .eq("id", artifact_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. Fetch artifact details for logging
  const { data: artifact } = await supabase
    .from("artifacts")
    .select("title, brief_name, artifact_type, test_url")
    .eq("id", artifact_id)
    .single();

  // 3. Log approval to system_events
  await supabase.from("system_events").insert({
    event_type: "human_approval",
    source: "morning-review",
    brief_name: artifact?.brief_name || null,
    payload: {
      artifact_id,
      artifact_title: artifact?.title || null,
      artifact_type: artifact?.artifact_type || null,
      test_url: artifact?.test_url || null,
      approved_at: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true, artifact_id });
}
