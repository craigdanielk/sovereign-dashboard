import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabase();

    // Resolve workspace slug and display name from workspace_id
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, slug, name, color")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const clientSlug = workspace.slug;

    // Fetch tasks for this tenant
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, source, created_at, updated_at")
      .eq("client_slug", clientSlug)
      .order("created_at", { ascending: false });

    if (tasksError) {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    // Fetch comms from v_inbox for this tenant
    const { data: comms, error: commsError } = await supabase
      .from("v_inbox")
      .select("id, platform, subject, body_preview, contact_name, sent_at, status, direction")
      .eq("client_slug", clientSlug)
      .order("sent_at", { ascending: false })
      .limit(20);

    if (commsError) {
      return NextResponse.json({ error: "Failed to fetch comms" }, { status: 500 });
    }

    return NextResponse.json({
      workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name, color: workspace.color },
      tasks: tasks ?? [],
      comms: comms ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
