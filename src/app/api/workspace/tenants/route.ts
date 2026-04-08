import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

// System workspaces excluded from the client workspace switcher.
const SYSTEM_SLUGS = ["north-star", "r17", "comms"] as const;

// SELECT id, slug, name FROM workspaces
// WHERE slug NOT IN ('north-star', 'r17', 'comms')
// ORDER BY name
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("workspaces")
      .select("id, slug, name")
      .not("slug", "in", `(${SYSTEM_SLUGS.map((s) => `"${s}"`).join(",")})`)
      .order("name");

    if (error) {
      return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
    }

    return NextResponse.json({ workspaces: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
