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

  return NextResponse.json({ ok: true, artifact_id });
}
